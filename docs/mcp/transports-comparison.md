# QuDAG MCP Transport Comparison: STDIO vs Streamable HTTP

## Executive Summary

This document provides a comprehensive comparison between STDIO and Streamable HTTP (formerly SSE) transports for QuDAG MCP integration. It analyzes architectural differences, security considerations, performance characteristics, and provides implementation recommendations for each transport mechanism.

**Design Date**: 2025-11-10
**MCP Protocol Version**: 2025-03-26
**Target Packages**: @qudag/mcp-stdio, @qudag/mcp-sse

---

## Protocol Evolution Note

### SSE Deprecation
As of MCP specification version 2025-03-26, the Server-Sent Events (SSE) transport has been **deprecated** in favor of **Streamable HTTP**. While we refer to the package as `@qudag/mcp-sse` for historical compatibility, the implementation will use the **Streamable HTTP** protocol.

### Key Changes
- **Old**: Dual-endpoint architecture (POST /connect + SSE stream)
- **New**: Single endpoint supporting both POST and GET
- **Benefit**: Simplified architecture, better HTTP semantics, improved caching

---

## Transport Architectures

## 1. STDIO Transport (@qudag/mcp-stdio)

### Architecture Overview
```
┌──────────────────────────────────────────┐
│         Claude Desktop / Host            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │     MCP Client (stdio)             │  │
│  └──────────┬─────────────────────────┘  │
└─────────────┼────────────────────────────┘
              │ spawn subprocess
              │ stdin/stdout pipes
              ▼
┌──────────────────────────────────────────┐
│    QuDAG MCP Server Process              │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   Message Router                   │  │
│  │   - Parse JSON from stdin          │  │
│  │   - Write JSON to stdout           │  │
│  │   - Newline-delimited              │  │
│  └──────────┬─────────────────────────┘  │
│             │                            │
│  ┌──────────▼─────────────────────────┐  │
│  │   QuDAG Core                       │  │
│  │   - DAG operations                 │  │
│  │   - Quantum circuits               │  │
│  │   - Crypto operations              │  │
│  │   - Vault access                   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Message Flow
```
Client                    Server (stdio)
  |                             |
  |-- spawn process ----------->|
  |                             |
  |-- {"method":"initialize"}-->|
  |                             |
  |<--{"result":{...}}---------|
  |                             |
  |--{"method":"tools/list"}-->|
  |                             |
  |<--{"result":{tools:[...]}}-|
  |                             |
  |--{"method":"tools/call"}-->|
  |                             |
  |<--{"method":"progress"}-----| (notification)
  |                             |
  |<--{"result":{...}}----------| (completion)
```

### Process Lifecycle
1. **Startup**: Client spawns server as subprocess
2. **Initialization**: Handshake via initialize method
3. **Operation**: Request/response over stdin/stdout
4. **Notifications**: Server can send async notifications
5. **Shutdown**: Client terminates process (SIGTERM/SIGKILL)

### Message Format
Newline-delimited JSON over stdio:
```
{"jsonrpc":"2.0","id":"1","method":"initialize","params":{...}}
{"jsonrpc":"2.0","id":"1","result":{...}}
{"jsonrpc":"2.0","method":"notification","params":{...}}
```

---

## 2. Streamable HTTP Transport (@qudag/mcp-sse)

### Architecture Overview
```
┌──────────────────────────────────────────┐
│     Web Browser / Claude Web             │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  MCP Client (Streamable HTTP)      │  │
│  └──────────┬─────────────────────────┘  │
└─────────────┼────────────────────────────┘
              │ HTTPS
              │ POST /mcp
              ▼
