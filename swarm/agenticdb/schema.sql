-- QuDAG AgenticDB Schema
-- Comprehensive database schema for agent execution history, quantum operations, and swarm coordination
-- Version: 1.0

-- ============================================================================
-- 1. CORE AGENT MANIFEST SCHEMA
-- ============================================================================

-- Agent manifest and registration
CREATE TABLE IF NOT EXISTS agents (
    agent_id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    mcp_endpoint TEXT,
    mlkem_public_key BLOB NOT NULL,
    mldsa_public_key BLOB NOT NULL,
    capabilities TEXT NOT NULL,
    docker_image TEXT,
    registry_uri TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    version TEXT,
    metadata_json TEXT
);

-- Agent ratings and performance
CREATE TABLE IF NOT EXISTS agent_ratings (
    rating_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    rating_score REAL NOT NULL,
    review_count INT DEFAULT 0,
    performance_score REAL,
    reliability_score REAL,
    rated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rater_agent_id TEXT REFERENCES agents(agent_id),
    UNIQUE(agent_id, rated_at)
);

-- ============================================================================
-- 2. QUANTUM EXECUTION HISTORY SCHEMA
-- ============================================================================

-- Cryptographic operations
CREATE TABLE IF NOT EXISTS crypto_operations (
    operation_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    operation_type TEXT NOT NULL,
    input_data BLOB,
    output_data BLOB,
    signature BLOB,
    public_key_fingerprint TEXT,
    execution_time_ms INT,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    security_level TEXT
);

-- Quantum fingerprints created and verified
CREATE TABLE IF NOT EXISTS quantum_fingerprints (
    fingerprint_id TEXT PRIMARY KEY,
    data_hash BLOB NOT NULL,
    fingerprint_value BLOB NOT NULL,
    operation_id TEXT REFERENCES crypto_operations(operation_id),
    verified BOOLEAN DEFAULT FALSE,
    verification_count INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_type TEXT
);

-- ============================================================================
-- 3. DAG CONSENSUS AND BLOCK SCHEMA
-- ============================================================================

