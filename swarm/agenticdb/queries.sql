-- AgenticDB Common Query Patterns
-- Performance analysis, monitoring, and optimization queries
-- Version: 1.0

-- ============================================================================
-- PERFORMANCE ANALYSIS QUERIES
-- ============================================================================

-- Query 1: Agent Execution Timeline
-- Purpose: View all operations performed by an agent chronologically
-- Usage: SELECT * FROM v_agent_execution_timeline WHERE agent_id = 'agent-quantum-001';
.mode column
.headers on

-- Detailed agent timeline query
SELECT
    c.operation_id,
    c.operation_type,
    c.execution_time_ms,
    c.status,
    t.task_id,
    t.task_type,
    c.created_at
FROM crypto_operations c
LEFT JOIN tasks t ON c.agent_id = t.agent_id
WHERE c.agent_id = ?
ORDER BY c.created_at DESC
LIMIT 50;

-- Query 2: Quantum Fingerprint Verification Chain
-- Purpose: Track the verification history of a quantum fingerprint
-- Shows all verifications and the agents involved

SELECT
    qf.fingerprint_id,
    qf.verification_count,
    qf.verified,
    c.signature,
    a.agent_id,
    a.agent_name,
    qf.created_at
FROM quantum_fingerprints qf
JOIN crypto_operations c ON qf.operation_id = c.operation_id
JOIN agents a ON c.agent_id = a.agent_id
WHERE qf.data_hash = ?
ORDER BY qf.created_at DESC;

-- Query 3: Swarm Performance Analysis
-- Purpose: Analyze swarm performance metrics including task distribution and success rates

SELECT
    s.swarm_id,
    s.swarm_type,
    COUNT(DISTINCT sm.agent_id) as agent_count,
    COUNT(DISTINCT t.task_id) as total_tasks,
    AVG(CAST(t.execution_time_ms AS FLOAT)) as avg_task_time_ms,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
    ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT t.task_id), 0), 2) as success_rate_percent
FROM swarm_states s
LEFT JOIN swarm_members sm ON s.swarm_id = sm.swarm_id
LEFT JOIN tasks t ON sm.agent_id = t.agent_id
WHERE s.created_at >= datetime('now', '-1 hour')
GROUP BY s.swarm_id, s.swarm_type;

-- Query 4: Exchange Volume and Fee Analysis
-- Purpose: Analyze exchange transactions and fee distributions

SELECT
    DATE(et.created_at) as date,
    COUNT(et.transaction_id) as transaction_count,
    SUM(et.amount_ruv) as total_volume_ruv,
    SUM(et.fee_ruv) as total_fees_ruv,
    ROUND(AVG(CAST(et.fee_ruv AS FLOAT) * 100.0 / NULLIF(et.amount_ruv, 0)), 2) as avg_fee_percent,
    SUM(CASE WHEN et.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
    SUM(CASE WHEN et.status = 'pending' THEN 1 ELSE 0 END) as pending_count
FROM exchange_transactions et
WHERE et.created_at >= datetime('now', '-7 days')
GROUP BY DATE(et.created_at)
ORDER BY date DESC;

-- Query 5: Consensus Round Efficiency
-- Purpose: Measure consensus latency and efficiency

SELECT
    cr.round_number,
    COUNT(DISTINCT dv.agent_id) as participating_agents,
    COUNT(DISTINCT dv.vertex_id) as vertices_processed,
    (cr.finality_timestamp_ms - CAST(strftime('%s', cr.created_at) AS INTEGER) * 1000) as consensus_time_ms,
    CASE
        WHEN (cr.finality_timestamp_ms - CAST(strftime('%s', cr.created_at) AS INTEGER) * 1000) < 1000 THEN 'fast'
        WHEN (cr.finality_timestamp_ms - CAST(strftime('%s', cr.created_at) AS INTEGER) * 1000) < 5000 THEN 'normal'
        ELSE 'slow'
    END as speed_category,
    cr.consensus_achieved
FROM consensus_rounds cr
LEFT JOIN dag_vertices dv ON dv.created_at BETWEEN cr.created_at AND datetime((cr.finality_timestamp_ms/1000), 'unixepoch')
WHERE cr.created_at >= datetime('now', '-24 hours')
GROUP BY cr.round_number
ORDER BY cr.round_number DESC
LIMIT 100;

-- Query 6: Task Execution Pattern Analysis
-- Purpose: Identify patterns in task execution (success rates, bottlenecks)

SELECT
    t.task_type,
    COUNT(t.task_id) as total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
    ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.task_id), 0), 2) as success_rate_percent,
    ROUND(AVG(CAST(t.execution_time_ms AS FLOAT)), 2) as avg_execution_ms,
    SUM(t.resource_cost_ruv) as total_resources_ruv
