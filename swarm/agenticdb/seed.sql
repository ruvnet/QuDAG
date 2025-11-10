-- AgenticDB Seed Data for Testing and Development
-- Sample data for initial agent registrations, crypto operations, and swarm coordination
-- Version: 1.0

-- ============================================================================
-- AGENT REGISTRATIONS
-- ============================================================================

INSERT OR IGNORE INTO agents (agent_id, agent_name, agent_type, mcp_endpoint, mlkem_public_key, mldsa_public_key, capabilities, docker_image, registry_uri, status, version) VALUES
    ('agent-quantum-001', 'Quantum Validator 1', 'quantum_validator', 'http://localhost:3001', X'DEADBEEF', X'CAFEBABE', '["ml_dsa_verify", "ml_kem_operations", "fingerprint_generation"]', 'qudag/quantum-validator:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-quantum-002', 'Quantum Validator 2', 'quantum_validator', 'http://localhost:3002', X'DEADBEEF', X'CAFEBABE', '["ml_dsa_verify", "ml_kem_operations"]', 'qudag/quantum-validator:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-consensus-lead', 'Consensus Coordinator', 'consensus_lead', 'http://localhost:3010', X'DEADBEEF', X'CAFEBABE', '["coordinate_votes", "finalize_decisions", "record_dag_vertex"]', 'qudag/consensus-lead:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-swarm-coordinator', 'Swarm Load Balancer', 'swarm_coordinator', 'http://localhost:3020', X'DEADBEEF', X'CAFEBABE', '["load_balance", "prioritize_tasks", "redistribute_work"]', 'qudag/swarm-coordinator:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-worker-001', 'Task Worker 1', 'worker', 'http://localhost:4001', X'DEADBEEF', X'CAFEBABE', '["execute_task", "report_status", "steal_work"]', 'qudag/worker:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-worker-002', 'Task Worker 2', 'worker', 'http://localhost:4002', X'DEADBEEF', X'CAFEBABE', '["execute_task", "report_status", "steal_work"]', 'qudag/worker:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-exchange-validator', 'Exchange Validator', 'exchange_validator', 'http://localhost:5001', X'DEADBEEF', X'CAFEBABE', '["verify_account_balance", "calculate_dynamic_fee", "ml_dsa_sign_transaction"]', 'qudag/exchange-validator:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-fee-coordinator', 'Fee Calculator', 'fee_coordinator', 'http://localhost:5010', X'DEADBEEF', X'CAFEBABE', '["calculate_fee_tier", "apply_verification_discount", "record_fee_metrics"]', 'qudag/fee-coordinator:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-ledger-keeper', 'Ledger Keeper', 'ledger_keeper', 'http://localhost:5020', X'DEADBEEF', X'CAFEBABE', '["update_ledger", "issue_signature", "record_transaction"]', 'qudag/ledger-keeper:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-dns-001', 'Dark DNS Provider 1', 'dark_dns_provider', 'http://localhost:6001', X'DEADBEEF', X'CAFEBABE', '["resolve_dark_domain", "verify_quantum_fingerprint", "provide_onion_routing"]', 'qudag/dark-dns:latest', 'registry.example.com', 'active', '1.0.0'),
    ('agent-resolution-lead', 'Resolution Coordinator', 'resolution_lead', 'http://localhost:6010', X'DEADBEEF', X'CAFEBABE', '["coordinate_lookups", "aggregate_results", "select_route"]', 'qudag/resolution-lead:latest', 'registry.example.com', 'active', '1.0.0');

-- ============================================================================
-- AGENT RATINGS
-- ============================================================================

INSERT OR IGNORE INTO agent_ratings (rating_id, agent_id, rating_score, review_count, performance_score, reliability_score, rater_agent_id) VALUES
    ('rating-quantum-001', 'agent-quantum-001', 0.98, 150, 0.97, 0.99, 'agent-consensus-lead'),
    ('rating-quantum-002', 'agent-quantum-002', 0.96, 148, 0.95, 0.97, 'agent-consensus-lead'),
    ('rating-worker-001', 'agent-worker-001', 0.92, 200, 0.91, 0.93, 'agent-swarm-coordinator'),
    ('rating-worker-002', 'agent-worker-002', 0.94, 195, 0.93, 0.95, 'agent-swarm-coordinator'),
    ('rating-exchange', 'agent-exchange-validator', 0.99, 500, 0.99, 0.99, 'agent-ledger-keeper'),
    ('rating-dns-001', 'agent-dns-001', 0.95, 100, 0.94, 0.96, 'agent-resolution-lead');

