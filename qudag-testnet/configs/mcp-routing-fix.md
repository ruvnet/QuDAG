# MCP HTTPS Timeout Fix Solutions

## Problem Summary
The HTTPS endpoint `https://qudag-testnet-node1.fly.dev/mcp` times out because:
1. The custom TCP socket implementation doesn't handle HTTP/2 properly
2. Missing proper HTTP/1.1 keep-alive support
3. No handling of Fly.io proxy headers
4. Insufficient timeout configurations

## Solution Options

### 1. **Quick Fix: Route MCP through Main HTTP Port**
Instead of exposing port 3333 directly, route MCP paths through the main HTTP service on port 8080.

In your main HTTP handler (port 8080), add:
```rust
// Add MCP routing to main HTTP server
match path {
    p if p.starts_with("/mcp") => {
        // Forward to internal MCP handler
        proxy_to_mcp(stream, path, "localhost:3333");
    }
    // ... other routes
}
```

### 2. **Improve HTTP Implementation**
Replace raw TCP socket handling with proper HTTP parsing:
- Handle HTTP/1.1 keep-alive connections
- Parse and respect Connection headers
- Implement proper Content-Length handling
- Add timeout management
- See `http-handler-fix.rs` for implementation

### 3. **Use Hyper HTTP Server**
Replace custom implementation with battle-tested HTTP library:
- Full HTTP/1.1 and HTTP/2 support
- Automatic keep-alive handling
- Proper header parsing
- See `mcp-server-hyper.rs` for implementation

### 4. **Deploy Dedicated MCP Service**
Create separate Fly.io app for MCP:
```bash
fly apps create qudag-mcp-service
fly deploy --config fly.mcp-dedicated.toml
# Access at: https://qudag-mcp-service.fly.dev/mcp
```

### 5. **Use Nginx Reverse Proxy**
Add nginx layer to handle HTTP properly:
- Handles HTTP/2 to HTTP/1.1 translation
- Manages timeouts and keep-alive
- Adds proper headers
- See `nginx-mcp-proxy.conf` for configuration

## Recommended Approach

For production, use **Solution 3 (Hyper)** or **Solution 5 (Nginx)**:

### Hyper Implementation Steps:
1. Add dependencies to Cargo.toml:
   ```toml
   hyper = { version = "0.14", features = ["full"] }
   tokio = { version = "1", features = ["full"] }
   ```

2. Replace TCP listener with Hyper server
3. Implement async handlers for MCP endpoints
4. Deploy with updated configuration

### Nginx Implementation Steps:
1. Update Dockerfile to include nginx:
   ```dockerfile
   FROM rust:latest as builder
   # ... build rust app ...
   
   FROM nginx:alpine
   COPY --from=builder /app/target/release/qudag-node /app/
   COPY nginx-mcp-proxy.conf /etc/nginx/conf.d/default.conf
   
   # Start both nginx and rust app
   CMD nginx && /app/qudag-node
   ```

2. Update fly.toml to use only port 8080
3. Let nginx handle all HTTP traffic

## Testing

After implementing any solution, test with:
```bash
# Test HTTPS endpoint
curl -v https://qudag-testnet-node1.fly.dev/mcp/info

# Test with keep-alive
curl -v --http1.1 -H "Connection: keep-alive" https://qudag-testnet-node1.fly.dev/mcp/info

# Test HTTP/2
curl -v --http2 https://qudag-testnet-node1.fly.dev/mcp/info
```

## Fly.io Configuration Tips

1. **Increase timeouts in fly.toml**:
   ```toml
   [[services.http_checks]]
     timeout = "30s"  # Increase from 10s
     grace_period = "60s"  # Increase from 45s
   ```

2. **Enable HTTP/2 support**:
   ```toml
   [[services.ports]]
     handlers = ["tls", "http"]
     [services.ports.tls_options]
       alpn = ["h2", "http/1.1"]
   ```

3. **Monitor logs**:
   ```bash
   fly logs -a qudag-testnet-node1
   ```

4. **Check proxy behavior**:
   ```bash
   fly ssh console -a qudag-testnet-node1
   curl -v http://localhost:3333/mcp/info
   ```