FROM tasks t
WHERE t.created_at >= datetime('now', '-24 hours')
GROUP BY t.task_type
ORDER BY total_tasks DESC;

-- ============================================================================
-- SECURITY AND COMPLIANCE QUERIES
-- ============================================================================

-- Query 7: Crypto Operation Security Audit
-- Purpose: Audit all cryptographic operations for security compliance

SELECT
    a.agent_id,
    a.agent_name,
    c.operation_type,
    COUNT(c.operation_id) as operation_count,
    SUM(CASE WHEN c.status = 'success' THEN 1 ELSE 0 END) as successful_ops,
    SUM(CASE WHEN c.status = 'failure' THEN 1 ELSE 0 END) as failed_ops,
    SUM(CASE WHEN c.status = 'timeout' THEN 1 ELSE 0 END) as timeout_ops,
    ROUND(AVG(CAST(c.execution_time_ms AS FLOAT)), 2) as avg_execution_ms,
    COUNT(DISTINCT c.security_level) as security_levels_used,
    MIN(c.created_at) as first_operation,
    MAX(c.created_at) as last_operation
FROM agents a
LEFT JOIN crypto_operations c ON a.agent_id = c.agent_id
WHERE c.created_at >= datetime('now', '-7 days')
GROUP BY a.agent_id, a.agent_name, c.operation_type
ORDER BY operation_count DESC;

-- Query 8: Failed Operation Investigation
-- Purpose: Investigate failed or timed-out operations

SELECT
    co.operation_id,
    a.agent_name,
    co.operation_type,
    co.status,
    co.error_message,
    co.execution_time_ms,
    co.security_level,
    co.created_at
FROM crypto_operations co
JOIN agents a ON co.agent_id = a.agent_id
WHERE co.status IN ('failure', 'timeout')
AND co.created_at >= datetime('now', '-7 days')
ORDER BY co.created_at DESC
LIMIT 50;

-- Query 9: Audit Trail for Specific Resource
-- Purpose: Get complete audit trail for compliance tracking

SELECT
    al.audit_id,
    a.agent_name,
    al.action,
    al.resource_type,
    al.resource_id,
    al.details_json,
    al.authorized,
    al.timestamp_ms,
    al.created_at
FROM audit_log al
LEFT JOIN agents a ON al.agent_id = a.agent_id
WHERE al.resource_type = ?
AND al.resource_id = ?
ORDER BY al.created_at DESC;

-- Query 10: Unauthorized Access Attempts
-- Purpose: Identify potential security incidents

SELECT
    al.audit_id,
    a.agent_name,
    al.action,
    al.resource_type,
    al.details_json,
    COUNT(*) as attempt_count,
    MIN(al.created_at) as first_attempt,
    MAX(al.created_at) as last_attempt
FROM audit_log al
LEFT JOIN agents a ON al.agent_id = a.agent_id
WHERE al.authorized = FALSE
GROUP BY a.agent_id, al.action, al.resource_type
ORDER BY attempt_count DESC;

-- ============================================================================
-- OPTIMIZATION AND BENCHMARKING QUERIES
-- ============================================================================

-- Query 11: Agent Performance Ranking
-- Purpose: Rank agents by performance metrics

SELECT
    a.agent_id,
    a.agent_name,
    a.agent_type,
    COUNT(DISTINCT t.task_id) as tasks_completed,
    ROUND(AVG(CAST(t.execution_time_ms AS FLOAT)), 2) as avg_task_time_ms,
    SUM(t.resource_cost_ruv) as total_resources_used,
    COALESCE(ar.rating_score, 0.0) as rating_score,
    ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT t.task_id), 0), 2) as success_rate_percent
FROM agents a
LEFT JOIN tasks t ON a.agent_id = t.agent_id AND t.created_at >= datetime('now', '-7 days')
LEFT JOIN agent_ratings ar ON a.agent_id = ar.agent_id
GROUP BY a.agent_id, a.agent_name, a.agent_type
ORDER BY tasks_completed DESC, rating_score DESC;

-- Query 12: Crypto Operation Performance Profiling
-- Purpose: Identify performance bottlenecks in crypto operations

SELECT
    operation_type,
    COUNT(operation_id) as operation_count,
    ROUND(MIN(CAST(execution_time_ms AS FLOAT)), 2) as min_time_ms,
    ROUND(AVG(CAST(execution_time_ms AS FLOAT)), 2) as avg_time_ms,
    ROUND(MAX(CAST(execution_time_ms AS FLOAT)), 2) as max_time_ms,
    ROUND(SQRT(AVG((execution_time_ms - (SELECT AVG(CAST(execution_time_ms AS FLOAT)) FROM crypto_operations)) *
                    (execution_time_ms - (SELECT AVG(CAST(execution_time_ms AS FLOAT)) FROM crypto_operations)))), 2) as stddev_ms
