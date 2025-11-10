# QuDAG MCP Tools Design

## Executive Summary

This document defines the MCP tool interface design for QuDAG's quantum-resistant distributed operations. The tools expose QuDAG's core capabilities through standardized MCP interfaces optimized for both STDIO (local) and Streamable HTTP (web) transports.

**Design Date**: 2025-11-10
**MCP Protocol Version**: 2025-03-26
**Target Packages**: @qudag/mcp-stdio, @qudag/mcp-sse

---

## Design Principles

### 1. Quantum-First Security
- All operations utilize post-quantum cryptographic primitives (ML-KEM, ML-DSA, HQC)
- Cryptographic proofs for all state-changing operations
- Zero-knowledge proofs for privacy-sensitive queries
- Automatic key rotation with forward secrecy

### 2. Transport-Agnostic Design
- Tools work identically across STDIO and Streamable HTTP
- Async operations with progress tracking
- Streaming support for large datasets
- Graceful degradation for limited transports

### 3. Performance Optimization
- Lazy evaluation for expensive operations
- Batch operation support
- Resource pooling and connection reuse
- Intelligent caching with cache invalidation

### 4. Developer Experience
- Clear, consistent naming conventions
- Comprehensive JSON Schema validation
- Detailed error messages with recovery hints
- Rich metadata for debugging and monitoring

---

## Tool Categories

## 1. Quantum DAG Operations

### Tool: `execute_quantum_dag`

**Purpose**: Execute quantum circuit operations on the QuDAG topology with consensus validation.

**Input Schema**:
```typescript
interface ExecuteQuantumDagInput {
  // Circuit definition
  circuit: {
    qubits: number;                    // Number of qubits (1-32)
    gates: Array<{
      type: "H" | "X" | "Y" | "Z" | "CNOT" | "T" | "S" | "RX" | "RY" | "RZ";
      target: number | number[];       // Target qubit(s)
      params?: number[];               // Rotation angles for parameterized gates
      control?: number;                // Control qubit for controlled gates
    }>;
    measurements?: number[];           // Qubits to measure
  };

  // Execution options
  execution: {
    backend?: "simulator" | "classical-dag";  // Default: simulator
    shots?: number;                    // Number of measurements (1-10000)
    optimization_level?: 0 | 1 | 2 | 3;      // Circuit optimization
    noise_model?: {
      enabled: boolean;
      error_rate?: number;
    };
  };

  // DAG consensus options
  consensus?: {
    require_finality?: boolean;       // Wait for DAG finalization
    timeout_ms?: number;              // Max wait time (default: 30000)
    min_confirmations?: number;       // Min DAG confirmations
  };

  // Metadata
  metadata?: {
    label?: string;
    description?: string;
    tags?: string[];
  };
}
```

**Output Schema**:
```typescript
interface ExecuteQuantumDagOutput {
  // Execution results
  execution_id: string;
  status: "pending" | "running" | "completed" | "failed";

  // Quantum results (when completed)
  results?: {
    measurements: Record<string, number>;  // Bitstring -> count
    statevector?: number[][];              // For small circuits
    probabilities: Record<string, number>; // Bitstring -> probability
    execution_time_ms: number;
  };

  // DAG integration
  dag_info: {
    vertex_id: string;
    consensus_status: "pending" | "accepted" | "finalized";
    confidence_score: number;
    dag_height: number;
  };

  // Performance metrics
  metrics: {
    gate_count: number;
    depth: number;
    optimization_applied: boolean;
    backend_utilization: number;
  };
}
```

**Error Codes**:
- `QUANTUM_INVALID_CIRCUIT`: Invalid circuit definition
- `QUANTUM_RESOURCE_LIMIT`: Circuit too large for available resources
- `QUANTUM_TIMEOUT`: Execution timeout
- `DAG_CONSENSUS_FAILED`: DAG consensus could not be reached

---

### Tool: `optimize_circuit`

**Purpose**: Optimize quantum circuit topology for QuDAG execution.

