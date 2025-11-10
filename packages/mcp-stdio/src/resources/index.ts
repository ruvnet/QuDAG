export {
  getQuantumStateResource,
  getQuantumCircuitResource,
  getQuantumBenchmarkResource,
} from './quantum-state.js';

export {
  getDagVertexResource,
  getDagTipsResource,
  getDagStatisticsResource,
} from './dag-vertices.js';

export {
  getCryptoKeyResource,
  getCryptoAlgorithmsResource,
} from './crypto-keys.js';

export {
  getNetworkPeerResource,
  getNetworkTopologyResource,
} from './network-peers.js';

export {
  getSystemStatusResource,
} from './system-status.js';

/**
 * Route resource requests to appropriate handlers
 */
export function getResource(uri: string): any {
  if (uri.startsWith('quantum://states/')) {
    return getQuantumStateResource(uri);
  } else if (uri.startsWith('quantum://circuits/')) {
    return getQuantumCircuitResource(uri);
  } else if (uri.startsWith('quantum://benchmarks/')) {
    return getQuantumBenchmarkResource(uri);
  } else if (uri.startsWith('dag://vertices/')) {
    return getDagVertexResource(uri);
  } else if (uri.startsWith('dag://tips')) {
    return getDagTipsResource(uri);
  } else if (uri.startsWith('dag://statistics')) {
    return getDagStatisticsResource(uri);
  } else if (uri.startsWith('crypto://keys/')) {
    return getCryptoKeyResource(uri);
  } else if (uri.startsWith('crypto://algorithms')) {
    return getCryptoAlgorithmsResource(uri);
  } else if (uri.startsWith('network://peers/')) {
    return getNetworkPeerResource(uri);
  } else if (uri.startsWith('network://topology')) {
    return getNetworkTopologyResource(uri);
  } else if (uri.startsWith('system://status')) {
    return getSystemStatusResource(uri);
  } else {
    throw new Error(`Unknown resource URI: ${uri}`);
  }
}

/**
 * List all available resource templates
 */
export function listResourceTemplates() {
  return [
    {
      uriTemplate: 'quantum://states/{execution_id}',
      name: 'Quantum Execution State',
      description: 'Access quantum circuit execution state and results',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'quantum://circuits/{circuit_id}',
      name: 'Quantum Circuit Definition',
      description: 'Access quantum circuit definitions and metadata',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'quantum://benchmarks/{benchmark_id}',
      name: 'Quantum Benchmark Results',
      description: 'Access benchmark results and performance data',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'dag://vertices/{vertex_id}',
      name: 'DAG Vertex',
      description: 'Access individual DAG vertex data',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'dag://tips',
      name: 'DAG Tips',
      description: 'Access current DAG tips (vertices without children)',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'dag://statistics',
      name: 'DAG Statistics',
      description: 'Access DAG aggregate statistics and health metrics',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'crypto://keys/{key_id}',
      name: 'Cryptographic Key',
      description: 'Access public key information and metadata',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'crypto://algorithms',
      name: 'Cryptographic Algorithms',
      description: 'Information about supported cryptographic algorithms',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'network://peers/{peer_id}',
      name: 'Network Peer',
      description: 'Access peer information and connection status',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'network://topology',
      name: 'Network Topology',
      description: 'Access network topology and peer graph',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'system://status',
      name: 'System Status',
      description: 'Access overall system status and health',
      mimeType: 'application/json',
    },
  ];
}