FROM crypto_operations
WHERE status = 'success'
AND created_at >= datetime('now', '-7 days')
GROUP BY operation_type
ORDER BY avg_time_ms DESC;

-- Query 13: Work Stealing Effectiveness
-- Purpose: Measure effectiveness of work-stealing load balancing

SELECT
    s.swarm_id,
    s.swarm_type,
    COUNT(DISTINCT sm.agent_id) as agent_count,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    ROUND(AVG(CAST(t.execution_time_ms AS FLOAT)), 2) as avg_task_time_ms,
    s.work_stealing_enabled,
    s.active_tasks as current_active_tasks
FROM swarm_states s
LEFT JOIN swarm_members sm ON s.swarm_id = sm.swarm_id
LEFT JOIN tasks t ON sm.agent_id = t.agent_id AND t.created_at >= datetime('now', '-1 day')
GROUP BY s.swarm_id, s.work_stealing_enabled
ORDER BY completed_tasks DESC;

-- Query 14: Network Route Latency Analysis
-- Purpose: Identify network bottlenecks and routing inefficiencies

SELECT
    nr.route_type,
    COUNT(nr.route_id) as route_count,
    ROUND(AVG(CAST(nr.latency_ms AS FLOAT)), 2) as avg_latency_ms,
    ROUND(MIN(CAST(nr.latency_ms AS FLOAT)), 2) as min_latency_ms,
    ROUND(MAX(CAST(nr.latency_ms AS FLOAT)), 2) as max_latency_ms,
    ROUND(AVG(CAST(nr.bandwidth_mbps AS FLOAT)), 2) as avg_bandwidth_mbps,
    ROUND(AVG(nr.success_rate * 100), 2) as avg_success_rate_percent
FROM network_routes nr
GROUP BY nr.route_type
ORDER BY avg_latency_ms DESC;

-- Query 15: Dark Domain Performance Analysis
-- Purpose: Analyze dark domain resolution performance

SELECT
    dd.privacy_level,
    COUNT(dd.domain_id) as domain_count,
    ROUND(AVG(CAST(nr.latency_ms AS FLOAT)), 2) as avg_resolution_latency_ms,
    SUM(CASE WHEN dd.onion_routing_enabled THEN 1 ELSE 0 END) as onion_enabled_count,
    ROUND(AVG(nr.success_rate * 100), 2) as avg_route_success_percent
FROM dark_domains dd
LEFT JOIN network_routes nr ON dd.agent_id = nr.source_agent_id
GROUP BY dd.privacy_level;

-- ============================================================================
-- TREND ANALYSIS AND FORECASTING
-- ============================================================================

-- Query 16: Task Completion Trend (Last 7 Days)
-- Purpose: Identify trends in task completion rates

SELECT
    DATE(t.created_at) as date,
    t.task_type,
    COUNT(t.task_id) as total_tasks,
    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
    ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / COUNT(t.task_id), 2) as success_rate_percent
FROM tasks t
WHERE t.created_at >= datetime('now', '-7 days')
GROUP BY DATE(t.created_at), t.task_type
ORDER BY date DESC, task_type;

-- Query 17: Exchange Transaction Velocity
-- Purpose: Measure transaction throughput over time

SELECT
    DATE(et.created_at) as date,
    ROUND(COUNT(et.transaction_id) * 60.0 / NULLIF((julianday('now') - julianday(DATE(et.created_at))) * 24 * 60, 0), 2) as transactions_per_minute,
    SUM(et.amount_ruv) as daily_volume_ruv,
    AVG(CAST(et.amount_ruv AS FLOAT)) as avg_transaction_ruv,
    COUNT(DISTINCT et.from_account_id) as unique_senders
FROM exchange_transactions et
WHERE et.status = 'confirmed'
AND et.created_at >= datetime('now', '-30 days')
GROUP BY DATE(et.created_at)
ORDER BY date DESC;

-- Query 18: Consensus Round Duration Trend
-- Purpose: Monitor consensus latency over time for performance regression

SELECT
    cr.round_number,
    (cr.finality_timestamp_ms - CAST(strftime('%s', cr.created_at) AS INTEGER) * 1000) as consensus_time_ms,
    COUNT(DISTINCT dv.agent_id) as participating_agents,
    COUNT(DISTINCT dv.vertex_id) as vertices_in_round,
    cr.created_at
FROM consensus_rounds cr
LEFT JOIN dag_vertices dv ON dv.created_at BETWEEN cr.created_at AND datetime((cr.finality_timestamp_ms/1000), 'unixepoch')
WHERE cr.created_at >= datetime('now', '-3 days')
AND cr.consensus_achieved = TRUE
ORDER BY cr.round_number DESC
LIMIT 100;

-- ============================================================================
-- ANOMALY DETECTION QUERIES
-- ============================================================================

-- Query 19: Detect Agents with High Error Rates
-- Purpose: Identify agents that may be malfunctioning