-- ============================================================================
-- CRYPTO OPERATIONS (Sample)
-- ============================================================================

INSERT OR IGNORE INTO crypto_operations (operation_id, agent_id, operation_type, input_data, output_data, signature, public_key_fingerprint, execution_time_ms, status, security_level) VALUES
    ('crypto-op-001', 'agent-quantum-001', 'ml_dsa_verify', X'AABBCCDD', X'VERIFIED', X'SIG001', 'fingerprint-001', 45, 'success', 'NIST-Level-3'),
    ('crypto-op-002', 'agent-quantum-001', 'ml_kem_encapsulate', X'EEFF0011', X'CIPHERTEXT001', X'SIG002', 'fingerprint-001', 52, 'success', 'NIST-Level-3'),
    ('crypto-op-003', 'agent-quantum-002', 'ml_dsa_verify', X'AABBCCDD', X'VERIFIED', X'SIG003', 'fingerprint-002', 43, 'success', 'NIST-Level-3'),
    ('crypto-op-004', 'agent-quantum-001', 'ml_dsa_sign', X'MESSAGE001', X'SIGNATURE001', X'SIG004', 'fingerprint-001', 48, 'success', 'NIST-Level-3'),
    ('crypto-op-005', 'agent-exchange-validator', 'blake3_hash', X'TRANSACTION001', X'HASH001', X'SIG005', 'fingerprint-exchange', 25, 'success', 'NIST-Level-3');

-- ============================================================================
-- QUANTUM FINGERPRINTS
-- ============================================================================

INSERT OR IGNORE INTO quantum_fingerprints (fingerprint_id, data_hash, fingerprint_value, operation_id, verified, verification_count, data_type) VALUES
    ('qfp-001', X'HASH001', X'FP001', 'crypto-op-001', TRUE, 10, 'transaction'),
    ('qfp-002', X'HASH002', X'FP002', 'crypto-op-002', TRUE, 8, 'message'),
    ('qfp-003', X'HASH003', X'FP003', 'crypto-op-003', TRUE, 9, 'transaction'),
    ('qfp-004', X'HASH004', X'FP004', 'crypto-op-004', TRUE, 12, 'state_snapshot'),
    ('qfp-005', X'HASH005', X'FP005', 'crypto-op-005', TRUE, 5, 'transaction');

-- ============================================================================
-- DAG VERTICES (Sample Blocks)
-- ============================================================================

INSERT OR IGNORE INTO dag_vertices (vertex_id, agent_id, vertex_hash, parents, payload, timestamp_ms, signature, merkle_proof) VALUES
    ('vertex-001', 'agent-quantum-001', X'DAG001', '[]', X'PAYLOAD001', 1700000000000, X'SIGNATURE001', X'MERKLE001'),
    ('vertex-002', 'agent-quantum-002', X'DAG002', '["vertex-001"]', X'PAYLOAD002', 1700000001000, X'SIGNATURE002', X'MERKLE002'),
    ('vertex-003', 'agent-worker-001', X'DAG003', '["vertex-001", "vertex-002"]', X'PAYLOAD003', 1700000002000, X'SIGNATURE003', X'MERKLE003'),
    ('vertex-004', 'agent-consensus-lead', X'DAG004', '["vertex-002", "vertex-003"]', X'PAYLOAD004', 1700000003000, X'SIGNATURE004', X'MERKLE004'),
    ('vertex-005', 'agent-quantum-001', X'DAG005', '["vertex-003", "vertex-004"]', X'PAYLOAD005', 1700000004000, X'SIGNATURE005', X'MERKLE005');

-- ============================================================================
-- DAG EDGES (Consensus Relationships)
-- ============================================================================

INSERT OR IGNORE INTO dag_edges (edge_id, source_vertex, target_vertex, consensus_votes, is_finalized, finality_round) VALUES
    ('edge-001', 'vertex-001', 'vertex-002', 8, TRUE, 1),
    ('edge-002', 'vertex-002', 'vertex-003', 8, TRUE, 1),
    ('edge-003', 'vertex-001', 'vertex-003', 7, TRUE, 1),
    ('edge-004', 'vertex-003', 'vertex-004', 9, TRUE, 2),
    ('edge-005', 'vertex-002', 'vertex-004', 8, TRUE, 2),
    ('edge-006', 'vertex-004', 'vertex-005', 8, FALSE, NULL);

