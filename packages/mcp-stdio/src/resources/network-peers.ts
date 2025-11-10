import { getCurrentTimestamp } from '../utils/helpers.js';

// Mock peer storage
const mockPeers = new Map<string, any>();

function ensureMockPeer(peer_id: string) {
  if (!mockPeers.has(peer_id)) {
    mockPeers.set(peer_id, {
      peer_id,
      multiaddr: [`/ip4/10.0.1.${Math.floor(Math.random() * 255)}/tcp/8080/p2p/${peer_id}`],
      public_key: `mock_pubkey_${peer_id}`,
      reputation: 0.7 + Math.random() * 0.3,
      connected_since: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    });
  }
  return mockPeers.get(peer_id);
}

export function getNetworkPeerResource(uri: string): any {
  // Parse URI: network://peers/{peer_id}
  const match = uri.match(/network:\/\/peers\/([^?]+)/);
  if (!match) {
    throw new Error(`Invalid network peer URI: ${uri}`);
  }

  const peer_id = match[1];
  const peer = ensureMockPeer(peer_id);

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify({
      peer: {
        peer_id: peer.peer_id,
        multiaddr: peer.multiaddr,
        public_key: peer.public_key,
        reputation: peer.reputation,
      },
      connection: {
        status: 'connected',
        since: peer.connected_since,
        quantum_channel: Math.random() > 0.5,
        encrypted: true,
      },
      capabilities: {
        protocols: ['/qudag/1.0.0', '/libp2p/circuit/relay/0.2.0'],
        features: ['quantum-crypto', 'dag-consensus', 'dark-addressing'],
        version: '0.1.0',
      },
      performance: {
        latency_ms: 20 + Math.random() * 80,
        bandwidth_mbps: 50 + Math.random() * 150,
        success_rate: 0.95 + Math.random() * 0.05,
        error_rate: Math.random() * 0.05,
      },
      activity: {
        messages_sent: Math.floor(Math.random() * 1000),
        messages_received: Math.floor(Math.random() * 1000),
        last_message: getCurrentTimestamp(),
      },
    }, null, 2),
  };
}

export function getNetworkTopologyResource(uri: string): any {
  // Parse URI: network://topology?depth=2
  const url = new URL(uri.replace('network://', 'http://'));
  const depth = parseInt(url.searchParams.get('depth') || '2');

  // Generate mock topology
  const peer_count = 5 + Math.floor(Math.random() * 10);
  const peers = [];

  for (let i = 0; i < peer_count; i++) {
    const peer_id = `peer_${i}`;
    ensureMockPeer(peer_id);
    peers.push({
      peer_id,
      distance: Math.floor(Math.random() * depth) + 1,
      connected_to: [`peer_${(i + 1) % peer_count}`, `peer_${(i + 2) % peer_count}`],
      reputation: 0.7 + Math.random() * 0.3,
    });
  }

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify({
      local_node: {
        peer_id: 'local_node',
        multiaddr: ['/ip4/127.0.0.1/tcp/8080/p2p/local_node'],
        connected_peers: peer_count,
      },
      peers,
      metrics: {
        total_peers: peer_count,
        average_degree: 2,
        diameter: depth,
        clustering_coefficient: 0.4 + Math.random() * 0.3,
      },
    }, null, 2),
  };
}
