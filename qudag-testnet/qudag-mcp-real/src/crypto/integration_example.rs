// src/crypto/integration_example.rs
// Example of integrating crypto module into the main MCP server

use anyhow::Result;
use serde_json::Value;
use crate::crypto::{CryptoState, handle_crypto_tool};

/// Example integration with the MCP server
pub struct McpCryptoIntegration {
    crypto_state: CryptoState,
}

impl McpCryptoIntegration {
    /// Create new MCP crypto integration
    pub async fn new() -> Result<Self> {
        let mut crypto_state = CryptoState::new()?;
        crypto_state.initialize().await?;
        
        Ok(Self { crypto_state })
    }
    
    /// Handle MCP tool request
    pub async fn handle_tool(&self, tool_name: &str, args: Value) -> Result<Value> {
        // Check if this is a crypto tool
        if tool_name.starts_with("qudag_key_") || 
           tool_name.starts_with("qudag_sign") ||
           tool_name.starts_with("qudag_verify") ||
           tool_name.starts_with("qudag_encrypt") ||
           tool_name.starts_with("qudag_decrypt") ||
           tool_name.starts_with("qudag_fingerprint_") ||
           tool_name.starts_with("qudag_vault_") {
            return handle_crypto_tool(&self.crypto_state, tool_name, args).await;
        }
        
        // Not a crypto tool
        Err(anyhow::anyhow!("Not a crypto tool: {}", tool_name))
    }
    
    /// Get crypto tool definitions for MCP
    pub fn get_tool_definitions() -> Vec<serde_json::Value> {
        vec![
            // Key generation
            serde_json::json!({
                "name": "qudag_key_generate",
                "description": "Generate quantum-resistant key pair (ML-DSA, ML-KEM, or HQC)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "algorithm": {
                            "type": "string",
                            "enum": ["ml-dsa", "ml-kem", "hqc"],
                            "description": "Quantum-resistant algorithm to use"
                        }
                    },
                    "required": ["algorithm"]
                }
            }),
            
            // Signing
            serde_json::json!({
                "name": "qudag_sign",
                "description": "Sign data with ML-DSA quantum-resistant signature",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "Message to sign"
                        },
                        "key_id": {
                            "type": "string",
                            "description": "ID of the signing key"
                        }
                    },
                    "required": ["message", "key_id"]
                }
            }),
            
            // Verification
            serde_json::json!({
                "name": "qudag_verify",
                "description": "Verify ML-DSA signature",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "signature": {
                            "type": "string",
                            "description": "Base64-encoded signature"
                        },
                        "message": {
                            "type": "string",
                            "description": "Original message"
                        },
                        "public_key": {
                            "type": "string",
                            "description": "Base64-encoded public key"
                        }
                    },
                    "required": ["signature", "message", "public_key"]
                }
            }),
            
            // Encryption
            serde_json::json!({
                "name": "qudag_encrypt",
                "description": "Encrypt data with ML-KEM quantum-resistant encryption",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "data": {
                            "type": "string",
                            "description": "Data to encrypt"
                        },
                        "recipient": {
                            "type": "string",
                            "description": "Recipient's public key (base64)"
                        }
                    },
                    "required": ["data", "recipient"]
                }
            }),
            
            // Decryption
            serde_json::json!({
                "name": "qudag_decrypt",
                "description": "Decrypt ML-KEM encrypted data",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "ciphertext": {
                            "type": "string",
                            "description": "Base64-encoded ciphertext"
                        },
                        "encapsulated_key": {
                            "type": "string",
                            "description": "Base64-encoded encapsulated key"
                        },
                        "key_id": {
                            "type": "string",
                            "description": "ID of the decryption key"
                        }
                    },
                    "required": ["ciphertext", "encapsulated_key", "key_id"]
                }
            }),
            
            // Fingerprinting
            serde_json::json!({
                "name": "qudag_fingerprint_create",
                "description": "Create quantum fingerprint of data",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "data": {
                            "type": "string",
                            "description": "Data to fingerprint"
                        }
                    },
                    "required": ["data"]
                }
            }),
            
            serde_json::json!({
                "name": "qudag_fingerprint_verify",
                "description": "Verify quantum fingerprint",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "fingerprint": {
                            "type": "string",
                            "description": "Base64-encoded fingerprint"
                        },
                        "data": {
                            "type": "string",
                            "description": "Data to verify against"
                        }
                    },
                    "required": ["fingerprint", "data"]
                }
            }),
            
            // Key management
            serde_json::json!({
                "name": "qudag_key_list",
                "description": "List all generated keys",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }),
            
            serde_json::json!({
                "name": "qudag_key_export",
                "description": "Export public key in specified format",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "key_id": {
                            "type": "string",
                            "description": "ID of the key to export"
                        },
                        "format": {
                            "type": "string",
                            "enum": ["base64", "pem", "jwk"],
                            "description": "Export format"
                        }
                    },
                    "required": ["key_id"]
                }
            }),
            
            serde_json::json!({
                "name": "qudag_key_import",
                "description": "Import public key",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "key_data": {
                            "type": "string",
                            "description": "Key data (PEM or base64)"
                        },
                        "algorithm": {
                            "type": "string",
                            "enum": ["ml-dsa", "ml-kem", "hqc"],
                            "description": "Key algorithm"
                        }
                    },
                    "required": ["key_data", "algorithm"]
                }
            }),
            
            // Vault operations
            serde_json::json!({
                "name": "qudag_vault_create",
                "description": "Create new secure vault",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Vault name"
                        }
                    },
                    "required": ["name"]
                }
            }),
            
            serde_json::json!({
                "name": "qudag_vault_unlock",
                "description": "Unlock vault for operations",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Vault name"
                        },
                        "password": {
                            "type": "string",
                            "description": "Vault password (optional, uses env var if not provided)"
                        }
                    },
                    "required": ["name"]
                }
            }),
            
            serde_json::json!({
                "name": "qudag_vault_list",
                "description": "List vault entries",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }),
        ]
    }
}

/// Example usage in main.rs or mcp/mod.rs
pub async fn integrate_crypto_with_mcp() -> Result<()> {
    // Create crypto integration
    let crypto = McpCryptoIntegration::new().await?;
    
    // Example: Generate a key
    let result = crypto.handle_tool(
        "qudag_key_generate",
        serde_json::json!({ "algorithm": "ml-dsa" })
    ).await?;
    
    println!("Generated key: {}", result["key_id"]);
    
    // Example: Sign data
    let sign_result = crypto.handle_tool(
        "qudag_sign",
        serde_json::json!({
            "message": "Hello, quantum world!",
            "key_id": result["key_id"]
        })
    ).await?;
    
    println!("Signature: {}", sign_result["signature"]);
    
    Ok(())
}