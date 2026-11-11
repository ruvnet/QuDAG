//! Integration tests for QuDAG MCP implementation

use qudag_mcp::protocol::{MCPMessage, MCPNotification, MCPRequest, MCPResponse, RequestId};
use qudag_mcp::resources::ResourceRegistry;
use qudag_mcp::tools::ToolRegistry;
use qudag_mcp::transport::Transport;
use qudag_mcp::{
    ClientInfo, Error, QuDAGMCPServer, ResourceURI, Result, ServerConfig, ServerState, ToolName,
    ToolResultContent,
};
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::timeout;

/// In-memory transport for testing that simulates client-server communication
struct MockTransport {
    incoming: mpsc::UnboundedReceiver<MCPMessage>,
    outgoing: mpsc::UnboundedSender<MCPMessage>,
    connected: bool,
}

impl MockTransport {
    /// Create two transports wired to each other: what one sends, the other receives
    fn create_pair() -> (MockTransport, MockTransport) {
        let (tx1, rx1) = mpsc::unbounded_channel();
        let (tx2, rx2) = mpsc::unbounded_channel();

        let transport1 = MockTransport {
            incoming: rx2,
            outgoing: tx1,
            connected: true,
        };

        let transport2 = MockTransport {
            incoming: rx1,
            outgoing: tx2,
            connected: true,
        };

        (transport1, transport2)
    }
}

#[async_trait::async_trait]
impl Transport for MockTransport {
    async fn send(&mut self, message: MCPMessage) -> Result<()> {
        if !self.connected {
            return Err(Error::connection_lost());
        }

        self.outgoing
            .send(message)
            .map_err(|_| Error::connection_lost())?;
        Ok(())
    }

    async fn receive(&mut self) -> Result<Option<MCPMessage>> {
        if !self.connected {
            return Err(Error::connection_lost());
        }

        match timeout(Duration::from_millis(100), self.incoming.recv()).await {
            Ok(Some(message)) => Ok(Some(message)),
            Ok(None) => {
                self.connected = false;
                Ok(None)
            }
            Err(_) => Ok(None), // Timeout
        }
    }

    async fn close(&mut self) -> Result<()> {
        self.connected = false;
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connected
    }
}

/// Parse the JSON payload of the first text content item of a tool result
fn tool_result_json(content: &[ToolResultContent]) -> serde_json::Value {
    match &content[0] {
        ToolResultContent::Text { text } => serde_json::from_str(text).unwrap(),
        other => panic!("Expected text content in tool result, got {:?}", other),
    }
}

#[tokio::test]
async fn test_server_initialization() {
    let config = ServerConfig::new()
        .with_server_info("Test Server", "1.0.0")
        .with_log_level("debug");

    let server = QuDAGMCPServer::new(config).await.unwrap();

    // Test initial state
    assert!(matches!(server.state().await, ServerState::Uninitialized));
    assert!(!server.is_running().await);

    // Test server statistics
    let stats = server.stats().await;
    assert!(stats.tools_count > 0);
    assert!(stats.resources_count > 0);
    assert_eq!(stats.active_subscriptions, 0);
    assert!(!stats.client_connected);
}

#[tokio::test]
async fn test_mock_transport_roundtrip() {
    let (mut client, mut server): (Box<dyn Transport>, Box<dyn Transport>) = {
        let (a, b) = MockTransport::create_pair();
        (Box::new(a), Box::new(b))
    };

    // Client -> server request
    let request = MCPRequest::initialize(ClientInfo::new("test-client", "1.0.0"), HashMap::new());
    let request_id = request.id.clone();
    client.send(MCPMessage::Request(request)).await.unwrap();

    let received = server.receive().await.unwrap().expect("request delivered");
    assert!(received.is_request());
    assert_eq!(received.id(), Some(&request_id));

    // Server -> client response
    let response = MCPResponse::success(request_id.clone(), serde_json::json!({"ok": true}));
    server.send(MCPMessage::Response(response)).await.unwrap();

    let received = client.receive().await.unwrap().expect("response delivered");
    assert!(received.is_response());
    assert_eq!(received.id(), Some(&request_id));

    // Nothing pending: receive times out with None and stays connected
    assert!(client.receive().await.unwrap().is_none());
    assert!(client.is_connected());

    // A closed transport refuses traffic
    client.close().await.unwrap();
    assert!(!client.is_connected());
    let err = client
        .send(MCPMessage::Notification(MCPNotification::initialized()))
        .await
        .unwrap_err();
    assert!(err.is_retryable());
}

