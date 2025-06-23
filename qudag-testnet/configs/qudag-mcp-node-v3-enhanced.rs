// QuDAG Node v3 Enhanced - Improved MCP Tool Descriptions
// This file contains the enhanced init_mcp_tools function with better descriptions

fn init_mcp_tools() -> HashMap<String, serde_json::Value> {
    let mut tools = HashMap::new();
    
    // DAG Operations
    tools.insert("qudag_dag".to_string(), json!({
        "name": "qudag_dag",
        "description": "QuDAG Directed Acyclic Graph operations including consensus, finality, and tip selection",
        "inputSchema": {
            "type": "object",
            "required": ["operation"],
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The DAG operation to perform",
                    "enum": ["get_status", "add_vertex", "get_tips", "validate", "query_finality", "get_vertex"]
                },
                "vertex_id": {
                    "type": "string",
                    "description": "Vertex ID for query operations"
                },
                "data": {
                    "type": "string",
                    "description": "Data payload for submit operation"
                },
                "depth": {
                    "type": "integer",
                    "description": "Query depth limit for traversal operations",
                    "minimum": 1,
                    "maximum": 100
                }
            }
        }
    }));
    
    // Vault Operations
    tools.insert("qudag_vault".to_string(), json!({
        "name": "qudag_vault",
        "description": "QuDAG quantum-resistant password vault operations including create, read, update, delete entries and password generation",
        "inputSchema": {
            "type": "object",
            "required": ["operation"],
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The vault operation to perform",
                    "enum": ["create", "unlock", "store", "retrieve", "list", "update", "remove", "generate_password"]
                },
                "label": {
                    "type": "string",
                    "description": "Entry label for store, retrieve, update, remove operations"
                },
                "username": {
                    "type": "string",
                    "description": "Username for vault entries"
                },
                "password": {
                    "type": "string",
                    "description": "Password for store/update operations (use generate_password for secure generation)"
                },
                "category": {
                    "type": "string",
                    "description": "Category filter for list operation",
                    "enum": ["personal", "work", "finance", "social", "development", "darknet"]
                },
                "generate": {
                    "type": "boolean",
                    "description": "Generate password for store/update operations"
                },
                "length": {
                    "type": "integer",
                    "description": "Password length for generation",
                    "minimum": 8,
                    "maximum": 64,
                    "default": 16
                },
                "symbols": {
                    "type": "boolean",
                    "description": "Include symbols in generated password",
                    "default": true
                },
                "numbers": {
                    "type": "boolean",
                    "description": "Include numbers in generated password",
                    "default": true
                }
            }
        }
    }));
    
    // Network Operations
    tools.insert("qudag_network".to_string(), json!({
        "name": "qudag_network",
        "description": "QuDAG P2P network operations including peer management, discovery, and dark addressing",
        "inputSchema": {
            "type": "object",
            "required": ["operation"],
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The network operation to perform",
                    "enum": ["list_peers", "connect", "disconnect", "broadcast", "resolve_dark_domain", "register_dark_domain", "get_network_stats"]
                },
                "peer_address": {
                    "type": "string",
                    "description": "Peer multiaddr for connect/disconnect operations (e.g., /ip4/1.2.3.4/tcp/4001)"
                },
                "domain": {
                    "type": "string",
                    "description": "Dark domain for resolve/register operations (e.g., mynode.dark)"
                },
                "message": {
                    "type": "string",
                    "description": "Message content for broadcast operation"
                },
                "ttl": {
                    "type": "integer",
                    "description": "Time-to-live for dark domain registration (hours)",
                    "minimum": 1,
                    "maximum": 8760,
                    "default": 720
                }
            }
        }
    }));
    
    // Cryptography Operations
    tools.insert("qudag_crypto".to_string(), json!({
        "name": "qudag_crypto",
        "description": "QuDAG quantum-resistant cryptographic operations including key generation, signing, verification, hashing, and encryption",
        "inputSchema": {
            "type": "object",
            "required": ["operation"],
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The cryptographic operation to perform",
                    "enum": ["generate_keys", "sign", "verify", "encrypt", "decrypt", "hash", "fingerprint"]
                },
                "algorithm": {
                    "type": "string",
                    "description": "Cryptographic algorithm to use",
                    "enum": ["ml-dsa", "ml-kem", "hqc", "blake3", "chacha20poly1305"],
                    "default": "ml-dsa"
                },
                "data": {
                    "type": "string",
                    "description": "Data to sign, verify, hash, encrypt, or decrypt (base64 encoded)"
                },
                "signature": {
                    "type": "string",
                    "description": "Signature to verify (base64 encoded)"
                },
                "publicKey": {
                    "type": "string",
                    "description": "Public key for verification or encryption (base64 encoded)"
                },
                "privateKey": {
                    "type": "string",
                    "description": "Private key for signing or decryption (base64 encoded)"
                },
                "format": {
                    "type": "string",
                    "description": "Output format for keys",
                    "enum": ["base64", "hex", "pem"],
                    "default": "base64"
                }
            }
        }
    }));
    
    // Exchange Operations
    tools.insert("qudag_exchange".to_string(), json!({
        "name": "qudag_exchange",
        "description": "QuDAG Exchange operations for rUv tokens - decentralized resource trading on the darknet",
        "inputSchema": {
            "type": "object",
            "required": ["operation"],
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The exchange operation to perform",
                    "enum": ["get_balance", "transfer", "get_fees", "list_accounts", "get_exchange_rate", "create_account", "verify_agent"]
                },
                "account_id": {
                    "type": "string",
                    "description": "Account identifier for balance queries and transfers"
                },
                "from_account": {
                    "type": "string",
                    "description": "Source account for transfers"
                },
                "to_account": {
                    "type": "string",
                    "description": "Destination account for transfers"
                },
                "amount": {
                    "type": "number",
                    "description": "Amount of rUv tokens for transfers",
                    "minimum": 0.01
                },
                "memo": {
                    "type": "string",
                    "description": "Optional memo for transactions (max 256 chars)",
                    "maxLength": 256
                },
                "account_name": {
                    "type": "string",
                    "description": "Name for new account creation"
                }
            }
        }
    }));
    
    // System Information (limited for remote users)
    tools.insert("qudag_system".to_string(), json!({
        "name": "qudag_system",
        "description": "QuDAG system information and network health monitoring",
        "inputSchema": {
            "type": "object",
            "required": ["operation"],
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The system operation to perform",
                    "enum": ["get_info", "get_network_health", "get_node_metrics", "get_version"]
                },
                "detailed": {
                    "type": "boolean",
                    "description": "Return detailed information",
                    "default": false
                }
            }
        }
    }));
    
    // Dark Services (special darknet features)
    tools.insert("qudag_dark".to_string(), json!({
        "name": "qudag_dark",
        "description": "QuDAG darknet-specific services including onion routing, shadow addresses, and anonymous messaging",
        "inputSchema": {
            "type": "object",
            "required": ["operation"],
            "properties": {
                "operation": {
                    "type": "string",
                    "description": "The dark service operation to perform",
                    "enum": ["create_shadow_address", "send_anonymous_message", "create_onion_route", "get_dark_stats"]
                },
                "hops": {
                    "type": "integer",
                    "description": "Number of onion routing hops",
                    "minimum": 3,
                    "maximum": 7,
                    "default": 5
                },
                "ttl": {
                    "type": "integer",
                    "description": "Time-to-live for shadow addresses (minutes)",
                    "minimum": 5,
                    "maximum": 1440,
                    "default": 60
                },
                "recipient": {
                    "type": "string",
                    "description": "Recipient dark address or public key"
                },
                "message": {
                    "type": "string",
                    "description": "Message content for anonymous messaging"
                }
            }
        }
    }));
    
    tools
}

// Enhanced handle_mcp_tools_list function
fn handle_mcp_tools_list(mcp_state: &Arc<Mutex<McpState>>) -> String {
    let mcp_lock = mcp_state.lock().unwrap();
    let tools_vec: Vec<serde_json::Value> = mcp_lock.tools.values()
        .map(|tool| {
            json!({
                "name": tool["name"],
                "description": tool["description"],
                "inputSchema": tool["inputSchema"]
            })
        })
        .collect();
    
    let response = json!({
        "tools": tools_vec
    });
    
    create_simple_response("200 OK", "application/json", &response.to_string())
}