-- ============================================================================
-- CONSENSUS ROUNDS
-- ============================================================================

INSERT OR IGNORE INTO consensus_rounds (round_id, round_number, participating_agents, vertices_processed, consensus_achieved, finality_timestamp_ms, state_root) VALUES
    ('round-001', 1, 8, 3, TRUE, 1700000005000, X'STATE001'),
    ('round-002', 2, 8, 4, TRUE, 1700000010000, X'STATE002'),
    ('round-003', 3, 9, 5, TRUE, 1700000015000, X'STATE003'),
    ('round-004', 4, 8, 3, TRUE, 1700000020000, X'STATE004'),
    ('round-005', 5, 7, 2, FALSE, NULL, NULL);

-- ============================================================================
-- TASKS
-- ============================================================================

INSERT OR IGNORE INTO tasks (task_id, agent_id, task_type, task_priority, payload_json, status, result_json, execution_time_ms, resource_cost_ruv) VALUES
    ('task-001', 'agent-worker-001', 'compute', 2, '{"operation": "hash", "data": "input"}', 'completed', '{"result": "hash_output"}', 150, 10),
    ('task-002', 'agent-worker-002', 'validate', 3, '{"operation": "validate", "data": "transaction"}', 'completed', '{"result": "valid"}', 200, 15),
    ('task-003', 'agent-worker-001', 'route', 1, '{"operation": "route", "destination": "node-x"}', 'in_progress', NULL, NULL, 5),
    ('task-004', 'agent-exchange-validator', 'exchange', 3, '{"operation": "verify_transfer", "amount": 1000}', 'completed', '{"result": "verified"}', 250, 20),
    ('task-005', 'agent-dns-001', 'resolve', 2, '{"operation": "resolve", "domain": "test.dark"}', 'completed', '{"result": "resolved"}', 180, 12);

-- ============================================================================
-- SWARM STATES
-- ============================================================================

INSERT OR IGNORE INTO swarm_states (swarm_id, swarm_type, agent_count, coordinator_agent_id, active_tasks, completed_tasks, failed_tasks, work_stealing_enabled, status) VALUES
    ('swarm-001', 'hierarchical', 8, 'agent-swarm-coordinator', 2, 45, 1, TRUE, 'running'),
    ('swarm-002', 'mesh', 6, 'agent-consensus-lead', 1, 32, 0, FALSE, 'running'),
    ('swarm-003', 'distributed', 5, 'agent-resolution-lead', 0, 28, 2, TRUE, 'idle');

-- ============================================================================
-- SWARM MEMBERS
-- ============================================================================

INSERT OR IGNORE INTO swarm_members (membership_id, swarm_id, agent_id, role, joined_at, active) VALUES
    ('member-001', 'swarm-001', 'agent-swarm-coordinator', 'coordinator', datetime('now', '-1 day'), TRUE),
    ('member-002', 'swarm-001', 'agent-worker-001', 'worker', datetime('now', '-1 day'), TRUE),
    ('member-003', 'swarm-001', 'agent-worker-002', 'worker', datetime('now', '-1 day'), TRUE),
    ('member-004', 'swarm-002', 'agent-consensus-lead', 'coordinator', datetime('now', '-2 days'), TRUE),
    ('member-005', 'swarm-002', 'agent-quantum-001', 'validator', datetime('now', '-2 days'), TRUE),
    ('member-006', 'swarm-002', 'agent-quantum-002', 'validator', datetime('now', '-2 days'), TRUE),
    ('member-007', 'swarm-003', 'agent-resolution-lead', 'coordinator', datetime('now', '-3 days'), TRUE),
    ('member-008', 'swarm-003', 'agent-dns-001', 'worker', datetime('now', '-3 days'), TRUE);

-- ============================================================================
-- RUV ACCOUNTS
-- ============================================================================

INSERT OR IGNORE INTO ruv_accounts (account_id, agent_id, balance_ruv, total_received, total_spent, verification_status, fee_tier) VALUES
    ('account-agent-001', 'agent-worker-001', 5000, 10000, 5000, 'verified', 0.0025),
    ('account-agent-002', 'agent-worker-002', 8500, 15000, 6500, 'verified', 0.0025),
    ('account-agent-003', 'agent-quantum-001', 12000, 20000, 8000, 'premium', 0.001),
    ('account-agent-004', 'agent-exchange-validator', 3000, 5000, 2000, 'unverified', 0.001),
    ('account-agent-005', 'agent-dns-001', 2500, 4000, 1500, 'verified', 0.0025);