**Input Schema**:
```typescript
interface OptimizeCircuitInput {
  // Circuit to optimize
  circuit: {
    qubits: number;
    gates: Array<{
      type: string;
      target: number | number[];
      params?: number[];
      control?: number;
    }>;
  };

  // Optimization options
  optimization: {
    level: 0 | 1 | 2 | 3;              // Optimization aggressiveness
    preserve_semantics: boolean;        // Guarantee equivalent output
    target_metric?: "depth" | "gates" | "fidelity" | "dag-locality";
    max_iterations?: number;
  };

  // DAG-specific optimizations
  dag_optimization?: {
    minimize_dag_depth?: boolean;      // Reduce DAG vertex count
    maximize_parallelism?: boolean;    // Enable parallel execution
    locality_aware?: boolean;          // Consider network topology
  };
}
```

**Output Schema**:
```typescript
interface OptimizeCircuitOutput {
  // Optimized circuit
  optimized_circuit: {
    qubits: number;
    gates: Array<{
      type: string;
      target: number | number[];
      params?: number[];
      control?: number;
    }>;
  };

  // Optimization results
  optimization_results: {
    original_metrics: {
      gate_count: number;
      depth: number;
      dag_vertices: number;
    };
    optimized_metrics: {
      gate_count: number;
      depth: number;
      dag_vertices: number;
    };
    improvement: {
      gates_reduced: number;
      depth_reduced: number;
      dag_vertices_reduced: number;
      estimated_speedup: number;
    };
  };

  // Optimization strategy applied
  strategy: {
    techniques_applied: string[];
    optimization_time_ms: number;
    iterations: number;
  };
}
```

---

### Tool: `analyze_complexity`

**Purpose**: Analyze quantum circuit complexity and resource requirements.

**Input Schema**:
```typescript
interface AnalyzeComplexityInput {
  // Circuit to analyze
  circuit: {
    qubits: number;
    gates: Array<{
      type: string;
      target: number | number[];
      params?: number[];
      control?: number;
    }>;
  };

  // Analysis options
  analysis: {
    include_quantum_metrics?: boolean;
    include_classical_metrics?: boolean;
    include_dag_metrics?: boolean;
    include_resource_estimates?: boolean;
  };
}
```

**Output Schema**:
```typescript
interface AnalyzeComplexityOutput {
  // Quantum complexity
  quantum_metrics?: {
    gate_count: number;
    depth: number;
    qubit_count: number;
    two_qubit_gates: number;
    entanglement_entropy: number;
    circuit_expressibility: number;
  };

  // Classical complexity
  classical_metrics?: {
    simulation_complexity: string;     // e.g., "O(2^n)"
    memory_requirement_bytes: number;
    estimated_simulation_time_ms: number;
  };

  // DAG complexity
  dag_metrics?: {
    expected_vertex_count: number;
    expected_dag_depth: number;
    parallelization_factor: number;
    consensus_overhead: number;
  };

  // Resource estimates
  resource_estimates?: {
    cpu_time_estimate_ms: number;
    memory_estimate_mb: number;
    network_bandwidth_estimate_kb: number;
    dag_storage_estimate_bytes: number;
  };

  // Recommendations
  recommendations: string[];
}
```

---

### Tool: `benchmark_performance`

**Purpose**: Benchmark quantum circuit execution performance on QuDAG.

**Input Schema**:
```typescript
interface BenchmarkPerformanceInput {
  // Circuit to benchmark
  circuit: {
    qubits: number;
    gates: Array<{
      type: string;
      target: number | number[];
      params?: number[];
      control?: number;
    }>;
  };

  // Benchmark configuration
  benchmark: {
    iterations?: number;               // Default: 100
    warmup_iterations?: number;        // Default: 10
    parallel_executions?: number;      // Default: 1
    backends?: Array<"simulator" | "classical-dag">;
  };

  // Performance metrics to collect
  metrics?: {
    execution_time?: boolean;
    throughput?: boolean;
    latency_distribution?: boolean;
    resource_utilization?: boolean;
    dag_consensus_time?: boolean;
  };
}
```

