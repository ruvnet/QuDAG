use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::{DateTime, Utc};
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeyType {
    MlDsa,
    MlKem,
    Hqc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyPair {
    pub id: String,
    pub key_type: KeyType,
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoMetrics {
    pub total_keys_generated: u64,
    pub signatures_created: u64,
    pub signatures_verified: u64,
    pub encryptions: u64,
    pub decryptions: u64,
    pub average_sign_time_ms: f64,
    pub average_verify_time_ms: f64,
}

struct TimingStats {
    sign_times: Vec<f64>,
    verify_times: Vec<f64>,
}

pub struct CryptoManager {
    keys: HashMap<String, KeyPair>,
    metrics: CryptoMetrics,
    timing_stats: TimingStats,
    key_counter: u64,
}

impl CryptoManager {
    pub fn new() -> Self {
        Self {
            keys: HashMap::new(),
            metrics: CryptoMetrics {
                total_keys_generated: 0,
                signatures_created: 0,
                signatures_verified: 0,
                encryptions: 0,
                decryptions: 0,
                average_sign_time_ms: 0.0,
                average_verify_time_ms: 0.0,
            },
            timing_stats: TimingStats {
                sign_times: Vec::new(),
                verify_times: Vec::new(),
            },
            key_counter: 0,
        }
    }
    
    pub async fn generate_key_pair(&mut self, key_type: KeyType) -> Result<KeyPair, Box<dyn std::error::Error>> {
        self.key_counter += 1;
        let key_id = format!("key_{}_{}", 
            match key_type {
                KeyType::MlDsa => "mldsa",
                KeyType::MlKem => "mlkem",
                KeyType::Hqc => "hqc",
            },
            self.key_counter
        );
        
        // Simulate key generation
        let (pub_key_size, priv_key_size) = match key_type {
            KeyType::MlDsa => (1312, 2560), // ML-DSA-44 sizes
            KeyType::MlKem => (1184, 2400), // ML-KEM-768 sizes
            KeyType::Hqc => (7245, 7285),   // HQC-192 sizes
        };
        
        let key_pair = KeyPair {
            id: key_id.clone(),
            key_type,
            public_key: self.generate_random_bytes(pub_key_size),
            private_key: self.generate_random_bytes(priv_key_size),
            created_at: Utc::now(),
        };
        
        self.keys.insert(key_id.clone(), key_pair.clone());
        self.metrics.total_keys_generated += 1;
        
        println!("🔑 Generated {} key pair: {}", 
            match key_type {
                KeyType::MlDsa => "ML-DSA",
                KeyType::MlKem => "ML-KEM",
                KeyType::Hqc => "HQC",
            },
            key_id
        );
        
        Ok(key_pair)
    }
    
    pub async fn sign(&mut self, data: &[u8], key_id: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let start = Instant::now();
        
        let key = self.keys.get(key_id)
            .ok_or("Key not found")?;
        
        if key.key_type != KeyType::MlDsa {
            return Err("Key is not a signing key".into());
        }
        
        // Simulate ML-DSA signature
        let signature = self.generate_signature(data, &key.private_key);
        
        let elapsed = start.elapsed().as_secs_f64() * 1000.0;
        self.timing_stats.sign_times.push(elapsed);
        self.update_average_times();
        
        self.metrics.signatures_created += 1;
        
        Ok(signature)
    }
    
    pub async fn verify(&mut self, data: &[u8], signature: &[u8], key_id: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let start = Instant::now();
        
        let key = self.keys.get(key_id)
            .ok_or("Key not found")?;
        
        if key.key_type != KeyType::MlDsa {
            return Err("Key is not a signing key".into());
        }
        
        // Simulate ML-DSA verification
        let expected_sig = self.generate_signature(data, &key.private_key);
        let is_valid = signature == expected_sig.as_slice();
        
        let elapsed = start.elapsed().as_secs_f64() * 1000.0;
        self.timing_stats.verify_times.push(elapsed);
        self.update_average_times();
        
        self.metrics.signatures_verified += 1;
        
        Ok(is_valid)
    }
    
    pub async fn encrypt(&mut self, data: &[u8], recipient: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let key = self.keys.get(recipient)
            .ok_or("Recipient key not found")?;
        
        if key.key_type != KeyType::MlKem && key.key_type != KeyType::Hqc {
            return Err("Key is not an encryption key".into());
        }
        
        // Simulate quantum-resistant encryption
        let ciphertext = self.simulate_encryption(data, &key.public_key);
        
        self.metrics.encryptions += 1;
        
        Ok(ciphertext)
    }
    
    pub async fn decrypt(&mut self, ciphertext: &[u8], key_id: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let key = self.keys.get(key_id)
            .ok_or("Key not found")?;
        
        if key.key_type != KeyType::MlKem && key.key_type != KeyType::Hqc {
            return Err("Key is not an encryption key".into());
        }
        
        // Simulate quantum-resistant decryption
        let plaintext = self.simulate_decryption(ciphertext, &key.private_key);
        
        self.metrics.decryptions += 1;
        
        Ok(plaintext)
    }
    
    pub fn get_metrics(&self) -> CryptoMetrics {
        self.metrics.clone()
    }
    
    fn generate_random_bytes(&self, size: usize) -> Vec<u8> {
        use sha2::{Sha256, Digest};
        let mut result = Vec::with_capacity(size);
        let mut hasher = Sha256::new();
        
        for i in 0..(size / 32 + 1) {
            hasher.update(&i.to_le_bytes());
            hasher.update(&std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
                .to_le_bytes());
            let hash = hasher.finalize_reset();
            result.extend_from_slice(&hash);
        }
        
        result.truncate(size);
        result
    }
    
    fn generate_signature(&self, data: &[u8], private_key: &[u8]) -> Vec<u8> {
        use sha2::{Sha512, Digest};
        let mut hasher = Sha512::new();
        hasher.update(data);
        hasher.update(private_key);
        hasher.update(b"ML-DSA-SIGNATURE");
        hasher.finalize().to_vec()
    }
    
    fn simulate_encryption(&self, data: &[u8], public_key: &[u8]) -> Vec<u8> {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(b"ENCRYPT");
        hasher.update(public_key);
        hasher.update(data);
        
        let key = hasher.finalize();
        
        // Simple XOR encryption for simulation
        let mut ciphertext = data.to_vec();
        for (i, byte) in ciphertext.iter_mut().enumerate() {
            *byte ^= key[i % key.len()];
        }
        
        ciphertext
    }
    
    fn simulate_decryption(&self, ciphertext: &[u8], private_key: &[u8]) -> Vec<u8> {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(b"ENCRYPT");
        hasher.update(&private_key[..32]); // Use part of private key as public key simulation
        hasher.update(b"");
        
        let key = hasher.finalize();
        
        // XOR decryption (same as encryption)
        let mut plaintext = ciphertext.to_vec();
        for (i, byte) in plaintext.iter_mut().enumerate() {
            *byte ^= key[i % key.len()];
        }
        
        plaintext
    }
    
    fn update_average_times(&mut self) {
        if !self.timing_stats.sign_times.is_empty() {
            self.metrics.average_sign_time_ms = 
                self.timing_stats.sign_times.iter().sum::<f64>() / self.timing_stats.sign_times.len() as f64;
        }
        
        if !self.timing_stats.verify_times.is_empty() {
            self.metrics.average_verify_time_ms = 
                self.timing_stats.verify_times.iter().sum::<f64>() / self.timing_stats.verify_times.len() as f64;
        }
        
        // Keep only last 1000 samples
        if self.timing_stats.sign_times.len() > 1000 {
            self.timing_stats.sign_times.drain(0..self.timing_stats.sign_times.len() - 1000);
        }
        if self.timing_stats.verify_times.len() > 1000 {
            self.timing_stats.verify_times.drain(0..self.timing_stats.verify_times.len() - 1000);
        }
    }
}

// Global crypto manager instance
lazy_static::lazy_static! {
    pub static ref CRYPTO_MANAGER: Arc<Mutex<CryptoManager>> = Arc::new(Mutex::new(CryptoManager::new()));
}

pub async fn initialize() {
    let mut manager = CRYPTO_MANAGER.lock().await;
    
    // Generate initial system keys
    let _ = manager.generate_key_pair(KeyType::MlDsa).await;
    let _ = manager.generate_key_pair(KeyType::MlKem).await;
    let _ = manager.generate_key_pair(KeyType::Hqc).await;
    
    println!("🔐 Crypto Manager initialized with quantum-resistant algorithms");
}