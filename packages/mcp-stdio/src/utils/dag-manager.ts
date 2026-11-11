/**
 * DAG Manager
 *
 * Manages global DAG state and execution registry for resource access.
 * Provides centralized storage for quantum execution results and DAG vertices.
 */

interface ExecutionState {
  execution_id: string;
  circuit_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  results?: any;
  circuit?: any;
  dag_info?: any;
  metrics?: any;
}

interface DagVertex {
  vertex_id: string;
  created_at: string;
  timestamp: number;
  vertex_type: string;
  payload?: any;
  parents?: string[];
  children?: string[];
  consensus?: any;
}

class DagManager {
  private executions: Map<string, ExecutionState> = new Map();
  private vertices: Map<string, DagVertex> = new Map();
  private circuits: Map<string, any> = new Map();
  private benchmarks: Map<string, any> = new Map();

  // Execution management
  registerExecution(execution: ExecutionState): void {
    this.executions.set(execution.execution_id, execution);
  }

  getExecution(execution_id: string): ExecutionState | undefined {
    return this.executions.get(execution_id);
  }

  updateExecution(execution_id: string, updates: Partial<ExecutionState>): void {
    const existing = this.executions.get(execution_id);
    if (existing) {
      this.executions.set(execution_id, { ...existing, ...updates });
    }
  }

  listExecutions(): ExecutionState[] {
    return Array.from(this.executions.values());
  }

  // Circuit management
  registerCircuit(circuit_id: string, circuit: any): void {
    this.circuits.set(circuit_id, {
      circuit_id,
      ...circuit,
      created_at: new Date().toISOString(),
      version: 1,
    });
  }

  getCircuit(circuit_id: string): any | undefined {
    return this.circuits.get(circuit_id);
  }

  listCircuits(): any[] {
    return Array.from(this.circuits.values());
  }

  // Vertex management
  registerVertex(vertex: DagVertex): void {
    this.vertices.set(vertex.vertex_id, vertex);

    // Update children references
    if (vertex.parents) {
      for (const parent_id of vertex.parents) {
        const parent = this.vertices.get(parent_id);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          if (!parent.children.includes(vertex.vertex_id)) {
            parent.children.push(vertex.vertex_id);
          }
        }
      }
    }
  }

  getVertex(vertex_id: string): DagVertex | undefined {
    return this.vertices.get(vertex_id);
  }

  listVertices(): DagVertex[] {
    return Array.from(this.vertices.values());
  }

  getTips(): DagVertex[] {
    return Array.from(this.vertices.values()).filter(
      (v) => !v.children || v.children.length === 0
    );
  }

  getDagStatistics() {
    const vertices = this.listVertices();
    const tips = this.getTips();

    const verticesByType = vertices.reduce((acc, v) => {
      acc[v.vertex_type] = (acc[v.vertex_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const verticesByStatus = vertices.reduce((acc, v) => {
      const status = v.consensus?.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      vertices: {
        total: vertices.length,
        pending: verticesByStatus.pending || 0,
        accepted: verticesByStatus.accepted || 0,
        finalized: verticesByStatus.finalized || 0,
        by_type: verticesByType,
      },
      graph: {
        tip_count: tips.length,
        average_branch_factor: vertices.length > 0
          ? vertices.reduce((sum, v) => sum + (v.children?.length || 0), 0) / vertices.length
          : 0,
      },
      consensus: {
        average_confidence: vertices.length > 0
          ? vertices.reduce((sum, v) => sum + (v.consensus?.confidence_score || 0), 0) / vertices.length
          : 0,
      },
    };
  }

  // Benchmark management
  registerBenchmark(benchmark_id: string, benchmark: any): void {
    this.benchmarks.set(benchmark_id, benchmark);
  }

  getBenchmark(benchmark_id: string): any | undefined {
    return this.benchmarks.get(benchmark_id);
  }

  // Utility methods
  generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  clear(): void {
    this.executions.clear();
    this.vertices.clear();
    this.circuits.clear();
    this.benchmarks.clear();
  }
}

// Global singleton instance
export const dagManager = new DagManager();
