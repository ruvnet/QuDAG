# MCP HTTPS Timeout Fix - Final Recommendations

## Immediate Fix (Fastest to implement)

1. **Route MCP through main HTTP port (8080)**
   - Modify your main HTTP handler to proxy `/mcp/*` requests to internal port 3333
   - This leverages the already-working HTTP endpoint
   - Implementation provided in `http-mcp-router.rs`

2. **Update fly.toml** to remove direct MCP port exposure:
   ```toml
   # Remove the MCP service section that exposes port 3333
   # Keep MCP running internally on 3333
   # Route through main HTTP service on port 80/443
   ```

## Production-Ready Solutions

### Option A: Use Hyper (Recommended for Rust projects)
**Pros:**
- Native Rust solution
- Full HTTP/1.1 and HTTP/2 support
- Async/await compatible
- Battle-tested in production

**Implementation:**
1. Add Hyper dependencies
2. Replace TCP socket code with Hyper server
3. No changes needed to fly.toml
4. See `mcp-server-hyper.rs`

### Option B: Add Nginx Proxy Layer
**Pros:**
- Handles all HTTP complexities
- Zero code changes to MCP server
- Industry-standard solution
- Built-in timeout handling

**Implementation:**
1. Update Dockerfile to include nginx
2. Configure nginx to proxy to localhost:3333
3. Expose only nginx on port 8080
4. See `nginx-mcp-proxy.conf`

## Testing Your Fix

```bash
# Test locally first
fly ssh console -a qudag-testnet-node1
curl -v http://localhost:8080/mcp/info

# Then test HTTPS endpoint
curl -v https://qudag-testnet-node1.fly.dev/mcp/info

# Test with different clients
curl --http2 https://qudag-testnet-node1.fly.dev/mcp/info
curl --http1.1 https://qudag-testnet-node1.fly.dev/mcp/info
```

## Why The Current Implementation Fails

1. **No HTTP/2 Support**: Fly.io proxy sends HTTP/2, your server only handles HTTP/1.0
2. **No Keep-Alive**: Connections drop immediately, Fly proxy expects persistent connections
3. **Missing Headers**: No proper Content-Length, Connection headers
4. **Timeout Mismatches**: Your 30s timeout vs Fly's expectations

## Quick Debugging Commands

```bash
# Check if MCP is running internally
fly ssh console -a qudag-testnet-node1 -C "curl -v http://localhost:3333/mcp/info"

# Check Fly proxy logs
fly logs -a qudag-testnet-node1 | grep -i mcp

# Monitor real-time
fly logs -a qudag-testnet-node1 --tail
```

## Recommended Action Plan

1. **Immediate**: Implement HTTP router fix (1 hour)
2. **This Week**: Migrate to Hyper implementation (4 hours)
3. **Next Sprint**: Add proper monitoring and metrics
4. **Future**: Consider gRPC for MCP if applicable