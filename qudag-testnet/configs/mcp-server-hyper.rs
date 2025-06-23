// MCP Server using Hyper for proper HTTP handling
use hyper::{Body, Request, Response, Server, StatusCode};
use hyper::service::{make_service_fn, service_fn};
use hyper::header::{CONTENT_TYPE, ACCESS_CONTROL_ALLOW_ORIGIN};
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use serde_json::json;

async fn handle_mcp_request(
    req: Request<Body>,
    state: Arc<Mutex<NodeState>>,
    mcp_state: Arc<Mutex<McpState>>,
) -> Result<Response<Body>, Infallible> {
    let path = req.uri().path();
    let method = req.method();
    
    let (status, body) = match (method.as_str(), path) {
        ("GET", "/mcp") | ("GET", "/mcp/") => {
            let mcp_lock = mcp_state.lock().unwrap();
            let discovery = json!({
                "mcp": {
                    "version": "0.1.0",
                    "serverInfo": {
                        "name": "QuDAG MCP Server",
                        "version": "1.0.0",
                        "protocolVersion": "2024-11-05"
                    },
                    "capabilities": mcp_lock.capabilities,
                    "instructions": "QuDAG MCP server for quantum-resistant DAG operations"
                }
            });
            (StatusCode::OK, discovery.to_string())
        }
        ("GET", "/mcp/info") => {
            let state_lock = state.lock().unwrap();
            let network_lock = state_lock.network.lock().unwrap();
            
            let info = json!({
                "name": "QuDAG MCP Server",
                "version": "1.0.0",
                "protocolVersion": "2024-11-05",
                "vendor": "QuDAG",
                "supportedVersions": ["2024-11-05"],
                "nodeInfo": {
                    "id": network_lock.node_id,
                    "name": state_lock.node_name,
                    "network": state_lock.network_id,
                    "peers": state_lock.peer_count,
                    "blockHeight": state_lock.block_height,
                    "synced": state_lock.is_synced,
                    "uptime": state_lock.uptime.elapsed().as_secs()
                }
            });
            (StatusCode::OK, info.to_string())
        }
        ("GET", "/mcp/tools") => {
            let mcp_lock = mcp_state.lock().unwrap();
            let tools_list = json!({
                "tools": mcp_lock.tools.values().collect::<Vec<_>>()
            });
            (StatusCode::OK, tools_list.to_string())
        }
        ("GET", "/mcp/resources") => {
            let mcp_lock = mcp_state.lock().unwrap();
            let resources_list = json!({
                "resources": mcp_lock.resources.values().collect::<Vec<_>>()
            });
            (StatusCode::OK, resources_list.to_string())
        }
        _ => {
            let error = json!({"error": "MCP endpoint not found"});
            (StatusCode::NOT_FOUND, error.to_string())
        }
    };
    
    let response = Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "application/json")
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Body::from(body))
        .unwrap();
    
    Ok(response)
}

pub async fn start_mcp_server_hyper(
    port: u16,
    state: Arc<Mutex<NodeState>>,
    mcp_state: Arc<Mutex<McpState>>,
) {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    
    let make_svc = make_service_fn(move |_conn| {
        let state = state.clone();
        let mcp_state = mcp_state.clone();
        
        async move {
            Ok::<_, Infallible>(service_fn(move |req| {
                handle_mcp_request(req, state.clone(), mcp_state.clone())
            }))
        }
    });
    
    let server = Server::bind(&addr)
        .serve(make_svc);
    
    println!("[MCP] Hyper server listening on http://{}", addr);
    
    if let Err(e) = server.await {
        eprintln!("[MCP] Server error: {}", e);
    }
}

// Add to Cargo.toml:
// [dependencies]
// hyper = { version = "0.14", features = ["full"] }
// tokio = { version = "1", features = ["full"] }