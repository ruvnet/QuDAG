// HTTP Server with MCP routing - Quick fix implementation
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::Duration;

// Main HTTP handler that routes MCP requests
fn handle_http_request(mut stream: TcpStream, state: Arc<Mutex<NodeState>>) {
    stream.set_read_timeout(Some(Duration::from_secs(30))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(30))).ok();
    
    let mut buffer = [0; 8192];
    match stream.read(&mut buffer) {
        Ok(size) => {
            let request = String::from_utf8_lossy(&buffer[..size]);
            let lines: Vec<&str> = request.lines().collect();
            
            if lines.is_empty() {
                return;
            }
            
            let request_line = lines[0];
            let parts: Vec<&str> = request_line.split_whitespace().collect();
            if parts.len() < 2 {
                return;
            }
            
            let method = parts[0];
            let path = parts[1];
            
            // Route requests
            match path {
                // MCP endpoints - proxy to internal MCP server
                p if p.starts_with("/mcp") => {
                    proxy_to_mcp(&mut stream, method, path, &request);
                }
                // Health check
                "/health" => {
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n\
                        Content-Type: text/plain\r\n\
                        Content-Length: 7\r\n\
                        Connection: keep-alive\r\n\
                        \r\n\
                        healthy"
                    );
                    stream.write_all(response.as_bytes()).ok();
                }
                // Node status
                "/status" => {
                    let state_lock = state.lock().unwrap();
                    let status = json!({
                        "node": state_lock.node_name,
                        "peers": state_lock.peer_count,
                        "height": state_lock.block_height,
                        "synced": state_lock.is_synced
                    });
                    
                    let body = status.to_string();
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n\
                        Content-Type: application/json\r\n\
                        Content-Length: {}\r\n\
                        Access-Control-Allow-Origin: *\r\n\
                        Connection: keep-alive\r\n\
                        \r\n\
                        {}",
                        body.len(),
                        body
                    );
                    stream.write_all(response.as_bytes()).ok();
                }
                _ => {
                    let response = "HTTP/1.1 404 Not Found\r\n\
                        Content-Type: text/plain\r\n\
                        Content-Length: 9\r\n\
                        \r\n\
                        Not Found";
                    stream.write_all(response.as_bytes()).ok();
                }
            }
        }
        Err(_) => {}
    }
}

// Proxy MCP requests to internal MCP server
fn proxy_to_mcp(client_stream: &mut TcpStream, method: &str, path: &str, original_request: &str) {
    // Connect to internal MCP server
    match TcpStream::connect("127.0.0.1:3333") {
        Ok(mut mcp_stream) => {
            // Set timeouts
            mcp_stream.set_read_timeout(Some(Duration::from_secs(25))).ok();
            mcp_stream.set_write_timeout(Some(Duration::from_secs(25))).ok();
            
            // Forward the request to MCP server
            if mcp_stream.write_all(original_request.as_bytes()).is_ok() {
                // Read response from MCP server
                let mut response_buffer = Vec::new();
                let mut temp_buffer = [0; 4096];
                
                // Read response with timeout
                loop {
                    match mcp_stream.read(&mut temp_buffer) {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            response_buffer.extend_from_slice(&temp_buffer[..n]);
                            // Check if we have complete response
                            if response_buffer.windows(4).any(|w| w == b"\r\n\r\n") {
                                // Check for Content-Length to know if we need more data
                                let response_str = String::from_utf8_lossy(&response_buffer);
                                if let Some(body_start) = response_str.find("\r\n\r\n") {
                                    let headers = &response_str[..body_start];
                                    if let Some(content_length) = parse_content_length(headers) {
                                        let body_start_idx = body_start + 4;
                                        let current_body_len = response_buffer.len() - body_start_idx;
                                        if current_body_len >= content_length {
                                            break;
                                        }
                                    } else {
                                        // No Content-Length, assume complete
                                        break;
                                    }
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
                
                // Forward response to client
                if !response_buffer.is_empty() {
                    client_stream.write_all(&response_buffer).ok();
                } else {
                    // MCP server didn't respond, send error
                    let error_response = "HTTP/1.1 502 Bad Gateway\r\n\
                        Content-Type: text/plain\r\n\
                        Content-Length: 20\r\n\
                        \r\n\
                        MCP server timeout";
                    client_stream.write_all(error_response.as_bytes()).ok();
                }
            }
        }
        Err(_) => {
            // Can't connect to MCP server
            let error_response = "HTTP/1.1 503 Service Unavailable\r\n\
                Content-Type: text/plain\r\n\
                Content-Length: 23\r\n\
                \r\n\
                MCP server unavailable";
            client_stream.write_all(error_response.as_bytes()).ok();
        }
    }
}

fn parse_content_length(headers: &str) -> Option<usize> {
    headers.lines()
        .find(|line| line.to_lowercase().starts_with("content-length:"))
        .and_then(|line| line.split(':').nth(1))
        .and_then(|value| value.trim().parse().ok())
}

// Start HTTP server with MCP routing
fn start_http_server_with_mcp(port: &str, state: Arc<Mutex<NodeState>>) {
    let addr = format!("0.0.0.0:{}", port);
    match TcpListener::bind(&addr) {
        Ok(listener) => {
            println!("[HTTP] Server with MCP routing listening on http://{}", addr);
            println!("[HTTP] Available endpoints:");
            println!("  - /health");
            println!("  - /status");
            println!("  - /mcp/*  (routed to internal MCP server)");
            
            for stream in listener.incoming() {
                match stream {
                    Ok(stream) => {
                        let state_clone = state.clone();
                        thread::spawn(move || {
                            handle_http_request(stream, state_clone);
                        });
                    }
                    Err(e) => {
                        eprintln!("[HTTP] Connection error: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("[HTTP] Failed to bind to {}: {}", addr, e);
        }
    }
}