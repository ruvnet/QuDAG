# QuDAG MCP Resources Design

## Executive Summary

This document defines the MCP resource interface design for QuDAG's quantum-resistant distributed system. Resources provide read-only access to system state, quantum circuit data, DAG structures, and monitoring information through standardized URI schemes.

**Design Date**: 2025-11-10
**MCP Protocol Version**: 2025-03-26
**Target Packages**: @qudag/mcp-stdio, @qudag/mcp-sse

---

## Design Principles

### 1. URI-Based Addressing
- Hierarchical URI scheme for intuitive navigation
- Query parameters for filtering and pagination
- Fragment identifiers for specific data elements
- Consistent naming conventions across resources

### 2. Read-Only Semantics
- Resources are immutable views of system state
- State changes occur through tools, not resources
- Resources reflect current or historical state
- Cache-friendly with explicit TTL and ETags

### 3. Efficient Data Access
- Lazy loading for large datasets
- Pagination support for collection resources
- Selective field inclusion/exclusion
- Compression for large payloads

### 4. Real-Time Updates
- Subscription support for resource changes
- WebSocket/SSE notifications for updates
- Change events with detailed diff information
- Efficient delta updates

---

## Resource URI Schemes

## 1. Quantum State Resources

### URI: `quantum://states/{execution_id}`

**Purpose**: Access quantum circuit execution state and results.

**URI Parameters**:
- `{execution_id}`: Unique execution identifier

**Query Parameters**:
- `format`: `json` | `statevector` | `density-matrix` (default: `json`)
- `include_metadata`: `true` | `false` (default: `true`)

**MIME Type**: `application/json` or `application/octet-stream` (for binary formats)

**Resource Content**:
```typescript
interface QuantumStateResource {
  // Execution metadata
  execution: {
    execution_id: string;
    circuit_id: string;
    status: "pending" | "running" | "completed" | "failed";
    created_at: string;              // ISO 8601
    completed_at?: string;
    execution_time_ms?: number;
  };

  // Quantum state (when completed)
  state?: {
    qubits: number;
    measurements: Record<string, number>;  // Bitstring -> count
    probabilities: Record<string, number>; // Bitstring -> probability
    statevector?: {
      real: number[];
      imaginary: number[];
    };
    density_matrix?: number[][];
  };

  // Circuit information
  circuit: {
    qubits: number;
    gate_count: number;
    depth: number;
    entanglement_entropy?: number;
  };

  // DAG integration
  dag_info: {
    vertex_id: string;
    consensus_status: string;
    confidence_score: number;
  };

  // Cache control
  cache_control: {
    ttl_seconds: number;
    etag: string;
    last_modified: string;
  };
}
```

**Example URIs**:
```
quantum://states/exec_789
quantum://states/exec_789?format=statevector
quantum://states/exec_789?include_metadata=false
```

**Subscription Support**: Yes
- Event: `quantum/state/changed`
- Triggers: Status change, result availability

---

### URI: `quantum://circuits/{circuit_id}`

**Purpose**: Access quantum circuit definitions and metadata.

**URI Parameters**:
- `{circuit_id}`: Unique circuit identifier

**Query Parameters**:
- `format`: `json` | `qasm` | `quil` (default: `json`)
- `include_optimization`: `true` | `false` (default: `false`)
- `version`: Circuit version number

**Resource Content**:
```typescript
interface QuantumCircuitResource {
  // Circuit metadata
  circuit: {
    circuit_id: string;
    label?: string;
    description?: string;
    version: number;
    created_at: string;
    updated_at: string;
    created_by?: string;
  };

  // Circuit definition
  definition: {
    qubits: number;
    classical_bits?: number;
    gates: Array<{
      type: string;
      target: number | number[];
      params?: number[];
      control?: number;
    }>;
    measurements?: number[];
  };

  // Circuit metrics
  metrics: {
    gate_count: number;
    depth: number;
    two_qubit_gates: number;
    entanglement_entropy: number;
    complexity_class: string;
  };

  // Optimization information
  optimization?: {
    original_gate_count: number;
    optimized_gate_count: number;
    optimization_level: number;
    techniques_applied: string[];
  };

  // Execution history
  execution_history?: {
    total_executions: number;
    last_execution: string;
    average_execution_time_ms: number;
  };
}
```

