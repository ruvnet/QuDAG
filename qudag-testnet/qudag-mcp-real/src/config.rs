//! Configuration management for QuDAG MCP Real

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub network: NetworkConfig,
    pub crypto: CryptoConfig,
    pub dag: DagConfig,
    pub exchange: ExchangeConfig,
    pub mcp: MpcConfig,
    pub storage: StorageConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub listen_port: u16,
    pub bootstrap_peers: Vec<String>,
    pub max_peers: usize,
    pub enable_mdns: bool,
    pub enable_relay: bool,
    pub enable_autonat: bool,
    pub enable_dcutr: bool,
    pub gossipsub_heartbeat_interval: u64,
    pub kademlia_replication_factor: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoConfig {
    pub algorithm: String, // "ml-dsa", "ml-kem", "hqc"
    pub key_store_path: String,
    pub enable_timing_protection: bool,
    pub enable_hardware_acceleration: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagConfig {
    pub consensus_algorithm: String, // "qr-avalanche"
    pub block_size_limit: usize,
    pub finality_threshold: f64,
    pub validator_set_size: usize,
    pub block_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeConfig {
    pub database_url: String,
    pub fee_model: FeeModel,
    pub business_plan_enabled: bool,
    pub payout_threshold: u64,
    pub system_fee_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeModel {
    pub base_fee: f64,
    pub dynamic_fee_enabled: bool,
    pub verified_agent_discount: f64,
    pub minimum_fee: f64,
    pub maximum_fee: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MpcConfig {
    pub port: u16,
    pub host: String,
    pub enable_auth: bool,
    pub auth_token: Option<String>,
    pub max_request_size: usize,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub data_dir: String,
    pub cache_size: usize,
    pub enable_compression: bool,
    pub backup_enabled: bool,
    pub backup_interval_hours: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            network: NetworkConfig {
                listen_port: 9000,
                bootstrap_peers: vec![],
                max_peers: 50,
                enable_mdns: true,
                enable_relay: true,
                enable_autonat: true,
                enable_dcutr: true,
                gossipsub_heartbeat_interval: 1000,
                kademlia_replication_factor: 20,
            },
            crypto: CryptoConfig {
                algorithm: "ml-dsa".to_string(),
                key_store_path: "./data/keys".to_string(),
                enable_timing_protection: true,
                enable_hardware_acceleration: false,
            },
            dag: DagConfig {
                consensus_algorithm: "qr-avalanche".to_string(),
                block_size_limit: 1_048_576, // 1MB
                finality_threshold: 0.8,
                validator_set_size: 100,
                block_time_ms: 1000,
            },
            exchange: ExchangeConfig {
                database_url: "sqlite://./data/exchange.db".to_string(),
                fee_model: FeeModel {
                    base_fee: 0.001,
                    dynamic_fee_enabled: true,
                    verified_agent_discount: 0.5,
                    minimum_fee: 0.0001,
                    maximum_fee: 0.01,
                },
                business_plan_enabled: true,
                payout_threshold: 100,
                system_fee_percentage: 0.001,
            },
            mcp: MpcConfig {
                port: 3000,
                host: "0.0.0.0".to_string(),
                enable_auth: false,
                auth_token: None,
                max_request_size: 10_485_760, // 10MB
                timeout_ms: 30000,
            },
            storage: StorageConfig {
                data_dir: "./data".to_string(),
                cache_size: 100_000_000, // 100MB
                enable_compression: true,
                backup_enabled: true,
                backup_interval_hours: 24,
            },
        }
    }
}

impl Config {
    /// Load configuration from a TOML file
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }
    
    /// Save configuration to a TOML file
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }
    
    /// Load configuration with environment variable overrides
    pub fn load_with_env<P: AsRef<Path>>(path: P) -> Result<Self> {
        let mut config = Self::load(path)?;
        
        // Override with environment variables
        if let Ok(port) = std::env::var("QUDAG_MCP_PORT") {
            config.mcp.port = port.parse()?;
        }
        
        if let Ok(p2p_port) = std::env::var("QUDAG_P2P_PORT") {
            config.network.listen_port = p2p_port.parse()?;
        }
        
        if let Ok(peers) = std::env::var("QUDAG_BOOTSTRAP_PEERS") {
            config.network.bootstrap_peers = peers
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();
        }
        
        if let Ok(db_url) = std::env::var("QUDAG_DATABASE_URL") {
            config.exchange.database_url = db_url;
        }
        
        Ok(config)
    }
    
    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        // Validate network config
        if self.network.listen_port == 0 {
            anyhow::bail!("Invalid listen port");
        }
        
        if self.network.max_peers == 0 {
            anyhow::bail!("Max peers must be greater than 0");
        }
        
        // Validate crypto config
        match self.crypto.algorithm.as_str() {
            "ml-dsa" | "ml-kem" | "hqc" => {},
            _ => anyhow::bail!("Invalid crypto algorithm: {}", self.crypto.algorithm),
        }
        
        // Validate DAG config
        if self.dag.finality_threshold <= 0.0 || self.dag.finality_threshold > 1.0 {
            anyhow::bail!("Finality threshold must be between 0 and 1");
        }
        
        // Validate exchange config
        if self.exchange.fee_model.minimum_fee > self.exchange.fee_model.maximum_fee {
            anyhow::bail!("Minimum fee cannot be greater than maximum fee");
        }
        
        Ok(())
    }
}