#[tokio::test]
async fn test_mcp_protocol_messages() {
    // Test MCPRequest creation
    let request = MCPRequest::initialize(ClientInfo::new("test-client", "1.0.0"), HashMap::new());
    assert_eq!(request.jsonrpc, "2.0");
    assert_eq!(request.method, "initialize");
    assert!(request.params.is_some());

    // Test message serialization
    let message = MCPMessage::Request(request);
    let json = message.to_json().unwrap();
    let parsed = MCPMessage::from_json(&json).unwrap();

    assert!(parsed.is_request());
    assert_eq!(parsed.method(), Some("initialize"));

    // Test MCPResponse creation
    let response = MCPResponse::success(RequestId::generate(), serde_json::json!({"status": "ok"}));
    assert_eq!(response.jsonrpc, "2.0");
    assert!(response.result.is_some());
    assert!(response.error.is_none());

    // Test MCPNotification creation
    let notification = MCPNotification::initialized();
    assert_eq!(notification.jsonrpc, "2.0");
    assert_eq!(notification.method, "notifications/initialized");
}

#[tokio::test]
async fn test_tool_registry_integration() {
    let registry = ToolRegistry::new();

    // Test listing tools
    let tools = registry.list_tools().await.unwrap();
    assert!(!tools.is_empty());

    // Verify we have expected QuDAG tools
    let tool_names: Vec<&str> = tools.iter().map(|t| t.name.as_str()).collect();
    for expected in [
        "dag",
        "crypto",
        "vault",
        "network",
        "system",
        "config",
        "qudag_exchange",
    ] {
        assert!(tool_names.contains(&expected), "missing tool {}", expected);
    }

    // Test tool execution
    let tool_name = ToolName::new("dag");
    let result = registry
        .call_tool(&tool_name, Some(serde_json::json!({"operation": "tips"})))
        .await
        .unwrap();
    assert_eq!(result.is_error, Some(false));
    assert!(!result.content.is_empty());
    let data = tool_result_json(&result.content);
    assert_eq!(data["success"], true);
    assert!(data["tips"].is_array());
}

#[tokio::test]
async fn test_resource_registry_integration() {
    let registry = ResourceRegistry::new();

    // Test listing resources
    let resources = registry.list_resources().await.unwrap();
    assert!(!resources.is_empty());

    // Verify we have expected QuDAG resources
    let resource_uris: Vec<&str> = resources.iter().map(|r| r.uri.as_str()).collect();
    for scheme in [
        "dag://",
        "vault://",
        "network://",
        "system://",
        "exchange://",
    ] {
        assert!(
            resource_uris.iter().any(|uri| uri.starts_with(scheme)),
            "no {} resource listed",
            scheme
        );
    }

    // Every listed resource can be read back through the registry
    for resource in &resources {
        let uri = ResourceURI::new(resource.uri.clone());
        let contents = registry.read_resource(&uri).await.unwrap();
        assert!(!contents.is_empty(), "{} returned no content", resource.uri);
    }

    // Test resource reading
    let dag_uri = ResourceURI::new("dag://state");
    let contents = registry.read_resource(&dag_uri).await.unwrap();
    assert_eq!(contents.len(), 1);
    assert_eq!(contents[0].uri, dag_uri.as_str());
    assert!(contents[0].mime_type.as_ref().unwrap().contains("json"));
}