**Example URIs**:
```
quantum://circuits/circ_123
quantum://circuits/circ_123?format=qasm
quantum://circuits/circ_123?version=2
```

---

### URI: `quantum://benchmarks/{benchmark_id}`

**Purpose**: Access quantum benchmark results and performance data.

**Resource Content**:
```typescript
interface QuantumBenchmarkResource {
  // Benchmark metadata
  benchmark: {
    benchmark_id: string;
    circuit_id: string;
    created_at: string;
    configuration: {
      iterations: number;
      backends: string[];
      shot_count: number;
    };
  };

  // Performance results
  results: {
    execution_stats: {
      mean_time_ms: number;
      median_time_ms: number;
      p95_time_ms: number;
      p99_time_ms: number;
      std_deviation_ms: number;
    };
    throughput: {
      operations_per_second: number;
      total_operations: number;
    };
    resource_utilization: {
      cpu_percent: number;
      memory_mb: number;
      network_mbps: number;
    };
  };

  // Backend comparison
  backend_comparison?: Record<string, {
    mean_time_ms: number;
    success_rate: number;
  }>;

  // Historical trends
  trends?: {
    performance_improvement_percent: number;
    previous_benchmark_id?: string;
  };
}
```

---

## 2. DAG Resources

### URI: `dag://vertices/{vertex_id}`

**Purpose**: Access individual DAG vertex data.

**Query Parameters**:
- `include_payload`: `true` | `false` (default: `false`)
- `include_parents`: `true` | `false` (default: `false`)
- `include_children`: `true` | `false` (default: `false`)
- `include_consensus`: `true` | `false` (default: `true`)

**Resource Content**:
```typescript
interface DagVertexResource {
  // Vertex metadata
  vertex: {
    vertex_id: string;
    created_at: string;
    timestamp: number;
    vertex_type: "data" | "quantum" | "cryptographic" | "system";
  };

  // Payload (if included)
  payload?: {
    size_bytes: number;
    content_hash: string;
    content?: string;              // Base64-encoded
    content_type?: string;
  };

  // Graph structure
  structure: {
    parents?: string[];
    children?: string[];
    depth: number;
    branch_factor: number;
  };

  // Consensus information
  consensus: {
    status: "pending" | "accepted" | "finalized";
    confidence_score: number;
    voting_rounds: number;
    finality_depth?: number;
    finalized_at?: string;
  };

  // Network propagation
  propagation: {
    first_seen_at: string;
    propagation_time_ms: number;
    peer_count: number;
  };

  // Verification
  verification: {
    signature_valid: boolean;
    hash_valid: boolean;
    quantum_resistant: boolean;
  };
}
```

**Example URIs**:
```
dag://vertices/vtx_abc123
dag://vertices/vtx_abc123?include_payload=true
dag://vertices/vtx_abc123?include_parents=true&include_children=true
```

**Subscription Support**: Yes
- Event: `dag/vertex/changed`
- Triggers: Consensus status change, finalization

---

### URI: `dag://tips`

**Purpose**: Access current DAG tips (vertices without children).

**Query Parameters**:
- `limit`: Maximum tips to return (default: 10)
- `min_confidence`: Minimum confidence score (default: 0.0)
- `include_metadata`: `true` | `false` (default: `true`)

**Resource Content**:
```typescript
interface DagTipsResource {
  // Tips list
  tips: Array<{
    vertex_id: string;
    confidence_score: number;
    timestamp: number;
    parents: string[];
    depth: number;
    age_ms: number;
  }>;

  // Aggregate statistics
  statistics: {
    total_tips: number;
    average_confidence: number;
    tip_distribution: Record<number, number>;  // Depth -> count
    oldest_tip_age_ms: number;
  };

  // Health indicators
  health: {
    tip_count_healthy: boolean;
    confidence_healthy: boolean;
    age_healthy: boolean;
    warnings: string[];
  };

  // Update metadata
  metadata: {
    last_updated: string;
    update_frequency_ms: number;
    cache_ttl_seconds: number;
  };
}
```