┌──────────────────────────────────────────┐
│    Load Balancer / CDN                   │
│    - TLS termination                     │
│    - Request routing                     │
│    - Rate limiting                       │
└──────────────┬───────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────┐
│    QuDAG MCP Server (HTTP)               │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   HTTP Server (Axum)               │  │
│  │   - Single /mcp endpoint           │  │
│  │   - POST: JSON-RPC request         │  │
│  │   - GET: Health check              │  │
│  │   - Content-Type negotiation       │  │
│  └──────────┬─────────────────────────┘  │
│             │                            │
│  ┌──────────▼─────────────────────────┐  │
│  │   Authentication Middleware        │  │
│  │   - OAuth2 / Bearer tokens         │  │
│  │   - Session management             │  │
│  │   - Rate limiting                  │  │
│  └──────────┬─────────────────────────┘  │
│             │                            │
│  ┌──────────▼─────────────────────────┐  │
│  │   Message Router                   │  │
│  │   - Route to tool handlers         │  │
│  │   - Stream large responses         │  │
│  │   - Error handling                 │  │
│  └──────────┬─────────────────────────┘  │
│             │                            │
│  ┌──────────▼─────────────────────────┐  │
│  │   QuDAG Core                       │  │
│  │   - DAG operations                 │  │
│  │   - Quantum circuits               │  │
│  │   - Crypto operations              │  │
│  │   - Vault access                   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Message Flow
```
Client                    Server (Streamable HTTP)
  |                             |
  |-- POST /mcp ---------------->|
  |   Accept: application/json, |
  |           text/event-stream |
  |   Body: {"method":"init"}   |
  |                             |
  |<-- 200 OK -------------------| (JSON response)
  |    Content-Type:            |
  |    application/json         |
  |    Body: {"result":{...}}   |
  |                             |
  |-- POST /mcp ---------------->| (long operation)
  |   Body: {"method":"exec"}   |
  |                             |
  |<-- 200 OK -------------------| (SSE stream)
  |    Content-Type:            |
  |    text/event-stream        |
  |                             |
  |<-- data: {"progress":0.5}---| (SSE event)
  |                             |
  |<-- data: {"result":{...}}---| (final result)
  |                             |
  |    [stream closes]          |
```

### HTTP Request/Response
```http
POST /mcp HTTP/1.1
Host: qudag-mcp.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json, text/event-stream

{
  "jsonrpc": "2.0",
  "id": "req_123",
  "method": "tools/call",
  "params": {
    "name": "execute_quantum_dag",
    "arguments": {...}
  }
}
```

Response (fast operation):
```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-cache
X-Request-ID: req_123

{
  "jsonrpc": "2.0",
  "id": "req_123",
  "result": {...}
}
```

Response (streaming operation):
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
X-Request-ID: req_123

data: {"jsonrpc":"2.0","method":"progress","params":{"progress":0.25}}

data: {"jsonrpc":"2.0","method":"progress","params":{"progress":0.75}}

data: {"jsonrpc":"2.0","id":"req_123","result":{...}}
```

---

## Detailed Comparison

## Security

### STDIO Transport

**Authentication**:
- **OS-level process permissions**: Server inherits user permissions
- **No network authentication**: Local process only
- **Environment variables**: Configuration via env vars
- **File system permissions**: Vault access controlled by file permissions

**Encryption**:
- **Not applicable**: Communication within same machine
- **Process isolation**: OS-enforced memory isolation
- **IPC security**: OS-enforced pipe security

**Attack Surface**:
- **Local only**: Must compromise host machine first
- **Process injection**: Standard OS protection
- **File system**: Vault files on local disk
- **Supply chain**: Malicious server binary

**Best Practices**:
```typescript
// STDIO server configuration
interface StdioSecurityConfig {
  // Inherit user permissions
  user_context: "inherit";

  // Environment-based configuration
  vault_path: string;              // From QUDAG_VAULT_PATH
  config_path: string;             // From QUDAG_CONFIG_PATH

  // No network exposure
  network_enabled: false;

  // Process isolation
  sandbox_enabled: boolean;        // OS-level sandbox
}
```

**Threat Model**:
| Threat | Risk | Mitigation |
|--------|------|------------|
| Malicious client | Low | OS process permissions |
| Process injection | Medium | OS protections, code signing |
| Vault file access | Medium | File permissions, encryption at rest |
| Supply chain attack | High | Binary verification, checksums |

---

### Streamable HTTP Transport

**Authentication**:
- **OAuth2 / OpenID Connect**: Standard web authentication
- **Bearer tokens**: JWT or opaque tokens
- **API keys**: For service-to-service
- **Mutual TLS**: Optional client certificates

**Authorization**:
- **Role-based access control (RBAC)**: Fine-grained permissions
- **Capability-based**: Per-tool authorization
- **Vault-level permissions**: Separate vault access control
- **Rate limiting**: Prevent abuse

**Encryption**:
- **TLS 1.3 required**: All traffic encrypted
- **Certificate validation**: Prevent MITM
- **HSTS**: HTTP Strict Transport Security
- **Origin validation**: DNS rebinding protection

**Attack Surface**:
- **Network exposure**: Public or private network
- **DDoS**: Distributed denial of service
- **Credential theft**: Token/session hijacking
- **Man-in-the-middle**: TLS implementation bugs
- **DNS rebinding**: Malicious origin headers

**Best Practices**:
```typescript
// Streamable HTTP security configuration
interface HttpSecurityConfig {
  // TLS configuration
  tls: {
    cert_path: string;
    key_path: string;
    min_version: "TLS1.3";
    cipher_suites: string[];       // Strong ciphers only
  };

