// src/crypto/vault.rs
// Integration with QuDAG vault for secure key storage

use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use qudag_vault_core::{
    Vault, VaultConfig, Secret, SecretType, SecretMetadata,
    EncryptionConfig, AccessControl, Permission,
    StorageBackend, FileStorage, MemoryStorage,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use chrono::Utc;

use super::{KeyPair, Algorithm, CryptoError};

/// Vault entry for storing keys
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    pub id: String,
    pub name: String,
    pub entry_type: String,
    pub algorithm: String,
    pub created_at: String,
    pub last_accessed: String,
    pub metadata: HashMap<String, String>,
}

/// Vault manager for secure key storage
pub struct VaultManager {
    vault: Vault,
    entries: HashMap<String, VaultEntry>,
    vault_path: PathBuf,
}

impl VaultManager {
    /// Create new vault manager
    pub fn new() -> Result<Self> {
        let vault_path = PathBuf::from("./qudag-vault");
        std::fs::create_dir_all(&vault_path)?;
        
        // Configure vault with quantum-resistant encryption
        let config = VaultConfig {
            name: "qudag-mcp-vault".to_string(),
            description: "QuDAG MCP key storage vault".to_string(),
            encryption: EncryptionConfig {
                algorithm: "ML-KEM-768".to_string(),
                key_derivation: "Argon2id".to_string(),
                iterations: 3,
                memory_cost: 65536,
                parallelism: 4,
            },
            storage: StorageBackend::File(FileStorage::new(vault_path.clone())?),
            access_control: AccessControl::default(),
        };
        
        let vault = Vault::new(config)?;
        
        Ok(Self {
            vault,
            entries: HashMap::new(),
            vault_path,
        })
    }
    
    /// Initialize vault (create or unlock)
    pub async fn initialize(&mut self) -> Result<()> {
        // Check if vault exists
        let vault_file = self.vault_path.join("vault.db");
        if vault_file.exists() {
            // Vault exists, load it
            info!("Loading existing vault from {:?}", vault_file);
            self.vault.load()?;
        } else {
            // Create new vault with master password
            info!("Creating new vault at {:?}", vault_file);
            let master_password = std::env::var("QUDAG_VAULT_PASSWORD")
                .unwrap_or_else(|_| "qudag-testnet-default-password".to_string());
            self.vault.create(&master_password)?;
        }
        
        // Load entries index
        self.load_entries()?;
        
        info!("Vault initialized with {} entries", self.entries.len());
        Ok(())
    }
    
    /// Store key in vault
    pub async fn store_key(&mut self, key_id: &str, keypair: &KeyPair) -> Result<()> {
        // Create secret for private key
        let secret = Secret {
            id: key_id.to_string(),
            secret_type: SecretType::PrivateKey,
            data: keypair.private_key.clone(),
            metadata: SecretMetadata {
                name: format!("{} private key", keypair.algorithm.as_str()),
                algorithm: keypair.algorithm.as_str().to_string(),
                created_at: Utc::now().timestamp(),
                expires_at: None,
                tags: vec!["quantum-safe".to_string(), "mcp".to_string()],
                custom: HashMap::new(),
            },
        };
        
        // Store in vault
        self.vault.store_secret(secret)?;
        
        // Create vault entry
        let entry = VaultEntry {
            id: key_id.to_string(),
            name: format!("Key {}", key_id),
            entry_type: "private_key".to_string(),
            algorithm: keypair.algorithm.as_str().to_string(),
            created_at: keypair.created_at.clone(),
            last_accessed: Utc::now().to_rfc3339(),
            metadata: HashMap::from([
                ("fingerprint".to_string(), keypair.metadata.fingerprint.clone()),
                ("public_key".to_string(), BASE64.encode(&keypair.public_key)),
            ]),
        };
        
        self.entries.insert(key_id.to_string(), entry);
        self.save_entries()?;
        
        info!("Stored key {} in vault", key_id);
        Ok(())
    }
    
    /// Retrieve key from vault
    pub async fn retrieve_key(&mut self, key_id: &str) -> Result<Vec<u8>> {
        // Get secret from vault
        let secret = self.vault.get_secret(key_id)?
            .ok_or_else(|| anyhow!(CryptoError::KeyNotFound(key_id.to_string())))?;
        
        // Update last accessed time
        if let Some(entry) = self.entries.get_mut(key_id) {
            entry.last_accessed = Utc::now().to_rfc3339();
            self.save_entries()?;
        }
        
        Ok(secret.data)
    }
    
