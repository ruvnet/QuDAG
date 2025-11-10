# AgenticDB Integration for QuDAG

## Overview

AgenticDB is a database system designed to store and manage GenAI agent manifests and execution history. This document outlines the schema design and integration points for storing QuDAG quantum execution history, agent operations, and agentic workflow metadata.

## Strategic Vision

AgenticDB serves as the **persistent execution layer** for QuDAG's agentic swarms. It captures:
- Quantum cryptographic operations and signatures
- Agent execution traces and task results
- DAG consensus decisions and merkle proofs
- Exchange transactions and fee calculations
- Swarm coordination metrics and agent health states

## Schema Design for Quantum Execution History

### 1. Core Agent Manifest Schema

```sql
-- Agent manifest and registration
CREATE TABLE agents (
    agent_id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    agent_type TEXT NOT NULL, -- 'quantum_provider', 'consensus_validator', 'exchange_agent', etc.
    mcp_endpoint TEXT,
    mlkem_public_key BLOB NOT NULL,  -- ML-KEM-768 public key
    mldsa_public_key BLOB NOT NULL,  -- ML-DSA verification key
    capabilities TEXT NOT NULL, -- JSON array of capabilities
    docker_image TEXT,
    registry_uri TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    status TEXT, -- 'active', 'inactive', 'suspended'
    version TEXT,
    metadata_json TEXT -- JSON metadata
);

-- Agent ratings and performance
CREATE TABLE agent_ratings (
    rating_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    rating_score REAL NOT NULL, -- 0.0 to 1.0
    review_count INT,
    performance_score REAL,
    reliability_score REAL,
    rated_at TIMESTAMP NOT NULL,
    rater_agent_id TEXT REFERENCES agents(agent_id),
    UNIQUE(agent_id, rated_at)
);
```

### 2. Quantum Execution History Schema

```sql
-- Cryptographic operations
CREATE TABLE crypto_operations (
    operation_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    operation_type TEXT NOT NULL,
    -- 'ml_kem_keygen', 'ml_kem_encapsulate', 'ml_kem_decapsulate',
    -- 'ml_dsa_sign', 'ml_dsa_verify', 'blake3_hash', 'hqc_encrypt', 'hqc_decrypt'
    input_data BLOB,
    output_data BLOB,
    signature BLOB, -- ML-DSA signature of operation
    public_key_fingerprint TEXT,
    execution_time_ms INT,
    status TEXT, -- 'success', 'failure', 'timeout'
    error_message TEXT,
    created_at TIMESTAMP NOT NULL,
    security_level TEXT -- 'NIST-Level-3', 'NIST-Level-5', etc.
);

-- Quantum fingerprints created and verified
CREATE TABLE quantum_fingerprints (
    fingerprint_id TEXT PRIMARY KEY,
    data_hash BLOB NOT NULL,
    fingerprint_value BLOB NOT NULL,
    operation_id TEXT REFERENCES crypto_operations(operation_id),
    verified BOOLEAN DEFAULT FALSE,
    verification_count INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    data_type TEXT -- 'transaction', 'message', 'state_snapshot', etc.
);
```

### 3. DAG Consensus and Block Schema

```sql
-- DAG vertices (messages)
CREATE TABLE dag_vertices (
    vertex_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    vertex_hash BLOB NOT NULL UNIQUE,
    parents TEXT NOT NULL, -- JSON array of parent vertex IDs
    payload BLOB,
    timestamp_ms INT NOT NULL,
    signature BLOB NOT NULL, -- ML-DSA signature
    merkle_proof BLOB,
    created_at TIMESTAMP NOT NULL
);

-- DAG edges and consensus decisions
CREATE TABLE dag_edges (
    edge_id TEXT PRIMARY KEY,
    source_vertex TEXT NOT NULL REFERENCES dag_vertices(vertex_id),
    target_vertex TEXT NOT NULL REFERENCES dag_vertices(vertex_id),
    consensus_votes INT,
    is_finalized BOOLEAN DEFAULT FALSE,
    finality_round INT,
    created_at TIMESTAMP NOT NULL
);

-- QR-Avalanche consensus state
CREATE TABLE consensus_rounds (
    round_id TEXT PRIMARY KEY,
    round_number INT NOT NULL,
    participating_agents INT,
    vertices_processed INT,
    consensus_achieved BOOLEAN,
    finality_timestamp_ms INT,
    state_root BLOB, -- Hash of consensus state
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL
);
```

### 4. Task Execution and Swarm Coordination Schema

