// src/crypto/operations.rs
// Real cryptographic operations using QuDAG crypto libraries

use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use qudag_crypto::{
    MlDsaKeyPair, MlDsa65, MlDsa87, SigningKey, VerifyingKey,
    MlKem768, MlKem1024, EncapsulationKey, DecapsulationKey,
    HybridQuantumCrypto, QuantumFingerprint, SecureHash,
    RandomGenerator, CryptoRng,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use chrono::Utc;

use super::{Algorithm, CryptoError, KeyMetadata, VaultManager};

/// Key pair structure holding real crypto keys
#[derive(Clone)]
pub struct KeyPair {
    pub id: String,
    pub algorithm: Algorithm,
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
    pub created_at: String,
    pub metadata: KeyMetadata,
}

/// Signature result
#[derive(Debug, Serialize, Deserialize)]
pub struct SignatureResult {
    pub signature: String,
    pub algorithm: String,
    pub key_id: String,
    pub timestamp: String,
}

/// Encryption result
#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub ciphertext: String,
    pub encapsulated_key: String,
    pub algorithm: String,
    pub recipient: String,
}

/// Real crypto operations implementation
pub struct CryptoOperations {
    keys: Arc<Mutex<HashMap<String, KeyPair>>>,
    vault: Arc<Mutex<VaultManager>>,
    fingerprints: Arc<Mutex<HashMap<String, String>>>,
}

impl CryptoOperations {
    pub fn new(
        keys: Arc<Mutex<HashMap<String, KeyPair>>>,
        vault: Arc<Mutex<VaultManager>>,
        fingerprints: Arc<Mutex<HashMap<String, String>>>,
    ) -> Self {
        Self { keys, vault, fingerprints }
    }
    
    /// Generate real quantum-resistant key pair
    pub async fn generate_keys(&self, algorithm: &str) -> Result<KeyPair> {
        let algo = match algorithm {
            "ml-dsa" | "ml-dsa-65" => Algorithm::MlDsa,
            "ml-kem" | "ml-kem-768" => Algorithm::MlKem,
            "hqc" => Algorithm::Hqc,
            _ => return Err(anyhow!(CryptoError::InvalidAlgorithm(algorithm.to_string()))),
        };
        
        let id = format!("key_{}", uuid::Uuid::new_v4());
        let created_at = Utc::now().to_rfc3339();
        
        let (public_key, private_key) = match algo {
            Algorithm::MlDsa => {
                // Generate real ML-DSA key pair
                let keypair = MlDsa65::generate(&mut CryptoRng)?;
                let public = keypair.verifying_key().to_bytes().to_vec();
                let private = keypair.signing_key().to_bytes().to_vec();
                (public, private)
            },
            Algorithm::MlKem => {
                // Generate real ML-KEM key pair
                let (encaps_key, decaps_key) = MlKem768::generate(&mut CryptoRng)?;
                let public = encaps_key.to_bytes().to_vec();
                let private = decaps_key.to_bytes().to_vec();
                (public, private)
            },
            Algorithm::Hqc => {
                // Generate hybrid quantum crypto keys
                let hqc = HybridQuantumCrypto::new()?;
                let (public, private) = hqc.generate_keypair(&mut CryptoRng)?;
                (public.to_vec(), private.to_vec())
            },
        };
        
        // Create quantum fingerprint
        let fingerprint = QuantumFingerprint::create(&public_key)?;
        let fingerprint_str = BASE64.encode(fingerprint.as_bytes());
        
        // Store fingerprint
        self.fingerprints.lock().unwrap().insert(id.clone(), fingerprint_str.clone());
        
        let metadata = KeyMetadata {
            id: id.clone(),
            algorithm: algo.clone(),
            created_at: created_at.clone(),
            fingerprint: fingerprint_str,
            vault_id: None,
        };
        
        let keypair = KeyPair {
            id: id.clone(),
            algorithm: algo,
            public_key,
            private_key,
            created_at,
            metadata,
        };
        
        // Store in memory
        self.keys.lock().unwrap().insert(id.clone(), keypair.clone());
        
        // Optionally store in vault
        if let Ok(mut vault) = self.vault.lock() {
            vault.store_key(&id, &keypair).await?;
        }
        
        info!("Generated {} key pair: {}", algorithm, id);
        Ok(keypair)
    }
    
