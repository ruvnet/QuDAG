/**
 * AgenticDB Client for QuDAG
 * TypeScript client for recording and querying agent execution history
 * Supports quantum operations, tasks, consensus, exchange, and monitoring data
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Type definitions for agent operations
export interface Agent {
  agentId: string;
  agentName: string;
  agentType: string;
  mcpEndpoint?: string;
  mlkemPublicKey: Buffer;
  mldsaPublicKey: Buffer;
  capabilities: string[];
  dockerImage?: string;
  registryUri?: string;
  status: 'active' | 'inactive' | 'suspended';
  version?: string;
}

export interface CryptoOperation {
  operationId: string;
  agentId: string;
  operationType: string;
  inputData?: Buffer;
  outputData?: Buffer;
  signature?: Buffer;
  publicKeyFingerprint?: string;
  executionTimeMs: number;
  status: 'success' | 'failure' | 'timeout';
  errorMessage?: string;
  securityLevel?: string;
}

export interface Task {
  taskId: string;
  agentId: string;
  taskType: string;
  taskPriority: number;
  payloadJson: string;
  status: 'pending' | 'assigned' | 'executing' | 'completed' | 'failed';
  resultJson?: string;
  executionTimeMs?: number;
  resourceCostRuv?: number;
  completedAt?: Date;
}

export interface ExchangeTransaction {
  transactionId: string;
  fromAccountId: string;
  toAccountId: string;
  amountRuv: number;
  feeRuv: number;
  signature: Buffer;
  status: 'pending' | 'confirmed' | 'failed';
  blockHeight?: number;
  merkleProof?: Buffer;
  executedAt: Date;
}

export interface ConsensusRound {
  roundId: string;
  roundNumber: number;
  participatingAgents: number;
  verticesProcessed: number;
  consensusAchieved: boolean;
  finalityTimestampMs?: number;
  stateRoot?: Buffer;
}

export interface QuantumFingerprint {
  fingerprintId: string;
  dataHash: Buffer;
  fingerprintValue: Buffer;
  operationId?: string;
  verified: boolean;
  verificationCount: number;
  dataType?: string;
}

export interface WorkflowExecution {
  workflowId: string;
  workflowType: string;
  workflowName?: string;
  participatingAgents: string[];
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  executionTimeMs?: number;
  resourceConsumptionRuv?: number;
  successStatus?: boolean;
}

export interface ClaudeFlowTask {
  taskId: string;
  taskName: string;
  taskTitle: string;
  assignedAgent: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  priority?: string;
  objective?: string;
  executionSteps?: number;
  stepsCompleted?: number;
  successCriteriaMet?: boolean;
  outputsJson?: string;
  findingsSummary?: string;
}

/**
 * AgenticDB Client - Main class for database operations
 */
export class AgenticDBClient {
  private db: sqlite3.Database;
  private isInitialized: boolean = false;

