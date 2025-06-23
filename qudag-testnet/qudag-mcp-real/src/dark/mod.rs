use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DarkDomainRegistration {
    pub domain: String,
    pub quantum_fingerprint: String,
    pub addresses: Vec<String>,
    pub owner_pubkey: Vec<u8>,
    pub registered_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub is_active: bool,
}

pub struct DarkRegistry {
    registrations: HashMap<String, DarkDomainRegistration>,
    fingerprint_index: HashMap<String, String>, // fingerprint -> domain
    registration_counter: u64,
}

impl DarkRegistry {
    pub fn new() -> Self {
        Self {
            registrations: HashMap::new(),
            fingerprint_index: HashMap::new(),
            registration_counter: 0,
        }
    }
    
    pub async fn register_domain(
        &mut self, 
        domain: &str, 
        address: Option<&str>
    ) -> Result<DarkDomainRegistration, Box<dyn std::error::Error>> {
        // Validate domain format
        if !domain.ends_with(".dark") {
            return Err("Domain must end with .dark".into());
        }
        
        if self.registrations.contains_key(domain) {
            return Err("Domain already registered".into());
        }
        
        self.registration_counter += 1;
        
        // Generate quantum fingerprint
        let fingerprint = self.generate_quantum_fingerprint(domain);
        
        // Check for fingerprint collisions
        if self.fingerprint_index.contains_key(&fingerprint) {
            return Err("Quantum fingerprint collision detected".into());
        }
        
        let addresses = if let Some(addr) = address {
            vec![addr.to_string()]
        } else {
            vec![format!("/dark/{}/p2p/{}", domain.replace(".dark", ""), self.registration_counter)]
        };
        
        let registration = DarkDomainRegistration {
            domain: domain.to_string(),
            quantum_fingerprint: fingerprint.clone(),
            addresses,
            owner_pubkey: vec![0; 32], // Placeholder for owner's public key
            registered_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::days(365),
            is_active: true,
        };
        
        self.registrations.insert(domain.to_string(), registration.clone());
        self.fingerprint_index.insert(fingerprint, domain.to_string());
        
        println!("🌑 Registered dark domain: {} -> {}", domain, registration.addresses[0]);
        
        Ok(registration)
    }
    
    pub async fn resolve_domain(&self, domain: &str) -> Option<DarkDomainRegistration> {
        self.registrations.get(domain)
            .filter(|reg| reg.is_active && reg.expires_at > Utc::now())
            .cloned()
    }
    
    pub async fn list_domains(&self) -> Vec<String> {
        self.registrations.keys()
            .filter(|domain| {
                self.registrations.get(*domain)
                    .map(|reg| reg.is_active)
                    .unwrap_or(false)
            })
            .cloned()
            .collect()
    }
    
    pub async fn revoke_domain(&mut self, domain: &str) -> Result<(), Box<dyn std::error::Error>> {
        let registration = self.registrations.get_mut(domain)
            .ok_or("Domain not found")?;
        
        registration.is_active = false;
        
        // Remove from fingerprint index
        self.fingerprint_index.remove(&registration.quantum_fingerprint);
        
        println!("❌ Revoked dark domain: {}", domain);
        
        Ok(())
    }
    
    pub async fn update_domain_addresses(
        &mut self, 
        domain: &str, 
        new_addresses: Vec<String>
    ) -> Result<(), Box<dyn std::error::Error>> {
        let registration = self.registrations.get_mut(domain)
            .ok_or("Domain not found")?;
        
        if !registration.is_active {
            return Err("Domain is not active".into());
        }
        
        registration.addresses = new_addresses;
        
        Ok(())
    }
    
    fn generate_quantum_fingerprint(&self, domain: &str) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(domain);
        hasher.update(b"QUANTUM-FINGERPRINT");
        hasher.update(&self.registration_counter.to_le_bytes());
        
        let hash = hasher.finalize();
        format!("qfp:{}", hex::encode(&hash[..16]))
    }
}

// Global dark registry instance
lazy_static::lazy_static! {
    pub static ref DARK_REGISTRY: Arc<Mutex<DarkRegistry>> = Arc::new(Mutex::new(DarkRegistry::new()));
}

pub async fn initialize() {
    let mut registry = DARK_REGISTRY.lock().await;
    
    // Register some example dark domains
    let _ = registry.register_domain("qudag.dark", Some("/dns4/qudag.dark/tcp/4001")).await;
    let _ = registry.register_domain("exchange.dark", Some("/dns4/exchange.dark/tcp/4002")).await;
    let _ = registry.register_domain("vault.dark", Some("/dns4/vault.dark/tcp/4003")).await;
    
    println!("🌑 Dark Registry initialized with {} domains", registry.registrations.len());
}

// Hex encoding helper
mod hex {
    pub fn encode(data: &[u8]) -> String {
        data.iter()
            .map(|b| format!("{:02x}", b))
            .collect()
    }
}