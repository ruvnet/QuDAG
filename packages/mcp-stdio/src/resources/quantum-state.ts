import { dagManager } from '../utils/dag-manager.js';

export function getQuantumStateResource(uri: string): any {
  // Parse URI: quantum://states/{execution_id}?format=json&include_metadata=true
  const match = uri.match(/quantum:\/\/states\/([^?]+)/);
  if (!match) {
    throw new Error(`Invalid quantum state URI: ${uri}`);
  }

  const execution_id = match[1];
  const url = new URL(uri.replace('quantum://', 'http://'));
  const format = url.searchParams.get('format') || 'json';
  const include_metadata = url.searchParams.get('include_metadata') !== 'false';

  const execution = dagManager.getExecution(execution_id);
  if (!execution) {
    throw new Error(`Execution not found: ${execution_id}`);
  }

  const resource: any = {
    uri,
    mimeType: format === 'json' ? 'application/json' : 'application/octet-stream',
    text: JSON.stringify({
      execution: include_metadata
        ? {
            execution_id: execution.execution_id,
            circuit_id: execution.circuit_id,
            status: execution.status,
            created_at: execution.created_at,
            completed_at: execution.completed_at,
            execution_time_ms: execution.results?.execution_time_ms,
          }
        : undefined,
      state: execution.status === 'completed' && execution.results
        ? {
            qubits: execution.circuit?.qubits,
            measurements: execution.results.measurements,
            probabilities: execution.results.probabilities,
          }
        : undefined,
      circuit: include_metadata && execution.circuit
        ? {
            qubits: execution.circuit.qubits,
            gate_count: execution.circuit.gates?.length,
            depth: execution.metrics?.depth,
          }
        : undefined,
      dag_info: include_metadata ? execution.dag_info : undefined,
      cache_control: {
        ttl_seconds: execution.status === 'completed' ? 3600 : 60,
        etag: `etag_${execution_id}_${execution.status}`,
        last_modified: execution.completed_at || execution.created_at,
      },
    }, null, 2),
  };

  return resource;
}

export function getQuantumCircuitResource(uri: string): any {
  // Parse URI: quantum://circuits/{circuit_id}
  const match = uri.match(/quantum:\/\/circuits\/([^?]+)/);
  if (!match) {
    throw new Error(`Invalid quantum circuit URI: ${uri}`);
  }

  const circuit_id = match[1];
  const circuit = dagManager.getCircuit(circuit_id);

  if (!circuit) {
    throw new Error(`Circuit not found: ${circuit_id}`);
  }

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(circuit, null, 2),
  };
}

export function getQuantumBenchmarkResource(uri: string): any {
  // Parse URI: quantum://benchmarks/{benchmark_id}
  const match = uri.match(/quantum:\/\/benchmarks\/([^?]+)/);
  if (!match) {
    throw new Error(`Invalid benchmark URI: ${uri}`);
  }

  const benchmark_id = match[1];
  const benchmark = dagManager.getBenchmark(benchmark_id);

  if (!benchmark) {
    throw new Error(`Benchmark not found: ${benchmark_id}`);
  }

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(benchmark, null, 2),
  };
}
