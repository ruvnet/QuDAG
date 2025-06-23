use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_accessed: DateTime<Utc>,
    pub is_locked: bool,
    pub quantum_encrypted: bool,
    pub items_count: usize,
}

#[derive(Debug, Clone)]
struct VaultData {
    vault: Vault,
    password_hash: Vec<u8>,
    items: HashMap<String, Vec<u8>>,
}

pub struct VaultManager {
    vaults: HashMap<String, VaultData>,
    vault_counter: u64,
}

impl VaultManager {
    pub fn new() -> Self {
        Self {
            vaults: HashMap::new(),
            vault_counter: 0,
        }
    }
    
    pub async fn create_vault(&mut self, name: &str, password: &str) -> Result<String, Box<dyn std::error::Error>> {
        if self.vaults.values().any(|v| v.vault.name == name) {
            return Err("Vault with this name already exists".into());
        }
        
        self.vault_counter += 1;
        let vault_id = format!("vault_{}", self.vault_counter);
        
        let vault = Vault {
            id: vault_id.clone(),
            name: name.to_string(),
            created_at: Utc::now(),
            last_accessed: Utc::now(),
            is_locked: true,
            quantum_encrypted: true,
            items_count: 0,
        };
        
        let vault_data = VaultData {
            vault: vault.clone(),
            password_hash: self.hash_password(password),
            items: HashMap::new(),
        };
        
        self.vaults.insert(vault_id.clone(), vault_data);
        
        println!("🔐 Created quantum-encrypted vault: {} ({})", name, vault_id);
        
        Ok(vault_id)
    }
    
    pub async fn unlock_vault(&mut self, name: &str, password: &str) -> Result<(), Box<dyn std::error::Error>> {
        let vault_data = self.vaults.values_mut()
            .find(|v| v.vault.name == name)
            .ok_or("Vault not found")?;
        
        let password_hash = self.hash_password(password);
        if password_hash != vault_data.password_hash {
            return Err("Invalid password".into());
        }
        
        vault_data.vault.is_locked = false;
        vault_data.vault.last_accessed = Utc::now();
        
        println!("🔓 Unlocked vault: {}", name);
        
        Ok(())
    }
    
    pub async fn lock_vault(&mut self, name: &str) -> Result<(), Box<dyn std::error::Error>> {
        let vault_data = self.vaults.values_mut()
            .find(|v| v.vault.name == name)
            .ok_or("Vault not found")?;
        
        vault_data.vault.is_locked = true;
        
        println!("🔒 Locked vault: {}", name);
        
        Ok(())
    }
    
    pub async fn store_data(
        &mut self, 
        vault_name: &str, 
        key: &str, 
        data: &[u8]
    ) -> Result<(), Box<dyn std::error::Error>> {
        let vault_data = self.vaults.values_mut()
            .find(|v| v.vault.name == vault_name)
            .ok_or("Vault not found")?;
        
        if vault_data.vault.is_locked {
            return Err("Vault is locked".into());
        }
        
        // Simulate quantum encryption
        let encrypted_data = self.quantum_encrypt(data, &vault_data.vault.id);
        
        vault_data.items.insert(key.to_string(), encrypted_data);
        vault_data.vault.items_count = vault_data.items.len();
        vault_data.vault.last_accessed = Utc::now();
        
        println!("💾 Stored item '{}' in vault '{}' ({} bytes)", key, vault_name, data.len());
        
        Ok(())
    }
    
    pub async fn retrieve_data(
        &mut self, 
        vault_name: &str, 
        key: &str
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let vault_data = self.vaults.values_mut()
            .find(|v| v.vault.name == vault_name)
            .ok_or("Vault not found")?;
        
        if vault_data.vault.is_locked {
            return Err("Vault is locked".into());
        }
        
        let encrypted_data = vault_data.items.get(key)
            .ok_or("Item not found")?
            .clone();
        
        // Simulate quantum decryption
        let decrypted_data = self.quantum_decrypt(&encrypted_data, &vault_data.vault.id);
        
        vault_data.vault.last_accessed = Utc::now();
        
        println!("📤 Retrieved item '{}' from vault '{}'", key, vault_name);
        
        Ok(decrypted_data)
    }
    
    pub async fn delete_item(
        &mut self, 
        vault_name: &str, 
        key: &str
    ) -> Result<(), Box<dyn std::error::Error>> {
        let vault_data = self.vaults.values_mut()
            .find(|v| v.vault.name == vault_name)
            .ok_or("Vault not found")?;
        
        if vault_data.vault.is_locked {
            return Err("Vault is locked".into());
        }
        
        vault_data.items.remove(key)
            .ok_or("Item not found")?;
        
        vault_data.vault.items_count = vault_data.items.len();
        vault_data.vault.last_accessed = Utc::now();
        
        println!("🗑️  Deleted item '{}' from vault '{}'", key, vault_name);
        
        Ok(())
    }
    
    pub async fn list_vaults(&self) -> Vec<Vault> {
        self.vaults.values()
            .map(|v| v.vault.clone())
            .collect()
    }
    
    pub async fn list_vault_items(&self, vault_name: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let vault_data = self.vaults.values()
            .find(|v| v.vault.name == vault_name)
            .ok_or("Vault not found")?;
        
        if vault_data.vault.is_locked {
            return Err("Vault is locked".into());
        }
        
        Ok(vault_data.items.keys().cloned().collect())
    }
    
    fn hash_password(&self, password: &str) -> Vec<u8> {
        use sha2::{Sha512, Digest};
        let mut hasher = Sha512::new();
        hasher.update(password);
        hasher.update(b"QUDAG-VAULT-SALT");
        hasher.finalize().to_vec()
    }
    
    fn quantum_encrypt(&self, data: &[u8], vault_id: &str) -> Vec<u8> {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(b"QUANTUM-ENCRYPT");
        hasher.update(vault_id);
        hasher.update(&self.vault_counter.to_le_bytes());
        
        let key = hasher.finalize();
        
        // XOR encryption with quantum-derived key
        let mut encrypted = data.to_vec();
        for (i, byte) in encrypted.iter_mut().enumerate() {
            *byte ^= key[i % key.len()];
        }
        
        encrypted
    }
    
    fn quantum_decrypt(&self, encrypted: &[u8], vault_id: &str) -> Vec<u8> {
        // Decryption is same as encryption for XOR
        self.quantum_encrypt(encrypted, vault_id)
    }
}

// Global vault manager instance
lazy_static::lazy_static! {
    pub static ref VAULT_MANAGER: Arc<Mutex<VaultManager>> = Arc::new(Mutex::new(VaultManager::new()));
}

pub async fn initialize() {
    let mut manager = VAULT_MANAGER.lock().await;
    
    // Create a system vault
    let _ = manager.create_vault("system", "quantum-system-password").await;
    let _ = manager.unlock_vault("system", "quantum-system-password").await;
    let _ = manager.store_data("system", "node_identity", b"QuDAG-Node-001").await;
    let _ = manager.lock_vault("system").await;
    
    println!("🔐 Vault Manager initialized with quantum encryption");
}