  // Authentication
  auth: {
    method: "oauth2" | "bearer" | "mtls";
    issuer_url?: string;           // OAuth issuer
    jwks_url?: string;             // JSON Web Key Set
    audience?: string;             // Expected audience
    token_validation: {
      verify_signature: true;
      verify_expiry: true;
      verify_audience: true;
    };
  };

  // Authorization
  authorization: {
    rbac_enabled: boolean;
    default_role: string;
    require_vault_permission: boolean;
  };

  // Security headers
  security_headers: {
    hsts: "max-age=31536000; includeSubDomains";
    csp: "default-src 'none'";
    x_frame_options: "DENY";
    x_content_type_options: "nosniff";
  };

  // Origin validation
  cors: {
    allowed_origins: string[];
    credentials: boolean;
  };

  // Rate limiting
  rate_limiting: {
    requests_per_minute: number;
    burst_size: number;
    by_client_id: boolean;
  };
}
```

**Threat Model**:
| Threat | Risk | Mitigation |
|--------|------|------------|
| Unauthorized access | High | OAuth2, strong authentication |
| Token theft | High | Short-lived tokens, rotation |
| DDoS attack | High | Rate limiting, WAF |
| MITM attack | Medium | TLS 1.3, certificate pinning |
| DNS rebinding | Medium | Origin validation, CORS |
| Credential stuffing | High | Rate limiting, MFA |

---

## Performance

### STDIO Transport

**Latency**:
- **Local IPC**: 0.1-1ms per message
- **No network overhead**: Direct process communication
- **Pipe buffering**: Kernel-level optimization
- **No TLS overhead**: Unencrypted communication

**Throughput**:
- **High message rate**: 10,000+ messages/sec
- **Large payloads**: Limited by pipe buffer (~65KB)
- **Streaming**: Efficient for continuous data
- **Memory usage**: Low overhead

**Scalability**:
- **Single client**: One server process per client
- **Process overhead**: ~10-50MB per server
- **CPU usage**: Minimal for routing
- **Vertical scaling**: Limited by host resources

**Benchmarks**:
```typescript
// Typical STDIO performance
interface StdioPerformance {
  message_latency_p50: "0.5ms";
  message_latency_p99: "2ms";
  throughput_messages_per_sec: 10000;
  memory_per_server_mb: 30;

  // Operation-specific
  tool_execution_overhead_ms: 0.2;
  resource_read_overhead_ms: 0.1;
  notification_latency_ms: 0.5;
}
```

**Optimization Strategies**:
- **Message batching**: Combine multiple small messages
- **Binary encoding**: Optionally use MessagePack instead of JSON
- **Lazy evaluation**: Defer expensive operations
- **Connection reuse**: Keep server process alive

---

### Streamable HTTP Transport

**Latency**:
- **Network RTT**: 10-100ms (depends on geography)
- **TLS handshake**: 50-200ms (first request)
- **HTTP overhead**: 1-5ms per request
- **Keep-alive**: Reduced overhead for multiple requests

**Throughput**:
- **Request rate**: 100-1,000 requests/sec per server
- **Large payloads**: Efficient with HTTP/2 multiplexing
- **Streaming**: SSE for real-time updates
- **Caching**: HTTP caching for resources

**Scalability**:
- **Multiple clients**: Thousands per server
- **Horizontal scaling**: Load balancer + multiple servers
- **Connection pooling**: Reuse TCP connections
- **Stateless**: Easy to scale horizontally

**Benchmarks**:
```typescript
// Typical Streamable HTTP performance
interface HttpPerformance {
  message_latency_p50: "50ms";     // Including network
  message_latency_p99: "200ms";
  throughput_requests_per_sec: 500;
  memory_per_server_mb: 200;       // More clients per server