    /// Sign data with real ML-DSA signature
    pub async fn sign_data(&self, data: &[u8], key_id: &str) -> Result<SignatureResult> {
        let keys = self.keys.lock().unwrap();
        let keypair = keys.get(key_id)
            .ok_or_else(|| anyhow!(CryptoError::KeyNotFound(key_id.to_string())))?;
        
        match &keypair.algorithm {
            Algorithm::MlDsa => {
                // Create real ML-DSA signature
                let signing_key = MlDsa65::signing_key_from_bytes(&keypair.private_key)?;
                let signature = signing_key.sign(data);
                
                Ok(SignatureResult {
                    signature: BASE64.encode(signature.to_bytes()),
                    algorithm: "ml-dsa-65".to_string(),
                    key_id: key_id.to_string(),
                    timestamp: Utc::now().to_rfc3339(),
                })
            },
            _ => Err(anyhow!("Key {} is not a signing key", key_id)),
        }
    }
    
    /// Verify ML-DSA signature
    pub async fn verify_signature(
        &self, 
        signature: &str, 
        data: &[u8], 
        public_key: &[u8]
    ) -> Result<bool> {
        let sig_bytes = BASE64.decode(signature)?;
        
        // Verify with ML-DSA
        let verifying_key = MlDsa65::verifying_key_from_bytes(public_key)?;
        Ok(verifying_key.verify(data, &sig_bytes).is_ok())
    }
    
    /// Encrypt data with real ML-KEM
    pub async fn encrypt_data(
        &self, 
        data: &[u8], 
        recipient_key: &[u8]
    ) -> Result<EncryptionResult> {
        // Use ML-KEM for key encapsulation
        let encaps_key = MlKem768::encapsulation_key_from_bytes(recipient_key)?;
        let (ciphertext, shared_secret) = encaps_key.encapsulate(&mut CryptoRng)?;
        
        // Derive encryption key from shared secret
        let encryption_key = SecureHash::derive_key(&shared_secret, b"encryption", 32)?;
        
        // Encrypt data with derived key (using AES-256-GCM via HybridQuantumCrypto)
        let hqc = HybridQuantumCrypto::new()?;
        let encrypted = hqc.encrypt_with_key(data, &encryption_key)?;
        
        Ok(EncryptionResult {
            ciphertext: BASE64.encode(&encrypted),
            encapsulated_key: BASE64.encode(&ciphertext),
            algorithm: "ml-kem-768".to_string(),
            recipient: BASE64.encode(&recipient_key[..32]), // First 32 bytes as ID
        })
    }
    
    /// Decrypt data with real ML-KEM
    pub async fn decrypt_data(
        &self,
        ciphertext: &str,
        encapsulated_key: &str,
        key_id: &str
    ) -> Result<Vec<u8>> {
        let keys = self.keys.lock().unwrap();
        let keypair = keys.get(key_id)
            .ok_or_else(|| anyhow!(CryptoError::KeyNotFound(key_id.to_string())))?;
        
        match &keypair.algorithm {
            Algorithm::MlKem => {
                let ct_bytes = BASE64.decode(ciphertext)?;
                let encaps_bytes = BASE64.decode(encapsulated_key)?;
                
                // Decapsulate to get shared secret
                let decaps_key = MlKem768::decapsulation_key_from_bytes(&keypair.private_key)?;
                let shared_secret = decaps_key.decapsulate(&encaps_bytes)?;
                
                // Derive decryption key
                let decryption_key = SecureHash::derive_key(&shared_secret, b"encryption", 32)?;
                
                // Decrypt data
                let hqc = HybridQuantumCrypto::new()?;
                Ok(hqc.decrypt_with_key(&ct_bytes, &decryption_key)?)
            },
            _ => Err(anyhow!("Key {} is not an encryption key", key_id)),
        }
    }
    
