//! MCP prompts implementation

use anyhow::Result;
use serde_json::json;
use std::sync::Arc;
use crate::{AppState, mcp::{Prompt, PromptArgument, ToolResult, ToolContent}};

/// List all available prompts
pub async fn list_all_prompts(state: &Arc<AppState>) -> Vec<Prompt> {
    vec![
        Prompt {
            name: "quantum_crypto_setup".to_string(),
            description: "Set up quantum-resistant cryptography for the node".to_string(),
            arguments: vec![
                PromptArgument {
                    name: "algorithm".to_string(),
                    description: "Quantum-resistant algorithm (ml-dsa, ml-kem, hqc)".to_string(),
                    required: true,
                    default: Some(json!("ml-dsa")),
                },
            ],
        },
        Prompt {
            name: "create_token_account".to_string(),
            description: "Create a new rUv token account with initial setup".to_string(),
            arguments: vec![
                PromptArgument {
                    name: "name".to_string(),
                    description: "Account name".to_string(),
                    required: true,
                    default: None,
                },
                PromptArgument {
                    name: "initial_balance".to_string(),
                    description: "Initial balance (0 for new accounts)".to_string(),
                    required: false,
                    default: Some(json!(0)),
                },
            ],
        },
        Prompt {
            name: "network_bootstrap".to_string(),
            description: "Bootstrap the P2P network with peers".to_string(),
            arguments: vec![
                PromptArgument {
                    name: "peers".to_string(),
                    description: "Comma-separated list of multiaddrs".to_string(),
                    required: false,
                    default: None,
                },
            ],
        },
        Prompt {
            name: "dag_status_report".to_string(),
            description: "Generate a comprehensive DAG status report".to_string(),
            arguments: vec![],
        },
        Prompt {
            name: "business_plan_setup".to_string(),
            description: "Set up exchange business plan with contributors".to_string(),
            arguments: vec![
                PromptArgument {
                    name: "enable".to_string(),
                    description: "Enable business plan (true/false)".to_string(),
                    required: true,
                    default: Some(json!(true)),
                },
                PromptArgument {
                    name: "threshold".to_string(),
                    description: "Payout threshold amount".to_string(),
                    required: false,
                    default: Some(json!(100)),
                },
            ],
        },
    ]
}

