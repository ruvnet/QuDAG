use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
    pub id: String,
    pub multiaddr: String,
    pub connected_at: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BandwidthStats {
    pub total_bytes_sent: u64,
    pub total_bytes_received: u64,
    pub bytes_per_second_in: u64,
    pub bytes_per_second_out: u64,
}

pub struct NetworkManager {
    peers: HashMap<String, Peer>,
    listening_addresses: Vec<String>,
    protocol_version: String,
    network_id: String,
    bandwidth_stats: BandwidthStats,
    message_counter: u64,
}

impl NetworkManager {
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
            listening_addresses: vec![
                "/ip4/0.0.0.0/tcp/4001".to_string(),
                "/ip4/0.0.0.0/udp/4001/quic".to_string(),
            ],
            protocol_version: "qudag/1.0.0".to_string(),
            network_id: "qudag-mainnet".to_string(),
            bandwidth_stats: BandwidthStats {
                total_bytes_sent: 0,
                total_bytes_received: 0,
                bytes_per_second_in: 0,
                bytes_per_second_out: 0,
            },
            message_counter: 0,
        }
    }
    
    pub fn get_peer_count(&self) -> usize {
        self.peers.len()
    }
    
    pub fn get_listening_addresses(&self) -> Vec<String> {
        self.listening_addresses.clone()
    }
    
    pub fn get_protocol_version(&self) -> String {
        self.protocol_version.clone()
    }
    
    pub fn get_network_id(&self) -> String {
        self.network_id.clone()
    }
    
    pub fn get_bandwidth_stats(&self) -> BandwidthStats {
        self.bandwidth_stats.clone()
    }
    
    pub async fn list_peers(&self) -> Vec<Peer> {
        self.peers.values().cloned().collect()
    }
    
    pub async fn connect_peer(&mut self, multiaddr: &str) -> Result<(), Box<dyn std::error::Error>> {
        // Simulate peer connection
        let peer_id = format!("peer_{}", self.peers.len() + 1);
        
        let peer = Peer {
            id: peer_id.clone(),
            multiaddr: multiaddr.to_string(),
            connected_at: Utc::now(),
            last_seen: Utc::now(),
            bytes_sent: 0,
            bytes_received: 0,
            latency_ms: rand::random::<u64>() % 100 + 10, // 10-110ms
        };
        
        self.peers.insert(peer_id.clone(), peer);
        
        println!("🔗 Connected to peer: {} at {}", peer_id, multiaddr);
        
        Ok(())
    }
    
    pub async fn disconnect_peer(&mut self, peer_address: &str) -> Result<(), Box<dyn std::error::Error>> {
        // Find peer by address
        let peer_id = self.peers.iter()
            .find(|(_, p)| p.multiaddr == peer_address)
            .map(|(id, _)| id.clone());
        
        if let Some(id) = peer_id {
            self.peers.remove(&id);
            println!("🔌 Disconnected from peer: {}", peer_address);
            Ok(())
        } else {
            Err("Peer not found".into())
        }
    }
    
    pub async fn broadcast_message(&mut self, data: &[u8]) -> Result<String, Box<dyn std::error::Error>> {
        self.message_counter += 1;
        let broadcast_id = format!("broadcast_{}", self.message_counter);
        
        // Simulate broadcasting to all peers
        let message_size = data.len() as u64;
        
        for peer in self.peers.values_mut() {
            peer.bytes_sent += message_size;
            peer.last_seen = Utc::now();
        }
        
        self.bandwidth_stats.total_bytes_sent += message_size * self.peers.len() as u64;
        
        println!("📡 Broadcast {} to {} peers ({} bytes)", 
                 broadcast_id, self.peers.len(), message_size);
        
        Ok(broadcast_id)
    }
    
    pub fn simulate_incoming_data(&mut self, peer_id: &str, bytes: u64) {
        if let Some(peer) = self.peers.get_mut(peer_id) {
            peer.bytes_received += bytes;
            peer.last_seen = Utc::now();
            self.bandwidth_stats.total_bytes_received += bytes;
        }
    }
}

// Global network manager instance
lazy_static::lazy_static! {
    pub static ref NETWORK_MANAGER: Arc<Mutex<NetworkManager>> = Arc::new(Mutex::new(NetworkManager::new()));
}

pub async fn initialize() {
    let mut manager = NETWORK_MANAGER.lock().await;
    
    // Connect to bootstrap peers
    let bootstrap_peers = vec![
        "/dns4/bootstrap1.qudag.io/tcp/4001/p2p/QmBootstrap1",
        "/dns4/bootstrap2.qudag.io/tcp/4001/p2p/QmBootstrap2",
    ];
    
    for peer_addr in bootstrap_peers {
        if let Err(e) = manager.connect_peer(peer_addr).await {
            eprintln!("Failed to connect to bootstrap peer {}: {}", peer_addr, e);
        }
    }
    
    println!("🌐 Network Manager initialized with {} bootstrap peers", manager.get_peer_count());
}

// Random number generation for simulation
mod rand {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    pub fn random<T>() -> T 
    where 
        T: From<u64>
    {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .subsec_nanos() as u64;
        T::from(nanos)
    }
}