**Output Schema**:
```typescript
interface BenchmarkPerformanceOutput {
  // Execution statistics
  execution_stats: {
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    total_time_ms: number;
  };

  // Performance metrics
  performance: {
    mean_execution_time_ms: number;
    median_execution_time_ms: number;
    p95_execution_time_ms: number;
    p99_execution_time_ms: number;
    throughput_ops_per_sec: number;
  };

  // Resource utilization
  resources?: {
    cpu_utilization_percent: number;
    memory_usage_mb: number;
    network_bandwidth_mbps: number;
  };

  // DAG metrics
  dag_performance?: {
    consensus_time_ms: number;
    propagation_time_ms: number;
    finalization_time_ms: number;
  };

  // Backend comparison (if multiple backends)
  backend_comparison?: Record<string, {
    execution_time_ms: number;
    throughput_ops_per_sec: number;
  }>;
}
```

---

## 2. Quantum Cryptographic Operations

### Tool: `quantum_key_exchange`

**Purpose**: Perform quantum-resistant key exchange using ML-KEM.

**Input Schema**:
```typescript
interface QuantumKeyExchangeInput {
  // Key exchange parameters
  algorithm: "ml-kem-512" | "ml-kem-768" | "ml-kem-1024";
  role: "initiator" | "responder";

  // For responder: encapsulated key from initiator
  encapsulated_key?: string;         // Base64-encoded

  // Options
  options?: {
    derive_shared_secret?: boolean;
    store_in_vault?: boolean;
    vault_label?: string;
  };

  // DAG storage
  dag_storage?: {
    store_public_key?: boolean;
    require_consensus?: boolean;
  };
}
```

**Output Schema**:
```typescript
interface QuantumKeyExchangeOutput {
  // For initiator: public key and encapsulated shared secret
  public_key?: string;               // Base64-encoded
  encapsulated_key?: string;         // Base64-encoded

  // For both: derived shared secret
  shared_secret: string;             // Base64-encoded

  // Key metadata
  metadata: {
    algorithm: string;
    security_level: 1 | 3 | 5;
    key_id: string;
    timestamp: string;
  };

  // DAG information (if stored)
  dag_info?: {
    vertex_id: string;
    consensus_status: string;
  };

  // Vault information (if stored)
  vault_info?: {
    vault_id: string;
    entry_label: string;
  };
}
```

---

### Tool: `quantum_sign`

**Purpose**: Create quantum-resistant digital signatures using ML-DSA.

**Input Schema**:
```typescript
interface QuantumSignInput {
  // Data to sign
  data: string;                      // Base64-encoded

  // Signing parameters
  algorithm: "ml-dsa-44" | "ml-dsa-65" | "ml-dsa-87";
  private_key: string;               // Base64-encoded or vault reference

  // Options
  options?: {
    include_timestamp?: boolean;
    include_context?: boolean;
    context?: string;
  };

  // DAG storage
  dag_storage?: {
    store_signature?: boolean;
    attach_to_vertex?: string;
  };
}
```

**Output Schema**:
```typescript
interface QuantumSignOutput {
  // Signature
  signature: string;                 // Base64-encoded

  // Signature metadata
  metadata: {
    algorithm: string;
    key_id: string;
    timestamp: string;
    data_hash: string;                // SHA3-256 hash
    signature_size_bytes: number;
  };

  // Verification info
  verification: {
    public_key: string;               // Base64-encoded
    verification_instructions: string;
  };

  // DAG information (if stored)
  dag_info?: {
    vertex_id: string;
    consensus_status: string;
  };
}
```

---

## 3. Network and P2P Operations

### Tool: `dark_address_resolve`

**Purpose**: Resolve .dark domain addresses to network endpoints.

