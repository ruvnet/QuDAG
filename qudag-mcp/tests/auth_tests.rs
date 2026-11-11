//! Authentication and security tests with vault integration

use qudag_mcp::protocol::{InitializeParams, MCPRequest};
use qudag_mcp::resources::ResourceRegistry;
use qudag_mcp::tools::ToolRegistry;
use qudag_mcp::{
    ClientInfo, Error, QuDAGMCPServer, ResourceURI, ServerCapabilities, ServerConfig, ServerState,
    ToolName, ToolResultContent,
};
use std::collections::HashMap;
use std::time::Duration;

/// Parse the JSON payload of the first text content item of a tool result
fn tool_result_json(content: &[ToolResultContent]) -> serde_json::Value {
    match &content[0] {
        ToolResultContent::Text { text } => serde_json::from_str(text).unwrap(),
        other => panic!("Expected text content in tool result, got {:?}", other),
    }
}

/// Read a resource and parse its single JSON text content
async fn read_json_resource(registry: &ResourceRegistry, uri: &str) -> serde_json::Value {
    let contents = registry
        .read_resource(&ResourceURI::new(uri))
        .await
        .unwrap();
    assert_eq!(contents.len(), 1);
    serde_json::from_str(contents[0].text.as_ref().unwrap()).unwrap()
}

#[tokio::test]
async fn test_basic_authentication_flow() {
    // A client advertises its authentication capabilities in the initialize request
    let mut capabilities = HashMap::new();
    capabilities.insert(
        "authentication".to_string(),
        serde_json::json!({
            "supported_methods": ["oauth2", "api_key"],
            "token_refresh": true
        }),
    );

    let request = MCPRequest::initialize(
        ClientInfo::new("Authenticated Client", "1.0.0"),
        capabilities,
    );

    // Verify authentication capabilities are carried to the server
    let params: InitializeParams = serde_json::from_value(request.params.unwrap()).unwrap();
    assert_eq!(params.client_info.name, "Authenticated Client");
    assert!(params.capabilities.contains_key("authentication"));
    assert_eq!(params.capabilities["authentication"]["token_refresh"], true);
}

#[tokio::test]
async fn test_server_authentication_capabilities() {
    let mut server_capabilities = ServerCapabilities::default();

    // Add authentication to experimental capabilities
    if let Some(ref mut experimental) = server_capabilities.experimental {
        experimental.insert(
            "authentication".to_string(),
            serde_json::json!({
                "required": false,
                "methods": ["oauth2", "api_key", "vault_token"],
                "token_validation": true
            }),
        );
    }

    let mut config = ServerConfig::new().with_server_info("Secure QuDAG MCP Server", "1.0.0");
    config.capabilities = server_capabilities;

    // The advertised capabilities serialize with the authentication block
    let advertised = serde_json::to_value(&config.capabilities).unwrap();
    assert_eq!(
        advertised["experimental"]["authentication"]["methods"][2],
        "vault_token"
    );

    let server = QuDAGMCPServer::new(config).await.unwrap();

    // Test server starts uninitialized until a client completes the handshake
    let stats = server.stats().await;
    assert!(matches!(stats.state, ServerState::Uninitialized));
    assert!(!stats.client_connected);
}

#[tokio::test]
async fn test_vault_integration_security() {
    let registry = ResourceRegistry::new();

    // Test accessing vault resources
    let vault_resources = registry.list_resources().await.unwrap();
    let vault_uris: Vec<&str> = vault_resources
        .iter()
        .map(|r| r.uri.as_str())
        .filter(|uri| uri.starts_with("vault://"))
        .collect();

    assert!(!vault_uris.is_empty());

    // Test reading vault entries (should not expose sensitive data)
    let data = read_json_resource(&registry, "vault://entries").await;
    let encryption = &data["vault_info"]["encryption"];
    assert!(encryption["algorithm"].is_string());
    assert_eq!(encryption["quantum_resistant"], true);

    // Ensure no secret material is exposed in the entry listing
    let entries = data["entries"].as_array().unwrap();
    assert!(!entries.is_empty());
    for entry in entries {
        for field in ["password", "secret", "private_key", "token"] {
            assert!(
                entry.get(field).is_none(),
                "vault entry {} exposes field {}",
                entry["id"],
                field
            );
        }
    }
}

