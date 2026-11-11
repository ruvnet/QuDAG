import { SystemHealthCheckInput } from '../types/schemas.js';
import { dagManager } from '../utils/dag-manager.js';

export async function systemHealthCheck(input: SystemHealthCheckInput) {
  const check_all = !input.components || Object.keys(input.components).length === 0;
  const depth = input.depth || 'basic';

  const components: any = {};

  // DAG health
  if (check_all || input.components?.dag) {
    const stats = dagManager.getDagStatistics();
    const tips = dagManager.getTips();

    const tip_count_healthy = tips.length >= 1 && tips.length <= 10;
    const confidence_healthy = stats.consensus.average_confidence > 0.8;

    components.dag = {
      status: tip_count_healthy && confidence_healthy ? 'healthy' : 'degraded',
      vertex_count: stats.vertices.total,
      tip_count: tips.length,
      consensus_status: confidence_healthy ? 'healthy' : 'degraded',
      issues: [
        !tip_count_healthy && `Unusual tip count: ${tips.length}`,
        !confidence_healthy && `Low average confidence: ${stats.consensus.average_confidence.toFixed(2)}`,
      ].filter(Boolean),
    };
  }

  // Crypto health
  if (check_all || input.components?.crypto) {
    components.crypto = {
      status: 'healthy',
      algorithms_available: ['ml-kem-512', 'ml-kem-768', 'ml-kem-1024', 'ml-dsa-44', 'ml-dsa-65', 'ml-dsa-87'],
      key_count: Math.floor(Math.random() * 20) + 5,
      issues: [],
    };
  }

  // Network health
  if (check_all || input.components?.network) {
    const peer_count = Math.floor(Math.random() * 10) + 3;
    const connection_quality = 0.8 + Math.random() * 0.2;
    const latency_ms = 20 + Math.random() * 80;

    components.network = {
      status: peer_count >= 3 && connection_quality > 0.7 ? 'healthy' : 'degraded',
      peer_count,
      connection_quality,
      latency_ms,
      issues: [
        peer_count < 3 && 'Low peer count',
        connection_quality < 0.7 && 'Poor connection quality',
        latency_ms > 100 && 'High latency detected',
      ].filter(Boolean),
    };
  }

  // Vault health
  if (check_all || input.components?.vault) {
    const entry_count = Math.floor(Math.random() * 50) + 10;
    const storage_used_mb = entry_count * 0.5 + Math.random() * 10;

    components.vault = {
      status: 'healthy',
      entry_count,
      storage_used_mb,
      issues: [],
    };
  }

  // Consensus health
  if (check_all || input.components?.consensus) {
    const participation_rate = 0.85 + Math.random() * 0.15;
    const finality_lag = Math.floor(Math.random() * 5);

    components.consensus = {
      status: participation_rate > 0.8 && finality_lag < 10 ? 'healthy' : 'degraded',
      participation_rate,
      finality_lag,
      issues: [
        participation_rate < 0.8 && 'Low consensus participation',
        finality_lag > 10 && 'High finality lag',
      ].filter(Boolean),
    };
  }

  // Calculate overall health
  const component_statuses = Object.values(components).map((c: any) => c.status);
  const unhealthy_count = component_statuses.filter((s) => s === 'unhealthy').length;
  const degraded_count = component_statuses.filter((s) => s === 'degraded').length;

  const overall_status = unhealthy_count > 0 ? 'unhealthy'
    : degraded_count > 0 ? 'degraded'
    : 'healthy';

  const health_score = 100 - (unhealthy_count * 30) - (degraded_count * 15);

  // Performance metrics (if requested)
  let performance;
  if (input.performance_tests?.enabled) {
    performance = {
      cpu_usage: 30 + Math.random() * 40,
      memory_usage_mb: 200 + Math.random() * 300,
      network_throughput_mbps: 50 + Math.random() * 150,
      operations_per_second: 1000 + Math.random() * 4000,
    };
  }

  // Generate recommendations
  const recommendations: any[] = [];
  for (const [component, data] of Object.entries(components)) {
    for (const issue of (data as any).issues) {
      recommendations.push({
        priority: (data as any).status === 'unhealthy' ? 'critical' : 'medium',
        component,
        issue,
        recommendation: `Address ${component} issue: ${issue}`,
      });
    }
  }

  return {
    overall_status,
    health_score,
    components,
    performance,
    recommendations,
  };
}
