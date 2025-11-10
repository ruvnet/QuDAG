# @qudag/mcp-sse

## QuDAG MCP Server with Streamable HTTP Transport

A production-ready Model Context Protocol (MCP) server implementation for QuDAG quantum-resistant distributed systems, using Streamable HTTP transport (SSE) for web integration.

**Version**: 0.1.0
**Protocol**: MCP 2025-03-26
**Transport**: Streamable HTTP (Server-Sent Events)

## Features

### Core Capabilities
- **Quantum Circuit Operations**: Execute, optimize, and analyze quantum circuits on the QuDAG DAG topology
- **Post-Quantum Cryptography**: ML-DSA signatures and ML-KEM key exchange with quantum-resistant algorithms
- **OAuth2 Authentication**: Secure API access with JWT token validation
- **Role-Based Access Control**: Fine-grained permissions for quantum and network operations
- **Rate Limiting**: Prevent abuse with per-user and per-IP rate limiting
- **Security Middleware**: XSS protection, CSRF tokens, security headers, and input validation

### Transport Protocols
- **Streamable HTTP**: Modern HTTP/1.1 with Server-Sent Events for real-time updates
- **JSON-RPC 2.0**: Standard protocol for method calls and notifications
- **TLS 1.3**: End-to-end encryption for all connections
- **CORS Support**: Cross-origin resource sharing with origin validation

## Quick Start

### Installation

```bash
npm install @qudag/mcp-sse
```

### Basic Usage

```typescript
import QuDAGMcpServer from "@qudag/mcp-sse";

const server = new QuDAGMcpServer({
  host: "0.0.0.0",
  port: 3000,
  protocol: "http"
});

await server.start();
console.log("Server running on http://0.0.0.0:3000");
```

### Environment Configuration

Set environment variables to configure the server:

```bash
# Server settings
export QUDAG_HOST=0.0.0.0
export QUDAG_PORT=3000
export QUDAG_PROTOCOL=https

# TLS settings
export QUDAG_TLS_CERT_PATH=/path/to/cert.pem
export QUDAG_TLS_KEY_PATH=/path/to/key.pem

# OAuth2 settings
export QUDAG_OAUTH2_ISSUER_URL=https://auth.qudag.io
export QUDAG_OAUTH2_AUDIENCE=qudag-mcp-api
export QUDAG_OAUTH2_REQUIRE_AUTH=true

# Security
export QUDAG_RATE_LIMIT=1000
export QUDAG_CORS_ORIGINS=https://app.qudag.io,https://quantum.qudag.io

# Logging
export QUDAG_LOG_LEVEL=info
export QUDAG_AUDIT_ENABLED=true
```

## API Documentation

### MCP Protocol Endpoints

#### POST /mcp
Main JSON-RPC 2.0 endpoint for all MCP operations.

**Request Example** (Initialize):
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize",
  "params": {}
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": { "listChanged": false },
      "resources": { "subscribe": false }
    },
    "serverInfo": {
      "name": "QuDAG MCP Server",
      "version": "0.1.0"
    }
  }
}
```

#### tools/list
List all available tools.

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/list",
  "params": {}
}
```

#### tools/call
Execute a specific tool.

```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "method": "tools/call",
  "params": {
    "name": "execute_quantum_dag",
    "arguments": {
      "circuit": {
        "qubits": 5,
        "gates": [
          { "type": "H", "target": 0 },
          { "type": "CNOT", "target": [0, 1], "control": 0 }
        ]
      },
      "execution": {
        "backend": "simulator",
        "shots": 1024
      }
    }
  }
}
```

### Available Tools

#### Quantum Operations
- **execute_quantum_dag**: Execute quantum circuits with consensus validation
- **optimize_circuit**: Optimize quantum circuits for QuDAG execution
- **analyze_complexity**: Analyze circuit complexity and resources
- **benchmark_performance**: Benchmark quantum execution performance

#### Cryptography
- **quantum_key_exchange**: Perform ML-KEM key exchange
- **quantum_sign**: Create ML-DSA signatures
- **system_health_check**: Health check of QuDAG system

#### Network & Vault
- **dark_address_resolve**: Resolve .dark domains
- **peer_discovery**: Discover QuDAG peers
- **vault_quantum_store**: Store encrypted secrets
- **vault_quantum_retrieve**: Retrieve encrypted secrets

## Authentication

### OAuth2 / OIDC

The server supports OAuth2 with JWT token validation:

```bash
# Request with Bearer token
curl -H "Authorization: Bearer eyJhbGc..." \
  -X POST http://localhost:3000/mcp
```

### Token Claims

Required JWT claims:
- `iss`: Issuer URL (must match configured issuer)
- `sub`: Subject (user ID)
- `aud`: Audience (must match configured audience)
- `exp`: Expiration time (in seconds)
- `iat`: Issued at time
- `scope`: Space-separated scopes
- `roles`: Array of role names

### Roles

**Default Roles**:
- **admin**: Full system access
- **developer**: Read/write/execute quantum and DAG operations
- **operator**: Execute and monitor operations (read-only vault/network)
- **auditor**: Read-only access to all resources
- **readonly**: Limited read-only access

## Security

### Threat Mitigation

1. **Authentication**: OAuth2 / OIDC with JWT validation
2. **Authorization**: RBAC with role hierarchies
3. **Rate Limiting**: Token bucket algorithm (default 600 req/min)
4. **Input Validation**: JSON schema validation for all tools
5. **Encryption**: TLS 1.3 required for production
6. **Security Headers**: HSTS, CSP, X-Frame-Options, etc.

