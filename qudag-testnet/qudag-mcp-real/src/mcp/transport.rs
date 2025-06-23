use super::{McpRequest, McpResponse, MCP_SERVER};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use futures_util::{SinkExt, StreamExt};
use warp::{ws::WebSocket, Filter, Rejection, Reply};
use tokio_stream::wrappers::BroadcastStream;
use tokio::sync::broadcast;

// HTTP Server implementation
pub async fn start_http_server(host: &str, port: u16) {
    let mcp_server = Arc::new(MCP_SERVER);
    
    // MCP endpoint
    let mcp_route = warp::post()
        .and(warp::path("mcp"))
        .and(warp::body::json())
        .and(with_server(mcp_server.clone()))
        .and_then(handle_http_request);
    
    // SSE endpoint for real-time updates
    let sse_route = warp::get()
        .and(warp::path("sse"))
        .and(with_server(mcp_server.clone()))
        .map(handle_sse);
    
    // WebSocket endpoint
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(with_server(mcp_server.clone()))
        .map(|ws: warp::ws::Ws, server| {
            ws.on_upgrade(move |socket| handle_websocket(socket, server))
        });
    
    // Health check
    let health_route = warp::get()
        .and(warp::path("health"))
        .map(|| warp::reply::json(&serde_json::json!({
            "status": "healthy",
            "service": "QuDAG MCP Server",
            "version": "1.0.0"
        })));
    
    // Tool list endpoint
    let tools_route = warp::get()
        .and(warp::path("tools"))
        .and(with_server(mcp_server.clone()))
        .and_then(handle_tools_list);
    
    // Combine all routes
    let routes = mcp_route
        .or(sse_route)
        .or(ws_route)
        .or(health_route)
        .or(tools_route)
        .with(warp::cors().allow_any_origin());
    
    let addr = format!("{}:{}", host, port).parse::<std::net::SocketAddr>().unwrap();
    
    println!("🚀 QuDAG MCP Server listening on http://{}", addr);
    
    warp::serve(routes).run(addr).await;
}

fn with_server(
    server: Arc<&'static super::McpServer>,
) -> impl Filter<Extract = (Arc<&'static super::McpServer>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || server.clone())
}

async fn handle_http_request(
    request: McpRequest,
    server: Arc<&'static super::McpServer>,
) -> Result<impl Reply, Rejection> {
    let response = server.handle_request(request).await;
    Ok(warp::reply::json(&response))
}

async fn handle_tools_list(
    server: Arc<&'static super::McpServer>,
) -> Result<impl Reply, Rejection> {
    let tools = server.tools.read().await;
    let tool_list: Vec<_> = tools.values().collect();
    
    Ok(warp::reply::json(&serde_json::json!({
        "tools": tool_list
    })))
}

// SSE implementation for real-time updates
fn handle_sse(server: Arc<&'static super::McpServer>) -> impl Reply {
    let (tx, rx) = broadcast::channel(100);
    
    // Spawn a task to send periodic updates
    tokio::spawn(async move {
        loop {
            // Get real system metrics
            let metrics = crate::system::get_system_metrics().await;
            let exchange_metrics = crate::exchange::EXCHANGE.get_system_metrics().await;
            
            let update = serde_json::json!({
                "type": "metrics_update",
                "timestamp": chrono::Utc::now(),
                "data": {
                    "system": metrics,
                    "exchange": exchange_metrics,
                }
            });
            
            let _ = tx.send(format!("data: {}\n\n", serde_json::to_string(&update).unwrap()));
            
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }
    });
    
    let stream = BroadcastStream::new(rx);
    let event_stream = stream.map(|msg| {
        msg.map(|data| warp::sse::Event::default().data(data))
            .map_err(|_| warp::sse::error())
    });
    
    warp::sse::reply(event_stream)
}