-- ============================================================================
-- EXCHANGE TRANSACTIONS
-- ============================================================================

INSERT OR IGNORE INTO exchange_transactions (transaction_id, from_account_id, to_account_id, amount_ruv, fee_ruv, signature, status, block_height, executed_at) VALUES
    ('tx-001', 'account-agent-001', 'account-agent-002', 500, 2, X'TXSIG001', 'confirmed', 100, datetime('now', '-1 day')),
    ('tx-002', 'account-agent-003', 'account-agent-001', 1000, 1, X'TXSIG002', 'confirmed', 101, datetime('now', '-1 day')),
    ('tx-003', 'account-agent-002', 'account-agent-004', 200, 1, X'TXSIG003', 'confirmed', 102, datetime('now', '-12 hours')),
    ('tx-004', 'account-agent-001', 'account-agent-003', 300, 3, X'TXSIG004', 'pending', 103, datetime('now', '-6 hours')),
    ('tx-005', 'account-agent-005', 'account-agent-002', 150, 1, X'TXSIG005', 'confirmed', 104, datetime('now', '-2 hours'));

-- ============================================================================
-- PAYOUT DISTRIBUTIONS
-- ============================================================================

INSERT OR IGNORE INTO payout_distributions (payout_id, source_account_id, distribution_type, recipient_role, distributions_json, total_distributed_ruv, round_number, executed_at) VALUES
    ('payout-001', 'account-agent-001', 'business_plan_single', 'single_agent', '[{"recipient_id": "agent-worker-001", "amount_ruv": 95}]', 95, 1, datetime('now', '-1 day')),
    ('payout-002', 'account-agent-002', 'business_plan_plugin', 'plugin_creator', '[{"recipient_id": "plugin-001", "amount_ruv": 85}, {"recipient_id": "plugin-002", "amount_ruv": 10}]', 95, 1, datetime('now', '-1 day')),
    ('payout-003', 'account-agent-003', 'business_plan_node_ops', 'node_operator', '[{"recipient_id": "ops-001", "amount_ruv": 80}, {"recipient_id": "ops-002", "amount_ruv": 15}]', 95, 2, datetime('now', '-12 hours'));

-- ============================================================================
-- DARK DOMAINS
-- ============================================================================

INSERT OR IGNORE INTO dark_domains (domain_id, domain_name, agent_id, quantum_fingerprint, addresses_json, onion_routing_enabled, privacy_level, expires_at) VALUES
    ('domain-001', 'quantum-validator-1.dark', 'agent-quantum-001', X'QFPDOM001', '["192.168.1.1", "2001:db8::1"]', TRUE, 'private', NULL),
    ('domain-002', 'exchange-hub.dark', 'agent-exchange-validator', X'QFPDOM002', '["10.0.0.1"]', TRUE, 'public', NULL),
    ('domain-003', 'dns-cluster.dark', 'agent-dns-001', X'QFPDOM003', '["172.16.0.1"]', TRUE, 'anonymous', datetime('now', '+90 days')),
    ('domain-004', 'temp-worker.dark', 'agent-worker-001', X'QFPDOM004', '["192.168.100.1"]', FALSE, 'private', datetime('now', '+7 days'));

-- ============================================================================
-- NETWORK ROUTES
-- ============================================================================

INSERT OR IGNORE INTO network_routes (route_id, source_agent_id, destination_agent_id, route_type, hops, latency_ms, bandwidth_mbps, success_rate) VALUES
    ('route-001', 'agent-quantum-001', 'agent-quantum-002', 'direct', 1, 5, 1000, 0.99),
    ('route-002', 'agent-worker-001', 'agent-worker-002', 'direct', 1, 8, 900, 0.98),
    ('route-003', 'agent-worker-001', 'agent-dns-001', 'onion', 3, 45, 500, 0.95),
    ('route-004', 'agent-exchange-validator', 'agent-ledger-keeper', 'direct', 1, 3, 1000, 0.99),
    ('route-005', 'agent-consensus-lead', 'agent-quantum-001', 'direct', 1, 4, 950, 0.99);