### Security Best Practices

1. **Use HTTPS in Production**: Always use TLS 1.3
2. **Enable OAuth2**: Require authentication for all requests
3. **Configure CORS**: Restrict to known origins
4. **Monitor Audit Logs**: Enable audit logging for compliance
5. **Rotate Certificates**: Use short-lived certificates
6. **Update Dependencies**: Keep security patches current

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV QUDAG_PROTOCOL=https
ENV QUDAG_PORT=8443
ENV QUDAG_REQUIRE_AUTH=true

EXPOSE 8443

CMD ["node", "dist/server.js"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qudag-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: qudag-mcp
  template:
    metadata:
      labels:
        app: qudag-mcp
    spec:
      containers:
      - name: mcp-server
        image: qudag/mcp-sse:0.1.0
        ports:
        - containerPort: 8443
        env:
        - name: QUDAG_PROTOCOL
          value: "https"
        - name: QUDAG_TLS_CERT_PATH
          value: "/etc/certs/tls.crt"
        - name: QUDAG_TLS_KEY_PATH
          value: "/etc/certs/tls.key"
        - name: QUDAG_OAUTH2_ISSUER_URL
          valueFrom:
            configMapKeyRef:
              name: qudag-config
              key: oauth2-issuer
        volumeMounts:
        - name: certs
          mountPath: /etc/certs
          readOnly: true
      volumes:
      - name: certs
        secret:
          secretName: qudag-tls
```

### Environment Variables

**Server**:
- `QUDAG_HOST`: Server hostname (default: 0.0.0.0)
- `QUDAG_PORT`: Server port (default: 3000)
- `QUDAG_PROTOCOL`: Protocol (http/https, default: https)

**TLS**:
- `QUDAG_TLS_CERT_PATH`: Path to TLS certificate
- `QUDAG_TLS_KEY_PATH`: Path to TLS private key
- `QUDAG_TLS_CA_PATH`: Path to CA certificate (optional)

**OAuth2**:
- `QUDAG_OAUTH2_ISSUER_URL`: OAuth2 issuer URL
- `QUDAG_OAUTH2_AUDIENCE`: Expected audience claim
- `QUDAG_OAUTH2_JWKS_URL`: JWKS endpoint URL
- `QUDAG_OAUTH2_VERIFY_SIGNATURE`: Verify JWT signatures (default: true)
- `QUDAG_OAUTH2_VERIFY_EXPIRY`: Verify token expiry (default: true)
- `QUDAG_REQUIRE_AUTH`: Require authentication (default: true)

**Security**:
- `QUDAG_RATE_LIMIT`: Requests per minute (default: 600)
- `QUDAG_RATE_LIMIT_PER_USER`: Rate limit per user (default: true)
- `QUDAG_CORS_ORIGINS`: Comma-separated CORS origins
- `QUDAG_HELMET_ENABLED`: Enable Helmet security headers (default: true)
- `QUDAG_CSP_ENABLED`: Enable CSP headers (default: true)

**Logging**:
- `QUDAG_LOG_LEVEL`: Log level (debug/info/warn/error, default: info)
- `QUDAG_LOG_FORMAT`: Log format (json/text, default: json)
- `QUDAG_AUDIT_ENABLED`: Enable audit logging (default: true)

## Development

### Build

```bash
npm run build
npm run typecheck
npm run lint
```

### Testing

```bash
npm test
npm run test:auth
npm run test:tools
```

### Development Server

```bash
npm run dev
```

## Performance

### Benchmarks

- Tool execution latency: < 100ms (p95)
- Async operations: < 10ms overhead
- Streaming throughput: > 10MB/s
- Concurrent requests: > 100/sec

### Optimization

1. Enable HTTP/2 multiplexing
2. Use connection pooling
3. Implement request batching
4. Cache frequently accessed data
5. Use compression (gzip/brotli)

## Error Handling

### Error Codes

- `-32600`: Invalid Request - Malformed JSON-RPC
- `-32601`: Method Not Found - Unknown tool name
- `-32602`: Invalid Params - Invalid tool arguments
- `-32603`: Internal Error - Server-side error
- `-32000`: Quantum Error - Quantum operation failed
- `-32001`: DAG Error - DAG operation failed
- `-32002`: Crypto Error - Cryptographic operation failed
- `-32003`: Network Error - Network operation failed
- `-32004`: Vault Error - Vault operation failed
- `-32005`: Timeout Error - Operation timeout

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "error": {
    "code": -32000,
    "message": "Quantum circuit execution failed",
    "data": {
      "type": "QUANTUM_RESOURCE_LIMIT",
      "component": "quantum_executor",
      "details": "Circuit requires 32 qubits but only 16 available",
      "recovery_hints": [
        "Reduce circuit size to 16 qubits or fewer",
        "Use circuit optimization to reduce qubit requirements"
      ],
      "request_id": "req_123"
    }
  }
}
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Write tests for new features
2. Ensure TypeScript strict mode compliance
3. Add security checks for new endpoints
4. Update documentation
5. Follow existing code style

## License

MIT

## Support

For issues and questions:
- GitHub Issues: https://github.com/ruvnet/QuDAG/issues
- Documentation: https://docs.qudag.io
- Security: security@qudag.io
