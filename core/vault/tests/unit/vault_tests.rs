use qudag_vault_core::*;
use tempfile::TempDir;

#[cfg(test)]
mod vault_lifecycle_tests {
    use super::*;

    #[test]
    fn test_vault_creation() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let master_password = "TestPassword123!@#";

        let result = Vault::create(vault_path.to_str().unwrap(), master_password);

        assert!(result.is_ok(), "Vault creation should succeed");
        let vault = result.unwrap();

        // Verify vault properties
        assert!(vault_path.exists(), "Vault file should be created");
        assert_eq!(
            vault.list_secrets(None).unwrap().len(),
            0,
            "New vault should have no secrets"
        );
    }

    #[test]
    fn test_vault_open_with_correct_password() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let master_password = "CorrectHorseBatteryStaple";

        // Create vault
        let _vault = Vault::create(vault_path.to_str().unwrap(), master_password).unwrap();
        drop(_vault); // Close vault

        // Open vault
        let result = Vault::open(vault_path.to_str().unwrap(), master_password);
        assert!(
            result.is_ok(),
            "Opening vault with correct password should succeed"
        );
    }

    #[test]
    fn test_vault_open_with_incorrect_password() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let master_password = "CorrectPassword";
        let wrong_password = "WrongPassword";

        // Create vault
        let _vault = Vault::create(vault_path.to_str().unwrap(), master_password).unwrap();
        drop(_vault);

        // Try to open with wrong password
        let result = Vault::open(vault_path.to_str().unwrap(), wrong_password);
        assert!(
            result.is_err(),
            "Opening vault with incorrect password should fail"
        );

        match result {
            Err(VaultError::InvalidPassword) => (),
            Err(other) => panic!("Expected InvalidPassword, got {:?}", other),
            Ok(_) => unreachable!(),
        }
    }

    #[test]
    fn test_vault_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let master_password = "PersistenceTest123";

        // Create vault and add secrets
        {
            let mut vault = Vault::create(vault_path.to_str().unwrap(), master_password).unwrap();
            vault
                .add_secret("test/email", "user@example.com", Some("password123"))
                .unwrap();
            vault.add_secret("test/github", "testuser", None).unwrap(); // Auto-generate password
        }

        // Reopen vault and verify secrets
        {
            let vault = Vault::open(vault_path.to_str().unwrap(), master_password).unwrap();
            // Two secrets plus the implicit "test" category node
            let labels = vault.list_secrets(None).unwrap();
            assert_eq!(
                labels.len(),
                3,
                "Vault should have 2 secrets after reopening"
            );
            assert!(labels.contains(&"test/email".to_string()));
            assert!(labels.contains(&"test/github".to_string()));

            let email_secret = vault.get_secret("test/email").unwrap();
            assert_eq!(email_secret.username, "user@example.com");
            assert_eq!(email_secret.password.as_str(), "password123");

            let github_secret = vault.get_secret("test/github").unwrap();
            assert_eq!(github_secret.username, "testuser");
            assert!(
                !github_secret.password.as_str().is_empty(),
                "Auto-generated password should not be empty"
            );
        }
    }
}

#[cfg(test)]
mod secret_management_tests {
    use super::*;

    #[test]
    fn test_add_and_retrieve_secret() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let mut vault = Vault::create(vault_path.to_str().unwrap(), "TestPassword").unwrap();

        // Add secret
        let result = vault.add_secret("email/personal", "alice@example.com", Some("SecurePass123"));
        assert!(result.is_ok(), "Adding secret should succeed");

