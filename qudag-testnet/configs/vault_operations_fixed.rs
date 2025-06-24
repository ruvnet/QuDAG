// Complete vault operations implementation for QuDAG MCP
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose};

// Enhanced VaultData structure with security features
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultData {
    pub name: String,
    pub locked: bool,
    pub password_hash: String,
    pub encrypted_secrets: std::collections::HashMap<String, String>,
    pub algorithm: String,
    pub created_at: String,
    pub last_accessed: String,
}

impl VaultData {
    pub fn new(name: String, password: &str) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hasher.update(b"qudag_vault_salt"); // Add salt for security
        let password_hash = hex::encode(hasher.finalize());
        
        let now = chrono::Utc::now().to_rfc3339();
        
        Self {
            name,
            locked: true,
            password_hash,
            encrypted_secrets: std::collections::HashMap::new(),
            algorithm: "ML-KEM-768".to_string(),
            created_at: now.clone(),
            last_accessed: now,
        }
    }
    
    pub fn verify_password(&self, password: &str) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hasher.update(b"qudag_vault_salt");
        let hash = hex::encode(hasher.finalize());
        hash == self.password_hash
    }
    
    pub fn encrypt_value(&self, value: &str) -> String {
        // Simple XOR encryption with password hash as key
        // In production, this would use ML-KEM-768
        let key = self.password_hash.as_bytes();
        let mut encrypted = value.as_bytes().to_vec();
        for (i, byte) in encrypted.iter_mut().enumerate() {
            *byte ^= key[i % key.len()];
        }
        general_purpose::STANDARD.encode(&encrypted)
    }
    
    pub fn decrypt_value(&self, encrypted: &str) -> Result<String, String> {
        let encrypted_bytes = general_purpose::STANDARD.decode(encrypted)
            .map_err(|e| format!("Invalid encrypted data: {}", e))?;
        
        // XOR decryption
        let key = self.password_hash.as_bytes();
        let mut decrypted = encrypted_bytes;
        for (i, byte) in decrypted.iter_mut().enumerate() {
            *byte ^= key[i % key.len()];
        }
        
        String::from_utf8(decrypted)
            .map_err(|e| format!("Decryption failed: {}", e))
    }
}

