# QuDAG MCP-SSE API Documentation

## API Overview

The QuDAG MCP-SSE server implements the Model Context Protocol (MCP 2025-03-26) with Streamable HTTP transport using Server-Sent Events (SSE).

### Base URL

```
https://api.qudag.io/mcp
```

### Authentication

All requests (except health check) require OAuth2 bearer token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -X POST https://api.qudag.io/mcp \
  -H "Content-Type: application/json"
```

## Core API Methods

### 1. Initialize Server

Initializes the MCP connection and returns protocol capabilities.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "initialize",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "tools": {
        "listChanged": false
      },
      "resources": {
        "subscribe": false
      }
    },
    "serverInfo": {
      "name": "QuDAG MCP Server",
      "version": "0.1.0"
    }
  }
}
```

### 2. List Tools

Retrieve available tools with schemas.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": {
    "tools": [
      {
        "name": "execute_quantum_dag",
        "description": "Execute quantum circuit operations on the QuDAG topology",
        "inputSchema": {
          "type": "object",
          "properties": {
            "circuit": {
              "type": "object",
              "properties": {
                "qubits": { "type": "integer", "minimum": 1, "maximum": 32 },
                "gates": { "type": "array" }
              },
              "required": ["qubits", "gates"]
            }
          },
          "required": ["circuit"]
        }
      }
    ]
  }
}
```

### 3. Call Tool

Execute a specific tool with parameters.

**Request:**
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
          {"type": "H", "target": 0},
          {"type": "CNOT", "target": [0, 1], "control": 0},
          {"type": "X", "target": 2}
        ]
      },
      "execution": {
        "backend": "simulator",
        "shots": 1024,
        "optimization_level": 2
      },
      "consensus": {
        "require_finality": true,
        "timeout_ms": 30000
      }
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"execution_id\": \"exec_abc123\", \"status\": \"completed\", \"results\": {...}}"
    }]
  }
}
```

## Quantum Tools API

### execute_quantum_dag

Execute quantum circuits on QuDAG topology.

**Parameters:**
```typescript
{
  circuit: {
    qubits: number (1-32);
    gates: Array<{
      type: "H" | "X" | "Y" | "Z" | "CNOT" | "T" | "S" | "RX" | "RY" | "RZ";
      target: number | number[];
      params?: number[];
      control?: number;
    }>;
    measurements?: number[];
  };
  execution?: {
    backend?: "simulator" | "classical-dag";
    shots?: number (1-10000);
    optimization_level?: 0 | 1 | 2 | 3;
    noise_model?: {
      enabled: boolean;
      error_rate?: number;
    };
  };
  consensus?: {
    require_finality?: boolean;
    timeout_ms?: number;
    min_confirmations?: number;
  };
  metadata?: {
    label?: string;
    description?: string;
    tags?: string[];
  };
}
```

**Example:**
```bash
curl -X POST https://api.qudag.io/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "exec_001",
    "method": "tools/call",
    "params": {
      "name": "execute_quantum_dag",
      "arguments": {
        "circuit": {
          "qubits": 3,
          "gates": [
            {"type": "H", "target": 0},
            {"type": "H", "target": 1},
            {"type": "H", "target": 2}
          ]
        },
        "execution": {
          "shots": 1024
        }
      }
    }
  }'
```

### optimize_circuit

Optimize quantum circuits for execution.

**Parameters:**
```typescript
{
  circuit: {
    qubits: number;
    gates: Array<Gate>;
  };
  optimization: {
    level: 0 | 1 | 2 | 3;
    preserve_semantics?: boolean;
    target_metric?: "depth" | "gates" | "fidelity" | "dag-locality";
    max_iterations?: number;
  };
  dag_optimization?: {
    minimize_dag_depth?: boolean;
    maximize_parallelism?: boolean;
    locality_aware?: boolean;
  };
}
```

### analyze_complexity

Analyze circuit complexity and resources.

**Parameters:**
```typescript
{
  circuit: {
    qubits: number;
    gates: Array<Gate>;
  };
  analysis?: {
    include_quantum_metrics?: boolean;
    include_classical_metrics?: boolean;
    include_dag_metrics?: boolean;
    include_resource_estimates?: boolean;
  };
}
```

### benchmark_performance

Benchmark execution performance.

**Parameters:**
```typescript
{
  circuit: {
    qubits: number;
    gates: Array<Gate>;
  };
  benchmark?: {
    iterations?: number;
    warmup_iterations?: number;
    parallel_executions?: number;
    backends?: Array<"simulator" | "classical-dag">;
  };
  metrics?: {
    execution_time?: boolean;
    throughput?: boolean;
    latency_distribution?: boolean;
    resource_utilization?: boolean;
    dag_consensus_time?: boolean;
  };
}
```

## Cryptography Tools API

### quantum_key_exchange

Perform quantum-resistant key exchange.

**Parameters:**
```typescript
{
  algorithm: "ml-kem-512" | "ml-kem-768" | "ml-kem-1024";
  role: "initiator" | "responder";
  encapsulated_key?: string;
  options?: {
    derive_shared_secret?: boolean;
    store_in_vault?: boolean;
    vault_label?: string;
  };
  dag_storage?: {
    store_public_key?: boolean;
    require_consensus?: boolean;
  };
}
```

**Example:**
```bash
curl -X POST https://api.qudag.io/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "kex_001",
    "method": "tools/call",
    "params": {
      "name": "quantum_key_exchange",
      "arguments": {
        "algorithm": "ml-kem-768",
        "role": "initiator",
        "options": {
          "store_in_vault": true,
          "vault_label": "alice_bob_key"
        }
      }
    }
  }'
```

