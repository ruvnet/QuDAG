use qudag_vault_core::*;
use std::sync::Arc;
use std::time::Duration;
use tempfile::TempDir;
use tokio::sync::RwLock;

#[cfg(test)]
mod performance_tests {
    use super::*;
    use std::time::Instant;

    #[tokio::test]
    async fn test_vault_concurrent_operations() {
        let temp_dir = TempDir::new().unwrap();
        let vault_path = temp_dir.path().join("test_vault.qdag");

        let vault = Arc::new(RwLock::new(
            Vault::create(vault_path.to_str().unwrap(), "TestPassword").unwrap(),
        ));

        // Spawn multiple concurrent tasks
        let mut handles = vec![];

        for i in 0..10 {
            let vault_clone = vault.clone();
            let handle = tokio::spawn(async move {
                let mut vault = vault_clone.write().await;
                for j in 0..100 {
                    vault
                        .add_secret(
                            &format!("concurrent/secret_{}_{}", i, j),
                            &format!("user_{}", i),
                            Some(&format!("pass_{}", j)),
                        )
                        .unwrap();
                }
            });
            handles.push(handle);
        }

        // Wait for all tasks
        let start = Instant::now();
        for handle in handles {
            handle.await.unwrap();
        }
        let duration = start.elapsed();

        // Verify all secrets were added
        let vault = vault.read().await;
        // Count only the secrets (the listing also holds the "concurrent" category node)
        let secret_count = vault
            .list_secrets(None)
            .unwrap()
            .iter()
            .filter(|label| label.starts_with("concurrent/secret_"))
            .count();
        assert_eq!(secret_count, 1000, "Should have 1000 secrets");

        // Performance check. The budget is for optimized builds; an unoptimized
        // debug build spends its time in unoptimized serialization and AES code,
        // so its wall-clock time says nothing about the vault.
        println!("Added 1000 secrets concurrently in {:?}", duration);
        assert!(
            cfg!(debug_assertions) || duration < Duration::from_secs(5),
            "Concurrent operations too slow: {:?}",
            duration
        );
    }
}