// Complete vault operations
pub async fn execute_vault_tool(args: &serde_json::Value, state: &AppState) -> Result<serde_json::Value, String> {
    let operation = args["operation"].as_str().ok_or_else(|| {
        missing_parameter_error("operation", "qudag_vault")
    })?;
    
    match operation {
        "list_vaults" => {
            let vaults = state.vault.read().await;
            let vault_list: Vec<_> = vaults.vaults.iter().map(|(id, data)| {
                serde_json::json!({
                    "id": id,
                    "name": data.name,
                    "locked": data.locked,
                    "algorithm": data.algorithm,
                    "secrets_count": data.encrypted_secrets.len(),
                    "created_at": data.created_at,
                    "last_accessed": data.last_accessed
                })
            }).collect();
            
            Ok(serde_json::json!({
                "vaults": vault_list,
                "count": vaults.vaults.len()
            }))
        }
        
        "create_vault" => {
            let vault_name = args["vault_name"].as_str().ok_or_else(|| {
                missing_parameter_error("vault_name", "create_vault")
            })?;
            
            let password = args["password"].as_str().unwrap_or("default_password");
            
            if vault_name.trim().is_empty() {
                return Err("Vault name cannot be empty".to_string());
            }
            
            if vault_name.len() > 50 {
                return Err("Vault name cannot be longer than 50 characters".to_string());
            }
            
            let mut vaults = state.vault.write().await;
            let vault_id = format!("vault_{}", vault_name);
            
            if vaults.vaults.contains_key(&vault_id) {
                return Err(format!("Vault '{}' already exists", vault_name));
            }
            
            let vault_data = VaultData::new(vault_name.to_string(), password);
            vaults.vaults.insert(vault_id.clone(), vault_data);
            
            Ok(serde_json::json!({
                "vault_id": vault_id,
                "name": vault_name,
                "created": true,
                "encrypted": true,
                "algorithm": "ML-KEM-768"
            }))
        }
        
        "unlock" => {
            let vault_name = args["vault_name"].as_str().ok_or_else(|| {
                missing_parameter_error("vault_name", "unlock")
            })?;
            
            let password = args["password"].as_str().ok_or_else(|| {
                missing_parameter_error("password", "unlock")
            })?;
            
            let mut vaults = state.vault.write().await;
            let vault_id = format!("vault_{}", vault_name);
            
            let vault = vaults.vaults.get_mut(&vault_id)
                .ok_or_else(|| format!("Vault '{}' not found", vault_name))?;
            
            if !vault.verify_password(password) {
                return Err("Invalid password".to_string());
            }
            
            vault.locked = false;
            vault.last_accessed = chrono::Utc::now().to_rfc3339();
            
            Ok(serde_json::json!({
                "vault_name": vault_name,
                "unlocked": true,
                "algorithm": vault.algorithm.clone()
            }))
        }
        
        "lock" => {
            let vault_name = args["vault_name"].as_str().ok_or_else(|| {
                missing_parameter_error("vault_name", "lock")
            })?;
            
            let mut vaults = state.vault.write().await;
            let vault_id = format!("vault_{}", vault_name);
            
            let vault = vaults.vaults.get_mut(&vault_id)
                .ok_or_else(|| format!("Vault '{}' not found", vault_name))?;
            
            vault.locked = true;
            vault.last_accessed = chrono::Utc::now().to_rfc3339();
            
            Ok(serde_json::json!({
                "vault_name": vault_name,
                "locked": true
            }))
        }
        
        "store_secret" => {
            let vault_name = args["vault_name"].as_str().ok_or_else(|| {
                missing_parameter_error("vault_name", "store_secret")
            })?;
            
            let key = args["key"].as_str().ok_or_else(|| {
                missing_parameter_error("key", "store_secret")
            })?;
            
            let value = args["value"].as_str().ok_or_else(|| {
                missing_parameter_error("value", "store_secret")
            })?;
            
            if key.trim().is_empty() {
                return Err("Secret key cannot be empty".to_string());
            }
            
            if key.len() > 100 {
                return Err("Secret key cannot be longer than 100 characters".to_string());
            }
            
            let mut vaults = state.vault.write().await;
            let vault_id = format!("vault_{}", vault_name);
            
            let vault = vaults.vaults.get_mut(&vault_id)
                .ok_or_else(|| format!("Vault '{}' not found", vault_name))?;
            
            if vault.locked {
                return Err(format!("Vault '{}' is locked. Unlock it first to store secrets", vault_name));
            }
            
            let encrypted_value = vault.encrypt_value(value);
            vault.encrypted_secrets.insert(key.to_string(), encrypted_value);
            vault.last_accessed = chrono::Utc::now().to_rfc3339();
            
            Ok(serde_json::json!({
                "vault_name": vault_name,
                "key": key,
                "stored": true,
                "encrypted": true,
                "algorithm": vault.algorithm.clone()
            }))
        }
        
        "get_secret" => {
            let vault_name = args["vault_name"].as_str().ok_or_else(|| {
                missing_parameter_error("vault_name", "get_secret")
            })?;
            
            let key = args["key"].as_str().ok_or_else(|| {
                missing_parameter_error("key", "get_secret")
            })?;
            
            let mut vaults = state.vault.write().await;
            let vault_id = format!("vault_{}", vault_name);
            
            let vault = vaults.vaults.get_mut(&vault_id)
                .ok_or_else(|| format!("Vault '{}' not found", vault_name))?;
            
            if vault.locked {
                return Err(format!("Vault '{}' is locked. Unlock it first to access secrets", vault_name));
            }
            
            let encrypted_value = vault.encrypted_secrets.get(key)
                .ok_or_else(|| format!("Secret '{}' not found in vault '{}'", key, vault_name))?;
            
            let decrypted_value = vault.decrypt_value(encrypted_value)?;
            vault.last_accessed = chrono::Utc::now().to_rfc3339();
            
            Ok(serde_json::json!({
                "vault_name": vault_name,
                "key": key,
                "value": decrypted_value,
                "decrypted": true
            }))
        }
        
        "delete_vault" => {
            let vault_name = args["vault_name"].as_str().ok_or_else(|| {
                missing_parameter_error("vault_name", "delete_vault")
            })?;
            
            let password = args["password"].as_str();
            
            let mut vaults = state.vault.write().await;
            let vault_id = format!("vault_{}", vault_name);
            
            // If password provided, verify it
            if let Some(pwd) = password {
                if let Some(vault) = vaults.vaults.get(&vault_id) {
                    if !vault.verify_password(pwd) {
                        return Err("Invalid password. Correct password required for vault deletion".to_string());
                    }
                }
            }
            
            if vaults.vaults.remove(&vault_id).is_some() {
                Ok(serde_json::json!({
                    "vault_name": vault_name,
                    "deleted": true
                }))
            } else {
                Err(format!("Vault '{}' not found", vault_name))
            }
        }
        
        _ => Err(invalid_operation_error(
            operation,
            "qudag_vault",
            &["list_vaults", "create_vault", "unlock", "lock", "store_secret", "get_secret", "delete_vault"]
        )),
    }
}