SELECT
    a.agent_id,
    a.agent_name,
    COUNT(t.task_id) as task_count,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
    ROUND(100.0 * SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.task_id), 0), 2) as failure_rate_percent,
    COUNT(DISTINCT DATE(t.completed_at)) as days_active
FROM agents a
LEFT JOIN tasks t ON a.agent_id = t.agent_id AND t.created_at >= datetime('now', '-7 days')
WHERE COUNT(t.task_id) > 10
GROUP BY a.agent_id, a.agent_name
HAVING failure_rate_percent > 5.0
ORDER BY failure_rate_percent DESC;

-- Query 20: Slow Operations Detection
-- Purpose: Identify operations running slower than expected

SELECT
    c.operation_id,
    a.agent_name,
    c.operation_type,
    c.execution_time_ms,
    (SELECT ROUND(AVG(CAST(execution_time_ms AS FLOAT)), 2) FROM crypto_operations WHERE operation_type = c.operation_type AND status = 'success') as avg_type_time_ms,
    ROUND(CAST(c.execution_time_ms AS FLOAT) / (SELECT AVG(CAST(execution_time_ms AS FLOAT)) FROM crypto_operations WHERE operation_type = c.operation_type AND status = 'success'), 2) as slowdown_factor,
    c.created_at
FROM crypto_operations c
JOIN agents a ON c.agent_id = a.agent_id
WHERE c.status = 'success'
AND c.created_at >= datetime('now', '-7 days')
AND c.execution_time_ms > 1.5 * (SELECT AVG(CAST(execution_time_ms AS FLOAT)) FROM crypto_operations WHERE operation_type = c.operation_type AND status = 'success')
ORDER BY slowdown_factor DESC
LIMIT 50;

-- ============================================================================
-- REPORTING QUERIES
-- ============================================================================

-- Query 21: Daily System Health Report
-- Purpose: Generate comprehensive daily health metrics

SELECT
    DATE(datetime('now')) as report_date,
    (SELECT COUNT(DISTINCT agent_id) FROM agents WHERE status = 'active') as active_agents,
    (SELECT COUNT(DISTINCT swarm_id) FROM swarm_states WHERE status = 'running') as active_swarms,
    (SELECT COUNT(*) FROM tasks WHERE DATE(created_at) = DATE(datetime('now')) AND status = 'completed') as tasks_completed_today,
    (SELECT COUNT(*) FROM exchange_transactions WHERE DATE(created_at) = DATE(datetime('now')) AND status = 'confirmed') as transactions_completed_today,
    (SELECT SUM(amount_ruv) FROM exchange_transactions WHERE DATE(created_at) = DATE(datetime('now')) AND status = 'confirmed') as daily_volume_ruv,
    (SELECT COUNT(*) FROM consensus_rounds WHERE DATE(created_at) = DATE(datetime('now'))) as consensus_rounds_completed;

-- Query 22: Security Incident Summary
-- Purpose: Generate security incident report

SELECT
    COUNT(*) as total_incidents,
    COUNT(CASE WHEN action = 'unauthorized_attempt' THEN 1 END) as unauthorized_attempts,
    COUNT(CASE WHEN action = 'verification_failed' THEN 1 END) as verification_failures,
    COUNT(DISTINCT agent_id) as agents_involved,
    MIN(created_at) as earliest_incident,
    MAX(created_at) as latest_incident
FROM audit_log
WHERE authorized = FALSE
AND created_at >= datetime('now', '-7 days');

-- Query 23: Agent Capability Matrix
-- Purpose: Create matrix of agent capabilities for resource allocation

SELECT
    a.agent_id,
    a.agent_name,
    a.agent_type,
    COUNT(DISTINCT t.task_id) as tasks_assigned,
    COUNT(DISTINCT c.operation_id) as crypto_operations_performed
FROM agents a
LEFT JOIN tasks t ON a.agent_id = t.agent_id
LEFT JOIN crypto_operations c ON a.agent_id = c.agent_id
WHERE a.status = 'active'
GROUP BY a.agent_id, a.agent_name, a.agent_type
ORDER BY agent_type, tasks_assigned DESC;

-- ============================================================================
-- QUERY OPTIMIZATION RECOMMENDATIONS
-- ============================================================================

-- Index recommendations for frequently run queries:
-- CREATE INDEX idx_tasks_agent_status ON tasks(agent_id, status);
-- CREATE INDEX idx_crypto_operations_agent_created ON crypto_operations(agent_id, created_at DESC);
-- CREATE INDEX idx_exchange_transactions_account_status ON exchange_transactions(from_account_id, status, created_at DESC);
-- CREATE INDEX idx_consensus_rounds_date_round ON consensus_rounds(round_number, finality_timestamp_ms);
-- CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id, timestamp_ms DESC);