#[tokio::test]
async fn test_error_handling() {
    let tool_registry = ToolRegistry::new();
    let resource_registry = ResourceRegistry::new();

    // Test tool not found error
    let nonexistent_tool = ToolName::new("nonexistent_tool");
    let result = tool_registry.call_tool(&nonexistent_tool, None).await;
    let error = result.unwrap_err();
    assert!(matches!(&error, Error::Tool { tool_name, .. } if tool_name == "nonexistent_tool"));
    assert_eq!(error.error_code(), -32005);

    // Test resource not found error
    let nonexistent_resource = ResourceURI::new("invalid://nonexistent/resource");
    let result = resource_registry.read_resource(&nonexistent_resource).await;
    let error = result.unwrap_err();
    assert!(matches!(error, Error::Resource { .. }));
    assert_eq!(error.error_code(), -32004);

    // Test JSON-RPC error codes
    assert_eq!(Error::tool_not_found("test").error_code(), -32005);
    assert_eq!(Error::resource("test", "missing").error_code(), -32004);
}

#[tokio::test]
async fn test_tool_execution_with_parameters() {
    let registry = ToolRegistry::new();
    let tool_name = ToolName::new("dag");

    // Test DAG status operation
    let args = serde_json::json!({ "operation": "status" });
    let result = registry.call_tool(&tool_name, Some(args)).await.unwrap();

    assert_eq!(result.is_error, Some(false));
    assert!(!result.content.is_empty());

    // Verify the result contains expected data
    let result_data = tool_result_json(&result.content);
    assert_eq!(result_data["success"], true);
    assert!(result_data["vertex_count"].is_number());
    assert!(result_data["finalized_height"].is_number());

    // Unknown operations are rejected as invalid requests
    let args = serde_json::json!({ "operation": "add_vertex" });
    let error = registry
        .call_tool(&tool_name, Some(args))
        .await
        .unwrap_err();
    assert_eq!(error.error_code(), -32600);
}

#[tokio::test]
async fn test_crypto_tool_execution() {
    let registry = ToolRegistry::new();

    // Test crypto key generation
    let args = serde_json::json!({
        "operation": "generateKeypair",
        "algorithm": "ml-kem-768"
    });

    let tool_name = ToolName::new("crypto");
    let result = registry.call_tool(&tool_name, Some(args)).await.unwrap();

    assert_eq!(result.is_error, Some(false));

    // Verify the result contains crypto data
    let result_data = tool_result_json(&result.content);
    assert_eq!(result_data["algorithm"], "ml-kem-768");
    assert_eq!(result_data["quantumResistant"], true);
    assert!(result_data["publicKey"].is_string());
    assert!(result_data["privateKey"].is_string());

    // Hashing is a real (non-mock) operation: BLAKE3, hex encoded
    let args = serde_json::json!({ "operation": "hash", "data": "abc" });
    let result = registry.call_tool(&tool_name, Some(args)).await.unwrap();
    let result_data = tool_result_json(&result.content);
    assert_eq!(
        result_data["hash"],
        blake3::hash(b"abc").to_hex().to_string()
    );
    assert_eq!(result_data["length"], 64);
}