    /// Create new vault with specific name
    pub async fn create_vault(&mut self, name: &str) -> Result<String> {
        let vault_id = format!("vault_{}", uuid::Uuid::new_v4());
        let vault_path = self.vault_path.join(name);
        std::fs::create_dir_all(&vault_path)?;
        
        // Create sub-vault configuration
        let config = VaultConfig {
            name: name.to_string(),
            description: format!("QuDAG vault: {}", name),
            encryption: EncryptionConfig {
                algorithm: "ML-KEM-1024".to_string(), // Stronger encryption for user vaults
                key_derivation: "Argon2id".to_string(),
                iterations: 4,
                memory_cost: 131072,
                parallelism: 8,
            },
            storage: StorageBackend::File(FileStorage::new(vault_path)?),
            access_control: AccessControl::default(),
        };
        
        // Create sub-vault
        let sub_vault = Vault::new(config)?;
        
        // Store vault metadata
        let entry = VaultEntry {
            id: vault_id.clone(),
            name: name.to_string(),
            entry_type: "vault".to_string(),
            algorithm: "ML-KEM-1024".to_string(),
            created_at: Utc::now().to_rfc3339(),
            last_accessed: Utc::now().to_rfc3339(),
            metadata: HashMap::new(),
        };
        
        self.entries.insert(vault_id.clone(), entry);
        self.save_entries()?;
        
        info!("Created vault '{}' with ID: {}", name, vault_id);
        Ok(vault_id)
    }
    
    /// Unlock vault for operations
    pub async fn unlock_vault(&mut self, name: &str, password: &str) -> Result<()> {
        // Find vault by name
        let vault_entry = self.entries.values()
            .find(|e| e.name == name && e.entry_type == "vault")
            .ok_or_else(|| anyhow!("Vault '{}' not found", name))?;
        
        // Load and unlock the vault
        let vault_path = self.vault_path.join(name);
        let mut sub_vault = Vault::new(VaultConfig {
            name: name.to_string(),
            description: format!("QuDAG vault: {}", name),
            encryption: EncryptionConfig::default(),
            storage: StorageBackend::File(FileStorage::new(vault_path)?),
            access_control: AccessControl::default(),
        })?;
        
        sub_vault.unlock(password)?;
        
        // Update last accessed
        if let Some(entry) = self.entries.get_mut(&vault_entry.id) {
            entry.last_accessed = Utc::now().to_rfc3339();
            self.save_entries()?;
        }
        
        info!("Unlocked vault '{}'", name);
        Ok(())
    }
    
    /// List all vault entries
    pub async fn list_entries(&self) -> Result<Vec<VaultEntry>> {
        Ok(self.entries.values().cloned().collect())
    }
    
    /// Delete key from vault
    pub async fn delete_key(&mut self, key_id: &str) -> Result<()> {
        // Remove from vault
        self.vault.delete_secret(key_id)?;
        
        // Remove from entries
        self.entries.remove(key_id);
        self.save_entries()?;
        
        info!("Deleted key {} from vault", key_id);
        Ok(())
    }
    
    /// Lock all vaults
    pub async fn lock_all(&mut self) -> Result<()> {
        self.vault.lock()?;
        info!("All vaults locked");
        Ok(())
    }
    
    /// Load entries index
    fn load_entries(&mut self) -> Result<()> {
        let entries_file = self.vault_path.join("entries.json");
        if entries_file.exists() {
            let data = std::fs::read_to_string(&entries_file)?;
            self.entries = serde_json::from_str(&data)?;
        }
        Ok(())
    }
    
    /// Save entries index
    fn save_entries(&self) -> Result<()> {
        let entries_file = self.vault_path.join("entries.json");
        let data = serde_json::to_string_pretty(&self.entries)?;
        std::fs::write(entries_file, data)?;
        Ok(())
    }
}

impl Algorithm {
    fn as_str(&self) -> &str {
        match self {
            Algorithm::MlDsa => "ml-dsa",
            Algorithm::MlKem => "ml-kem",
            Algorithm::Hqc => "hqc",
        }
    }
}

// External crate dependencies
use uuid;
use log::info;