  // Operation-specific
  tool_execution_overhead_ms: 10;
  resource_read_overhead_ms: 5;
  sse_notification_latency_ms: 50;

  // TLS impact
  tls_handshake_ms: 100;
  tls_overhead_per_request_ms: 2;
}
```

**Optimization Strategies**:
- **HTTP/2 multiplexing**: Multiple requests over single connection
- **TLS session resumption**: Fast reconnection
- **Compression**: Gzip/Brotli for large payloads
- **CDN caching**: Cache resources globally
- **Connection keep-alive**: Reduce handshake overhead
- **Request batching**: Combine multiple operations

**CDN Integration**:
```typescript
interface CdnConfig {
  // Cache static resources
  resource_cache: {
    "quantum://algorithms": "public, max-age=3600";
    "crypto://algorithms": "public, max-age=3600";
    "system://status": "private, max-age=10";
  };

  // Edge computing
  edge_functions: {
    auth_validation: boolean;       // Validate at edge
    rate_limiting: boolean;         // Rate limit at edge
  };
}
```

---

## State Management

### STDIO Transport

**Session State**:
- **Process lifetime**: State lives with process
- **Single session**: One client per server
- **Memory-based**: Fast state access
- **No persistence**: State lost on restart

**State Storage**:
```typescript
interface StdioState {
  // In-memory state
  execution_cache: Map<string, ExecutionState>;
  subscription_map: Map<string, Subscription>;

  // No distributed state
  distributed: false;

  // Fast access
  state_access_time_us: 1;
}
```

**Limitations**:
- Cannot share state between clients
- State lost if process crashes
- Limited to single machine resources

---

### Streamable HTTP Transport

**Session State**:
- **Stateless design**: Each request independent
- **Session tokens**: Identify client sessions
- **Distributed state**: Redis/database for shared state
- **Persistent**: State survives server restarts

**State Storage**:
```typescript
interface HttpState {
  // Session store (Redis)
  session_store: {
    type: "redis" | "postgres" | "memory";
    ttl_seconds: number;

    // Session data
    sessions: {
      [session_id: string]: {
        user_id: string;
        created_at: string;
        last_active: string;
        state: Record<string, any>;
      };
    };
  };

  // Execution tracking (database)
  execution_store: {
    active_executions: Map<string, ExecutionState>;
    completed_executions: Array<ExecutionResult>;
  };

  // Subscription management (pub/sub)
  subscriptions: {
    backend: "redis" | "nats" | "kafka";
    topics: Map<string, Set<string>>;  // topic -> subscriber_ids
  };

  // Distributed
  distributed: true;

  // Slower access (network)
  state_access_time_ms: 5;
}
```

**Benefits**:
- State shared across multiple servers
- Survives server restarts
- Enables load balancing
- Scales horizontally

---

## Long-Running Operations

### STDIO Transport

**Progress Tracking**:
```typescript
// Server sends notifications
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/progress",
  "params": {
    "execution_id": "exec_123",
    "progress": 0.45,
    "message": "Optimizing circuit..."
  }
}
```

**Implementation**:
```rust
// Rust server code
async fn execute_with_progress(
    circuit: Circuit,
    notifier: &mut StdioNotifier,
) -> Result<ExecutionResult> {
    // Start execution
    let exec_id = start_execution(&circuit).await?;

    // Send progress updates
    for progress in 0..=100 {
        notifier.send_progress(exec_id, progress as f64 / 100.0).await?;
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    // Return final result
    get_execution_result(exec_id).await
}
```

---

### Streamable HTTP Transport

**Progress Tracking via SSE**:
```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: text/event-stream

{"method":"execute_quantum_dag","params":{...}}

---

HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"method":"progress","params":{"execution_id":"exec_123","progress":0.25}}

data: {"method":"progress","params":{"execution_id":"exec_123","progress":0.50}}

data: {"method":"progress","params":{"execution_id":"exec_123","progress":0.75}}

data: {"id":"req_123","result":{...}}