        // Retrieve secret
        let secret = vault.get_secret("email/personal").unwrap();
        assert_eq!(secret.label, "email/personal");
        assert_eq!(secret.username, "alice@example.com");
        assert_eq!(secret.password.as_str(), "SecurePass123");
    }

    #[test]
    fn test_add_secret_with_generated_password() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let mut vault = Vault::create(vault_path.to_str().unwrap(), "TestPassword").unwrap();

        // Add secret without password (should generate)
        let result = vault.add_secret("server/production", "admin", None);
        assert!(
            result.is_ok(),
            "Adding secret with generated password should succeed"
        );

        // Retrieve and verify generated password
        let secret = vault.get_secret("server/production").unwrap();
        assert_eq!(secret.username, "admin");
        assert!(
            secret.password.as_str().len() >= 16,
            "Generated password should be at least 16 chars"
        );
        assert!(
            has_uppercase(secret.password.as_str()),
            "Generated password should have uppercase"
        );
        assert!(
            has_lowercase(secret.password.as_str()),
            "Generated password should have lowercase"
        );
        assert!(
            has_digit(secret.password.as_str()),
            "Generated password should have digits"
        );
        assert!(
            has_special(secret.password.as_str()),
            "Generated password should have special chars"
        );
    }

    #[test]
    fn test_update_existing_secret() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let mut vault = Vault::create(vault_path.to_str().unwrap(), "TestPassword").unwrap();

        // Add initial secret
        vault
            .add_secret("api/service", "api_user", Some("OldPassword"))
            .unwrap();

        // Update secret
        let result = vault.update_secret("api/service", Some("api_user"), Some("NewPassword"));
        assert!(result.is_ok(), "Updating secret should succeed");

        // Verify update
        let secret = vault.get_secret("api/service").unwrap();
        assert_eq!(secret.password.as_str(), "NewPassword");
    }

    #[test]
    fn test_delete_secret() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let mut vault = Vault::create(vault_path.to_str().unwrap(), "TestPassword").unwrap();

        // Add and then delete secret
        vault
            .add_secret("temp/secret", "temp_user", Some("TempPass"))
            .unwrap();
        let temp_label = "temp/secret".to_string();
        assert!(vault.list_secrets(None).unwrap().contains(&temp_label));

        let result = vault.delete_secret("temp/secret");
        assert!(result.is_ok(), "Deleting secret should succeed");
        assert!(!vault.list_secrets(None).unwrap().contains(&temp_label));

        // Try to retrieve deleted secret
        let result = vault.get_secret("temp/secret");
        assert!(result.is_err(), "Getting deleted secret should fail");
    }

    #[test]
    fn test_list_secrets() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");
        let mut vault = Vault::create(vault_path.to_str().unwrap(), "TestPassword").unwrap();

        // Add multiple secrets
        vault
            .add_secret("email/work", "work@company.com", Some("WorkPass"))
            .unwrap();
        vault
            .add_secret("email/personal", "me@personal.com", Some("PersonalPass"))
            .unwrap();
        vault
            .add_secret("social/twitter", "@handle", Some("TwitterPass"))
            .unwrap();
        vault
            .add_secret("social/linkedin", "profile", Some("LinkedInPass"))
            .unwrap();

        // List all secrets (plus the implicit "email" and "social" category nodes)
        let all_secrets = vault.list_secrets(None).unwrap();
        assert_eq!(all_secrets.len(), 6);
        assert!(all_secrets.contains(&"email/work".to_string()));
        assert!(all_secrets.contains(&"email/personal".to_string()));
        assert!(all_secrets.contains(&"social/twitter".to_string()));
        assert!(all_secrets.contains(&"social/linkedin".to_string()));

        // List by category
        let email_secrets = vault.list_secrets(Some("email")).unwrap();
        assert_eq!(email_secrets.len(), 2);
        assert!(email_secrets.contains(&"email/work".to_string()));
        assert!(email_secrets.contains(&"email/personal".to_string()));

        let social_secrets = vault.list_secrets(Some("social")).unwrap();
        assert_eq!(social_secrets.len(), 2);
        assert!(social_secrets.contains(&"social/twitter".to_string()));
        assert!(social_secrets.contains(&"social/linkedin".to_string()));
    }
}

// Helper functions for password validation
fn has_uppercase(s: &str) -> bool {
    s.chars().any(|c| c.is_uppercase())
}

fn has_lowercase(s: &str) -> bool {
    s.chars().any(|c| c.is_lowercase())
}

fn has_digit(s: &str) -> bool {
    s.chars().any(|c| c.is_numeric())
}

fn has_special(s: &str) -> bool {
    s.chars().any(|c| !c.is_alphanumeric())
}
