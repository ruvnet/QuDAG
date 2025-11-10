import { executeQuantumDag } from '../../src/tools/execute-quantum-dag';
import { dagManager } from '../../src/utils/dag-manager';

describe('executeQuantumDag', () => {
  beforeEach(() => {
    dagManager.clear();
  });

  it('should execute a simple quantum circuit', async () => {
    const input = {
      circuit: {
        qubits: 2,
        gates: [
          { type: 'H' as const, target: 0 },
          { type: 'CNOT' as const, target: [0, 1], control: 0 },
        ],
      },
    };

    const result = await executeQuantumDag(input);

    expect(result).toHaveProperty('execution_id');
    expect(result.status).toBe('completed');
    expect(result.results).toHaveProperty('measurements');
    expect(result.results).toHaveProperty('probabilities');
    expect(result.dag_info).toHaveProperty('vertex_id');
    expect(result.metrics).toHaveProperty('gate_count', 2);
  });

  it('should register execution in dag manager', async () => {
    const input = {
      circuit: {
        qubits: 1,
        gates: [{ type: 'H' as const, target: 0 }],
      },
    };

    const result = await executeQuantumDag(input);
    const execution = dagManager.getExecution(result.execution_id);

    expect(execution).toBeDefined();
    expect(execution?.status).toBe('completed');
  });

  it('should handle circuit with multiple qubits', async () => {
    const input = {
      circuit: {
        qubits: 4,
        gates: [
          { type: 'H' as const, target: 0 },
          { type: 'H' as const, target: 1 },
          { type: 'H' as const, target: 2 },
          { type: 'H' as const, target: 3 },
        ],
      },
      execution: {
        shots: 2000,
      },
    };

    const result = await executeQuantumDag(input);

    expect(result.status).toBe('completed');
    expect(result.results.measurements).toBeDefined();
    expect(Object.values(result.results.measurements).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(2000);
  });
});
