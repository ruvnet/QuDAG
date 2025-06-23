//! MCP resources implementation

use anyhow::Result;
use serde_json::json;
use std::sync::Arc;
use crate::{AppState, mcp::Resource};

/// List all available resources
pub async fn list_all_resources(state: &Arc<AppState>) -> Vec<Resource> {
    vec![
        Resource {
            uri: "qudag://system/status".to_string(),
            name: "System Status".to_string(),
            description: "Current QuDAG node system status".to_string(),
            mime_type: "application/json".to_string(),
            content: None,
        },
        Resource {
            uri: "qudag://network/topology".to_string(),
            name: "Network Topology".to_string(),
            description: "P2P network topology and peer information".to_string(),
            mime_type: "application/json".to_string(),
            content: None,
        },
        Resource {
            uri: "qudag://dag/state".to_string(),
            name: "DAG State".to_string(),
            description: "Current DAG consensus state and metrics".to_string(),
            mime_type: "application/json".to_string(),
            content: None,
        },
        Resource {
            uri: "qudag://exchange/stats".to_string(),
            name: "Exchange Statistics".to_string(),
            description: "rUv token exchange statistics and metrics".to_string(),
            mime_type: "application/json".to_string(),
            content: None,
        },
        Resource {
            uri: "qudag://crypto/algorithms".to_string(),
            name: "Crypto Algorithms".to_string(),
            description: "Supported quantum-resistant algorithms".to_string(),
            mime_type: "application/json".to_string(),
            content: None,
        },
    ]
}

/// Get a specific resource by URI
pub async fn get_resource(state: &Arc<AppState>, uri: &str) -> Result<Resource> {
    match uri {
        "qudag://system/status" => {
            let network_peers = state.network.peer_count().await;
            let dag_height = state.dag_service.current_height().await;
            let exchange_accounts = state.exchange_service.total_accounts().await;
            
            let content = json!({
                "version": crate::VERSION,
                "uptime_seconds": 0, // TODO: Track uptime
                "network": {
                    "peer_count": network_peers,
                    "listening_addresses": state.network.listening_addresses().await,
                },
                "dag": {
                    "height": dag_height,
                    "consensus": state.dag_service.consensus_status().await,
                },
                "exchange": {
                    "total_accounts": exchange_accounts,
                    "total_supply": state.exchange_service.total_supply().await,
                },
            });
            
            Ok(Resource {
                uri: uri.to_string(),
                name: "System Status".to_string(),
                description: "Current QuDAG node system status".to_string(),
                mime_type: "application/json".to_string(),
                content: Some(serde_json::to_string_pretty(&content)?),
            })
        }
        
        "qudag://network/topology" => {
            let peers = state.network.list_peers().await;
            let listening_addrs = state.network.listening_addresses().await;
            
            let content = json!({
                "node_id": "local", // TODO: Get actual node ID
                "listening_addresses": listening_addrs,
                "connected_peers": peers,
                "peer_count": peers.len(),
                "protocols": ["gossipsub", "kademlia", "mdns", "ping", "relay"],
            });
            
            Ok(Resource {
                uri: uri.to_string(),
                name: "Network Topology".to_string(),
                description: "P2P network topology and peer information".to_string(),
                mime_type: "application/json".to_string(),
                content: Some(serde_json::to_string_pretty(&content)?),
            })
        }
        
        "qudag://dag/state" => {
            let height = state.dag_service.current_height().await;
            let status = state.dag_service.consensus_status().await;
            let pending = state.dag_service.pending_blocks().await;
            let tips = state.dag_service.get_tips().await?;
            
            let content = json!({
                "height": height,
                "consensus_status": status,
                "pending_blocks": pending,
                "tip_count": tips.len(),
                "tips": tips,
                "algorithm": "qr-avalanche",
                "finality_threshold": state.config.dag.finality_threshold,
            });
            
            Ok(Resource {
                uri: uri.to_string(),
                name: "DAG State".to_string(),
                description: "Current DAG consensus state and metrics".to_string(),
                mime_type: "application/json".to_string(),
                content: Some(serde_json::to_string_pretty(&content)?),
            })
        }
        
        "qudag://exchange/stats" => {
            let accounts = state.exchange_service.total_accounts().await;
            let supply = state.exchange_service.total_supply().await;
            
            let content = json!({
                "total_accounts": accounts,
                "total_supply": supply,
                "fee_model": {
                    "base_fee": state.config.exchange.fee_model.base_fee,
                    "minimum_fee": state.config.exchange.fee_model.minimum_fee,
                    "maximum_fee": state.config.exchange.fee_model.maximum_fee,
                    "dynamic_fee_enabled": state.config.exchange.fee_model.dynamic_fee_enabled,
                    "verified_agent_discount": state.config.exchange.fee_model.verified_agent_discount,
                },
                "business_plan": {
                    "enabled": state.config.exchange.business_plan_enabled,
                    "payout_threshold": state.config.exchange.payout_threshold,
                    "system_fee_percentage": state.config.exchange.system_fee_percentage,
                },
            });
            
            Ok(Resource {
                uri: uri.to_string(),
                name: "Exchange Statistics".to_string(),
                description: "rUv token exchange statistics and metrics".to_string(),
                mime_type: "application/json".to_string(),
                content: Some(serde_json::to_string_pretty(&content)?),
            })
        }
        
        "qudag://crypto/algorithms" => {
            let content = json!({
                "current_algorithm": state.config.crypto.algorithm,
                "supported_algorithms": [
                    {
                        "name": "ml-dsa",
                        "type": "signature",
                        "security_level": 3,
                        "description": "Module-Lattice Digital Signature Algorithm",
                    },
                    {
                        "name": "ml-kem",
                        "type": "encryption",
                        "security_level": 3,
                        "description": "Module-Lattice Key Encapsulation Mechanism",
                    },
                    {
                        "name": "hqc",
                        "type": "hybrid",
                        "security_level": 3,
                        "description": "Hamming Quasi-Cyclic",
                    },
                ],
                "timing_protection": state.config.crypto.enable_timing_protection,
                "hardware_acceleration": state.config.crypto.enable_hardware_acceleration,
            });
            
            Ok(Resource {
                uri: uri.to_string(),
                name: "Crypto Algorithms".to_string(),
                description: "Supported quantum-resistant algorithms".to_string(),
                mime_type: "application/json".to_string(),
                content: Some(serde_json::to_string_pretty(&content)?),
            })
        }
        
        _ => Err(anyhow::anyhow!("Resource not found: {}", uri)),
    }
}