**Example URIs**:
```
dag://tips
dag://tips?limit=20&min_confidence=0.8
```

**Subscription Support**: Yes
- Event: `dag/tips/changed`
- Triggers: New tip added, tip finalized

---

### URI: `dag://order`

**Purpose**: Access global total ordering of finalized vertices.

**Query Parameters**:
- `start`: Starting order index (default: 0)
- `limit`: Number of vertices (default: 100, max: 1000)
- `include_payload`: `true` | `false` (default: `false`)

**Resource Content**:
```typescript
interface DagOrderResource {
  // Ordered vertices
  vertices: Array<{
    order_index: number;
    vertex_id: string;
    timestamp: number;
    finalized_at: string;
    payload_size?: number;
    payload?: string;              // If include_payload=true
  }>;

  // Ordering metadata
  ordering: {
    algorithm: "topological" | "timestamp" | "consensus";
    total_finalized: number;
    consistency_level: "strong" | "eventual";
    last_finalized_index: number;
  };

  // Pagination
  pagination: {
    start: number;
    limit: number;
    total: number;
    has_more: boolean;
    next_cursor?: string;
  };
}
```

---

### URI: `dag://statistics`

**Purpose**: Access DAG aggregate statistics and health metrics.

**Resource Content**:
```typescript
interface DagStatisticsResource {
  // Vertex statistics
  vertices: {
    total: number;
    pending: number;
    accepted: number;
    finalized: number;
    by_type: Record<string, number>;
  };

  // Graph metrics
  graph: {
    depth: number;
    tip_count: number;
    average_branch_factor: number;
    density: number;
  };

  // Consensus metrics
  consensus: {
    average_confidence: number;
    average_finality_time_ms: number;
    participation_rate: number;
    voting_rounds_per_vertex: number;
  };

  // Performance metrics
  performance: {
    vertices_per_second: number;
    average_propagation_time_ms: number;
    storage_size_mb: number;
  };

  // Time series data (last 24 hours)
  time_series?: {
    timestamps: string[];
    vertex_counts: number[];
    finality_times: number[];
  };

  // Health assessment
  health: {
    overall_status: "healthy" | "degraded" | "unhealthy";
    issues: string[];
    recommendations: string[];
  };
}
```

---

## 3. Cryptographic Resources

### URI: `crypto://keys/{key_id}`

**Purpose**: Access public key information and metadata.

**Query Parameters**:
- `format`: `pem` | `der` | `jwk` (default: `pem`)
- `include_metadata`: `true` | `false` (default: `true`)

**Resource Content**:
```typescript
interface CryptoKeyResource {
  // Key metadata
  key: {
    key_id: string;
    algorithm: string;
    key_type: "public" | "private_metadata";  // Never expose private keys
    created_at: string;
    expires_at?: string;
    status: "active" | "expired" | "revoked";
  };

  // Public key data
  public_key: {
    format: string;
    data: string;                    // PEM, DER, or JWK format
    fingerprint: string;             // SHA3-256 hash
    size_bits: number;
  };

  // Quantum resistance
  quantum_resistance: {
    algorithm_family: "ml-kem" | "ml-dsa" | "hqc";
    security_level: 1 | 3 | 5;
    nist_approved: boolean;
    quantum_safe: true;
  };

  // Usage information
  usage: {
    purpose: string[];               // "signing", "encryption", etc.
    usage_count: number;
    last_used: string;
    associated_vault_entries?: number;
  };

  // DAG storage
  dag_info?: {
    vertex_id: string;
    registered_at: string;
  };
}
```

**Example URIs**:
```
crypto://keys/key_abc123
crypto://keys/key_abc123?format=jwk
```

---

### URI: `crypto://algorithms`

**Purpose**: Access information about supported cryptographic algorithms.

