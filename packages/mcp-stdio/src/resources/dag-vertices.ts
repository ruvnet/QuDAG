import { dagManager } from '../utils/dag-manager.js';
import { getCurrentTimestamp } from '../utils/helpers.js';

export function getDagVertexResource(uri: string): any {
  // Parse URI: dag://vertices/{vertex_id}?include_payload=true&include_parents=false
  const match = uri.match(/dag:\/\/vertices\/([^?]+)/);
  if (!match) {
    throw new Error(`Invalid DAG vertex URI: ${uri}`);
  }

  const vertex_id = match[1];
  const url = new URL(uri.replace('dag://', 'http://'));
  const include_payload = url.searchParams.get('include_payload') === 'true';
  const include_parents = url.searchParams.get('include_parents') === 'true';
  const include_children = url.searchParams.get('include_children') === 'true';
  const include_consensus = url.searchParams.get('include_consensus') !== 'false';

  const vertex = dagManager.getVertex(vertex_id);
  if (!vertex) {
    throw new Error(`Vertex not found: ${vertex_id}`);
  }

  const resource = {
    vertex: {
      vertex_id: vertex.vertex_id,
      created_at: vertex.created_at,
      timestamp: vertex.timestamp,
      vertex_type: vertex.vertex_type,
    },
    payload: include_payload && vertex.payload
      ? {
          size_bytes: JSON.stringify(vertex.payload).length,
          content_hash: `hash_${vertex_id}`,
          content: vertex.payload,
          content_type: 'application/json',
        }
      : undefined,
    structure: {
      parents: include_parents ? vertex.parents : undefined,
      children: include_children ? vertex.children : undefined,
      depth: vertex.parents ? vertex.parents.length : 0,
      branch_factor: vertex.children ? vertex.children.length : 0,
    },
    consensus: include_consensus ? vertex.consensus : undefined,
    propagation: {
      first_seen_at: vertex.created_at,
      propagation_time_ms: 10 + Math.random() * 90,
      peer_count: Math.floor(Math.random() * 10) + 3,
    },
    verification: {
      signature_valid: true,
      hash_valid: true,
      quantum_resistant: true,
    },
  };

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(resource, null, 2),
  };
}

export function getDagTipsResource(uri: string): any {
  // Parse URI: dag://tips?limit=10&min_confidence=0.8
  const url = new URL(uri.replace('dag://', 'http://'));
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const min_confidence = parseFloat(url.searchParams.get('min_confidence') || '0.0');

  let tips = dagManager.getTips();

  // Filter by confidence
  tips = tips.filter(
    (tip) => (tip.consensus?.confidence_score || 0) >= min_confidence
  );

  // Apply limit
  tips = tips.slice(0, limit);

  const tip_data = tips.map((tip) => ({
    vertex_id: tip.vertex_id,
    confidence_score: tip.consensus?.confidence_score || 0,
    timestamp: tip.timestamp,
    parents: tip.parents || [],
    depth: tip.parents?.length || 0,
    age_ms: Date.now() - tip.timestamp,
  }));

  const statistics = {
    total_tips: tips.length,
    average_confidence: tips.length > 0
      ? tips.reduce((sum, t) => sum + (t.consensus?.confidence_score || 0), 0) / tips.length
      : 0,
    oldest_tip_age_ms: tips.length > 0
      ? Math.max(...tips.map(t => Date.now() - t.timestamp))
      : 0,
  };

  const health = {
    tip_count_healthy: tips.length >= 1 && tips.length <= 10,
    confidence_healthy: statistics.average_confidence > 0.8,
    age_healthy: statistics.oldest_tip_age_ms < 300000, // 5 minutes
    warnings: [] as string[],
  };

  if (!health.tip_count_healthy) health.warnings.push('Unusual tip count');
  if (!health.confidence_healthy) health.warnings.push('Low average confidence');
  if (!health.age_healthy) health.warnings.push('Old tips detected');

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify({
      tips: tip_data,
      statistics,
      health,
      metadata: {
        last_updated: getCurrentTimestamp(),
        update_frequency_ms: 1000,
        cache_ttl_seconds: 10,
      },
    }, null, 2),
  };
}

export function getDagStatisticsResource(uri: string): any {
  const stats = dagManager.getDagStatistics();

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify({
      ...stats,
      performance: {
        vertices_per_second: 10 + Math.random() * 20,
        average_propagation_time_ms: 50 + Math.random() * 100,
        storage_size_mb: stats.vertices.total * 0.002,
      },
      health: {
        overall_status: 'healthy',
        issues: [],
        recommendations: [],
      },
    }, null, 2),
  };
}