**Input Schema**:
```typescript
interface DarkAddressResolveInput {
  // Address to resolve
  address: string;                   // e.g., "vault.dark", "node-123.dark"

  // Resolution options
  options?: {
    include_quantum_fingerprint?: boolean;
    verify_signature?: boolean;
    cache_result?: boolean;
    timeout_ms?: number;
  };

  // Network options
  network?: {
    prefer_onion_routing?: boolean;
    require_quantum_secure?: boolean;
  };
}
```

**Output Schema**:
```typescript
interface DarkAddressResolveOutput {
  // Resolved address
  resolved: {
    address: string;
    endpoints: Array<{
      type: "multiaddr" | "onion" | "quantum";
      address: string;
      priority: number;
    }>;
  };

  // Quantum fingerprint
  quantum_fingerprint?: {
    fingerprint: string;
    algorithm: string;
    verification_status: "valid" | "invalid" | "unknown";
  };

  // Signature verification
  signature_verification?: {
    valid: boolean;
    signer_public_key: string;
    timestamp: string;
  };

  // Resolution metadata
  metadata: {
    resolution_time_ms: number;
    cache_hit: boolean;
    ttl_seconds: number;
    hops_traversed: number;
  };
}
```

---

### Tool: `peer_discovery`

**Purpose**: Discover and connect to QuDAG network peers.

**Input Schema**:
```typescript
interface PeerDiscoveryInput {
  // Discovery parameters
  discovery: {
    max_peers?: number;              // Default: 10
    min_reputation?: number;         // Default: 0.5
    require_capabilities?: string[];
    exclude_peers?: string[];
  };

  // Network constraints
  network?: {
    prefer_nearby?: boolean;
    max_latency_ms?: number;
    require_quantum_channel?: boolean;
  };

  // Connection options
  connection?: {
    auto_connect?: boolean;
    verify_identity?: boolean;
    establish_quantum_channel?: boolean;
  };
}
```

**Output Schema**:
```typescript
interface PeerDiscoveryOutput {
  // Discovered peers
  peers: Array<{
    peer_id: string;
    multiaddr: string[];
    reputation: number;
    capabilities: string[];
    latency_ms: number;
    last_seen: string;
  }>;

  // Discovery statistics
  discovery_stats: {
    total_discovered: number;
    qualified_peers: number;
    discovery_time_ms: number;
    discovery_method: string[];
  };

  // Connection status (if auto_connect enabled)
  connections?: Array<{
    peer_id: string;
    status: "connected" | "failed" | "pending";
    quantum_channel: boolean;
  }>;
}
```

---

## 4. Vault and Secret Management

### Tool: `vault_quantum_store`

**Purpose**: Store secrets in vault with quantum-resistant encryption.

**Input Schema**:
```typescript
interface VaultQuantumStoreInput {
  // Secret data
  secret: {
    label: string;
    data: string;                    // Base64-encoded
    category?: string;
    tags?: string[];
  };

  // Encryption parameters
  encryption: {
    algorithm: "ml-kem-768" | "ml-kem-1024" | "hqc-128" | "hqc-192";
    derive_key?: boolean;
    key_rotation_enabled?: boolean;
  };

  // Access control
  access_control?: {
    allowed_peers?: string[];
    require_signature?: boolean;
    expiry_time?: string;            // ISO 8601
  };

  // DAG storage
  dag_storage?: {
    store_metadata_in_dag?: boolean;
    require_consensus?: boolean;
  };
}
```

**Output Schema**:
```typescript
interface VaultQuantumStoreOutput {
  // Storage result
  vault_entry: {
    entry_id: string;
    label: string;
    created_at: string;
    size_bytes: number;
  };

  // Encryption metadata
  encryption: {
    algorithm: string;
    key_id: string;
    quantum_resistant: true;
    encryption_time_ms: number;
  };

  // DAG information
  dag_info?: {
    vertex_id: string;
    consensus_status: string;
    metadata_hash: string;
  };

  // Access information
  access: {
    retrieval_token: string;
    access_url?: string;
  };
}
```

---

### Tool: `vault_quantum_retrieve`

**Purpose**: Retrieve secrets from vault with quantum-resistant decryption.