```sql
-- Agent tasks
CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    task_type TEXT NOT NULL, -- 'compute', 'validate', 'route', 'exchange', etc.
    task_priority INT NOT NULL, -- 0-3, where 3 is critical
    payload_json TEXT NOT NULL,
    deadline_ms INT,
    status TEXT NOT NULL, -- 'pending', 'assigned', 'executing', 'completed', 'failed'
    result_json TEXT,
    execution_time_ms INT,
    resource_cost_ruv INT, -- rUv tokens
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    parent_task_id TEXT REFERENCES tasks(task_id),
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

-- Agent swarm coordination state
CREATE TABLE swarm_states (
    swarm_id TEXT PRIMARY KEY,
    swarm_type TEXT NOT NULL, -- 'hierarchical', 'mesh', 'distributed'
    agent_count INT,
    coordinator_agent_id TEXT REFERENCES agents(agent_id),
    active_tasks INT,
    completed_tasks INT,
    failed_tasks INT,
    work_stealing_enabled BOOLEAN,
    status TEXT, -- 'idle', 'running', 'paused', 'failed'
    created_at TIMESTAMP NOT NULL,
    last_heartbeat TIMESTAMP,
    metadata_json TEXT
);

-- Swarm agent membership
CREATE TABLE swarm_members (
    membership_id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarm_states(swarm_id),
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    role TEXT, -- 'coordinator', 'worker', 'validator'
    joined_at TIMESTAMP NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    UNIQUE(swarm_id, agent_id)
);
```

### 5. Exchange and Resource Trading Schema

```sql
-- rUv token accounts
CREATE TABLE ruv_accounts (
    account_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    balance_ruv INT NOT NULL DEFAULT 0,
    total_received INT,
    total_spent INT,
    verification_status TEXT, -- 'unverified', 'verified', 'premium'
    fee_tier REAL DEFAULT 0.001, -- 0.1% base fee
    created_at TIMESTAMP NOT NULL,
    UNIQUE(agent_id)
);

-- Exchange transactions
CREATE TABLE exchange_transactions (
    transaction_id TEXT PRIMARY KEY,
    from_account_id TEXT NOT NULL REFERENCES ruv_accounts(account_id),
    to_account_id TEXT NOT NULL REFERENCES ruv_accounts(account_id),
    amount_ruv INT NOT NULL,
    fee_ruv INT NOT NULL,
    signature BLOB NOT NULL, -- ML-DSA signature
    status TEXT NOT NULL, -- 'pending', 'confirmed', 'failed'
    block_height INT,
    merkle_proof BLOB,
    executed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL
);

-- Payout distribution records
CREATE TABLE payout_distributions (
    payout_id TEXT PRIMARY KEY,
    source_account_id TEXT NOT NULL REFERENCES ruv_accounts(account_id),
    distribution_type TEXT NOT NULL,
    -- 'business_plan_single', 'business_plan_plugin', 'business_plan_node_ops'
    recipient_role TEXT,
    distributions_json TEXT NOT NULL, -- JSON array of {recipient_id, amount_ruv}
    total_distributed_ruv INT,
    round_number INT,
    executed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL
);
```

### 6. Dark Domain and Network Schema

```sql
-- Registered .dark domains
CREATE TABLE dark_domains (
    domain_id TEXT PRIMARY KEY,
    domain_name TEXT NOT NULL UNIQUE, -- e.g., 'mynode.dark'
    agent_id TEXT REFERENCES agents(agent_id),
    quantum_fingerprint BLOB NOT NULL, -- Quantum fingerprint of domain
    addresses_json TEXT NOT NULL, -- JSON array of addresses
    onion_routing_enabled BOOLEAN DEFAULT TRUE,
    privacy_level TEXT, -- 'public', 'private', 'anonymous'
    registered_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    metadata_json TEXT
);

-- Network routing and connectivity
CREATE TABLE network_routes (
    route_id TEXT PRIMARY KEY,
    source_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    destination_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    route_type TEXT, -- 'direct', 'onion', 'shadow', 'relay'
    hops INT,
    latency_ms INT,
    bandwidth_mbps INT,
    last_tested TIMESTAMP,
    success_rate REAL, -- 0.0 to 1.0
    created_at TIMESTAMP NOT NULL,
    UNIQUE(source_agent_id, destination_agent_id)
);
```

### 7. Monitoring and Observability Schema

```sql
-- Agent performance metrics
CREATE TABLE agent_metrics (
    metric_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    metric_type TEXT NOT NULL,
    -- 'cpu_usage', 'memory_usage', 'task_throughput', 'error_rate', etc.
    metric_value REAL,
    unit TEXT,
    timestamp_ms INT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

-- Audit log for compliance
CREATE TABLE audit_log (
    audit_id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(agent_id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details_json TEXT,
    authorized BOOLEAN,
    timestamp_ms INT NOT NULL,
    created_at TIMESTAMP NOT NULL
);
```

## Integration Points in @qudag/core

### 1. **core/swarm** - HierarchicalSwarm Integration