#[tokio::test]
async fn test_crypto_tool_security() {
    let registry = ToolRegistry::new();

    // Test crypto key generation (should be quantum-resistant)
    let keygen_args = serde_json::json!({
        "operation": "generateKeypair",
        "algorithm": "ml-kem-768"
    });

    let tool_name = ToolName::new("crypto");
    let result = registry
        .call_tool(&tool_name, Some(keygen_args))
        .await
        .unwrap();

    assert_eq!(result.is_error, Some(false));

    let key_data = tool_result_json(&result.content);

    // Verify quantum-resistant algorithm is used
    assert_eq!(key_data["algorithm"], "ml-kem-768");
    assert_eq!(key_data["quantumResistant"], true);

    // Verify key material is present (mock data in this case)
    assert!(key_data["publicKey"].is_string());
    assert!(key_data["privateKey"].is_string());
    assert!(key_data["keyId"].is_string());
    assert!(key_data["format"].is_string());
}

#[tokio::test]
async fn test_signature_verification_security() {
    let registry = ToolRegistry::new();
    let crypto = ToolName::new("crypto");

    // Test digital signature creation
    let sign_args = serde_json::json!({
        "operation": "sign",
        "data": "SGVsbG8gV29ybGQ=", // "Hello World" in base64
        "privateKey": "mock_private_key_data"
    });

    let sign_result = registry.call_tool(&crypto, Some(sign_args)).await.unwrap();
    assert_eq!(sign_result.is_error, Some(false));
    let sign_data = tool_result_json(&sign_result.content);
    assert!(sign_data["signature"].is_string());
    assert_eq!(sign_data["algorithm"], "ml-dsa-65");

    // Test signature verification
    let verify_args = serde_json::json!({
        "operation": "verify",
        "data": "SGVsbG8gV29ybGQ=",
        "signature": sign_data["signature"],
        "publicKey": "mock_public_key_data"
    });

    let verify_result = registry
        .call_tool(&crypto, Some(verify_args))
        .await
        .unwrap();

    assert_eq!(verify_result.is_error, Some(false));

    let verify_data = tool_result_json(&verify_result.content);
    assert!(verify_data["valid"].is_boolean());
    assert_eq!(verify_data["algorithm"], "ml-dsa-65");

    // Signing without a private key is rejected
    let error = registry
        .call_tool(
            &crypto,
            Some(serde_json::json!({"operation": "sign", "data": "SGVsbG8="})),
        )
        .await
        .unwrap_err();
    assert_eq!(error.error_code(), -32600);
}

#[tokio::test]
async fn test_encryption_security() {
    let registry = ToolRegistry::new();
    let crypto = ToolName::new("crypto");

    // Test encryption
    let encrypt_args = serde_json::json!({
        "operation": "encrypt",
        "data": "U2VjcmV0IE1lc3NhZ2U=", // "Secret Message" in base64
        "publicKey": "mock_public_key_data"
    });

    let encrypt_result = registry
        .call_tool(&crypto, Some(encrypt_args))
        .await
        .unwrap();

    assert_eq!(encrypt_result.is_error, Some(false));

    let encrypt_data = tool_result_json(&encrypt_result.content);
    assert!(encrypt_data["encryptedData"].is_string());
    assert_eq!(encrypt_data["algorithm"], "ml-kem-768");
    assert_eq!(encrypt_data["quantumResistant"], true);

    // Test decryption
    let decrypt_args = serde_json::json!({
        "operation": "decrypt",
        "encryptedData": encrypt_data["encryptedData"],
        "privateKey": "mock_private_key_data"
    });

    let decrypt_result = registry
        .call_tool(&crypto, Some(decrypt_args))
        .await
        .unwrap();

    assert_eq!(decrypt_result.is_error, Some(false));

    let decrypt_data = tool_result_json(&decrypt_result.content);
    assert!(decrypt_data["data"].is_string());
    assert_eq!(decrypt_data["algorithm"], "ml-kem-768");
}