    /// Create quantum fingerprint
    pub async fn create_fingerprint(&self, data: &[u8]) -> Result<String> {
        let fingerprint = QuantumFingerprint::create(data)?;
        Ok(BASE64.encode(fingerprint.as_bytes()))
    }
    
    /// Verify quantum fingerprint
    pub async fn verify_fingerprint(&self, fingerprint: &str, data: &[u8]) -> Result<bool> {
        let fp_bytes = BASE64.decode(fingerprint)?;
        let computed = QuantumFingerprint::create(data)?;
        Ok(computed.as_bytes() == fp_bytes)
    }
    
    /// List all keys
    pub async fn list_keys(&self) -> Result<Vec<KeyMetadata>> {
        let keys = self.keys.lock().unwrap();
        Ok(keys.values().map(|k| k.metadata.clone()).collect())
    }
    
    /// Export public key
    pub async fn export_key(&self, key_id: &str, format: &str) -> Result<String> {
        let keys = self.keys.lock().unwrap();
        let keypair = keys.get(key_id)
            .ok_or_else(|| anyhow!(CryptoError::KeyNotFound(key_id.to_string())))?;
        
        match format {
            "pem" => {
                // Export as PEM format
                let pem = format!(
                    "-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----",
                    BASE64.encode(&keypair.public_key)
                );
                Ok(pem)
            },
            "jwk" => {
                // Export as JWK format
                let jwk = serde_json::json!({
                    "kty": match keypair.algorithm {
                        Algorithm::MlDsa => "ML-DSA",
                        Algorithm::MlKem => "ML-KEM",
                        Algorithm::Hqc => "HQC",
                    },
                    "kid": key_id,
                    "x": BASE64.encode(&keypair.public_key),
                    "alg": format!("{:?}", keypair.algorithm),
                    "use": match keypair.algorithm {
                        Algorithm::MlDsa => "sig",
                        Algorithm::MlKem | Algorithm::Hqc => "enc",
                    }
                });
                Ok(serde_json::to_string_pretty(&jwk)?)
            },
            _ => Ok(BASE64.encode(&keypair.public_key)),
        }
    }
    
    /// Import key from data
    pub async fn import_key(&self, key_data: &str, algorithm: &str) -> Result<String> {
        // Parse key data (support PEM and raw base64)
        let key_bytes = if key_data.starts_with("-----BEGIN") {
            // PEM format
            let lines: Vec<&str> = key_data.lines()
                .filter(|l| !l.starts_with("-----"))
                .collect();
            BASE64.decode(lines.join(""))?
        } else {
            // Raw base64
            BASE64.decode(key_data)?
        };
        
        let algo = match algorithm {
            "ml-dsa" => Algorithm::MlDsa,
            "ml-kem" => Algorithm::MlKem,
            "hqc" => Algorithm::Hqc,
            _ => return Err(anyhow!(CryptoError::InvalidAlgorithm(algorithm.to_string()))),
        };
        
        // Create fingerprint
        let fingerprint = QuantumFingerprint::create(&key_bytes)?;
        let fingerprint_str = BASE64.encode(fingerprint.as_bytes());
        
        let id = format!("imported_{}", uuid::Uuid::new_v4());
        let metadata = KeyMetadata {
            id: id.clone(),
            algorithm: algo.clone(),
            created_at: Utc::now().to_rfc3339(),
            fingerprint: fingerprint_str.clone(),
            vault_id: None,
        };
        
        // Store as public key only (imported keys)
        let keypair = KeyPair {
            id: id.clone(),
            algorithm: algo,
            public_key: key_bytes,
            private_key: vec![], // No private key for imported keys
            created_at: metadata.created_at.clone(),
            metadata,
        };
        
        self.keys.lock().unwrap().insert(id.clone(), keypair);
        self.fingerprints.lock().unwrap().insert(id.clone(), fingerprint_str);
        
        info!("Imported {} public key: {}", algorithm, id);
        Ok(id)
    }
}

// External crate dependencies
use uuid;
use log::info;