/// Execute a prompt by name
pub async fn execute_prompt(
    state: &Arc<AppState>,
    name: &str,
    params: serde_json::Value,
) -> Result<ToolResult> {
    match name {
        "quantum_crypto_setup" => {
            let algorithm = params["algorithm"].as_str()
                .unwrap_or("ml-dsa");
            
            // Generate keypair
            let keypair = state.crypto_service.generate_keypair(algorithm).await?;
            let public_key = keypair.public_key().to_base64();
            
            // Initialize crypto service
            state.crypto_service.initialize().await?;
            
            let message = format!(
                "Quantum-resistant cryptography initialized:\n\
                - Algorithm: {}\n\
                - Public Key: {}\n\
                - Timing Protection: {}\n\
                - Ready for secure operations",
                algorithm,
                &public_key[..32],
                state.config.crypto.enable_timing_protection
            );
            
            Ok(ToolResult {
                content: vec![ToolContent::text(message)],
            })
        }
        
        "create_token_account" => {
            let name = params["name"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Account name is required"))?;
            let initial_balance = params["initial_balance"].as_u64()
                .unwrap_or(0);
            
            // Create account
            let account = state.exchange_service.create_account(name).await?;
            
            let message = format!(
                "rUv Token Account Created:\n\
                - Account ID: {}\n\
                - Name: {}\n\
                - Balance: {} rUv\n\
                - Status: Active\n\
                - Fee Tier: Standard",
                account.id,
                account.name,
                account.balance
            );
            
            Ok(ToolResult {
                content: vec![ToolContent::text(message)],
            })
        }
        
        "network_bootstrap" => {
            let peers_str = params["peers"].as_str();
            let mut connected = Vec::new();
            let mut failed = Vec::new();
            
            if let Some(peers) = peers_str {
                for peer in peers.split(',') {
                    let peer = peer.trim();
                    match state.network.connect_peer(peer).await {
                        Ok(_) => connected.push(peer),
                        Err(e) => failed.push((peer, e.to_string())),
                    }
                }
            }
            
            // Use bootstrap peers from config if none provided
            if connected.is_empty() && failed.is_empty() {
                for peer in &state.config.network.bootstrap_peers {
                    match state.network.connect_peer(peer).await {
                        Ok(_) => connected.push(peer.as_str()),
                        Err(e) => failed.push((peer.as_str(), e.to_string())),
                    }
                }
            }
            
            let current_peers = state.network.peer_count().await;
            
            let mut message = format!(
                "Network Bootstrap Complete:\n\
                - Total Peers: {}\n\
                - Successfully Connected: {}\n",
                current_peers,
                connected.len()
            );
            
            if !connected.is_empty() {
                message.push_str("\nConnected to:\n");
                for peer in connected {
                    message.push_str(&format!("  ✓ {}\n", peer));
                }
            }
            
            if !failed.is_empty() {
                message.push_str("\nFailed connections:\n");
                for (peer, error) in failed {
                    message.push_str(&format!("  ✗ {}: {}\n", peer, error));
                }
            }
            
            Ok(ToolResult {
                content: vec![ToolContent::text(message)],
            })
        }
        
        "dag_status_report" => {
            let height = state.dag_service.current_height().await;
            let status = state.dag_service.consensus_status().await;
            let pending = state.dag_service.pending_blocks().await;
            let tips = state.dag_service.get_tips().await?;
            
            let message = format!(
                "DAG Status Report:\n\
                ================\n\
                Consensus: {}\n\
                Block Height: {}\n\
                Pending Blocks: {}\n\
                Active Tips: {}\n\
                \n\
                Configuration:\n\
                - Algorithm: {}\n\
                - Block Time: {}ms\n\
                - Finality Threshold: {}%\n\
                - Validator Set Size: {}\n\
                \n\
                Performance:\n\
                - Blocks/second: ~{:.2}\n\
                - Finality Time: ~{}ms",
                status,
                height,
                pending,
                tips.len(),
                state.config.dag.consensus_algorithm,
                state.config.dag.block_time_ms,
                state.config.dag.finality_threshold * 100.0,
                state.config.dag.validator_set_size,
                1000.0 / state.config.dag.block_time_ms as f64,
                state.config.dag.block_time_ms * 2
            );
            
            Ok(ToolResult {
                content: vec![ToolContent::text(message)],
            })
        }
        
        "business_plan_setup" => {
            let enable = params["enable"].as_bool()
                .unwrap_or(true);
            let threshold = params["threshold"].as_u64()
                .unwrap_or(100);
            
            if enable {
                state.exchange_service.enable_business_plan().await?;
                
                // Register default contributors
                state.exchange_service.register_contributor(
                    "system",
                    "system",
                    "system_vault",
                    Some(0.05),
                ).await?;
                
                let message = format!(
                    "Business Plan Enabled:\n\
                    ===================\n\
                    - Payout Threshold: {} rUv\n\
                    - System Fee: {}%\n\
                    - Fee Distribution:\n\
                    \n\
                    Single-agent (Autonomous Zero-person Businesses):\n\
                      • Agent: 95%\n\
                      • System: 5%\n\
                    \n\
                    Plugin-enhanced Agents:\n\
                      • Agent: 85%\n\
                      • Plugin Creators: 10%\n\
                      • System: 5%\n\
                    \n\
                    Node-operating Agents:\n\
                      • Agent: 80%\n\
                      • Node Operators: 15%\n\
                      • System: 5%\n\
                    \n\
                    Contributors can be registered with custom percentages.",
                    threshold,
                    state.config.exchange.system_fee_percentage * 100.0
                );
                
                Ok(ToolResult {
                    content: vec![ToolContent::text(message)],
                })
            } else {
                state.exchange_service.disable_business_plan().await?;
                
                Ok(ToolResult {
                    content: vec![ToolContent::text("Business plan disabled. Standard fee model active.".to_string())],
                })
            }
        }
        
        _ => Err(anyhow::anyhow!("Unknown prompt: {}", name)),
    }
}