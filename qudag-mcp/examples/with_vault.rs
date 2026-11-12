//! QuDAG MCP Server with Vault Integration Example
//!
//! This example demonstrates how to create an MCP server with enhanced
//! vault integration, showing secure secret management and authentication.

use base64::Engine as _;
use qudag_mcp::protocol::{InitializeParams, MCPMessage, MCPRequest};
use qudag_mcp::{resources, tools, transport};
use qudag_mcp::{
    ClientInfo, QuDAGMCPServer, ResourceURI, ServerCapabilities, ServerConfig, ServerInfo,
    ToolName, ToolResultContent,
};
use std::collections::HashMap;

/// Parse the JSON payload of the first text content item of a tool result
fn tool_json(
    content: &[ToolResultContent],
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    match content.first() {
        Some(ToolResultContent::Text { text }) => Ok(serde_json::from_str(text)?),
        _ => Err("tool returned no text content".into()),
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔐 QuDAG MCP Server with Vault Integration");
    println!("=========================================");

    // Create server configuration with enhanced security
    let mut capabilities = ServerCapabilities::default();

    // Add vault-specific capabilities
    if let Some(ref mut experimental) = capabilities.experimental {
        experimental.insert(
            "vault_integration".to_string(),
            serde_json::json!({
                "enabled": true,
                "features": ["secret_management", "authentication", "encryption"]
            }),
        );
        experimental.insert(
            "quantum_crypto".to_string(),
            serde_json::json!({
                "algorithms": ["ML-KEM", "ML-DSA", "HQC"],
                "security_levels": [2, 3, 5]
            }),
        );
    }

    let config = ServerConfig {
        server_info: ServerInfo::new("QuDAG MCP Vault Server", "1.0.0"),
        capabilities,
        transport: transport::TransportConfig::Stdio,
        log_level: "info".to_string(),
    };

    println!("🏗️  Creating secure MCP server...");
    let server = QuDAGMCPServer::new(config).await?;

    // Display security features
    println!("\n🔒 Security Features Enabled:");
    println!("  ✓ Quantum-resistant cryptography");
    println!("  ✓ Secure vault integration");
    println!("  ✓ Authentication support");
    println!("  ✓ Encrypted communications");

    // Demonstrate vault operations
    println!("\n💾 Demonstrating Vault Operations:");

    let resource_registry = resources::ResourceRegistry::new();

    // Inspect the vault entry index (metadata only, no secrets)
    let entries_uri = ResourceURI::new("vault://entries");
    let entries_data = resource_registry.read_resource(&entries_uri).await?;

    if let Some(text) = &entries_data[0].text {
        let vault: serde_json::Value = serde_json::from_str(text)?;
        let info = &vault["vault_info"];
        println!(
            "  📊 Vault Entries: {}",
            info["total_entries"].as_u64().unwrap_or(0)
        );

        if let Some(encryption) = info.get("encryption") {
            println!(
                "  🔐 Encryption: {} (KDF {})",
                encryption["algorithm"].as_str().unwrap_or("unknown"),
                encryption["kdf"].as_str().unwrap_or("unknown")
            );
            let quantum_resistant = encryption["quantum_resistant"].as_bool().unwrap_or(false);
            println!(
                "  ✅ Quantum Resistant: {}",
                if quantum_resistant { "YES" } else { "NO" }
            );
        }
    }

    // Demonstrate cryptographic operations
    println!("\n🔑 Demonstrating Quantum-Resistant Cryptography:");

    let tool_registry = tools::ToolRegistry::new();
    let crypto = ToolName::new("crypto");

    // Test different quantum-resistant algorithms
    let algorithms = vec![
        ("ml-kem-768", "Key Encapsulation Mechanism"),
        ("ml-dsa-65", "Digital Signature Algorithm"),
    ];

    for (algo, description) in algorithms {
        println!("  🧮 Testing {}: {}", algo, description);

        let keygen_args = serde_json::json!({
            "operation": "generateKeypair",
            "algorithm": algo
        });

        let result = tool_registry.call_tool(&crypto, Some(keygen_args)).await?;
        let key_data = tool_json(&result.content)?;
        println!(
            "    ✓ Generated {} keypair (quantum resistant: {})",
            key_data["algorithm"].as_str().unwrap_or("unknown"),
            key_data["quantumResistant"].as_bool().unwrap_or(false)
        );
    }

    // Demonstrate signature operations
    println!("\n✍️  Digital Signature Demo:");

    let test_data = "Hello, QuDAG MCP!";
    let test_data_b64 = base64::engine::general_purpose::STANDARD.encode(test_data.as_bytes());

    // Sign data
    let sign_args = serde_json::json!({
        "operation": "sign",
        "data": test_data_b64,
        "privateKey": "mock_private_key_for_demo"
    });

    let sign_result = tool_registry.call_tool(&crypto, Some(sign_args)).await?;
    let sign_data = tool_json(&sign_result.content)?;
    println!(
        "  ✓ Data signed using {}",
        sign_data["algorithm"].as_str().unwrap_or("unknown")
    );

    // Verify signature
    let verify_args = serde_json::json!({
        "operation": "verify",
        "data": test_data_b64,
        "signature": sign_data["signature"],
        "publicKey": "mock_public_key_for_demo"
    });

    let verify_result = tool_registry.call_tool(&crypto, Some(verify_args)).await?;
    let verify_data = tool_json(&verify_result.content)?;
    let is_valid = verify_data["valid"].as_bool().unwrap_or(false);
    println!(
        "  {} Signature verification: {}",
        if is_valid { "✅" } else { "❌" },
        if is_valid { "VALID" } else { "INVALID" }
    );

    // Demonstrate network security
    println!("\n🌐 Network Security Features:");

    let network_uri = ResourceURI::new("network://peers");
    let network_data = resource_registry.read_resource(&network_uri).await?;

    if let Some(text) = &network_data[0].text {
        let network: serde_json::Value = serde_json::from_str(text)?;

        if let Some(peers) = network["peers"].as_array() {
            println!("  👥 Known Peers: {}", peers.len());

            for (i, peer) in peers.iter().enumerate().take(3) {
                let peer_id = peer["id"].as_str().unwrap_or("unknown");
                let latency = peer["latency_ms"].as_f64().unwrap_or(0.0);
                println!("    {}. {} ({:.1}ms latency)", i + 1, peer_id, latency);
            }
        }
    }

    // Authentication simulation
    println!("\n🔐 Authentication System Demo:");

    // Build the client side of the MCP initialize handshake
    let client_info = ClientInfo::new("Secure QuDAG Client", "1.0.0");
    let mut client_capabilities = HashMap::new();
    client_capabilities.insert(
        "authentication".to_string(),
        serde_json::json!({
            "method": "vault_token",
            "secure": true
        }),
    );

    println!("  📋 Client Authentication Request:");
    println!("    - Client: {}", client_info.name);
    println!("    - Version: {}", client_info.version);
    println!("    - Auth Method: vault_token");

    // The initialize request a client sends over the stdio transport
    let init_request = MCPRequest::initialize(client_info, client_capabilities);
    let init_json = MCPMessage::Request(init_request.clone()).to_json()?;
    let params: InitializeParams = serde_json::from_value(init_request.params.unwrap_or_default())?;
    println!(
        "  📤 initialize request ready ({} bytes, protocol {})",
        init_json.len(),
        params.protocol_version
    );

    // Performance and security metrics
    println!("\n📊 Security & Performance Summary:");
    let server_stats = server.stats().await;

    println!("  🔧 Tools Available: {}", server_stats.tools_count);
    println!("  📦 Resources Available: {}", server_stats.resources_count);
    println!("  🔒 Security Level: Quantum-Resistant");

    demonstrate_secure_messaging()?;

    // Security recommendations
    println!("\n💡 Security Recommendations:");
    println!("  🔐 Use strong authentication tokens");
    println!("  🔄 Rotate encryption keys regularly");
    println!("  📝 Monitor vault access logs");
    println!("  🛡️  Enable all security features in production");
    println!("  🔍 Regular security audits recommended");

    println!("\n✨ QuDAG MCP Vault Integration Demo Completed!");

    Ok(())
}

/// Demonstrate building an encrypt request for secure message handling
fn demonstrate_secure_messaging() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n🔒 Secure Message Handling:");

    // Create a tools/call request for the crypto tool's encrypt operation
    let sensitive_data = "Confidential QuDAG Data";
    let encrypt_request = MCPRequest::call_tool(
        "crypto",
        serde_json::json!({
            "operation": "encrypt",
            "data": base64::engine::general_purpose::STANDARD.encode(sensitive_data.as_bytes()),
            "publicKey": "production_public_key"
        }),
    );

    println!("  📤 Encrypt request created");

    // Serialize for transmission
    let message = MCPMessage::Request(encrypt_request);
    let _secure_json = message.to_json()?;

    println!("  📡 Ready for transmission");

    Ok(())
}