**Input Schema**:
```typescript
interface VaultQuantumRetrieveInput {
  // Entry identification
  entry: {
    entry_id?: string;
    label?: string;
    retrieval_token?: string;
  };

  // Authentication
  authentication: {
    private_key?: string;            // For signature verification
    access_token?: string;
  };

  // Decryption options
  decryption?: {
    verify_integrity?: boolean;
    check_expiry?: boolean;
  };
}
```

**Output Schema**:
```typescript
interface VaultQuantumRetrieveOutput {
  // Retrieved secret
  secret: {
    label: string;
    data: string;                    // Base64-encoded, decrypted
    category?: string;
    tags?: string[];
  };

  // Entry metadata
  metadata: {
    entry_id: string;
    created_at: string;
    last_accessed: string;
    access_count: number;
    expires_at?: string;
  };

  // Verification
  verification: {
    integrity_valid: boolean;
    signature_valid: boolean;
    not_expired: boolean;
  };

  // Decryption info
  decryption: {
    algorithm: string;
    decryption_time_ms: number;
  };
}
```

---

## 5. System Monitoring and Diagnostics

### Tool: `system_health_check`

**Purpose**: Perform comprehensive health check of QuDAG system.

**Input Schema**:
```typescript
interface SystemHealthCheckInput {
  // Components to check
  components?: {
    dag?: boolean;
    crypto?: boolean;
    network?: boolean;
    vault?: boolean;
    consensus?: boolean;
  };

  // Check depth
  depth?: "basic" | "detailed" | "comprehensive";

  // Performance tests
  performance_tests?: {
    enabled?: boolean;
    quick_tests_only?: boolean;
  };
}
```

**Output Schema**:
```typescript
interface SystemHealthCheckOutput {
  // Overall status
  overall_status: "healthy" | "degraded" | "unhealthy";
  health_score: number;              // 0-100

  // Component health
  components: {
    dag?: {
      status: "healthy" | "degraded" | "unhealthy";
      vertex_count: number;
      tip_count: number;
      consensus_status: string;
      issues: string[];
    };
    crypto?: {
      status: "healthy" | "degraded" | "unhealthy";
      algorithms_available: string[];
      key_count: number;
      issues: string[];
    };
    network?: {
      status: "healthy" | "degraded" | "unhealthy";
      peer_count: number;
      connection_quality: number;
      latency_ms: number;
      issues: string[];
    };
    vault?: {
      status: "healthy" | "degraded" | "unhealthy";
      entry_count: number;
      storage_used_mb: number;
      issues: string[];
    };
    consensus?: {
      status: "healthy" | "degraded" | "unhealthy";
      participation_rate: number;
      finality_lag: number;
      issues: string[];
    };
  };

  // Performance metrics
  performance?: {
    cpu_usage: number;
    memory_usage_mb: number;
    network_throughput_mbps: number;
    operations_per_second: number;
  };

  // Recommendations
  recommendations: Array<{
    priority: "low" | "medium" | "high" | "critical";
    component: string;
    issue: string;
    recommendation: string;
  }>;
}
```

---

## Tool Execution Patterns

### Synchronous Execution
For fast operations (&lt;1 second), tools return immediately with results:

```json
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "method": "tools/call",
  "params": {
    "name": "analyze_complexity",
    "arguments": { "circuit": {...} }
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"quantum_metrics\": {...}}"
    }]
  }
}
```

### Asynchronous Execution with Progress
For long operations, tools return immediately with execution ID and send progress notifications:

```json
// Initial response
{
  "jsonrpc": "2.0",
  "id": "req_456",
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"execution_id\": \"exec_789\", \"status\": \"pending\"}"
    }]
  }
}

// Progress notification (STDIO/Streamable HTTP)
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/progress",
  "params": {
    "execution_id": "exec_789",
    "progress": 0.35,
    "message": "Optimizing circuit topology..."
  }
}

// Completion notification
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/completed",
  "params": {
    "execution_id": "exec_789",
    "result": {...}
  }
}
```

