use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::sync::atomic::{AtomicU64, Ordering};

// Initial supply constants
pub const INITIAL_SUPPLY: u64 = 1_000_000_000; // 1 billion rUv tokens
pub const INITIAL_BALANCE: u64 = 10_000; // Initial balance for new accounts

// Token counter for unique IDs
static TOKEN_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub balance: u64,
    pub created_at: DateTime<Utc>,
    pub is_verified: bool,
    pub verification_proof: Option<Vec<u8>>,
    pub total_sent: u64,
    pub total_received: u64,
    pub fees_paid: u64,
    pub quantum_pubkey: Option<Vec<u8>>,
}

impl Account {
    pub fn new(name: &str, email: Option<&str>) -> Self {
        let id = format!("account_{}", TOKEN_COUNTER.fetch_add(1, Ordering::Relaxed));
        
        Self {
            id,
            name: name.to_string(),
            email: email.map(|e| e.to_string()),
            balance: INITIAL_BALANCE,
            created_at: Utc::now(),
            is_verified: false,
            verification_proof: None,
            total_sent: 0,
            total_received: 0,
            fees_paid: 0,
            quantum_pubkey: None,
        }
    }
    
    pub fn with_quantum_key(mut self, pubkey: Vec<u8>) -> Self {
        self.quantum_pubkey = Some(pubkey);
        self
    }
    
    pub fn can_afford(&self, amount: u64, fee: u64) -> bool {
        self.balance >= amount + fee
    }
    
    pub fn apply_verification_discount(&self, base_fee: u64) -> u64 {
        if self.is_verified {
            // 50% discount for verified agents
            base_fee / 2
        } else {
            base_fee
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenTransfer {
    pub from_account: String,
    pub to_account: String,
    pub amount: u64,
    pub fee: u64,
    pub timestamp: DateTime<Utc>,
    pub memo: Option<String>,
    pub quantum_signature: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenMetrics {
    pub total_supply: u64,
    pub circulating_supply: u64,
    pub burned_tokens: u64,
    pub average_transaction_size: u64,
    pub velocity: f64, // Transactions per token per day
}

impl Default for TokenMetrics {
    fn default() -> Self {
        Self {
            total_supply: INITIAL_SUPPLY,
            circulating_supply: 0,
            burned_tokens: 0,
            average_transaction_size: 0,
            velocity: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBurn {
    pub account: String,
    pub amount: u64,
    pub reason: String,
    pub timestamp: DateTime<Utc>,
    pub quantum_proof: Vec<u8>,
}

pub struct TokenManager {
    pub metrics: TokenMetrics,
    pub burns: Vec<TokenBurn>,
}

impl TokenManager {
    pub fn new() -> Self {
        Self {
            metrics: TokenMetrics::default(),
            burns: Vec::new(),
        }
    }
    
    pub fn update_metrics(&mut self, accounts: &[Account], transfers: &[TokenTransfer]) {
        // Calculate circulating supply
        self.metrics.circulating_supply = accounts.iter()
            .map(|a| a.balance)
            .sum();
        
        // Calculate average transaction size
        if !transfers.is_empty() {
            let total_volume: u64 = transfers.iter().map(|t| t.amount).sum();
            self.metrics.average_transaction_size = total_volume / transfers.len() as u64;
            
            // Calculate velocity (simplified)
            let days = 30.0; // Last 30 days
            let daily_volume = total_volume as f64 / days;
            self.metrics.velocity = daily_volume / self.metrics.circulating_supply as f64;
        }
    }
    
    pub fn burn_tokens(&mut self, account: &str, amount: u64, reason: &str, proof: Vec<u8>) {
        let burn = TokenBurn {
            account: account.to_string(),
            amount,
            reason: reason.to_string(),
            timestamp: Utc::now(),
            quantum_proof: proof,
        };
        
        self.burns.push(burn);
        self.metrics.burned_tokens += amount;
        self.metrics.total_supply -= amount;
    }
    
    pub fn mint_tokens(&mut self, amount: u64) {
        // Only used for system rewards in business plan
        self.metrics.total_supply += amount;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_account_creation() {
        let account = Account::new("alice", Some("alice@example.com"));
        assert_eq!(account.name, "alice");
        assert_eq!(account.balance, INITIAL_BALANCE);
        assert!(!account.is_verified);
    }
    
    #[test]
    fn test_verification_discount() {
        let mut account = Account::new("bob", None);
        let base_fee = 100;
        
        // No discount for unverified
        assert_eq!(account.apply_verification_discount(base_fee), 100);
        
        // 50% discount for verified
        account.is_verified = true;
        assert_eq!(account.apply_verification_discount(base_fee), 50);
    }
    
    #[test]
    fn test_affordability() {
        let account = Account::new("charlie", None);
        
        // Can afford within balance
        assert!(account.can_afford(5000, 50));
        
        // Cannot afford exceeding balance
        assert!(!account.can_afford(INITIAL_BALANCE, 1));
    }
}