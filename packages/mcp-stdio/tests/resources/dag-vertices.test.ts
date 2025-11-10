import { getDagVertexResource, getDagTipsResource } from '../../src/resources/dag-vertices';
import { dagManager } from '../../src/utils/dag-manager';

describe('getDagVertexResource', () => {
  beforeEach(() => {
    dagManager.clear();
  });

  it('should throw error for invalid URI', () => {
    expect(() => getDagVertexResource('invalid://uri')).toThrow('Invalid DAG vertex URI');
  });

  it('should throw error for non-existent vertex', () => {
    expect(() => getDagVertexResource('dag://vertices/nonexistent')).toThrow('Vertex not found');
  });

  it('should return resource for existing vertex', () => {
    dagManager.registerVertex({
      vertex_id: 'test_vtx',
      created_at: new Date().toISOString(),
      timestamp: Date.now(),
      vertex_type: 'quantum',
      payload: { test: 'data' },
      parents: [],
      consensus: {
        status: 'accepted',
        confidence_score: 0.95,
        voting_rounds: 1,
      },
    });

    const resource = getDagVertexResource('dag://vertices/test_vtx');
    const parsed = JSON.parse(resource.text);

    expect(parsed.vertex).toBeDefined();
    expect(parsed.vertex.vertex_id).toBe('test_vtx');
    expect(parsed.consensus).toBeDefined();
  });
});

describe('getDagTipsResource', () => {
  beforeEach(() => {
    dagManager.clear();
  });

  it('should return empty tips for empty DAG', () => {
    const resource = getDagTipsResource('dag://tips');
    const parsed = JSON.parse(resource.text);

    expect(parsed.tips).toEqual([]);
    expect(parsed.statistics.total_tips).toBe(0);
  });

  it('should return tips', () => {
    dagManager.registerVertex({
      vertex_id: 'vtx_1',
      created_at: new Date().toISOString(),
      timestamp: Date.now(),
      vertex_type: 'quantum',
      parents: [],
      consensus: {
        status: 'accepted',
        confidence_score: 0.9,
        voting_rounds: 1,
      },
    });

    const resource = getDagTipsResource('dag://tips');
    const parsed = JSON.parse(resource.text);

    expect(parsed.tips).toHaveLength(1);
    expect(parsed.tips[0].vertex_id).toBe('vtx_1');
  });
});