#[tokio::test]
async fn test_access_control_errors() {
    let registry = ResourceRegistry::new();

    // Test attempting to access a scheme with no registered provider
    let crypto_uri = ResourceURI::new("crypto://keys/master_key");
    let result = registry.read_resource(&crypto_uri).await;
    assert!(matches!(result, Err(Error::Resource { .. })));

    // Test attempting to access malformed URIs
    let malformed_uri = ResourceURI::new("invalid://malformed/uri");
    let result = registry.read_resource(&malformed_uri).await;
    assert!(matches!(result, Err(Error::Resource { .. })));

    // Subscriptions to resources that do not support them are refused
    let result = registry
        .subscribe_to_resource(&ResourceURI::new("invalid://malformed/uri"))
        .await;
    assert!(matches!(result, Err(Error::Resource { .. })));
}

#[tokio::test]
async fn test_input_validation_security() {
    let registry = ToolRegistry::new();

    // Test tool execution with invalid parameters (no operation given)
    let invalid_args = serde_json::json!({
        "invalid_param": "malicious_input",
        "sql_injection": "'; DROP TABLE users; --"
    });

    let tool_name = ToolName::new("dag");
    let result = registry.call_tool(&tool_name, Some(invalid_args)).await;

    // Should fail as an invalid request
    let error = result.unwrap_err();
    assert!(matches!(error, Error::Protocol { .. }));
    assert_eq!(error.error_code(), -32600);

    // Test with missing arguments entirely
    let result = registry.call_tool(&tool_name, None).await;
    assert!(matches!(result, Err(Error::Protocol { .. })));

    // Test with out-of-range parameters
    let vault = ToolName::new("vault");
    let result = registry
        .call_tool(
            &vault,
            Some(serde_json::json!({"operation": "generate", "length": 4})),
        )
        .await;
    assert!(matches!(result, Err(Error::Protocol { .. })));
}

#[tokio::test]
async fn test_error_information_leakage() {
    let registry = ToolRegistry::new();

    // Test that error messages don't leak sensitive information
    let tool_name = ToolName::new("nonexistent_sensitive_tool");
    let result = registry.call_tool(&tool_name, None).await;

    if let Err(error @ Error::Tool { .. }) = result {
        if let Error::Tool { tool_name, .. } = &error {
            assert_eq!(tool_name, "nonexistent_sensitive_tool");
        }

        let error_json = error.to_json_rpc_error();
        let error_message = error_json["message"].as_str().unwrap();

        // Ensure error doesn't leak file paths, internal structure, etc.
        assert!(!error_message.contains('/'));
        assert!(!error_message.contains('\\'));
        assert!(!error_message.contains("internal"));
        assert!(!error_message.contains("debug"));
    } else {
        panic!("Expected tool-not-found error, got {:?}", result);
    }
}

#[tokio::test]
async fn test_resource_access_patterns() {
    let registry = ResourceRegistry::new();

    // Test that only the vault entry index is exposed, not raw secrets
    let resources = registry.list_resources().await.unwrap();
    let vault_uris: Vec<&str> = resources
        .iter()
        .map(|r| r.uri.as_str())
        .filter(|uri| uri.starts_with("vault://"))
        .collect();

    assert_eq!(vault_uris, vec!["vault://entries"]);
}

#[tokio::test]
async fn test_crypto_algorithm_security() {
    let registry = ToolRegistry::new();
    let crypto = ToolName::new("crypto");

    // Every key-generation algorithm the crypto tool advertises is post-quantum
    let tools = registry.list_tools().await.unwrap();
    let crypto_tool = tools.iter().find(|t| t.name == "crypto").unwrap();
    let algorithms = crypto_tool.input_schema["properties"]["algorithm"]["enum"]
        .as_array()
        .unwrap();

    let keypair_algorithms: Vec<&str> = algorithms
        .iter()
        .filter_map(|a| a.as_str())
        .filter(|a| a.starts_with("ml-"))
        .collect();
    assert!(keypair_algorithms.contains(&"ml-kem-768"));
    assert!(keypair_algorithms.contains(&"ml-dsa-65"));

    for algorithm in keypair_algorithms {
        let result = registry
            .call_tool(
                &crypto,
                Some(serde_json::json!({"operation": "generateKeypair", "algorithm": algorithm})),
            )
            .await
            .unwrap();
        let key_data = tool_result_json(&result.content);
        assert_eq!(
            key_data["quantumResistant"], true,
            "Non-quantum-resistant algorithm found: {}",
            algorithm
        );
    }
}