**Resource Content**:
```typescript
interface CryptoAlgorithmsResource {
  // Signing algorithms
  signing: Array<{
    name: string;
    family: string;
    security_level: number;
    signature_size_bytes: number;
    public_key_size_bytes: number;
    nist_approved: boolean;
    performance_tier: "fast" | "medium" | "slow";
  }>;

  // Encryption algorithms
  encryption: Array<{
    name: string;
    family: string;
    security_level: number;
    ciphertext_overhead_bytes: number;
    public_key_size_bytes: number;
    nist_approved: boolean;
    performance_tier: "fast" | "medium" | "slow";
  }>;

  // Hash algorithms
  hashing: Array<{
    name: string;
    output_size_bits: number;
    collision_resistant: boolean;
    quantum_safe: boolean;
  }>;

  // Recommendations
  recommendations: {
    general_purpose_signing: string;
    high_security_encryption: string;
    fast_hashing: string;
  };
}
```

---

### URI: `crypto://signatures/{signature_id}`

**Purpose**: Access signature verification information.

**Resource Content**:
```typescript
interface CryptoSignatureResource {
  // Signature metadata
  signature: {
    signature_id: string;
    algorithm: string;
    created_at: string;
    signer_key_id: string;
  };

  // Signature data
  data: {
    signature: string;               // Base64-encoded
    signed_data_hash: string;
    timestamp: string;
  };

  // Verification
  verification: {
    public_key: string;
    verification_status: "valid" | "invalid" | "unknown";
    verified_at?: string;
  };

  // DAG integration
  dag_info?: {
    vertex_id: string;
    attached_to?: string;
  };
}
```

---

## 4. Network Resources

### URI: `network://peers/{peer_id}`

**Purpose**: Access peer information and connection status.

**Resource Content**:
```typescript
interface NetworkPeerResource {
  // Peer identity
  peer: {
    peer_id: string;
    multiaddr: string[];
    public_key: string;
    reputation: number;
  };

  // Connection status
  connection: {
    status: "connected" | "disconnected" | "connecting";
    since: string;
    quantum_channel: boolean;
    encrypted: boolean;
  };

  // Capabilities
  capabilities: {
    protocols: string[];
    features: string[];
    version: string;
  };

  // Performance metrics
  performance: {
    latency_ms: number;
    bandwidth_mbps: number;
    success_rate: number;
    error_rate: number;
  };

  // Activity
  activity: {
    messages_sent: number;
    messages_received: number;
    last_message: string;
  };
}
```

---

### URI: `network://topology`

**Purpose**: Access network topology and peer graph.

**Query Parameters**:
- `depth`: Topology depth to explore (default: 2, max: 5)
- `include_disconnected`: `true` | `false` (default: `false`)

**Resource Content**:
```typescript
interface NetworkTopologyResource {
  // Local node
  local_node: {
    peer_id: string;
    multiaddr: string[];
    connected_peers: number;
  };

  // Peer graph
  peers: Array<{
    peer_id: string;
    distance: number;               // Hop count from local node
    connected_to: string[];
    reputation: number;
  }>;

  // Network metrics
  metrics: {
    total_peers: number;
    average_degree: number;
    diameter: number;
    clustering_coefficient: number;
  };

  // Visualization data
  visualization?: {
    nodes: Array<{
      id: string;
      label: string;
      size: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      weight: number;
    }>;
  };
}
```

---

### URI: `network://dark-addresses/{address}`

**Purpose**: Access dark address resolution information.

**Resource Content**:
```typescript
interface NetworkDarkAddressResource {
  // Address information
  address: {
    dark_address: string;
    registered_at: string;
    owner_public_key: string;
    ttl_seconds: number;
  };

  // Resolution
  resolution: {
    resolved_endpoints: Array<{
      type: string;
      address: string;
      priority: number;
    }>;
    quantum_fingerprint: string;
    signature_valid: boolean;
  };

  // Statistics
  statistics: {
    resolution_count: number;
    last_resolved: string;
    average_resolution_time_ms: number;
  };

  // DAG registration
  dag_info: {
    vertex_id: string;
    consensus_status: string;
  };
}
```

---

## 5. Vault Resources

### URI: `vault://entries/{entry_id}`

**Purpose**: Access vault entry metadata (not secret content).

