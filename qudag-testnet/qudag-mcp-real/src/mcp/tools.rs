//! MCP tools implementation

use anyhow::Result;
use serde_json::json;
use std::sync::Arc;
use crate::{AppState, mcp::{Tool, ToolResult, ToolContent}};

/// List all available tools
pub async fn list_all_tools(state: &Arc<AppState>) -> Vec<Tool> {
    vec![
        // Crypto tools
        Tool {
            name: "crypto_generate_keypair".to_string(),
            description: "Generate a quantum-resistant keypair".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "algorithm": {
                        "type": "string",
                        "enum": ["ml-dsa", "ml-kem", "hqc"],
                        "description": "Quantum-resistant algorithm to use"
                    }
                },
                "required": ["algorithm"]
            }),
        },
        Tool {
            name: "crypto_sign".to_string(),
            description: "Sign a message with quantum-resistant signature".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Message to sign"
                    }
                },
                "required": ["message"]
            }),
        },
        Tool {
            name: "crypto_verify".to_string(),
            description: "Verify a quantum-resistant signature".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Original message"
                    },
                    "signature": {
                        "type": "string",
                        "description": "Hex-encoded signature"
                    },
                    "public_key": {
                        "type": "string",
                        "description": "Base64-encoded public key"
                    }
                },
                "required": ["message", "signature", "public_key"]
            }),
        },
        
        // Network tools
        Tool {
            name: "network_connect_peer".to_string(),
            description: "Connect to a P2P network peer".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "multiaddr": {
                        "type": "string",
                        "description": "Multiaddr of the peer to connect to"
                    }
                },
                "required": ["multiaddr"]
            }),
        },
        Tool {
            name: "network_list_peers".to_string(),
            description: "List connected P2P network peers".to_string(),
            input_schema: json!({"type": "object", "properties": {}}),
        },
        
        // DAG tools
        Tool {
            name: "dag_submit_block".to_string(),
            description: "Submit a new block to the DAG".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "data": {
                        "type": "string",
                        "description": "Block data to submit"
                    }
                },
                "required": ["data"]
            }),
        },
        Tool {
            name: "dag_get_status".to_string(),
            description: "Get DAG consensus status".to_string(),
            input_schema: json!({"type": "object", "properties": {}}),
        },
        Tool {
            name: "dag_get_vertex".to_string(),
            description: "Get information about a specific vertex".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "vertex_id": {
                        "type": "string",
                        "description": "Vertex ID to query"
                    }
                },
                "required": ["vertex_id"]
            }),
        },
        Tool {
            name: "dag_get_tips".to_string(),
            description: "Get current DAG tips".to_string(),
            input_schema: json!({"type": "object", "properties": {}}),
        },
        Tool {
            name: "dag_handle_vote".to_string(),
            description: "Handle a consensus vote for a vertex".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "vertex_id": {
                        "type": "string",
                        "description": "Vertex ID to vote on"
                    },
                    "peer_id": {
                        "type": "string",
                        "description": "ID of the voting peer"
                    },
                    "vote": {
                        "type": "boolean",
                        "description": "Vote (true for accept, false for reject)"
                    }
                },
                "required": ["vertex_id", "peer_id", "vote"]
            }),
        },
        
        // Exchange tools
        Tool {
            name: "exchange_create_account".to_string(),
            description: "Create a new rUv token account".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Account name"
                    }
                },
                "required": ["name"]
            }),
        },
        Tool {
            name: "exchange_get_balance".to_string(),
            description: "Get rUv token balance for an account".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "account": {
                        "type": "string",
                        "description": "Account name"
                    }
                },
                "required": ["account"]
            }),
        },
        Tool {
            name: "exchange_transfer".to_string(),
            description: "Transfer rUv tokens between accounts".to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "from": {
                        "type": "string",
                        "description": "Source account name"
                    },
                    "to": {
                        "type": "string",
                        "description": "Destination account name"
                    },
                    "amount": {
                        "type": "integer",
                        "description": "Amount to transfer"
                    }
                },
                "required": ["from", "to", "amount"]
            }),
        },
    ]
}

