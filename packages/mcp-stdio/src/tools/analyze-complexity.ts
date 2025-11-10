import { AnalyzeComplexityInput } from '../types/schemas.js';
import { analyzeCircuitComplexity } from '../utils/helpers.js';

export async function analyzeComplexity(input: AnalyzeComplexityInput) {
  const quantum_metrics = analyzeCircuitComplexity(input.circuit);

  // Classical complexity
  const qubit_count = input.circuit.qubits;
  const state_space_size = Math.pow(2, qubit_count);
  const memory_bytes = state_space_size * 16; // Complex number = 16 bytes
  const simulation_time_ms = state_space_size * 0.001; // Rough estimate

  // DAG complexity
  const gate_count = input.circuit.gates.length;
  const expected_vertex_count = Math.ceil(gate_count / 2);
  const expected_dag_depth = Math.ceil(gate_count / qubit_count);
  const parallelization_factor = qubit_count > 1 ? Math.min(4, qubit_count) : 1;

  // Resource estimates
  const cpu_time_estimate_ms = simulation_time_ms * 1.2;
  const memory_estimate_mb = memory_bytes / (1024 * 1024);
  const network_bandwidth_estimate_kb = (expected_vertex_count * 1.5); // KB per vertex
  const dag_storage_estimate_bytes = expected_vertex_count * 2048; // 2KB per vertex

  // Generate recommendations
  const recommendations = [];
  if (qubit_count > 20) {
    recommendations.push('Consider using sparse simulation for circuits with >20 qubits');
  }
  if (quantum_metrics.two_qubit_gates > gate_count * 0.5) {
    recommendations.push('High entanglement detected; consider circuit optimization');
  }
  if (memory_estimate_mb > 1024) {
    recommendations.push('Circuit requires >1GB memory; consider distributed execution');
  }
  if (expected_dag_depth > 100) {
    recommendations.push('Deep DAG detected; enable parallel execution for better performance');
  }

  return {
    quantum_metrics: input.analysis.include_quantum_metrics !== false ? quantum_metrics : undefined,
    classical_metrics: input.analysis.include_classical_metrics !== false
      ? {
          simulation_complexity: `O(2^${qubit_count})`,
          memory_requirement_bytes: memory_bytes,
          estimated_simulation_time_ms: simulation_time_ms,
        }
      : undefined,
    dag_metrics: input.analysis.include_dag_metrics !== false
      ? {
          expected_vertex_count,
          expected_dag_depth,
          parallelization_factor,
          consensus_overhead: 0.05 + Math.random() * 0.05,
        }
      : undefined,
    resource_estimates: input.analysis.include_resource_estimates !== false
      ? {
          cpu_time_estimate_ms,
          memory_estimate_mb,
          network_bandwidth_estimate_kb,
          dag_storage_estimate_bytes,
        }
      : undefined,
    recommendations,
  };
}