**Resource Content**:
```typescript
interface VaultEntryResource {
  // Entry metadata
  entry: {
    entry_id: string;
    label: string;
    category?: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
  };

  // Encryption information
  encryption: {
    algorithm: string;
    key_id: string;
    quantum_resistant: boolean;
    encrypted_size_bytes: number;
  };

  // Access control
  access: {
    owner_key_id: string;
    allowed_peers?: string[];
    access_count: number;
    last_accessed?: string;
  };

  // Expiration
  expiration?: {
    expires_at: string;
    auto_delete: boolean;
  };

  // DAG storage
  dag_info?: {
    metadata_vertex_id: string;
    consensus_status: string;
  };
}
```

**Note**: Secret content is retrieved via `vault_quantum_retrieve` tool, not resources.

---

### URI: `vault://statistics`

**Purpose**: Access vault aggregate statistics.

**Resource Content**:
```typescript
interface VaultStatisticsResource {
  // Storage statistics
  storage: {
    total_entries: number;
    total_size_bytes: number;
    average_entry_size_bytes: number;
    by_category: Record<string, {
      count: number;
      size_bytes: number;
    }>;
  };

  // Access statistics
  access: {
    total_accesses: number;
    accesses_last_24h: number;
    most_accessed_entries: Array<{
      entry_id: string;
      label: string;
      access_count: number;
    }>;
  };

  // Security statistics
  security: {
    encryption_algorithms: Record<string, number>;
    quantum_resistant_entries: number;
    expired_entries: number;
    expiring_soon: number;           // Within 7 days
  };

  // Health
  health: {
    status: "healthy" | "degraded" | "unhealthy";
    issues: string[];
  };
}
```

---

## 6. System Resources

### URI: `system://status`

**Purpose**: Access overall system status and health.

**Resource Content**:
```typescript
interface SystemStatusResource {
  // System information
  system: {
    version: string;
    protocol_version: string;
    node_id: string;
    started_at: string;
    uptime_seconds: number;
  };

  // Component status
  components: {
    dag: "healthy" | "degraded" | "unhealthy";
    crypto: "healthy" | "degraded" | "unhealthy";
    network: "healthy" | "degraded" | "unhealthy";
    vault: "healthy" | "degraded" | "unhealthy";
    consensus: "healthy" | "degraded" | "unhealthy";
  };

  // Resource utilization
  resources: {
    cpu_percent: number;
    memory_mb: number;
    memory_percent: number;
    disk_mb: number;
    disk_percent: number;
  };

  // Performance metrics
  performance: {
    operations_per_second: number;
    average_latency_ms: number;
    p95_latency_ms: number;
  };

  // Overall health
  health: {
    status: "healthy" | "degraded" | "unhealthy";
    score: number;                   // 0-100
    issues: string[];
    warnings: string[];
  };
}
```

**Subscription Support**: Yes
- Event: `system/status/changed`
- Triggers: Health status change, critical issues

---

### URI: `system://logs`

**Purpose**: Access system logs and events.

**Query Parameters**:
- `level`: `debug` | `info` | `warn` | `error` (default: `info`)
- `component`: Component filter (optional)
- `limit`: Max entries (default: 100, max: 1000)
- `since`: ISO 8601 timestamp
- `until`: ISO 8601 timestamp

**Resource Content**:
```typescript
interface SystemLogsResource {
  // Log entries
  logs: Array<{
    timestamp: string;
    level: string;
    component: string;
    message: string;
    context?: Record<string, any>;
    trace_id?: string;
  }>;

  // Pagination
  pagination: {
    total: number;
    returned: number;
    has_more: boolean;
    next_cursor?: string;
  };

  // Filtering applied
  filters: {
    level?: string;
    component?: string;
    time_range: {
      start: string;
      end: string;
    };
  };
}
```

---

### URI: `system://metrics`

**Purpose**: Access detailed system metrics for monitoring.

**Query Parameters**:
- `metric`: Specific metric name (optional)
- `window`: Time window (`1m`, `5m`, `1h`, `24h`)
- `resolution`: Data point resolution

**Resource Content**:
```typescript
interface SystemMetricsResource {
  // Time series metrics
  metrics: {
    [metric_name: string]: {
      name: string;
      unit: string;
      values: Array<{
        timestamp: string;
        value: number;
      }>;
      aggregations?: {
        min: number;
        max: number;
        avg: number;
        p50: number;
        p95: number;
        p99: number;
      };
    };
  };

  // Metadata
  metadata: {
    time_range: {
      start: string;
      end: string;
    };
    resolution_ms: number;
    data_points: number;
  };
}
```

