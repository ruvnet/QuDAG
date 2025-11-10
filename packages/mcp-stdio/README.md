# @qudag/mcp-stdio

QuDAG MCP server with STDIO transport for Claude Desktop integration.

## Overview

This package provides a Model Context Protocol (MCP) server that exposes QuDAG's quantum-resistant distributed operations through a standardized interface. It uses STDIO transport for seamless integration with Claude Desktop and other local tools.

## Features

- **Quantum DAG Operations**: Execute, optimize, and analyze quantum circuits on QuDAG topology
- **Quantum-Resistant Cryptography**: ML-KEM key exchange and ML-DSA signatures
- **Dark Addressing**: Resolve .dark domain addresses with quantum fingerprints
- **Vault Operations**: Quantum-resistant secret storage and retrieval
- **Network Operations**: Peer discovery and topology management
- **System Monitoring**: Comprehensive health checks and diagnostics
- **Resource Access**: Read-only access to quantum states, DAG vertices, crypto keys, and more

## Installation

```bash
# Install from workspace
npm install @qudag/mcp-stdio

# Or build from source
cd packages/mcp-stdio
npm install
npm run build
```

## Usage

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "qudag": {
      "command": "node",
      "args": [
        "/absolute/path/to/QuDAG/packages/mcp-stdio/dist/index.js"
      ]
    }
  }
}
```

### Programmatic Usage

```typescript
import { QuDagMcpServer } from '@qudag/mcp-stdio';

async function main() {
  const server = new QuDagMcpServer();
  await server.connect();
}

main();
```

## Available Tools

### Quantum DAG Operations

- **execute_quantum_dag**: Execute quantum circuits with DAG consensus
- **optimize_circuit**: Optimize circuit topology for efficient execution
- **analyze_complexity**: Analyze circuit complexity and resource requirements
- **benchmark_performance**: Benchmark circuit execution performance

### Cryptographic Operations

- **quantum_key_exchange**: ML-KEM quantum-resistant key exchange
- **quantum_sign**: ML-DSA quantum-resistant digital signatures

### Network Operations

- **dark_address_resolve**: Resolve .dark domain addresses

### Vault Operations

- **vault_quantum_store**: Store secrets with quantum-resistant encryption
- **vault_quantum_retrieve**: Retrieve and decrypt vault secrets

### System Monitoring

- **system_health_check**: Comprehensive system health diagnostics

## Available Resources

### Quantum Resources

- `quantum://states/{execution_id}` - Quantum execution state and results
- `quantum://circuits/{circuit_id}` - Circuit definitions and metadata
- `quantum://benchmarks/{benchmark_id}` - Benchmark results

### DAG Resources

- `dag://vertices/{vertex_id}` - Individual DAG vertex data
- `dag://tips` - Current DAG tips
- `dag://statistics` - DAG aggregate statistics

### Crypto Resources

- `crypto://keys/{key_id}` - Public key information
- `crypto://algorithms` - Supported cryptographic algorithms

### Network Resources

- `network://peers/{peer_id}` - Peer information
- `network://topology` - Network topology

### System Resources

- `system://status` - Overall system status and health

## Example: Quantum Circuit Execution

Using Claude Desktop with the MCP server:

```
User: Execute a simple Bell state circuit

Claude uses execute_quantum_dag tool with:
{
  "circuit": {
    "qubits": 2,
    "gates": [
      { "type": "H", "target": 0 },
      { "type": "CNOT", "target": [0, 1], "control": 0 }
    ]
  },
  "execution": {
    "shots": 1000
  }
}

Response includes execution results, DAG integration info, and performance metrics.
```

## Example: Quantum Key Exchange

```
User: Perform ML-KEM-768 key exchange as initiator

Claude uses quantum_key_exchange tool with:
{
  "algorithm": "ml-kem-768",
  "role": "initiator"
}

Response includes public key, encapsulated key, and shared secret.
```

## Development

```bash
# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Testing

The package includes comprehensive tests for:

- Server initialization and transport
- All tool implementations
- Resource access patterns
- Error handling
- Input validation

Run tests with:

```bash
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage
```

## Architecture

```
┌─────────────────────┐
│  Claude Desktop     │
└──────────┬──────────┘
           │ STDIO (spawn)
           ▼
┌─────────────────────┐
│  MCP Server         │
│  - Tools Router     │
│  - Resource Router  │
│  - Schema Validator │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  QuDAG Core         │
│  (via @qudag/napi)  │
└─────────────────────┘
```

## Security

- All cryptographic operations use NIST-approved post-quantum algorithms
- Private keys are never exposed through resources or tool responses
- STDIO transport provides OS-level process isolation
- Input validation using Zod schemas
- Comprehensive error handling

## Performance

Target performance metrics:

- Tool execution overhead: <0.2ms
- Resource read overhead: <0.1ms
- Message throughput: 10,000+ messages/sec
- Memory usage: ~30MB per server instance

## Contributing

Contributions are welcome! Please see the main QuDAG repository for contribution guidelines.

## License

MIT

## Support

For issues, questions, or contributions, please visit the [QuDAG GitHub repository](https://github.com/ruvnet/QuDAG).

## Related Packages

- `@qudag/napi-core` - Core QuDAG functionality with N-API bindings
- `@qudag/mcp-sse` - QuDAG MCP server with HTTP transport for web deployments
- `@qudag/cli` - QuDAG command-line interface

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Desktop Documentation](https://claude.ai/desktop)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
