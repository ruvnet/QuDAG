//! Integration tests for QuDAG vault library.

use qudag_vault_core::{Vault, VaultError};
use tempfile::TempDir;

#[test]
fn test_vault_create_and_operations() {
    // `Vault::create` refuses to overwrite an existing file, so use a fresh path
    let temp_dir = TempDir::new().unwrap();
    let vault_path = temp_dir.path().join("vault.qdag");
    let vault_path = vault_path.as_path();

    // Test vault creation
    let mut vault = Vault::create(vault_path, "test_password").unwrap();

    // Test adding secrets
    vault
        .add_secret("email/work", "user@example.com", Some("password123"))
        .unwrap();
    vault
        .add_secret("social/github", "myusername", None)
        .unwrap(); // Generated password

    // Test listing secrets (the listing includes the implicit "email" and
    // "social" category nodes derived from the labels)
    let secrets = vault.list_secrets(None).unwrap();
    assert_eq!(secrets.len(), 4);
    assert!(secrets.contains(&"email/work".to_string()));
    assert!(secrets.contains(&"social/github".to_string()));

    // Test getting a secret
    let secret = vault.get_secret("email/work").unwrap();
    assert_eq!(secret.username, "user@example.com");
    assert_eq!(secret.password.as_str(), "password123");

    // Test categories
    let email_secrets = vault.list_secrets(Some("email")).unwrap();
    assert_eq!(email_secrets.len(), 1);

    // Drop and reopen vault
    drop(vault);

    let vault = Vault::open(vault_path, "test_password").unwrap();
    let secrets = vault.list_secrets(None).unwrap();
    assert_eq!(secrets.len(), 4);

    // Test wrong password
    let result = Vault::open(vault_path, "wrong_password");
    assert!(matches!(result, Err(VaultError::InvalidPassword)));
}

#[test]
fn test_vault_export_import() {
    let temp_dir = TempDir::new().unwrap();
    let vault1_path = temp_dir.path().join("vault1.qdag");
    let vault2_path = temp_dir.path().join("vault2.qdag");
    let export_path = temp_dir.path().join("export.qdag");

    // Create first vault and add secrets
    let mut vault1 = Vault::create(&vault1_path, "password1").unwrap();
    vault1
        .add_secret("test/secret1", "user1", Some("pass1"))
        .unwrap();
    vault1
        .add_secret("test/secret2", "user2", Some("pass2"))
        .unwrap();

    // Export vault
    vault1.export(&export_path).unwrap();

    // Create second vault and import
    let mut vault2 = Vault::create(&vault2_path, "password2").unwrap();
    vault2.import(&export_path, "password1").unwrap();

    // Verify imported secrets (plus the implicit "test" category node)
    let secrets = vault2.list_secrets(None).unwrap();
    assert_eq!(secrets.len(), 3);
    assert!(secrets.contains(&"test/secret1".to_string()));
    assert!(secrets.contains(&"test/secret2".to_string()));

    let secret = vault2.get_secret("test/secret1").unwrap();
    assert_eq!(secret.username, "user1");
}

#[test]
fn test_vault_password_generation() {
    use qudag_vault_core::utils::CharacterSet;

    let temp_dir = TempDir::new().unwrap();
    let vault = Vault::create(temp_dir.path().join("vault.qdag"), "test_password").unwrap();

    // Test different character sets
    let pass1 = vault.generate_password(16, CharacterSet::Alphanumeric);
    assert_eq!(pass1.len(), 16);
    assert!(pass1.chars().all(|c| c.is_alphanumeric()));

    let pass2 = vault.generate_password(20, CharacterSet::All);
    assert_eq!(pass2.len(), 20);

    // Passwords should be different
    assert_ne!(
        pass1,
        vault.generate_password(16, CharacterSet::Alphanumeric)
    );
}
