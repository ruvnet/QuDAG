import { getQuantumStateResource } from '../../src/resources/quantum-state';
import { dagManager } from '../../src/utils/dag-manager';

describe('getQuantumStateResource', () => {
  beforeEach(() => {
    dagManager.clear();
  });

  it('should throw error for invalid URI', () => {
    expect(() => getQuantumStateResource('invalid://uri')).toThrow('Invalid quantum state URI');
  });

  it('should throw error for non-existent execution', () => {
    expect(() => getQuantumStateResource('quantum://states/nonexistent')).toThrow(
      'Execution not found'
    );
  });

  it('should return resource for existing execution', () => {
    // Register a mock execution
    dagManager.registerExecution({
      execution_id: 'test_exec',
      circuit_id: 'test_circuit',
      status: 'completed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      results: {
        measurements: { '00': 500, '11': 500 },
        probabilities: { '00': 0.5, '11': 0.5 },
        execution_time_ms: 100,
      },
      circuit: {
        qubits: 2,
        gates: [],
      },
    });

    const resource = getQuantumStateResource('quantum://states/test_exec');

    expect(resource).toHaveProperty('uri');
    expect(resource).toHaveProperty('mimeType', 'application/json');
    expect(resource).toHaveProperty('text');

    const parsed = JSON.parse(resource.text);
    expect(parsed.execution).toBeDefined();
    expect(parsed.state).toBeDefined();
    expect(parsed.state.measurements).toEqual({ '00': 500, '11': 500 });
  });

  it('should respect include_metadata parameter', () => {
    dagManager.registerExecution({
      execution_id: 'test_exec_2',
      circuit_id: 'test_circuit_2',
      status: 'completed',
      created_at: new Date().toISOString(),
      results: {
        measurements: { '0': 1000 },
        probabilities: { '0': 1.0 },
        execution_time_ms: 50,
      },
    });

    const resource = getQuantumStateResource('quantum://states/test_exec_2?include_metadata=false');
    const parsed = JSON.parse(resource.text);

    expect(parsed.execution).toBeUndefined();
    expect(parsed.circuit).toBeUndefined();
  });
});