// WebSocket handler
async fn handle_websocket(ws: WebSocket, server: Arc<&'static super::McpServer>) {
    let (mut ws_tx, mut ws_rx) = ws.split();
    
    println!("🔌 New WebSocket connection established");
    
    // Handle incoming messages
    while let Some(result) = ws_rx.next().await {
        match result {
            Ok(msg) => {
                if let Ok(text) = msg.to_str() {
                    match serde_json::from_str::<McpRequest>(text) {
                        Ok(request) => {
                            let response = server.handle_request(request).await;
                            let response_text = serde_json::to_string(&response).unwrap();
                            
                            if ws_tx.send(warp::ws::Message::text(response_text)).await.is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            let error_response = McpResponse {
                                id: "error".to_string(),
                                result: None,
                                error: Some(super::McpErrorResponse {
                                    code: -32700,
                                    message: format!("Parse error: {}", e),
                                    data: None,
                                }),
                            };
                            
                            let _ = ws_tx.send(warp::ws::Message::text(
                                serde_json::to_string(&error_response).unwrap()
                            )).await;
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("WebSocket error: {}", e);
                break;
            }
        }
    }
    
    println!("🔌 WebSocket connection closed");
}

// Stdio transport for Claude Desktop integration
pub async fn start_stdio_server() {
    let server = &MCP_SERVER;
    let stdin = tokio::io::stdin();
    let mut stdout = tokio::io::stdout();
    let mut reader = BufReader::new(stdin);
    
    println!("🖥️  QuDAG MCP Server (stdio mode) ready");
    
    let mut line = String::new();
    
    loop {
        line.clear();
        
        match reader.read_line(&mut line).await {
            Ok(0) => break, // EOF
            Ok(_) => {
                if let Ok(request) = serde_json::from_str::<McpRequest>(&line) {
                    let response = server.handle_request(request).await;
                    let response_json = serde_json::to_string(&response).unwrap();
                    
                    stdout.write_all(response_json.as_bytes()).await.unwrap();
                    stdout.write_all(b"\n").await.unwrap();
                    stdout.flush().await.unwrap();
                }
            }
            Err(e) => {
                eprintln!("Error reading from stdin: {}", e);
                break;
            }
        }
    }
}

// Combined server that supports multiple transports
pub async fn start_multi_transport_server(
    http_host: &str,
    http_port: u16,
    enable_stdio: bool,
) {
    if enable_stdio {
        // Start stdio server in a separate task
        tokio::spawn(async {
            start_stdio_server().await;
        });
    }
    
    // Start HTTP/WebSocket server
    start_http_server(http_host, http_port).await;
}

// Batch request handler for performance
pub async fn handle_batch_request(
    requests: Vec<McpRequest>,
    server: &super::McpServer,
) -> Vec<McpResponse> {
    let mut responses = Vec::with_capacity(requests.len());
    
    // Process requests in parallel for better performance
    let futures: Vec<_> = requests
        .into_iter()
        .map(|req| server.handle_request(req))
        .collect();
    
    let results = futures::future::join_all(futures).await;
    
    responses.extend(results);
    responses
}

// Request validation middleware
pub fn validate_request(request: &McpRequest) -> Result<(), String> {
    // Validate request ID
    if request.id.is_empty() {
        return Err("Request ID cannot be empty".to_string());
    }
    
    // Validate method
    if request.method.is_empty() {
        return Err("Method cannot be empty".to_string());
    }
    
    // Validate params based on method
    match request.method.as_str() {
        "tools/call" => {
            if !request.params.is_object() {
                return Err("tools/call requires object parameters".to_string());
            }
            if request.params.get("name").is_none() {
                return Err("tools/call requires 'name' parameter".to_string());
            }
        }
        "resources/read" => {
            if request.params.get("uri").is_none() {
                return Err("resources/read requires 'uri' parameter".to_string());
            }
        }
        _ => {}
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_request_validation() {
        let valid_request = McpRequest {
            id: "test-1".to_string(),
            method: "tools/call".to_string(),
            params: serde_json::json!({
                "name": "qudag_dag",
                "arguments": {}
            }),
        };
        
        assert!(validate_request(&valid_request).is_ok());
        
        let invalid_request = McpRequest {
            id: "".to_string(),
            method: "tools/call".to_string(),
            params: serde_json::json!({}),
        };
        
        assert!(validate_request(&invalid_request).is_err());
    }
}