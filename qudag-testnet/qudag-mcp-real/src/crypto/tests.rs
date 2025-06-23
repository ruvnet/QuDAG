// src/crypto/tests.rs
// Tests for real crypto operations

#[cfg(test)]
mod tests {
    use super::super::*;
    use tokio;
    
    #[tokio::test]
    async fn test_ml_dsa_key_generation() {
        let state = CryptoState::new().unwrap();
        let ops = state.operations();
        
        // Generate ML-DSA key pair
        let keypair = ops.generate_keys("ml-dsa").await.unwrap();
        
        assert_eq!(keypair.algorithm, Algorithm::MlDsa);
        assert!(!keypair.public_key.is_empty());
        assert!(!keypair.private_key.is_empty());
        assert!(!keypair.metadata.fingerprint.is_empty());
    }
    
    #[tokio::test]
    async fn test_ml_dsa_sign_verify() {
        let state = CryptoState::new().unwrap();
        let ops = state.operations();
        
        // Generate key pair
        let keypair = ops.generate_keys("ml-dsa").await.unwrap();
        
        // Sign message
        let message = b"Hello, QuDAG with quantum-resistant signatures!";
        let signature = ops.sign_data(message, &keypair.id).await.unwrap();
        
        // Verify signature
        let valid = ops.verify_signature(
            &signature.signature,
            message,
            &keypair.public_key
        ).await.unwrap();
        
        assert!(valid);
        
        // Verify with wrong message should fail
        let wrong_message = b"Wrong message";
        let invalid = ops.verify_signature(
            &signature.signature,
            wrong_message,
            &keypair.public_key
        ).await.unwrap();
        
        assert!(!invalid);
    }
    
    #[tokio::test]
    async fn test_ml_kem_encrypt_decrypt() {
        let state = CryptoState::new().unwrap();
        let ops = state.operations();
        
        // Generate ML-KEM key pair
        let keypair = ops.generate_keys("ml-kem").await.unwrap();
        
        // Encrypt data
        let plaintext = b"Secret quantum-safe message";
        let encrypted = ops.encrypt_data(
            plaintext,
            &keypair.public_key
        ).await.unwrap();
        
        // Decrypt data
        let decrypted = ops.decrypt_data(
            &encrypted.ciphertext,
            &encrypted.encapsulated_key,
            &keypair.id
        ).await.unwrap();
        
        assert_eq!(plaintext.to_vec(), decrypted);
    }
    
    #[tokio::test]
    async fn test_quantum_fingerprint() {
        let state = CryptoState::new().unwrap();
        let ops = state.operations();
        
        // Create fingerprint
        let data = b"Quantum fingerprint test data";
        let fingerprint = ops.create_fingerprint(data).await.unwrap();
        
        // Verify fingerprint
        let valid = ops.verify_fingerprint(&fingerprint, data).await.unwrap();
        assert!(valid);
        
        // Different data should have different fingerprint
        let other_data = b"Different data";
        let invalid = ops.verify_fingerprint(&fingerprint, other_data).await.unwrap();
        assert!(!invalid);
    }
    
    #[tokio::test]
    async fn test_vault_operations() {
        let mut state = CryptoState::new().unwrap();
        state.initialize().await.unwrap();
        
        let ops = state.operations();
        
        // Generate key and store in vault
        let keypair = ops.generate_keys("ml-dsa").await.unwrap();
        
        // Create a vault
        let mut vault = state.vault.lock().unwrap();
        let vault_id = vault.create_vault("test-vault").await.unwrap();
        
        // List vault entries
        let entries = vault.list_entries().await.unwrap();
        assert!(entries.iter().any(|e| e.name == "test-vault"));
    }
    
    #[tokio::test]
    async fn test_key_export_import() {
        let state = CryptoState::new().unwrap();
        let ops = state.operations();
        
        // Generate key
        let keypair = ops.generate_keys("ml-dsa").await.unwrap();
        
        // Export key in PEM format
        let pem = ops.export_key(&keypair.id, "pem").await.unwrap();
        assert!(pem.starts_with("-----BEGIN PUBLIC KEY-----"));
        
        // Export key in JWK format
        let jwk = ops.export_key(&keypair.id, "jwk").await.unwrap();
        let jwk_obj: serde_json::Value = serde_json::from_str(&jwk).unwrap();
        assert_eq!(jwk_obj["kty"], "ML-DSA");
        assert_eq!(jwk_obj["use"], "sig");
        
        // Import key
        let imported_id = ops.import_key(&pem, "ml-dsa").await.unwrap();
        assert!(imported_id.starts_with("imported_"));
    }
    
    #[tokio::test]
    async fn test_hybrid_quantum_crypto() {
        let state = CryptoState::new().unwrap();
        let ops = state.operations();
        
        // Generate HQC key pair
        let keypair = ops.generate_keys("hqc").await.unwrap();
        
        assert_eq!(keypair.algorithm, Algorithm::Hqc);
        assert!(!keypair.public_key.is_empty());
        assert!(!keypair.private_key.is_empty());
    }
    
    #[tokio::test]
    async fn test_mcp_tool_handler() {
        let mut state = CryptoState::new().unwrap();
        state.initialize().await.unwrap();
        
        // Test key generation via MCP tool
        let args = serde_json::json!({
            "algorithm": "ml-dsa"
        });
        
        let result = handle_crypto_tool(&state, "qudag_key_generate", args).await.unwrap();
        assert_eq!(result["success"], true);
        assert!(result["key_id"].is_string());
        assert!(result["fingerprint"].is_string());
        
        // Test signing via MCP tool
        let key_id = result["key_id"].as_str().unwrap();
        let sign_args = serde_json::json!({
            "message": "Test message for MCP signing",
            "key_id": key_id
        });
        
        let sign_result = handle_crypto_tool(&state, "qudag_sign", sign_args).await.unwrap();
        assert_eq!(sign_result["success"], true);
        assert!(sign_result["signature"].is_string());
        
        // Test fingerprint via MCP tool
        let fp_args = serde_json::json!({
            "data": "Test data for fingerprinting"
        });
        
        let fp_result = handle_crypto_tool(&state, "qudag_fingerprint_create", fp_args).await.unwrap();
        assert_eq!(fp_result["success"], true);
        assert!(fp_result["fingerprint"].is_string());
    }
}