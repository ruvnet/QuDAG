pub mod tokens;
pub mod fees;

use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ExchangeError {
    #[error("Account not found: {0}")]
    AccountNotFound(String),
    
    #[error("Insufficient balance: available {available}, required {required}")]
    InsufficientBalance { available: u64, required: u64 },
    
    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),
    
    #[error("Immutable mode violation")]
    ImmutableViolation,
    
    #[error("Quantum signature verification failed")]
    SignatureVerificationFailed,
    
    #[error("Business plan error: {0}")]
    BusinessPlanError(String),
}

pub type Result<T> = std::result::Result<T, ExchangeError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeConfig {
    pub base_fee_percentage: f64,
    pub verified_agent_discount: f64,
    pub immutable_mode: bool,
    pub business_plan_enabled: bool,
    pub payout_threshold: u64,
    pub system_fee_percentage: f64,
}

impl Default for ExchangeConfig {
    fn default() -> Self {
        Self {
            base_fee_percentage: 0.01, // 1%
            verified_agent_discount: 0.5, // 50% discount
            immutable_mode: false,
            business_plan_enabled: false,
            payout_threshold: 100,
            system_fee_percentage: 0.001, // 0.1%
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub fee: u64,
    pub timestamp: DateTime<Utc>,
    pub status: TransactionStatus,
    pub quantum_signature: Option<Vec<u8>>,
    pub fee_split: Option<FeeSplit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransactionStatus {
    Pending,
    Confirmed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeSplit {
    pub system_fee: u64,
    pub contributor_fees: HashMap<String, u64>,
}

pub struct Exchange {
    config: Arc<RwLock<ExchangeConfig>>,
    accounts: Arc<RwLock<HashMap<String, tokens::Account>>>,
    transactions: Arc<RwLock<Vec<Transaction>>>,
    business_plan: Arc<RwLock<business_plan::BusinessPlan>>,
    immutable_key: Option<Vec<u8>>,
}

impl Exchange {
    pub fn new() -> Self {
        Self {
            config: Arc::new(RwLock::new(ExchangeConfig::default())),
            accounts: Arc::new(RwLock::new(HashMap::new())),
            transactions: Arc::new(RwLock::new(Vec::new())),
            business_plan: Arc::new(RwLock::new(business_plan::BusinessPlan::new())),
            immutable_key: None,
        }
    }
    
    pub async fn create_account(&self, name: &str, email: Option<&str>) -> Result<tokens::Account> {
        let config = self.config.read().await;
        if config.immutable_mode {
            return Err(ExchangeError::ImmutableViolation);
        }
        drop(config);
        
        let account = tokens::Account::new(name, email);
        let mut accounts = self.accounts.write().await;
        accounts.insert(name.to_string(), account.clone());
        Ok(account)
    }
    
    pub async fn get_account(&self, name: &str) -> Result<tokens::Account> {
        let accounts = self.accounts.read().await;
        accounts.get(name)
            .cloned()
            .ok_or_else(|| ExchangeError::AccountNotFound(name.to_string()))
    }
    
    pub async fn transfer(&self, from: &str, to: &str, amount: u64) -> Result<Transaction> {
        let mut accounts = self.accounts.write().await;
        
        // Get sender account
        let sender = accounts.get_mut(from)
            .ok_or_else(|| ExchangeError::AccountNotFound(from.to_string()))?;
        
        // Calculate fee
        let config = self.config.read().await;
        let fee = fees::calculate_fee(amount, sender.is_verified, &config);
        drop(config);
        
        let total_required = amount + fee;
        
        // Check balance
        if sender.balance < total_required {
            return Err(ExchangeError::InsufficientBalance {
                available: sender.balance,
                required: total_required,
            });
        }
        
        // Deduct from sender
        sender.balance -= total_required;
        sender.total_sent += amount;
        sender.fees_paid += fee;
        
        // Add to receiver
        let receiver = accounts.get_mut(to)
            .ok_or_else(|| ExchangeError::AccountNotFound(to.to_string()))?;
        receiver.balance += amount;
        receiver.total_received += amount;
        
        // Create transaction
        let transaction_id = format!("tx_{}", uuid::Uuid::new_v4());
        let transaction = Transaction {
            id: transaction_id,
            from: from.to_string(),
            to: to.to_string(),
            amount,
            fee,
            timestamp: Utc::now(),
            status: TransactionStatus::Confirmed,
            quantum_signature: None, // Would be set by quantum signing
            fee_split: None, // Will be calculated by business plan
        };
        
        // Process business plan payouts if enabled
        let config = self.config.read().await;
        if config.business_plan_enabled {
            let mut business_plan = self.business_plan.write().await;
            business_plan.process_transaction_fee(fee).await;
        }
        
        // Store transaction
        let mut transactions = self.transactions.write().await;
        transactions.push(transaction.clone());
        
        Ok(transaction)
    }
    
    pub async fn calculate_fee(&self, account: &str, amount: u64) -> Result<u64> {
        let accounts = self.accounts.read().await;
        let account = accounts.get(account)
            .ok_or_else(|| ExchangeError::AccountNotFound(account.to_string()))?;
        
        let config = self.config.read().await;
        Ok(fees::calculate_fee(amount, account.is_verified, &config))
    }
    
    pub async fn verify_agent(&self, account: &str, proof: Vec<u8>) -> Result<()> {
        // Verify quantum proof (simplified)
        if proof.len() < 32 {
            return Err(ExchangeError::SignatureVerificationFailed);
        }
        
        let mut accounts = self.accounts.write().await;
        let account = accounts.get_mut(account)
            .ok_or_else(|| ExchangeError::AccountNotFound(account.to_string()))?;
        
        account.is_verified = true;
        account.verification_proof = Some(proof);
        Ok(())
    }
    
    pub async fn deploy_immutable(&self, quantum_key: Vec<u8>) -> Result<()> {
        let mut config = self.config.write().await;
        if config.immutable_mode {
            return Err(ExchangeError::ImmutableViolation);
        }
        
        config.immutable_mode = true;
        // Store the quantum key for verification
        // In real implementation, this would lock the contract
        Ok(())
    }
    
    pub async fn get_immutable_status(&self) -> bool {
        let config = self.config.read().await;
        config.immutable_mode
    }
    
    pub async fn enable_business_plan(&self, auto_distribution: bool) -> Result<()> {
        let mut config = self.config.write().await;
        if config.immutable_mode {
            return Err(ExchangeError::ImmutableViolation);
        }
        
        config.business_plan_enabled = true;
        
        let mut business_plan = self.business_plan.write().await;
        business_plan.set_auto_distribution(auto_distribution);
        
        Ok(())
    }
    
    pub async fn register_contributor(
        &self, 
        id: &str, 
        role: business_plan::ContributorRole, 
        vault: &str
    ) -> Result<()> {
        let config = self.config.read().await;
        if !config.business_plan_enabled {
            return Err(ExchangeError::BusinessPlanError("Business plan not enabled".to_string()));
        }
        drop(config);
        
        let mut business_plan = self.business_plan.write().await;
        business_plan.register_contributor(id, role, vault).await;
        Ok(())
    }
    
    pub async fn get_system_metrics(&self) -> ExchangeMetrics {
        let accounts = self.accounts.read().await;
        let transactions = self.transactions.read().await;
        let config = self.config.read().await;
        let business_plan = self.business_plan.read().await;
        
        let total_supply: u64 = accounts.values().map(|a| a.balance).sum();
        let total_volume: u64 = transactions.iter().map(|t| t.amount).sum();
        let total_fees: u64 = transactions.iter().map(|t| t.fee).sum();
        let verified_accounts = accounts.values().filter(|a| a.is_verified).count();
        
        ExchangeMetrics {
            total_accounts: accounts.len(),
            verified_accounts,
            total_supply,
            total_volume,
            total_fees,
            average_fee_rate: if total_volume > 0 { 
                (total_fees as f64 / total_volume as f64) 
            } else { 
                config.base_fee_percentage 
            },
            business_plan_enabled: config.business_plan_enabled,
            immutable_mode: config.immutable_mode,
            contributors: business_plan.contributors.len(),
            total_payouts: business_plan.total_distributed,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeMetrics {
    pub total_accounts: usize,
    pub verified_accounts: usize,
    pub total_supply: u64,
    pub total_volume: u64,
    pub total_fees: u64,
    pub average_fee_rate: f64,
    pub business_plan_enabled: bool,
    pub immutable_mode: bool,
    pub contributors: usize,
    pub total_payouts: u64,
}

pub mod business_plan {
    use super::*;
    use std::collections::HashMap;
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "snake_case")]
    pub enum ContributorRole {
        AgentProvider,
        PluginCreator,
        NodeOperator,
        ProtocolDeveloper,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Contributor {
        pub id: String,
        pub role: ContributorRole,
        pub vault_address: String,
        pub earnings: u64,
        pub registered_at: DateTime<Utc>,
    }
    
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Payout {
        pub id: String,
        pub contributor_id: String,
        pub amount: u64,
        pub timestamp: DateTime<Utc>,
    }
    
    pub struct BusinessPlan {
        pub contributors: HashMap<String, Contributor>,
        pub pending_fees: u64,
        pub payout_threshold: u64,
        pub auto_distribution: bool,
        pub total_distributed: u64,
        pub payouts: Vec<Payout>,
    }
    
    impl BusinessPlan {
        pub fn new() -> Self {
            Self {
                contributors: HashMap::new(),
                pending_fees: 0,
                payout_threshold: 100,
                auto_distribution: false,
                total_distributed: 0,
                payouts: Vec::new(),
            }
        }
        
        pub fn set_auto_distribution(&mut self, enabled: bool) {
            self.auto_distribution = enabled;
        }
        
        pub async fn register_contributor(&mut self, id: &str, role: ContributorRole, vault: &str) {
            let contributor = Contributor {
                id: id.to_string(),
                role,
                vault_address: vault.to_string(),
                earnings: 0,
                registered_at: Utc::now(),
            };
            self.contributors.insert(id.to_string(), contributor);
        }
        
        pub async fn process_transaction_fee(&mut self, fee: u64) {
            self.pending_fees += fee;
            
            if self.auto_distribution && self.pending_fees >= self.payout_threshold {
                self.distribute_payouts().await;
            }
        }
        
        pub async fn distribute_payouts(&mut self) {
            if self.contributors.is_empty() || self.pending_fees == 0 {
                return;
            }
            
            // Simplified equal distribution
            let per_contributor = self.pending_fees / self.contributors.len() as u64;
            
            for contributor in self.contributors.values_mut() {
                contributor.earnings += per_contributor;
                
                let payout = Payout {
                    id: format!("payout_{}", uuid::Uuid::new_v4()),
                    contributor_id: contributor.id.clone(),
                    amount: per_contributor,
                    timestamp: Utc::now(),
                };
                self.payouts.push(payout);
            }
            
            self.total_distributed += self.pending_fees;
            self.pending_fees = 0;
        }
    }
}

// UUID generation
mod uuid {
    use std::sync::atomic::{AtomicU64, Ordering};
    
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    
    pub struct Uuid;
    
    impl Uuid {
        pub fn new_v4() -> String {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            let count = COUNTER.fetch_add(1, Ordering::Relaxed);
            format!("{:x}-{:x}", timestamp, count)
        }
    }
}

// Global exchange instance
lazy_static::lazy_static! {
    pub static ref EXCHANGE: Exchange = Exchange::new();
}