  constructor(dbPath: string = ':memory:') {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      }
    });
  }

  /**
   * Initialize database connection and run setup queries
   */
  public async initialize(schemaPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const schema = fs.readFileSync(schemaPath, 'utf-8');

      this.db.exec(schema, (err) => {
        if (err) {
          reject(err);
        } else {
          this.isInitialized = true;
          resolve();
        }
      });
    });
  }

  /**
   * Record a crypto operation to the database
   */
  public async recordCryptoOperation(operation: CryptoOperation): Promise<void> {
    const query = `
      INSERT INTO crypto_operations (
        operation_id, agent_id, operation_type, input_data, output_data,
        signature, public_key_fingerprint, execution_time_ms, status,
        error_message, security_level, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return this.runAsync(query, [
      operation.operationId,
      operation.agentId,
      operation.operationType,
      operation.inputData,
      operation.outputData,
      operation.signature,
      operation.publicKeyFingerprint,
      operation.executionTimeMs,
      operation.status,
      operation.errorMessage,
      operation.securityLevel,
    ]);
  }

  /**
   * Record a task execution
   */
  public async recordTask(task: Task): Promise<void> {
    const query = `
      INSERT INTO tasks (
        task_id, agent_id, task_type, task_priority, payload_json,
        status, result_json, execution_time_ms, resource_cost_ruv,
        completed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return this.runAsync(query, [
      task.taskId,
      task.agentId,
      task.taskType,
      task.taskPriority,
      task.payloadJson,
      task.status,
      task.resultJson,
      task.executionTimeMs,
      task.resourceCostRuv,
      task.completedAt,
    ]);
  }

  /**
   * Record an exchange transaction
   */
  public async recordExchangeTransaction(
    transaction: ExchangeTransaction
  ): Promise<void> {
    const query = `
      INSERT INTO exchange_transactions (
        transaction_id, from_account_id, to_account_id, amount_ruv, fee_ruv,
        signature, status, block_height, merkle_proof, executed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return this.runAsync(query, [
      transaction.transactionId,
      transaction.fromAccountId,
      transaction.toAccountId,
      transaction.amountRuv,
      transaction.feeRuv,
      transaction.signature,
      transaction.status,
      transaction.blockHeight,
      transaction.merkleProof,
      transaction.executedAt,
    ]);
  }

  /**
   * Record a consensus round
   */
  public async recordConsensusRound(round: ConsensusRound): Promise<void> {
    const query = `
      INSERT INTO consensus_rounds (
        round_id, round_number, participating_agents, vertices_processed,
        consensus_achieved, finality_timestamp_ms, state_root, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return this.runAsync(query, [
      round.roundId,
      round.roundNumber,
      round.participatingAgents,
      round.verticesProcessed,
      round.consensusAchieved,
      round.finalityTimestampMs,
      round.stateRoot,
    ]);
  }

  /**
   * Record a quantum fingerprint
   */
  public async recordQuantumFingerprint(fp: QuantumFingerprint): Promise<void> {
    const query = `
      INSERT INTO quantum_fingerprints (
        fingerprint_id, data_hash, fingerprint_value, operation_id,
        verified, verification_count, data_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return this.runAsync(query, [
      fp.fingerprintId,
      fp.dataHash,
      fp.fingerprintValue,
      fp.operationId,
      fp.verified,
      fp.verificationCount,
      fp.dataType,
    ]);
  }

  /**
   * Record a workflow execution
   */
  public async recordWorkflowExecution(
    execution: WorkflowExecution
  ): Promise<void> {
    const query = `
      INSERT INTO workflow_executions (
        workflow_id, workflow_type, workflow_name, participating_agents,
        started_at, completed_at, status, execution_time_ms,
        resource_consumption_ruv, success_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    return this.runAsync(query, [
      execution.workflowId,
      execution.workflowType,
      execution.workflowName,
      JSON.stringify(execution.participatingAgents),
      execution.startedAt,
      execution.completedAt,
      execution.status,
      execution.executionTimeMs,
      execution.resourceConsumptionRuv,
      execution.successStatus,
    ]);
  }

  /**
   * Record a claude-flow task
   */
  public async recordClaudeFlowTask(task: ClaudeFlowTask): Promise<void> {
    const query = `
      INSERT INTO claude_flow_tasks (
        task_id, task_name, task_title, assigned_agent, created_at,
        started_at, completed_at, status, priority, objective,
        execution_steps, steps_completed, success_criteria_met,
        outputs_json, findings_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return this.runAsync(query, [
      task.taskId,
      task.taskName,
      task.taskTitle,
      task.assignedAgent,
      task.createdAt,
      task.startedAt,
      task.completedAt,
      task.status,
      task.priority,
      task.objective,
      task.executionSteps,
      task.stepsCompleted,
      task.successCriteriaMet,
      task.outputsJson,
      task.findingsSummary,
    ]);
  }

  /**
   * Query agent performance metrics
   */
  public async getAgentPerformance(
    agentId: string
  ): Promise<Record<string, any>> {
    const query = `
      SELECT
        a.agent_id,
        a.agent_name,
        COUNT(DISTINCT t.task_id) as total_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
        AVG(CAST(t.execution_time_ms AS FLOAT)) as avg_task_time_ms,
        SUM(t.resource_cost_ruv) as total_resources_used
      FROM agents a
      LEFT JOIN tasks t ON a.agent_id = t.agent_id
      WHERE a.agent_id = ?
      GROUP BY a.agent_id, a.agent_name
    `;

    return this.getAsync(query, [agentId]);
  }

  /**
   * Query consensus efficiency metrics
   */
  public async getConsensusEfficiency(
    hours: number = 24
  ): Promise<Record<string, any>[]> {
    const query = `
      SELECT
        cr.round_number,
        COUNT(DISTINCT dv.agent_id) as participating_agents,
        COUNT(DISTINCT dv.vertex_id) as vertices_processed,
        AVG(CAST((cr.finality_timestamp_ms - CAST(strftime('%s', cr.created_at) AS INTEGER) * 1000) AS FLOAT)) as avg_consensus_time_ms,
        SUM(CASE WHEN cr.consensus_achieved THEN 1 ELSE 0 END) as successful_rounds
      FROM consensus_rounds cr
      LEFT JOIN dag_vertices dv ON dv.created_at BETWEEN cr.created_at AND datetime((cr.finality_timestamp_ms/1000), 'unixepoch')
      WHERE cr.created_at >= datetime('now', ? || ' hours')
      GROUP BY cr.round_number
      ORDER BY cr.round_number DESC
    `;

    return this.allAsync(query, [-hours]);
  }

  /**
   * Query exchange transaction volume and fees
   */
  public async getExchangeAnalysis(
    days: number = 7
  ): Promise<Record<string, any>[]> {
    const query = `
      SELECT
        DATE(et.created_at) as date,
        COUNT(et.transaction_id) as transaction_count,
        SUM(et.amount_ruv) as total_volume_ruv,
        SUM(et.fee_ruv) as total_fees_ruv,
        AVG(CAST(et.fee_ruv AS FLOAT) * 100.0 / NULLIF(et.amount_ruv, 0)) as avg_fee_percent
      FROM exchange_transactions et
      WHERE et.status = 'confirmed'
      AND et.created_at >= datetime('now', ? || ' days')
      GROUP BY DATE(et.created_at)
      ORDER BY date DESC
    `;

    return this.allAsync(query, [-days]);
  }

  /**
   * Query task execution patterns
   */
  public async getTaskPatterns(
    hours: number = 24
  ): Promise<Record<string, any>[]> {
    const query = `
      SELECT
        t.task_type,
        COUNT(t.task_id) as total_tasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
        ROUND(100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(t.task_id), 0), 2) as success_rate_percent,
        AVG(CAST(t.execution_time_ms AS FLOAT)) as avg_execution_ms
      FROM tasks t
      WHERE t.created_at >= datetime('now', ? || ' hours')
      GROUP BY t.task_type
      ORDER BY total_tasks DESC
    `;

    return this.allAsync(query, [-hours]);
  }

  /**
   * Query workflow execution summary
   */
  public async getWorkflowSummary(
    workflowType?: string
  ): Promise<Record<string, any>[]> {
    const query = workflowType
      ? `
        SELECT
          workflow_type,
          COUNT(*) as execution_count,
          AVG(CAST(execution_time_ms AS FLOAT)) as avg_time_ms,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM workflow_executions
        WHERE workflow_type = ?
        GROUP BY workflow_type
      `
      : `
        SELECT
          workflow_type,
          COUNT(*) as execution_count,
          AVG(CAST(execution_time_ms AS FLOAT)) as avg_time_ms,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM workflow_executions
        GROUP BY workflow_type
      `;

    return workflowType
      ? this.allAsync(query, [workflowType])
      : this.allAsync(query, []);
  }

  /**
   * Get agent execution timeline
   */
  public async getAgentTimeline(agentId: string): Promise<Record<string, any>[]> {
    const query = `
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
      LIMIT 50
    `;

    return this.allAsync(query, [agentId]);
  }

  /**
   * Close database connection
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Helper methods for database operations
  private runAsync(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private getAsync(
    sql: string,
    params: any[] = []
  ): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  private allAsync(
    sql: string,
    params: any[] = []
  ): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
}

export default AgenticDBClient;
