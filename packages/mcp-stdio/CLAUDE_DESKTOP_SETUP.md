# Claude Desktop Setup Guide

This guide walks you through setting up the QuDAG MCP STDIO server with Claude Desktop.

## Prerequisites

- Claude Desktop installed on your system
- Node.js 18.0.0 or higher
- QuDAG repository cloned locally

## Step 1: Build the Package

```bash
cd packages/mcp-stdio
npm install
npm run build
```

Verify the build succeeded:

```bash
ls dist/
# Should show: index.js, server.js, and other compiled files
```

## Step 2: Locate Claude Desktop Configuration

Find the Claude Desktop configuration file for your platform:

### macOS
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Windows
```
%APPDATA%\Claude\claude_desktop_config.json
```

### Linux
```
~/.config/Claude/claude_desktop_config.json
```

If the file doesn't exist, create it with an empty JSON object: `{}`

## Step 3: Add QuDAG MCP Server

Edit the configuration file and add the QuDAG server:

```json
{
  "mcpServers": {
    "qudag": {
      "command": "node",
      "args": [
        "/absolute/path/to/QuDAG/packages/mcp-stdio/dist/index.js"
      ],
      "env": {
        "QUDAG_LOG_LEVEL": "info"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/QuDAG` with the actual absolute path to your QuDAG repository.

### Example (macOS/Linux)
```json
{
  "mcpServers": {
    "qudag": {
      "command": "node",
      "args": [
        "/Users/yourname/projects/QuDAG/packages/mcp-stdio/dist/index.js"
      ]
    }
  }
}
```

### Example (Windows)
```json
{
  "mcpServers": {
    "qudag": {
      "command": "node",
      "args": [
        "C:\\Users\\yourname\\projects\\QuDAG\\packages\\mcp-stdio\\dist\\index.js"
      ]
    }
  }
}
```

## Step 4: Restart Claude Desktop

Completely quit and restart Claude Desktop for the changes to take effect.

## Step 5: Verify Installation

In Claude Desktop, try asking:

> "What tools are available from the QuDAG MCP server?"

Claude should list the available QuDAG tools, including:
- execute_quantum_dag
- optimize_circuit
- analyze_complexity
- quantum_key_exchange
- quantum_sign
- dark_address_resolve
- vault_quantum_store
- vault_quantum_retrieve
- system_health_check

## Step 6: Test Basic Functionality

Try executing a simple quantum circuit:

> "Execute a Bell state quantum circuit with 2 qubits using the QuDAG server"

Claude will use the `execute_quantum_dag` tool and return results including measurements and DAG information.

## Troubleshooting

### Server Not Found

If Claude doesn't see the QuDAG server:

1. Check the configuration file path is correct
2. Verify the absolute path to `index.js` is correct
3. Ensure the build succeeded (check `dist/` directory exists)
4. Restart Claude Desktop completely

### Permission Errors

If you see permission errors:

```bash
chmod +x /path/to/QuDAG/packages/mcp-stdio/dist/index.js
```

### View Server Logs

On Unix systems, you can view server output:

```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp-server-qudag.log

# Linux
tail -f ~/.local/share/Claude/logs/mcp-server-qudag.log
```

### Test Server Independently

Test the server outside Claude Desktop:

```bash
cd packages/mcp-stdio
node dist/index.js
```

The server should start without errors. Press Ctrl+C to stop.

## Advanced Configuration

### Environment Variables

You can customize server behavior with environment variables:

```json
{
  "mcpServers": {
    "qudag": {
      "command": "node",
      "args": [
        "/path/to/QuDAG/packages/mcp-stdio/dist/index.js"
      ],
      "env": {
        "QUDAG_LOG_LEVEL": "debug",
        "QUDAG_ENABLE_METRICS": "true",
        "QUDAG_MAX_CIRCUIT_QUBITS": "32"
      }
    }
  }
}
```

### Multiple MCP Servers

You can run multiple MCP servers simultaneously:

```json
{
  "mcpServers": {
    "qudag": {
      "command": "node",
      "args": ["/path/to/QuDAG/packages/mcp-stdio/dist/index.js"]
    },
    "other-server": {
      "command": "other-server-command",
      "args": ["--config", "config.json"]
    }
  }
}
```

## Example Usage

### Execute Quantum Circuit

> "Execute a quantum circuit with 3 qubits. Apply Hadamard gates to all qubits, then measure with 1000 shots."

### Quantum Key Exchange

> "Perform a quantum key exchange using ML-KEM-768 as the initiator"

### Analyze Circuit Complexity

> "Analyze the complexity of a quantum circuit with 4 qubits and 10 gates"

### Check System Health

> "Check the health status of the QuDAG system"

### Resolve Dark Address

> "Resolve the dark address 'quantum-node-1.dark' with quantum fingerprint verification"

## Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Desktop Documentation](https://claude.ai/desktop)
- [QuDAG GitHub Repository](https://github.com/ruvnet/QuDAG)

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Review server logs
3. Open an issue on the QuDAG GitHub repository
4. Include your configuration and error messages

## Security Notes

- The MCP server runs locally on your machine
- Communication is via STDIO (no network exposure)
- OS-level process isolation applies
- Private keys are never exposed through the API
- All cryptographic operations use post-quantum algorithms

## Next Steps

- Explore all available tools and resources
- Try complex quantum circuit operations
- Experiment with quantum cryptography
- Monitor system health and performance
- Integrate with your quantum development workflow