---

## Resource Subscription Protocol

### Subscription Request
```json
{
  "jsonrpc": "2.0",
  "id": "sub_1",
  "method": "resources/subscribe",
  "params": {
    "uri": "dag://tips",
    "changeTypes": ["added", "removed", "updated"]
  }
}
```

### Subscription Response
```json
{
  "jsonrpc": "2.0",
  "id": "sub_1",
  "result": {
    "subscription_id": "sub_abc123",
    "uri": "dag://tips",
    "expires_at": "2025-11-10T12:00:00Z"
  }
}
```

### Change Notification
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "subscription_id": "sub_abc123",
    "uri": "dag://tips",
    "changeType": "added",
    "resource": {
      "vertex_id": "vtx_new123",
      "confidence_score": 0.95
    }
  }
}
```

### Unsubscribe Request
```json
{
  "jsonrpc": "2.0",
  "id": "unsub_1",
  "method": "resources/unsubscribe",
  "params": {
    "subscription_id": "sub_abc123"
  }
}
```

---

## Caching and Performance

### Cache Control Headers
Resources include cache control metadata:

```typescript
interface CacheControl {
  ttl_seconds: number;               // Time to live
  etag: string;                      // Entity tag for validation
  last_modified: string;             // ISO 8601 timestamp
  immutable: boolean;                // True if resource never changes
}
```

### Cache Validation
Clients can validate cached resources:

```json
{
  "jsonrpc": "2.0",
  "id": "validate_1",
  "method": "resources/read",
  "params": {
    "uri": "dag://vertices/vtx_123",
    "if_none_match": "etag_xyz789"
  }
}
```

Response if unchanged:
```json
{
  "jsonrpc": "2.0",
  "id": "validate_1",
  "result": {
    "status": "not_modified",
    "etag": "etag_xyz789"
  }
}
```

---

## Transport-Specific Considerations

### STDIO Transport
- **Resource Access**: Synchronous read via `resources/read` method
- **Subscriptions**: Via periodic polling or notification messages
- **Caching**: Client-side caching recommended
- **Performance**: Low latency for local resources

### Streamable HTTP Transport
- **Resource Access**: HTTP GET with resource URI
- **Subscriptions**: Server-Sent Events stream
- **Caching**: HTTP cache headers (ETag, Last-Modified)
- **Performance**: CDN-friendly with standard HTTP caching

---

## Error Handling

### Resource Not Found
```json
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "error": {
    "code": -32002,
    "message": "Resource not found",
    "data": {
      "uri": "dag://vertices/vtx_invalid",
      "suggestion": "Verify vertex ID is correct"
    }
  }
}
```

### Access Denied
```json
{
  "jsonrpc": "2.0",
  "id": "req_456",
  "error": {
    "code": -32003,
    "message": "Access denied",
    "data": {
      "uri": "vault://entries/entry_123",
      "reason": "Insufficient permissions",
      "required_permission": "vault:read"
    }
  }
}
```

---

## Implementation Checklist

### Phase 1: Core Resources
- [ ] quantum://states/{execution_id}
- [ ] quantum://circuits/{circuit_id}
- [ ] dag://vertices/{vertex_id}
- [ ] dag://tips
- [ ] dag://statistics

### Phase 2: Security Resources
- [ ] crypto://keys/{key_id}
- [ ] crypto://algorithms
- [ ] vault://entries/{entry_id}
- [ ] vault://statistics

### Phase 3: Network Resources
- [ ] network://peers/{peer_id}
- [ ] network://topology
- [ ] network://dark-addresses/{address}

### Phase 4: System Resources
- [ ] system://status
- [ ] system://logs
- [ ] system://metrics

### Phase 5: Advanced Features
- [ ] Resource subscriptions
- [ ] Cache validation
- [ ] Streaming large resources
- [ ] Delta updates

---

**Document Status**: Draft
**Last Updated**: 2025-11-10
**Next Review**: Before implementation phase 1
