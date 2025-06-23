# QuDAG Real MCP Implementation Usage Guide

## Status
✅ **Successfully deployed** a real, fully functional QuDAG MCP implementation with all 7 tools.
🎉 **WORKING NOW**: https://quadag-mcp.fly.dev

## Available MCP Configurations

### 1. **qudag-testnet** (Primary - LIVE)
- **URL**: https://quadag-mcp.fly.dev ✅ WORKING
- **Status**: Deployed and fully functional 
- **Tools**: All 7 QuDAG tools implemented with real functionality

### 2. **qudag-local** (For Testing)
To run the MCP server locally:
```bash
# Run the standalone Docker image
docker run -d -p 3000:3000 qudag-mcp-real:standalone

# The server will be available at http://localhost:3000
# Use the "qudag-local" MCP configuration in Claude
```

### 3. **qudag-testnet** (Updated)
Points to the new real MCP implementation at qudag-mcp-real.fly.dev

## Available Tools

All tools are fully functional with real implementations:

1. **qudag_dag** - DAG consensus operations
   - `get_tips`, `add_vertex`, `get_vertex`, `get_consensus_status`, `get_dag_stats`

2. **qudag_network** - P2P network management
   - `list_peers`, `connect_peer`, `disconnect_peer`, `network_stats`, `broadcast_message`

3. **qudag_crypto** - Quantum-resistant cryptography
   - `generate_keypair`, `sign`, `verify`, `encrypt`, `decrypt`, `generate_fingerprint`

4. **qudag_vault** - Secure vault storage
   - `create_vault`, `unlock`, `lock`, `store_secret`, `get_secret`, `list_vaults`

5. **qudag_exchange** - rUv token exchange
   - `create_account`, `get_balance`, `transfer`, `list_accounts`, `get_fee_info`

6. **qudag_dark** - Dark services
   - `create_shadow_address`, `resolve_dark_domain`, `register_dark_domain`, `create_onion_route`

7. **qudag_system** - System monitoring
   - `get_node_info`, `get_metrics`, `get_network_topology`

## Testing the Implementation

### Local Testing
```bash
# Check health
curl http://localhost:3000/health

# List tools
curl http://localhost:3000/mcp/tools

# Execute a tool
curl -X POST http://localhost:3000/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "qudag_exchange", "arguments": {"operation": "list_accounts"}}'
```

### Remote Testing (WORKING NOW!)
```bash
# Check health
curl https://quadag-mcp.fly.dev/health

# MCP discovery
curl https://quadag-mcp.fly.dev/mcp

# Test a tool
curl -X POST https://quadag-mcp.fly.dev/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "qudag_exchange", "arguments": {"operation": "list_accounts"}}'
```

## Implementation Details

- **Language**: Rust
- **Framework**: Warp (async web framework)
- **Features**: Real DAG, P2P networking, quantum crypto, vault storage, token exchange
- **Deployment**: 2 machines running on fly.io in IAD region
- **Docker Image**: `qudag-mcp-real:standalone`

## Troubleshooting

If tools don't appear in Claude:
1. Try using the "qudag-local" configuration with the Docker container
2. Restart Claude/VS Code to reload MCP configurations
3. Check that the MCP proxy script has execute permissions
4. Verify the server is running: `docker ps | grep qudag-mcp-real`

## Source Code

The full implementation is in:
- `/workspaces/QuDAG/qudag-testnet/qudag-mcp-real/src/main_standalone.rs`
- Dockerfile: `/workspaces/QuDAG/qudag-testnet/qudag-mcp-real/Dockerfile.standalone`