-- DAG vertices (messages)
CREATE TABLE IF NOT EXISTS dag_vertices (
    vertex_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    vertex_hash BLOB NOT NULL UNIQUE,
    parents TEXT NOT NULL,
    payload BLOB,
    timestamp_ms INT NOT NULL,
    signature BLOB NOT NULL,
    merkle_proof BLOB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DAG edges and consensus decisions
CREATE TABLE IF NOT EXISTS dag_edges (
    edge_id TEXT PRIMARY KEY,
    source_vertex TEXT NOT NULL REFERENCES dag_vertices(vertex_id),
    target_vertex TEXT NOT NULL REFERENCES dag_vertices(vertex_id),
    consensus_votes INT DEFAULT 0,
    is_finalized BOOLEAN DEFAULT FALSE,
    finality_round INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- QR-Avalanche consensus state
CREATE TABLE IF NOT EXISTS consensus_rounds (
    round_id TEXT PRIMARY KEY,
    round_number INT NOT NULL,
    participating_agents INT,
    vertices_processed INT,
    consensus_achieved BOOLEAN DEFAULT FALSE,
    finality_timestamp_ms INT,
    state_root BLOB,
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. TASK EXECUTION AND SWARM COORDINATION SCHEMA
-- ============================================================================

-- Agent tasks
CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    task_type TEXT NOT NULL,
    task_priority INT NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    deadline_ms INT,
    status TEXT NOT NULL DEFAULT 'pending',
    result_json TEXT,
    execution_time_ms INT,
    resource_cost_ruv INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    parent_task_id TEXT REFERENCES tasks(task_id)
);

-- Agent swarm coordination state
CREATE TABLE IF NOT EXISTS swarm_states (
    swarm_id TEXT PRIMARY KEY,
    swarm_type TEXT NOT NULL,
    agent_count INT DEFAULT 0,
    coordinator_agent_id TEXT REFERENCES agents(agent_id),
    active_tasks INT DEFAULT 0,
    completed_tasks INT DEFAULT 0,
    failed_tasks INT DEFAULT 0,
    work_stealing_enabled BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'idle',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP,
    metadata_json TEXT
);

-- Swarm agent membership
CREATE TABLE IF NOT EXISTS swarm_members (
    membership_id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarm_states(swarm_id),
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    role TEXT,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    UNIQUE(swarm_id, agent_id)
);

-- ============================================================================
-- 5. EXCHANGE AND RESOURCE TRADING SCHEMA
-- ============================================================================

-- rUv token accounts
CREATE TABLE IF NOT EXISTS ruv_accounts (
    account_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    balance_ruv INT NOT NULL DEFAULT 0,
    total_received INT DEFAULT 0,
    total_spent INT DEFAULT 0,
    verification_status TEXT DEFAULT 'unverified',
    fee_tier REAL DEFAULT 0.001,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id)
);

-- Exchange transactions
CREATE TABLE IF NOT EXISTS exchange_transactions (
    transaction_id TEXT PRIMARY KEY,
    from_account_id TEXT NOT NULL REFERENCES ruv_accounts(account_id),
    to_account_id TEXT NOT NULL REFERENCES ruv_accounts(account_id),
    amount_ruv INT NOT NULL,
    fee_ruv INT NOT NULL,
    signature BLOB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    block_height INT,
    merkle_proof BLOB,
    executed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payout distribution records
CREATE TABLE IF NOT EXISTS payout_distributions (
    payout_id TEXT PRIMARY KEY,
    source_account_id TEXT NOT NULL REFERENCES ruv_accounts(account_id),
    distribution_type TEXT NOT NULL,
    recipient_role TEXT,
    distributions_json TEXT NOT NULL,
    total_distributed_ruv INT,
    round_number INT,
    executed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. DARK DOMAIN AND NETWORK SCHEMA
-- ============================================================================

-- Registered .dark domains
CREATE TABLE IF NOT EXISTS dark_domains (
    domain_id TEXT PRIMARY KEY,
    domain_name TEXT NOT NULL UNIQUE,
    agent_id TEXT REFERENCES agents(agent_id),
    quantum_fingerprint BLOB NOT NULL,
    addresses_json TEXT NOT NULL,
    onion_routing_enabled BOOLEAN DEFAULT TRUE,
    privacy_level TEXT DEFAULT 'public',
    registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    metadata_json TEXT
);

-- Network routing and connectivity
CREATE TABLE IF NOT EXISTS network_routes (
    route_id TEXT PRIMARY KEY,
    source_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    destination_agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    route_type TEXT,
    hops INT,
    latency_ms INT,
    bandwidth_mbps INT,
    last_tested TIMESTAMP,
    success_rate REAL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_agent_id, destination_agent_id)
);

-- ============================================================================
-- 7. MONITORING AND OBSERVABILITY SCHEMA
-- ============================================================================

-- Agent performance metrics
CREATE TABLE IF NOT EXISTS agent_metrics (
    metric_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(agent_id),
    metric_type TEXT NOT NULL,
    metric_value REAL,
    unit TEXT,
    timestamp_ms INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for compliance
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(agent_id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details_json TEXT,
    authorized BOOLEAN DEFAULT TRUE,
    timestamp_ms INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workflow execution tracking
CREATE TABLE IF NOT EXISTS workflow_executions (
    workflow_id TEXT PRIMARY KEY,
    workflow_type TEXT NOT NULL,
    workflow_name TEXT,
    participating_agents TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status TEXT DEFAULT 'running',
    execution_time_ms INT,
    resource_consumption_ruv INT,
    success_status BOOLEAN,
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Claude-flow task recording
CREATE TABLE IF NOT EXISTS claude_flow_tasks (
    task_id TEXT PRIMARY KEY,
    task_name TEXT NOT NULL,
    task_title TEXT NOT NULL,
    assigned_agent TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT,
    objective TEXT,
    execution_steps INT,
    steps_completed INT DEFAULT 0,
    success_criteria_met BOOLEAN DEFAULT FALSE,
    outputs_json TEXT,
    findings_summary TEXT,
    execution_time_hours REAL,
    memory_slots_used TEXT,
    related_agenticdb_records TEXT,
    next_recommended_tasks TEXT
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Agents table indexes
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);

-- Crypto operations indexes
CREATE INDEX IF NOT EXISTS idx_crypto_operations_agent ON crypto_operations(agent_id);
CREATE INDEX IF NOT EXISTS idx_crypto_operations_type ON crypto_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_crypto_operations_status ON crypto_operations(status);
CREATE INDEX IF NOT EXISTS idx_crypto_operations_created_at ON crypto_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_operations_fingerprint ON crypto_operations(public_key_fingerprint);

-- Quantum fingerprints indexes
CREATE INDEX IF NOT EXISTS idx_quantum_fingerprints_verified ON quantum_fingerprints(verified);
CREATE INDEX IF NOT EXISTS idx_quantum_fingerprints_created_at ON quantum_fingerprints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quantum_fingerprints_data_type ON quantum_fingerprints(data_type);

-- DAG vertices indexes
CREATE INDEX IF NOT EXISTS idx_dag_vertices_agent ON dag_vertices(agent_id);
CREATE INDEX IF NOT EXISTS idx_dag_vertices_timestamp ON dag_vertices(timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_dag_vertices_created_at ON dag_vertices(created_at DESC);

-- DAG edges indexes
CREATE INDEX IF NOT EXISTS idx_dag_edges_source ON dag_edges(source_vertex);
CREATE INDEX IF NOT EXISTS idx_dag_edges_target ON dag_edges(target_vertex);
CREATE INDEX IF NOT EXISTS idx_dag_edges_finalized ON dag_edges(is_finalized);

-- Consensus rounds indexes
CREATE INDEX IF NOT EXISTS idx_consensus_rounds_number ON consensus_rounds(round_number DESC);
CREATE INDEX IF NOT EXISTS idx_consensus_rounds_finality ON consensus_rounds(finality_timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_consensus_rounds_created_at ON consensus_rounds(created_at DESC);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(task_priority DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- Swarm states indexes
CREATE INDEX IF NOT EXISTS idx_swarm_states_type ON swarm_states(swarm_type);
CREATE INDEX IF NOT EXISTS idx_swarm_states_status ON swarm_states(status);
CREATE INDEX IF NOT EXISTS idx_swarm_states_created_at ON swarm_states(created_at DESC);

-- Exchange transactions indexes
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_from ON exchange_transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_to ON exchange_transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_status ON exchange_transactions(status);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_created_at ON exchange_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_block ON exchange_transactions(block_height);

-- Dark domains indexes
CREATE INDEX IF NOT EXISTS idx_dark_domains_agent ON dark_domains(agent_id);
CREATE INDEX IF NOT EXISTS idx_dark_domains_privacy ON dark_domains(privacy_level);
CREATE INDEX IF NOT EXISTS idx_dark_domains_registered_at ON dark_domains(registered_at DESC);

-- Network routes indexes
CREATE INDEX IF NOT EXISTS idx_network_routes_source ON network_routes(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_network_routes_dest ON network_routes(destination_agent_id);
CREATE INDEX IF NOT EXISTS idx_network_routes_type ON network_routes(route_type);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_type ON agent_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp_ms DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_agent ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp_ms DESC);

-- Workflow execution indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_type ON workflow_executions(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at DESC);

-- Claude-flow tasks indexes
CREATE INDEX IF NOT EXISTS idx_claude_flow_tasks_status ON claude_flow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_claude_flow_tasks_agent ON claude_flow_tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_claude_flow_tasks_created_at ON claude_flow_tasks(created_at DESC);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Agent performance summary view
CREATE VIEW IF NOT EXISTS v_agent_performance AS
SELECT
    a.agent_id,
    a.agent_name,
    a.agent_type,
    COUNT(DISTINCT t.task_id) as total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
    ROUND(AVG(t.execution_time_ms), 2) as avg_task_time_ms,
    COALESCE(ar.rating_score, 0.0) as rating_score,
    SUM(CASE WHEN t.status = 'completed' THEN t.resource_cost_ruv ELSE 0 END) as total_resources_used
FROM agents a
LEFT JOIN tasks t ON a.agent_id = t.agent_id
LEFT JOIN agent_ratings ar ON a.agent_id = ar.agent_id
GROUP BY a.agent_id, a.agent_name, a.agent_type, ar.rating_score;

-- Consensus efficiency view
CREATE VIEW IF NOT EXISTS v_consensus_efficiency AS
SELECT
    cr.round_number,
    COUNT(DISTINCT dv.agent_id) as participating_agents,
    (cr.finality_timestamp_ms - CAST(strftime('%s', cr.created_at) AS INTEGER) * 1000) as consensus_time_ms,
    CASE
        WHEN (cr.finality_timestamp_ms - CAST(strftime('%s', cr.created_at) AS INTEGER) * 1000) < 1000 THEN 'fast'
        WHEN (cr.finality_timestamp_ms - CAST(strftime('%s', cr.created_at) AS INTEGER) * 1000) < 5000 THEN 'normal'
        ELSE 'slow'
    END as speed_category,
    COUNT(DISTINCT dv.vertex_id) as vertices_processed
FROM consensus_rounds cr
LEFT JOIN dag_vertices dv ON dv.created_at BETWEEN cr.created_at AND datetime(cr.finality_timestamp_ms/1000, 'unixepoch')
GROUP BY cr.round_number, cr.finality_timestamp_ms, cr.created_at;

-- Exchange activity view
CREATE VIEW IF NOT EXISTS v_exchange_activity AS
SELECT
    DATE(et.created_at) as date,
    COUNT(et.transaction_id) as transaction_count,
    SUM(et.amount_ruv) as total_volume_ruv,
    SUM(et.fee_ruv) as total_fees_ruv,
    ROUND(AVG(et.fee_ruv * 100.0 / NULLIF(et.amount_ruv, 0)), 2) as avg_fee_percent,
    SUM(CASE WHEN et.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count
FROM exchange_transactions et
GROUP BY DATE(et.created_at)
ORDER BY date DESC;

-- Swarm activity view
CREATE VIEW IF NOT EXISTS v_swarm_activity AS
SELECT
    s.swarm_id,
    s.swarm_type,
    COUNT(DISTINCT sm.agent_id) as agent_count,
    COUNT(DISTINCT t.task_id) as total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
    ROUND(AVG(t.execution_time_ms), 2) as avg_task_time_ms,
    s.status as swarm_status
FROM swarm_states s
LEFT JOIN swarm_members sm ON s.swarm_id = sm.swarm_id
LEFT JOIN tasks t ON sm.agent_id = t.agent_id
GROUP BY s.swarm_id, s.swarm_type, s.status;

-- Crypto operation security audit view
CREATE VIEW IF NOT EXISTS v_crypto_security_audit AS
SELECT
    a.agent_id,
    a.agent_name,
    c.operation_type,
    COUNT(c.operation_id) as operation_count,
    SUM(CASE WHEN c.status = 'success' THEN 1 ELSE 0 END) as successful_ops,
    SUM(CASE WHEN c.status = 'failure' THEN 1 ELSE 0 END) as failed_ops,
    SUM(CASE WHEN c.status = 'timeout' THEN 1 ELSE 0 END) as timeout_ops,
    ROUND(AVG(c.execution_time_ms), 2) as avg_execution_ms,
    COUNT(DISTINCT c.security_level) as security_levels_used
FROM agents a
LEFT JOIN crypto_operations c ON a.agent_id = c.agent_id
GROUP BY a.agent_id, a.agent_name, c.operation_type;

-- Dark domain resolution view
CREATE VIEW IF NOT EXISTS v_dark_domain_stats AS
SELECT
    dd.privacy_level,
    COUNT(dd.domain_id) as domain_count,
    COUNT(DISTINCT dd.agent_id) as agent_count,
    SUM(CASE WHEN dd.onion_routing_enabled THEN 1 ELSE 0 END) as onion_routing_enabled_count,
    COUNT(CASE WHEN dd.expires_at IS NULL THEN 1 END) as permanent_domains,
    COUNT(CASE WHEN dd.expires_at IS NOT NULL AND dd.expires_at > CURRENT_TIMESTAMP THEN 1 END) as active_temporary_domains
FROM dark_domains dd
GROUP BY dd.privacy_level;