/// Execute a tool by name
pub async fn execute_tool(
    state: &Arc<AppState>,
    name: &str,
    params: serde_json::Value,
) -> Result<ToolResult> {
    match name {
        // Crypto tools
        "crypto_generate_keypair" => {
            let algorithm = params["algorithm"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing algorithm parameter"))?;
            
            let keypair = state.crypto_service.generate_keypair(algorithm).await?;
            let public_key = keypair.public_key().to_base64();
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "algorithm": algorithm,
                    "public_key": public_key,
                    "message": "Keypair generated successfully"
                }))],
            })
        }
        
        "crypto_sign" => {
            let message = params["message"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing message parameter"))?;
            
            let signature = state.crypto_service.sign(message.as_bytes()).await?;
            let public_key = state.crypto_service.public_key().await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "signature": hex::encode(signature),
                    "public_key": public_key,
                    "message": "Message signed successfully"
                }))],
            })
        }
        
        "crypto_verify" => {
            let message = params["message"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing message parameter"))?;
            let signature = params["signature"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing signature parameter"))?;
            let public_key = params["public_key"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing public_key parameter"))?;
            
            let sig_bytes = hex::decode(signature)?;
            let valid = state.crypto_service.verify(message.as_bytes(), &sig_bytes, public_key).await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "valid": valid,
                    "message": if valid { "Signature is valid" } else { "Signature is invalid" }
                }))],
            })
        }
        
        // Network tools
        "network_connect_peer" => {
            let multiaddr = params["multiaddr"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing multiaddr parameter"))?;
            
            state.network.connect_peer(multiaddr).await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::text(format!("Connected to peer: {}", multiaddr))],
            })
        }
        
        "network_list_peers" => {
            let peers = state.network.list_peers().await;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "peers": peers,
                    "count": peers.len()
                }))],
            })
        }
        
        // DAG tools
        "dag_submit_block" => {
            let data = params["data"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing data parameter"))?;
            
            // Get the DAG manager
            let dag_manager = state.dag_service.manager()
                .ok_or_else(|| anyhow::anyhow!("DAG manager not initialized"))?;
            
            // Submit vertex to DAG
            let result = dag_manager.read().await
                .add_vertex(data.as_bytes().to_vec()).await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "vertex_id": result.vertex_id,
                    "status": result.status,
                    "parents": result.parents,
                    "consensus_status": result.consensus_status,
                    "message": "Vertex submitted successfully"
                }))],
            })
        }
        
        "dag_get_status" => {
            // Get the DAG manager
            let dag_manager = state.dag_service.manager()
                .ok_or_else(|| anyhow::anyhow!("DAG manager not initialized"))?;
            
            // Get DAG statistics
            let stats = dag_manager.read().await.get_stats().await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "total_vertices": stats.get("total_vertices"),
                    "finalized_vertices": stats.get("finalized_vertices"),
                    "pending_vertices": stats.get("pending_vertices"),
                    "tips_count": stats.get("tips_count"),
                    "message": "DAG status retrieved successfully"
                }))],
            })
        }
        
        "dag_get_vertex" => {
            let vertex_id_str = params["vertex_id"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing vertex_id parameter"))?;
            
            // Get the DAG manager
            let dag_manager = state.dag_service.manager()
                .ok_or_else(|| anyhow::anyhow!("DAG manager not initialized"))?;
            
            // For now, we'll create a simple vertex ID lookup
            // In a real implementation, we'd parse the string to VertexId
            // This is a placeholder that needs proper vertex ID parsing
            let vertex_id = qudag_dag::VertexId::new(); // Temporary - needs proper parsing
            
            // Get vertex information
            let vertex_info = dag_manager.read().await
                .get_vertex(&vertex_id).await?;
            
            match vertex_info {
                Some(info) => Ok(ToolResult {
                    content: vec![ToolContent::json(json!(info))],
                }),
                None => Ok(ToolResult {
                    content: vec![ToolContent::json(json!({
                        "error": "Vertex not found",
                        "vertex_id": vertex_id_str
                    }))],
                }),
            }
        }
        
        "dag_get_tips" => {
            // Get the DAG manager
            let dag_manager = state.dag_service.manager()
                .ok_or_else(|| anyhow::anyhow!("DAG manager not initialized"))?;
            
            // Get current tips
            let tips = dag_manager.read().await.get_tips().await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "tips": tips.iter().map(|t| t.to_string()).collect::<Vec<_>>(),
                    "count": tips.len(),
                    "message": "DAG tips retrieved successfully"
                }))],
            })
        }
        
        "dag_handle_vote" => {
            let vertex_id_str = params["vertex_id"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing vertex_id parameter"))?;
            let peer_id = params["peer_id"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing peer_id parameter"))?;
            let vote = params["vote"].as_bool()
                .ok_or_else(|| anyhow::anyhow!("Missing or invalid vote parameter"))?;
            
            // Get the DAG manager
            let dag_manager = state.dag_service.manager()
                .ok_or_else(|| anyhow::anyhow!("DAG manager not initialized"))?;
            
            // For now, we'll create a simple vertex ID lookup
            // In a real implementation, we'd parse the string to VertexId
            // This is a placeholder that needs proper vertex ID parsing
            let vertex_id = qudag_dag::VertexId::new(); // Temporary - needs proper parsing
            
            // Handle consensus vote
            dag_manager.read().await
                .handle_consensus_vote(vertex_id, peer_id.to_string(), vote).await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "vertex_id": vertex_id_str,
                    "peer_id": peer_id,
                    "vote": vote,
                    "message": "Vote handled successfully"
                }))],
            })
        }
        
        // Exchange tools
        "exchange_create_account" => {
            let name = params["name"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing name parameter"))?;
            
            let account = state.exchange_service.create_account(name).await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "account_id": account.id,
                    "name": account.name,
                    "balance": account.balance,
                    "message": "Account created successfully"
                }))],
            })
        }
        
        "exchange_get_balance" => {
            let account = params["account"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing account parameter"))?;
            
            let balance = state.exchange_service.get_balance(account).await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "account": account,
                    "balance": balance
                }))],
            })
        }
        
        "exchange_transfer" => {
            let from = params["from"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing from parameter"))?;
            let to = params["to"].as_str()
                .ok_or_else(|| anyhow::anyhow!("Missing to parameter"))?;
            let amount = params["amount"].as_u64()
                .ok_or_else(|| anyhow::anyhow!("Missing or invalid amount parameter"))?;
            
            let tx_id = state.exchange_service.transfer(from, to, amount).await?;
            
            Ok(ToolResult {
                content: vec![ToolContent::json(json!({
                    "transaction_id": tx_id,
                    "from": from,
                    "to": to,
                    "amount": amount,
                    "message": "Transfer completed successfully"
                }))],
            })
        }
        
        _ => Err(anyhow::anyhow!("Unknown tool: {}", name)),
    }
}