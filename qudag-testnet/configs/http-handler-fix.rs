// Improved HTTP handler for Fly.io compatibility
use std::io::{Read, Write, BufReader, BufRead};
use std::net::TcpStream;
use std::time::Duration;

fn handle_mcp_request(stream: &mut TcpStream, state: &Arc<Mutex<NodeState>>, mcp_state: &Arc<Mutex<McpState>>) {
    // Set timeouts to prevent hanging connections
    stream.set_read_timeout(Some(Duration::from_secs(30))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(30))).ok();
    
    let mut reader = BufReader::new(stream.try_clone().unwrap());
    let mut request_line = String::new();
    
    if reader.read_line(&mut request_line).is_err() {
        return;
    }
    
    // Parse headers
    let mut headers = Vec::new();
    let mut content_length = 0;
    loop {
        let mut header_line = String::new();
        if reader.read_line(&mut header_line).is_err() {
            return;
        }
        
        if header_line == "\r\n" || header_line == "\n" {
            break;
        }
        
        // Check for Content-Length
        if header_line.to_lowercase().starts_with("content-length:") {
            if let Some(len_str) = header_line.split(':').nth(1) {
                content_length = len_str.trim().parse().unwrap_or(0);
            }
        }
        
        headers.push(header_line);
    }
    
    // Read body if present
    let mut body = String::new();
    if content_length > 0 {
        let mut body_buffer = vec![0u8; content_length];
        reader.read_exact(&mut body_buffer).ok();
        body = String::from_utf8_lossy(&body_buffer).to_string();
    }
    
    // Parse request
    let parts: Vec<&str> = request_line.trim().split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }
    
    let method = parts[0];
    let path = parts[1];
    let http_version = parts.get(2).unwrap_or(&"HTTP/1.1");
    
    // Check for keep-alive
    let connection_header = headers.iter()
        .find(|h| h.to_lowercase().starts_with("connection:"))
        .map(|h| h.to_lowercase().contains("keep-alive"))
        .unwrap_or(http_version == "HTTP/1.1"); // HTTP/1.1 defaults to keep-alive
    
    // Route and handle request
    let (status, response_body) = match (method, path) {
        ("GET", "/mcp") | ("GET", "/mcp/") => {
            handle_mcp_discovery_v2(state, mcp_state)
        }
        ("GET", "/mcp/info") => {
            handle_mcp_info_v2(state)
        }
        _ => {
            ("404 Not Found", json!({"error": "MCP endpoint not found"}).to_string())
        }
    };
    
    // Build proper HTTP response
    let mut response = format!("{} {}\r\n", http_version, status);
    response.push_str("Content-Type: application/json\r\n");
    response.push_str(&format!("Content-Length: {}\r\n", response_body.len()));
    response.push_str("Access-Control-Allow-Origin: *\r\n");
    
    // Handle connection header
    if connection_header {
        response.push_str("Connection: keep-alive\r\n");
        response.push_str("Keep-Alive: timeout=30, max=100\r\n");
    } else {
        response.push_str("Connection: close\r\n");
    }
    
    response.push_str("\r\n");
    response.push_str(&response_body);
    
    // Write response
    if let Err(e) = stream.write_all(response.as_bytes()) {
        eprintln!("Failed to write response: {}", e);
    }
    
    // Flush to ensure data is sent
    stream.flush().ok();
}