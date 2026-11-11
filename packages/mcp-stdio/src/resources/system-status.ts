import { getCurrentTimestamp } from '../utils/helpers.js';
import { dagManager } from '../utils/dag-manager.js';

const startTime = Date.now();

export function getSystemStatusResource(uri: string): any {
  const uptime_seconds = Math.floor((Date.now() - startTime) / 1000);
  const stats = dagManager.getDagStatistics();

  // Mock component statuses
  const components = {
    dag: 'healthy' as const,
    crypto: 'healthy' as const,
    network: 'healthy' as const,
    vault: 'healthy' as const,
    consensus: 'healthy' as const,
  };

  // Calculate overall health
  const issues: string[] = [];
  const warnings: string[] = [];

  if (stats.vertices.total === 0) {
    warnings.push('No DAG vertices yet');
  }

  const health_score = issues.length === 0 && warnings.length === 0 ? 100 : 90;
  const overall_status = issues.length > 0 ? 'unhealthy' : warnings.length > 0 ? 'degraded' : 'healthy';

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify({
      system: {
        version: '0.1.0',
        protocol_version: '2025-03-26',
        node_id: 'qudag_node_local',
        started_at: new Date(startTime).toISOString(),
        uptime_seconds,
      },
      components,
      resources: {
        cpu_percent: 20 + Math.random() * 30,
        memory_mb: 200 + Math.random() * 300,
        memory_percent: 10 + Math.random() * 20,
        disk_mb: stats.vertices.total * 2 + Math.random() * 100,
        disk_percent: 5 + Math.random() * 10,
      },
      performance: {
        operations_per_second: 1000 + Math.random() * 4000,
        average_latency_ms: 5 + Math.random() * 20,
        p95_latency_ms: 20 + Math.random() * 80,
      },
      health: {
        status: overall_status,
        score: health_score,
        issues,
        warnings,
      },
    }, null, 2),
  };
}