-- ============================================================================
-- AGENT METRICS
-- ============================================================================

INSERT OR IGNORE INTO agent_metrics (metric_id, agent_id, metric_type, metric_value, unit, timestamp_ms) VALUES
    ('metric-001', 'agent-worker-001', 'cpu_usage', 45.5, 'percent', 1700000000000),
    ('metric-002', 'agent-worker-001', 'memory_usage', 512.3, 'megabytes', 1700000000000),
    ('metric-003', 'agent-quantum-001', 'task_throughput', 250.0, 'tasks_per_hour', 1700000000000),
    ('metric-004', 'agent-exchange-validator', 'error_rate', 0.1, 'percent', 1700000000000),
    ('metric-005', 'agent-consensus-lead', 'consensus_latency', 2500.0, 'milliseconds', 1700000000000);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

INSERT OR IGNORE INTO audit_log (audit_id, agent_id, action, resource_type, resource_id, details_json, authorized, timestamp_ms) VALUES
    ('audit-001', 'agent-quantum-001', 'ml_dsa_verify', 'transaction', 'tx-001', '{"result": "verified"}', TRUE, 1700000000000),
    ('audit-002', 'agent-exchange-validator', 'update_balance', 'account', 'account-agent-001', '{"delta_ruv": -500}', TRUE, 1700000001000),
    ('audit-003', 'agent-consensus-lead', 'finalize_consensus', 'dag_round', 'round-001', '{"quorum": 8, "result": "valid"}', TRUE, 1700000002000),
    ('audit-004', 'agent-dns-001', 'resolve_domain', 'dark_domain', 'domain-001', '{"result": "resolved"}', TRUE, 1700000003000),
    ('audit-005', 'agent-worker-001', 'execute_task', 'task', 'task-001', '{"result": "completed"}', TRUE, 1700000004000);

-- ============================================================================
-- WORKFLOW EXECUTIONS
-- ============================================================================

INSERT OR IGNORE INTO workflow_executions (workflow_id, workflow_type, workflow_name, participating_agents, started_at, completed_at, status, execution_time_ms, resource_consumption_ruv, success_status) VALUES
    ('wf-001', 'quantum_consensus', 'Quantum Consensus Round 1', '["agent-quantum-001", "agent-quantum-002", "agent-consensus-lead"]', datetime('now', '-1 day'), datetime('now', '-1 day', '+5 seconds'), 'completed', 5000, 30, TRUE),
    ('wf-002', 'task_distribution', 'Task Distribution Batch 1', '["agent-swarm-coordinator", "agent-worker-001", "agent-worker-002"]', datetime('now', '-12 hours'), datetime('now', '-12 hours', '+10 seconds'), 'completed', 10000, 50, TRUE),
    ('wf-003', 'exchange_settlement', 'Exchange Settlement Round 1', '["agent-exchange-validator", "agent-fee-coordinator", "agent-ledger-keeper"]', datetime('now', '-6 hours'), datetime('now', '-6 hours', '+3 seconds'), 'completed', 3000, 25, TRUE),
    ('wf-004', 'dark_domain_resolution', 'Dark Domain Lookup', '["agent-dns-001", "agent-resolution-lead"]', datetime('now', '-2 hours'), datetime('now', '-2 hours', '+2 seconds'), 'completed', 2000, 15, TRUE),
    ('wf-005', 'quantum_consensus', 'Quantum Consensus Round 2', '["agent-quantum-001", "agent-quantum-002", "agent-consensus-lead"]', datetime('now', '-1 hour'), datetime('now', '-1 hour', '+4 seconds'), 'completed', 4000, 28, TRUE);

-- ============================================================================
-- COMMIT SUMMARY
-- ============================================================================

-- Seed data successfully inserted:
-- - 11 agents (quantum validators, workers, coordinators, etc.)
-- - 6 agent ratings
-- - 5 crypto operations
-- - 5 quantum fingerprints
-- - 5 DAG vertices
-- - 6 DAG edges
-- - 5 consensus rounds
-- - 5 tasks
-- - 3 swarm states
-- - 8 swarm members
-- - 5 rUv accounts
-- - 5 exchange transactions
-- - 3 payout distributions
-- - 4 dark domains
-- - 5 network routes
-- - 5 agent metrics
-- - 5 audit log entries
-- - 5 workflow executions