[stream closes]
```

**Implementation**:
```rust
// Rust server code
async fn handle_long_operation(
    req: ExecuteRequest,
) -> impl Stream<Item = SseEvent> {
    let (tx, rx) = mpsc::channel(100);

    tokio::spawn(async move {
        let exec_id = start_execution(&req.circuit).await.unwrap();

        // Send progress updates
        for progress in (0..=100).step_by(25) {
            let event = SseEvent::Progress {
                execution_id: exec_id.clone(),
                progress: progress as f64 / 100.0,
            };
            tx.send(event).await.ok();
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        // Send final result
        let result = get_execution_result(&exec_id).await.unwrap();
        tx.send(SseEvent::Result { result }).await.ok();
    });

    ReceiverStream::new(rx)
}
```

---

## Use Case Recommendations

### Use STDIO When:

✅ **Local desktop applications**
- Claude Desktop integration
- VS Code extensions
- Local development tools

✅ **CLI tools**
- Command-line utilities
- Shell scripts
- Local automation

✅ **Single-user scenarios**
- Personal quantum experiments
- Local vault management
- Development/testing

✅ **Low latency required**
- Real-time operations
- High-frequency trading
- Interactive debugging

✅ **No network available**
- Offline operation
- Air-gapped environments
- Local-only security

---

### Use Streamable HTTP When:

✅ **Web applications**
- Browser-based quantum IDE
- Cloud-hosted vault management
- Web dashboards

✅ **Multi-user scenarios**
- Team collaboration
- Shared resources
- Centralized management

✅ **Scalability required**
- High concurrent users
- Load balancing
- Geographic distribution

✅ **Cloud deployments**
- Serverless functions
- Container orchestration
- Microservices architecture

✅ **Standard web auth**
- OAuth2 integration
- SSO (Single Sign-On)
- Enterprise authentication

---

## Implementation Recommendations

### Package Structure

```
@qudag/mcp-stdio/
├── src/
│   ├── server.ts          # STDIO server implementation
│   ├── client.ts          # STDIO client implementation
│   ├── transport.ts       # STDIO transport layer
│   ├── tools/             # Tool implementations
│   ├── resources/         # Resource implementations
│   └── types.ts           # TypeScript types
├── examples/
│   ├── basic-server.ts
│   └── cli-tool.ts
└── package.json

@qudag/mcp-sse/
├── src/
│   ├── server.ts          # HTTP server implementation
│   ├── client.ts          # HTTP client implementation
│   ├── transport.ts       # Streamable HTTP transport
│   ├── auth/              # Authentication middleware
│   ├── tools/             # Tool implementations
│   ├── resources/         # Resource implementations
│   └── types.ts           # TypeScript types
├── examples/
│   ├── web-server.ts
│   └── cloud-deployment.ts
└── package.json
```

### Shared Code
Both packages should share common code:

```typescript
// @qudag/mcp-core (shared package)
export interface McpTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute(args: any): Promise<any>;
}

export interface McpResource {
  uri: string;
  mimeType: string;
  read(params?: any): Promise<any>;
}

// Common tool implementations
export class QuantumDagTool implements McpTool {
  // Shared across both transports
}
```

---

## Migration Path

### From STDIO to Streamable HTTP
1. **Extract business logic**: Separate tool logic from transport
2. **Add authentication**: Implement OAuth2/bearer tokens
3. **Add HTTP server**: Wrap tool handlers in HTTP endpoints
4. **Add state management**: Move from memory to Redis/database
5. **Add monitoring**: Metrics, logging, tracing
6. **Add deployment**: Containers, load balancers, CDN

### From Streamable HTTP to STDIO
1. **Remove auth middleware**: Rely on OS permissions
2. **Replace HTTP server**: Use stdio transport
3. **Simplify state**: Use in-process memory
4. **Remove network code**: Direct process communication
5. **Package as binary**: Single executable

---

## Conclusion

Both STDIO and Streamable HTTP transports have distinct advantages:

**STDIO**: Best for local, low-latency, single-user scenarios with OS-level security.

**Streamable HTTP**: Best for web, multi-user, scalable scenarios with standard web authentication.

QuDAG should provide both transports to support the full spectrum of use cases, from local development tools to cloud-scale web applications.

---

**Document Status**: Draft
**Last Updated**: 2025-11-10
**Next Review**: Before implementation phase 1