#[tokio::test]
async fn test_resource_content_formats() {
    let registry = ResourceRegistry::new();

    // Test DAG resources
    let dag_uri = ResourceURI::new("dag://state");
    let contents = registry.read_resource(&dag_uri).await.unwrap();
    assert_eq!(contents.len(), 1);
    assert_eq!(contents[0].mime_type.as_ref().unwrap(), "application/json");

    // Parse the JSON content
    let text = contents[0].text.as_ref().expect("dag state is text");
    let data: serde_json::Value = serde_json::from_str(text).unwrap();
    assert!(data["dag_info"]["vertex_count"].is_number());
    assert!(data["dag_info"]["edge_count"].is_number());
    assert!(data["dag_info"]["last_finalized_timestamp"].is_string());

    // Test exchange resources
    let exchange_uri = ResourceURI::new("exchange://supply");
    let contents = registry.read_resource(&exchange_uri).await.unwrap();
    assert_eq!(contents.len(), 1);
    assert_eq!(contents[0].uri, "exchange://supply");
    let text = contents[0].text.as_ref().expect("exchange supply is text");
    let data: serde_json::Value = serde_json::from_str(text).unwrap();
    assert!(data.is_object());

    // There is no crypto resource provider: the scheme is recognised but unresolved
    let crypto_uri = ResourceURI::crypto("algorithms/supported");
    let error = registry.read_resource(&crypto_uri).await.unwrap_err();
    assert!(matches!(&error, Error::Resource { resource_type, .. } if resource_type == "crypto"));
}

#[tokio::test]
async fn test_concurrent_operations() {
    use std::sync::Arc;

    let registry = Arc::new(ToolRegistry::new());
    let mut handles = vec![];

    // Spawn multiple concurrent tool executions
    for i in 0..10 {
        let registry_clone = registry.clone();
        let handle = tokio::spawn(async move {
            let tool_name = ToolName::new("dag");
            let result = registry_clone
                .call_tool(&tool_name, Some(serde_json::json!({"operation": "tips"})))
                .await;
            (i, result)
        });
        handles.push(handle);
    }

    // Wait for all operations to complete
    for handle in handles {
        let (i, result) = handle.await.unwrap();
        assert!(result.is_ok(), "Operation {} failed: {:?}", i, result);
    }
}

#[tokio::test]
async fn test_resource_uri_construction() {
    // Scheme helpers produce scheme://path URIs
    let dag_uri = ResourceURI::dag("vertices/all");
    assert_eq!(dag_uri.as_str(), "dag://vertices/all");

    let crypto_uri = ResourceURI::crypto("keys/public");
    assert_eq!(crypto_uri.as_str(), "crypto://keys/public");

    let vault_uri = ResourceURI::vault("secrets/config");
    assert_eq!(vault_uri.as_str(), "vault://secrets/config");

    let network_uri = ResourceURI::network("peers/connected");
    assert_eq!(network_uri.as_str(), "network://peers/connected");
    assert_eq!(network_uri.to_string(), "network://peers/connected");

    // Conversions keep the URI verbatim
    assert_eq!(
        ResourceURI::from("dag://state"),
        ResourceURI::new("dag://state")
    );
    assert_eq!(
        ResourceURI::from("invalid-uri-without-scheme".to_string()).as_str(),
        "invalid-uri-without-scheme"
    );
}

#[tokio::test]
async fn test_tool_schema_validation() {
    let registry = ToolRegistry::new();
    let tools = registry.list_tools().await.unwrap();

    // Verify all tools have proper schemas
    for tool in tools {
        assert!(!tool.name.is_empty());
        assert!(!tool.description.is_empty());
        assert!(tool.input_schema.is_object());

        let schema = tool.input_schema.as_object().unwrap();
        assert_eq!(schema.get("type").unwrap().as_str().unwrap(), "object");

        if let Some(properties) = schema.get("properties") {
            assert!(properties.is_object());
        }

        if let Some(required) = schema.get("required") {
            assert!(required.is_array());
        }
    }
}

#[tokio::test]
async fn test_memory_safety_and_cleanup() {
    // Test that we can create and drop many instances without issues
    for _ in 0..100 {
        let config = ServerConfig::new();
        let _server = QuDAGMCPServer::new(config).await.unwrap();
    }

    // Test concurrent creation and cleanup
    let mut handles = vec![];
    for _ in 0..50 {
        let handle = tokio::spawn(async {
            let config = ServerConfig::new();
            let server = QuDAGMCPServer::new(config).await.unwrap();
            let _stats = server.stats().await;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }
}