```rust
// Proposed: qudag-swarm -> agenticdb bridge
pub struct SwarmExecutionRecorder {
    db: AgenticdbClient,
    agent_id: AgentId,
}

impl SwarmExecutionRecorder {
    pub async fn record_task_execution(&self, task: &Task, result: &TaskResult) {
        // Record in AgenticDB upon task completion
        // Enable querying execution history
    }

    pub async fn record_agent_state(&self, status: &AgentStatus) {
        // Track agent state transitions
    }
}
```

### 2. **core/crypto** - Quantum Operation Tracking

```rust
// Proposed: qudag-crypto -> agenticdb bridge
pub struct CryptoOperationLogger {
    db: AgenticdbClient,
}

impl CryptoOperationLogger {
    pub async fn log_ml_kem_operation(&self,
        operation_type: &str,
        public_key: &PublicKey,
        result: &CryptoResult,
        execution_time_ms: u32
    ) {
        // Record ML-KEM/ML-DSA operations for audit
    }
}
```

### 3. **core/dag** - Consensus and Merkle Proof Tracking

```rust
// Proposed: qudag-dag -> agenticdb bridge
pub struct DagExecutionRecorder {
    db: AgenticdbClient,
}

impl DagExecutionRecorder {
    pub async fn record_vertex(&self, vertex: &Vertex, merkle_proof: &[u8]) {
        // Track DAG vertices and consensus decisions
    }

    pub async fn record_finality(&self, round: u64, finalized_vertices: &[VertexId]) {
        // Record when consensus reaches finality
    }
}
```

### 4. **core/exchange** - Transaction and Fee Tracking

```rust
// Proposed: qudag-exchange -> agenticdb bridge
pub struct ExchangeRecorder {
    db: AgenticdbClient,
}

impl ExchangeRecorder {
    pub async fn record_transaction(&self,
        tx: &Transaction,
        fee_calculated: rUv,
        signature: &MlDsaSignature
    ) {
        // Track rUv transfers and fee calculations
    }

    pub async fn record_payout(&self, payout: &PayoutDistribution) {
        // Track business plan payouts
    }
}
```

## Data Query Patterns

### 1. Agent Execution Timeline
```sql
SELECT
    c.operation_id,
    c.operation_type,
    c.execution_time_ms,
    c.status,
    t.task_id,
    t.task_type,
    c.created_at
FROM crypto_operations c
LEFT JOIN tasks t ON c.operation_id = t.task_id
WHERE c.agent_id = ?
ORDER BY c.created_at DESC;
```

### 2. Quantum Fingerprint Verification Chain
```sql
SELECT
    qf.fingerprint_id,
    qf.verification_count,
    qf.verified,
    c.signature,
    a.agent_id
FROM quantum_fingerprints qf
JOIN crypto_operations c ON qf.operation_id = c.operation_id
JOIN agents a ON c.agent_id = a.agent_id
WHERE qf.data_hash = ?
ORDER BY qf.created_at DESC;
```

### 3. Swarm Performance Analysis
```sql
SELECT
    s.swarm_id,
    COUNT(DISTINCT sm.agent_id) as agent_count,
    COUNT(DISTINCT t.task_id) as total_tasks,
    AVG(t.execution_time_ms) as avg_task_time_ms,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks
FROM swarm_states s
LEFT JOIN swarm_members sm ON s.swarm_id = sm.swarm_id
LEFT JOIN tasks t ON sm.agent_id = t.agent_id
WHERE s.created_at >= DATETIME('now', '-1 hour')
GROUP BY s.swarm_id;
```

### 4. Exchange Volume and Fee Analysis
```sql
SELECT
    DATE(et.created_at) as date,
    COUNT(et.transaction_id) as transaction_count,
    SUM(et.amount_ruv) as total_volume_ruv,
    SUM(et.fee_ruv) as total_fees_ruv,
    AVG(et.fee_ruv * 100.0 / et.amount_ruv) as avg_fee_percent
FROM exchange_transactions et
WHERE et.status = 'confirmed'
GROUP BY DATE(et.created_at)
ORDER BY date DESC;
```

## Benefits of AgenticDB Integration

1. **Audit Trail**: Complete immutable record of all quantum operations and agent decisions
2. **Performance Analysis**: Query execution patterns to optimize swarm coordination
3. **Compliance**: Track agent activities for regulatory requirements
4. **Debugging**: Reconstruct execution history for issue diagnosis
5. **Machine Learning**: Analyze patterns to improve agent behavior
6. **Resource Allocation**: Track rUv spending and optimize fee structures

## Implementation Roadmap

1. **Phase 1**: Design and validate schema (current)
2. **Phase 2**: Implement AgenticDB client library for QuDAG
3. **Phase 3**: Add recording bridges to core components
4. **Phase 4**: Create query and visualization tools
5. **Phase 5**: Integrate with agentic-flow for workflow tracking