### Streaming Results
For large datasets, tools can stream results in chunks:

```json
// STDIO: Multiple JSON objects on separate lines
{"chunk": 0, "data": [...], "more": true}
{"chunk": 1, "data": [...], "more": true}
{"chunk": 2, "data": [...], "more": false}

// Streamable HTTP: Server-Sent Events
data: {"chunk": 0, "data": [...], "more": true}

data: {"chunk": 1, "data": [...], "more": true}

data: {"chunk": 2, "data": [...], "more": false}
```

---

## Error Handling

### Standard Error Format
All tools use consistent error formatting:

```typescript
interface ToolError {
  code: number;                      // JSON-RPC error code
  message: string;                   // Human-readable message
  data?: {
    type: string;                    // Error category
    component: string;               // Failing component
    details: string;                 // Technical details
    recovery_hints?: string[];       // Suggested fixes
    request_id?: string;             // For support
  };
}
```

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

### Example Error Response
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
        "Use circuit optimization to reduce qubit requirements",
        "Contact support to increase resource allocation"
      ],
      "request_id": "req_123"
    }
  }
}
```

---

## Transport-Specific Considerations

### STDIO Transport
- **Connection**: Process spawned as subprocess
- **Authentication**: Inherited from parent process
- **Session**: Single session per process
- **Performance**: Low latency, high throughput
- **Use Cases**: Claude Desktop, local tools, CLI
- **Limitations**: No multi-user support

### Streamable HTTP Transport
- **Connection**: HTTP POST + optional SSE stream
- **Authentication**: HTTP headers (Bearer token, OAuth)
- **Session**: Stateless with session tokens
- **Performance**: Higher latency, web-scale throughput
- **Use Cases**: Web apps, cloud deployments, multi-user
- **Limitations**: Network overhead, requires HTTPS

---

## Implementation Roadmap

### Phase 1: Core Tools (Weeks 1-2)
- [ ] execute_quantum_dag
- [ ] optimize_circuit
- [ ] quantum_key_exchange
- [ ] dark_address_resolve
- [ ] vault_quantum_store
- [ ] vault_quantum_retrieve

### Phase 2: Analysis & Monitoring (Weeks 3-4)
- [ ] analyze_complexity
- [ ] benchmark_performance
- [ ] system_health_check

### Phase 3: Advanced Network (Weeks 5-6)
- [ ] peer_discovery
- [ ] quantum_sign
- [ ] Advanced DAG operations

### Phase 4: Optimization & Polish (Weeks 7-8)
- [ ] Performance tuning
- [ ] Error handling improvements
- [ ] Documentation and examples
- [ ] Integration tests

---

## Testing Strategy

### Unit Tests
- Input validation for all tools
- Error handling for edge cases
- Mock quantum operations
- Security validation

### Integration Tests
- STDIO transport end-to-end
- Streamable HTTP transport end-to-end
- Multi-tool workflows
- Concurrent execution

### Performance Tests
- Tool execution latency
- Memory usage under load
- Network bandwidth utilization
- DAG consensus overhead

### Security Tests
- Authentication validation
- Authorization enforcement
- Quantum resistance validation
- Timing attack resistance

---

## Appendix A: JSON Schema Examples

See individual tool definitions for complete JSON Schema specifications. All schemas follow JSON Schema Draft 2020-12.

## Appendix B: Performance Benchmarks

Target performance metrics:
- Tool execution latency: &lt;100ms (p95)
- Async operation overhead: &lt;10ms
- Streaming throughput: &gt;10MB/s
- Concurrent tool calls: &gt;100/sec per server

## Appendix C: Security Considerations

- All cryptographic operations use quantum-resistant algorithms
- Private keys never transmitted over network
- Vault secrets encrypted at rest and in transit
- Audit logging for all security-sensitive operations
- Rate limiting and DOS protection

---

**Document Status**: Draft
**Last Updated**: 2025-11-10
**Next Review**: Before implementation phase 1
