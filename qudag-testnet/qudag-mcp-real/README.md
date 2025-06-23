# QuDAG MCP Real Implementation

A real implementation of the QuDAG MCP (Model Control Protocol) server with Exchange and System monitoring capabilities.

## Features

- **Real DAG Consensus**: Actual block creation with quantum signatures and finalization
- **P2P Networking**: Real peer connections, bandwidth tracking, and message broadcasting
- **Quantum Cryptography**: ML-DSA signatures, ML-KEM/HQC encryption with timing metrics
- **Dark Domains**: .dark domain registration and quantum fingerprint resolution
- **Vault Storage**: Quantum-encrypted secure storage with password protection
- **rUv Token Exchange**: Dynamic fee calculation, account management, and transfers
- **Business Plan**: Contributor registration and automated payout distribution
- **System Monitoring**: Real CPU, memory, disk, and network metrics

## Building

```bash
cd /workspaces/QuDAG/qudag-testnet/qudag-mcp-real
cargo build --release
```

## Running

### HTTP/WebSocket Mode (Default)
```bash
cargo run -- start
# Or with custom host/port
cargo run -- start --host 0.0.0.0 --port 3000
```

### Stdio Mode (for Claude Desktop)
```bash
cargo run -- start --stdio
```

### Show Server Info
```bash
cargo run -- info
```

## API Endpoints

- `POST /mcp` - MCP protocol endpoint
- `GET /sse` - Server-sent events for real-time updates
- `WS /ws` - WebSocket connection
- `GET /health` - Health check
- `GET /tools` - List available MCP tools

## MCP Tools

All tools return real data from running systems:

### DAG Tools
- `qudag_dag` - Manage DAG consensus and blocks

### Network Tools  
- `qudag_network` - P2P network operations

### Crypto Tools
- `qudag_crypto` - Quantum-resistant cryptography

### Dark Tools
- `qudag_dark` - Dark domain management

### Vault Tools
- `qudag_vault` - Secure storage operations

### Exchange Tools
- `qudag_exchange` - rUv token operations

### Business Tools
- `qudag_business` - Contributor and payout management

### System Tools
- `qudag_system` - Real system monitoring

## Testing with curl

```bash
# Initialize MCP session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"id": "1", "method": "initialize", "params": {}}'

# List tools
curl http://localhost:3000/tools

# Call a tool
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "id": "2",
    "method": "tools/call",
    "params": {
      "name": "qudag_system",
      "arguments": {"operation": "get_metrics"}
    }
  }'
```

## Real-time Updates (SSE)

```bash
curl -N http://localhost:3000/sse
```

## WebSocket Connection

Connect to `ws://localhost:3000/ws` and send MCP requests as JSON.