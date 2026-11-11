import { BenchmarkPerformanceInput } from '../types/schemas.js';
import { calculatePercentiles, generateId } from '../utils/helpers.js';
import { dagManager } from '../utils/dag-manager.js';

export async function benchmarkPerformance(input: BenchmarkPerformanceInput) {
  const benchmark_id = generateId('bench');
  const circuit_id = generateId('circ');

  const iterations = input.benchmark.iterations || 100;
  const warmup_iterations = input.benchmark.warmup_iterations || 10;
  const backends = input.benchmark.backends || ['simulator'];

  const execution_times: number[] = [];
  let successful_executions = 0;
  let failed_executions = 0;

  const start_time = Date.now();

  // Warmup phase
  for (let i = 0; i < warmup_iterations; i++) {
    await simulateExecution(input.circuit);
  }

  // Benchmark phase
  for (let i = 0; i < iterations; i++) {
    try {
      const exec_time = await simulateExecution(input.circuit);
      execution_times.push(exec_time);
      successful_executions++;
    } catch (error) {
      failed_executions++;
    }
  }

  const total_time_ms = Date.now() - start_time;
  const percentiles = calculatePercentiles(execution_times);

  // Mock resource utilization
  const resources = {
    cpu_utilization_percent: 60 + Math.random() * 30,
    memory_usage_mb: 100 + Math.random() * 500,
    network_bandwidth_mbps: 10 + Math.random() * 90,
  };

  // Mock DAG performance metrics
  const dag_performance = {
    consensus_time_ms: 5 + Math.random() * 20,
    propagation_time_ms: 10 + Math.random() * 40,
    finalization_time_ms: 50 + Math.random() * 150,
  };

  // Backend comparison (if multiple backends)
  const backend_comparison: Record<string, any> = {};
  for (const backend of backends) {
    backend_comparison[backend] = {
      execution_time_ms: percentiles.mean * (backend === 'simulator' ? 1 : 0.8),
      throughput_ops_per_sec: (1000 / percentiles.mean) * (backend === 'simulator' ? 1 : 1.2),
    };
  }

  // Store benchmark results
  dagManager.registerBenchmark(benchmark_id, {
    benchmark_id,
    circuit_id,
    created_at: new Date().toISOString(),
    configuration: {
      iterations,
      backends,
      shot_count: 1000,
    },
    results: {
      execution_stats: {
        mean_time_ms: percentiles.mean,
        median_time_ms: percentiles.median,
        p95_time_ms: percentiles.p95,
        p99_time_ms: percentiles.p99,
      },
    },
  });

  return {
    execution_stats: {
      total_executions: iterations,
      successful_executions,
      failed_executions,
      total_time_ms,
    },
    performance: {
      mean_execution_time_ms: percentiles.mean,
      median_execution_time_ms: percentiles.median,
      p95_execution_time_ms: percentiles.p95,
      p99_execution_time_ms: percentiles.p99,
      throughput_ops_per_sec: 1000 / percentiles.mean,
    },
    resources: input.benchmark.parallel_executions ? resources : undefined,
    dag_performance: input.metrics?.dag_consensus_time !== false ? dag_performance : undefined,
    backend_comparison: backends.length > 1 ? backend_comparison : undefined,
  };
}

async function simulateExecution(circuit: any): Promise<number> {
  // Simulate circuit execution time based on complexity
  const base_time = 10;
  const per_gate_time = 0.5;
  const per_qubit_time = 2;

  const execution_time = base_time +
    (circuit.gates.length * per_gate_time) +
    (circuit.qubits * per_qubit_time) +
    (Math.random() * 10);

  // Simulate async execution
  await new Promise(resolve => setTimeout(resolve, 1));

  return execution_time;
}