### quantum_sign

Create quantum-resistant digital signatures.

**Parameters:**
```typescript
{
  data: string (base64);
  algorithm: "ml-dsa-44" | "ml-dsa-65" | "ml-dsa-87";
  private_key: string;
  options?: {
    include_timestamp?: boolean;
    include_context?: boolean;
    context?: string;
  };
  dag_storage?: {
    store_signature?: boolean;
    attach_to_vertex?: string;
  };
}
```

### system_health_check

Check QuDAG system health.

**Parameters:**
```typescript
{
  components?: {
    dag?: boolean;
    crypto?: boolean;
    network?: boolean;
    vault?: boolean;
    consensus?: boolean;
  };
  depth?: "basic" | "detailed" | "comprehensive";
  performance_tests?: {
    enabled?: boolean;
    quick_tests_only?: boolean;
  };
}
```

## Error Responses

All errors follow the JSON-RPC 2.0 error format:

```json
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "error": {
    "code": -32000,
    "message": "Error message",
    "data": {
      "type": "ERROR_TYPE",
      "component": "component_name",
      "details": "Technical details",
      "recovery_hints": ["Hint 1", "Hint 2"],
      "request_id": "req_123"
    }
  }
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32600 | Invalid Request | Malformed JSON-RPC |
| -32601 | Method Not Found | Unknown tool name |
| -32602 | Invalid Params | Invalid tool arguments |
| -32603 | Internal Error | Server-side error |
| -32000 | Quantum Error | Quantum operation failed |
| -32001 | DAG Error | DAG operation failed |
| -32002 | Crypto Error | Cryptographic operation failed |
| -32003 | Network Error | Network operation failed |
| -32004 | Vault Error | Vault operation failed |
| -32005 | Timeout Error | Operation timeout |

## Rate Limiting

All endpoints are subject to rate limiting. Default limits:

- **Global**: 1000 requests/minute
- **Per-User**: 600 requests/minute
- **Per-IP**: 60 requests/minute

**Rate Limit Headers:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 2024-01-01T12:00:00Z
Retry-After: 60
```

## Authentication Scopes

OAuth2 scopes control access:

| Scope | Description |
|-------|-------------|
| `qudag:read` | Read quantum and DAG data |
| `qudag:write` | Write quantum and DAG data |
| `qudag:execute` | Execute quantum operations |
| `vault:read` | Read vault entries |
| `vault:write` | Write vault entries |
| `admin` | Administrative operations |

## API Examples

### Example 1: Execute Bell State

```bash
#!/bin/bash

TOKEN="your_oauth2_token"
API="https://api.qudag.io/mcp"

curl -X POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "bell_001",
    "method": "tools/call",
    "params": {
      "name": "execute_quantum_dag",
      "arguments": {
        "circuit": {
          "qubits": 2,
          "gates": [
            {"type": "H", "target": 0},
            {"type": "CNOT", "target": [0, 1], "control": 0}
          ],
          "measurements": [0, 1]
        },
        "execution": {
          "shots": 1024
        }
      }
    }
  }' | jq .
```

### Example 2: Key Exchange

```bash
#!/bin/bash

TOKEN="your_oauth2_token"
API="https://api.qudag.io/mcp"

# Step 1: Initiator creates key
INITIATOR=$(curl -s -X POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "kex_1",
    "method": "tools/call",
    "params": {
      "name": "quantum_key_exchange",
      "arguments": {
        "algorithm": "ml-kem-768",
        "role": "initiator"
      }
    }
  }' | jq -r '.result.content[0].text | fromjson')

PUBLIC_KEY=$(echo $INITIATOR | jq -r '.public_key')
ENCAPSULATED=$(echo $INITIATOR | jq -r '.encapsulated_key')

echo "Public Key: $PUBLIC_KEY"
echo "Encapsulated Key: $ENCAPSULATED"

# Step 2: Responder decapsulates
curl -s -X POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": \"kex_2\",
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"quantum_key_exchange\",
      \"arguments\": {
        \"algorithm\": \"ml-kem-768\",
        \"role\": \"responder\",
        \"encapsulated_key\": \"$ENCAPSULATED\"
      }
    }
  }" | jq .
```

### Example 3: Circuit Analysis

```bash
#!/bin/bash

TOKEN="your_oauth2_token"
API="https://api.qudag.io/mcp"

curl -X POST "$API" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "analyze_001",
    "method": "tools/call",
    "params": {
      "name": "analyze_complexity",
      "arguments": {
        "circuit": {
          "qubits": 10,
          "gates": [
            {"type": "H", "target": 0},
            {"type": "H", "target": 1},
            {"type": "CNOT", "target": [0, 1], "control": 0},
            {"type": "CNOT", "target": [1, 2], "control": 1}
          ]
        },
        "analysis": {
          "include_quantum_metrics": true,
          "include_classical_metrics": true,
          "include_dag_metrics": true,
          "include_resource_estimates": true
        }
      }
    }
  }' | jq .
```

## Best Practices

1. **Token Management**
   - Use short-lived tokens (15 minutes)
   - Refresh tokens before expiry
   - Revoke tokens on logout

2. **Error Handling**
   - Implement exponential backoff for retries
   - Check `Retry-After` header for rate limiting
   - Log errors for debugging

3. **Performance**
   - Batch tool calls when possible
   - Use circuit optimization before large executions
   - Cache frequently used results

4. **Security**
   - Use HTTPS only
   - Validate SSL certificates
   - Never log sensitive data
   - Use strong authentication

---

For more information, visit: https://docs.qudag.io/api