#[tokio::test]
async fn test_network_security_information() {
    let registry = ResourceRegistry::new();

    // Test network peer information doesn't leak sensitive data
    let data = read_json_resource(&registry, "network://peers").await;
    let peers = data["peers"].as_array().unwrap();
    assert!(!peers.is_empty());

    for peer in peers {
        // Should have basic connection info but not sensitive details
        assert!(peer["id"].is_string());
        assert!(peer["status"].is_string());
        assert!(peer["latency_ms"].is_number());

        // Should not expose keys or loopback addresses
        let peer_str = peer.to_string();
        assert!(!peer_str.contains("private_key"));
        assert!(!peer_str.contains("secret"));
        assert!(!peer_str.contains("127.0.0.1"));
    }
}

#[tokio::test]
async fn test_dag_data_access_security() {
    let registry = ResourceRegistry::new();

    // Test DAG tip data access
    let data = read_json_resource(&registry, "dag://state").await;
    let tips = data["tips"].as_array().unwrap();
    assert!(!tips.is_empty());

    for tip in tips {
        // Should have public DAG information
        assert!(tip["id"].is_string());
        assert!(tip["confidence"].is_number());
        assert!(tip["timestamp"].is_string());

        // Check that confidence values are reasonable
        let confidence = tip["confidence"].as_f64().unwrap();
        assert!((0.0..=1.0).contains(&confidence));
    }
}

#[tokio::test]
async fn test_rate_limiting_simulation() {
    use std::time::Instant;

    let registry = ToolRegistry::new();
    let tool_name = ToolName::new("dag");

    // Simulate rapid tool calls to test for potential DoS protection
    let start = Instant::now();
    let mut results = vec![];

    for _ in 0..50 {
        let result = registry
            .call_tool(&tool_name, Some(serde_json::json!({"operation": "tips"})))
            .await;
        results.push(result);
    }

    let duration = start.elapsed();

    // All calls should succeed (no built-in rate limiting in mock implementation)
    for result in results {
        assert!(result.is_ok());
    }

    // Verify operations completed in reasonable time (should be fast for mock data)
    assert!(
        duration < Duration::from_secs(5),
        "Operations took too long: {:?}",
        duration
    );
}

#[tokio::test]
async fn test_memory_safety_with_large_inputs() {
    let registry = ToolRegistry::new();

    // Test with reasonably large input to ensure memory safety
    let large_payload = "x".repeat(1024 * 10); // 10KB payload

    let args = serde_json::json!({
        "operation": "hash",
        "data": large_payload
    });

    let tool_name = ToolName::new("crypto");
    let result = registry.call_tool(&tool_name, Some(args)).await;

    // Should handle large inputs gracefully
    let tool_result = result.unwrap();
    assert_eq!(tool_result.is_error, Some(false));
    let data = tool_result_json(&tool_result.content);
    assert_eq!(
        data["hash"],
        blake3::hash(large_payload.as_bytes()).to_hex().to_string()
    );
}

#[tokio::test]
async fn test_secure_error_reporting() {
    // Test that error reporting doesn't expose sensitive system information
    let errors = vec![
        Error::qudag("crypto", "key_generation failed"),
        Error::vault("entry_retrieval", "vault backend unavailable"),
        Error::qudag("dag", "consensus_validation failed"),
        Error::Network {
            message: "peer_connection failed".to_string(),
            source: None,
        },
    ];

    for error in errors {
        let json_error = error.to_json_rpc_error();
        let message = json_error["message"].as_str().unwrap();

        // Error messages should be informative but not leak internals
        assert!(!message.contains("stack trace"));
        assert!(!message.contains("file:"));
        assert!(!message.contains("line:"));
        assert!(!message.contains("panic"));
        assert!(!message.contains("unwrap"));

        // Should not contain system paths
        assert!(!message.contains("/usr/"));
        assert!(!message.contains("/home/"));
        assert!(!message.contains("C:\\"));

        // Should not contain sensitive data
        assert!(!message.contains("password"));
        assert!(!message.contains("private_key"));
        assert!(!message.contains("secret"));
    }
}
