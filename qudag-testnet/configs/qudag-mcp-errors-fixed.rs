// QuDAG MCP Network Tool - Enhanced Error Handling and Validation
// This version provides comprehensive error handling, parameter validation, and consistent error responses

use warp::Filter;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose};
use log::{debug, warn, error, info};

// Enhanced error handling structures
#[derive(Debug, Serialize, Deserialize)]
struct QuDAGError {
    pub error: String,
    pub code: String,
    pub suggestion: Option<String>,
    pub details: Option<serde_json::Value>,
}

impl QuDAGError {
    fn new(code: &str, message: &str, suggestion: Option<&str>) -> Self {
        Self {
            error: message.to_string(),
            code: code.to_string(),
            suggestion: suggestion.map(|s| s.to_string()),
            details: None,
        }
    }

    fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

// Error codes for network operations
mod error_codes {
    pub const MISSING_OPERATION: &str = "MISSING_OPERATION";
    pub const INVALID_OPERATION: &str = "INVALID_OPERATION";
    pub const MISSING_PEER_ADDRESS: &str = "MISSING_PEER_ADDRESS";
    pub const INVALID_PEER_ADDRESS: &str = "INVALID_PEER_ADDRESS";
    pub const MISSING_PEER_ID: &str = "MISSING_PEER_ID";
    pub const INVALID_PEER_ID: &str = "INVALID_PEER_ID";
    pub const MISSING_MESSAGE: &str = "MISSING_MESSAGE";
    pub const MESSAGE_TOO_LONG: &str = "MESSAGE_TOO_LONG";
    pub const PEER_NOT_FOUND: &str = "PEER_NOT_FOUND";
    pub const PEER_ALREADY_CONNECTED: &str = "PEER_ALREADY_CONNECTED";
    pub const CONNECTION_FAILED: &str = "CONNECTION_FAILED";
    pub const NETWORK_ERROR: &str = "NETWORK_ERROR";
    pub const VALIDATION_ERROR: &str = "VALIDATION_ERROR";
}

// Mock QuDAG types (keeping original mock types for compatibility)
mod qudag_types {
    use std::collections::HashMap;
    use rand::Rng;
    
    pub struct CryptoManager;
    
    impl CryptoManager {
        pub fn new() -> Self { Self }
        
        pub fn generate_keypair(&self) -> KeyPair {
            let mut rng = rand::thread_rng();
            let private_key: Vec<u8> = (0..2592).map(|_| rng.gen()).collect();
            let public_key: Vec<u8> = (0..1952).map(|_| rng.gen()).collect();
            
            KeyPair {
                public: public_key,
                private: private_key,
            }
        }
        
        pub fn sign(&self, message: &[u8], _key: &KeyPair) -> Vec<u8> {
            use sha2::{Sha256, Digest};
            let mut hasher = Sha256::new();
            hasher.update(message);
            hasher.finalize().to_vec()
        }
    }
    
    pub struct KeyPair {
        pub public: Vec<u8>,
        pub private: Vec<u8>,
    }
    
    impl KeyPair {
        pub fn public_key(&self) -> &[u8] {
            &self.public
        }
    }
    
    pub struct NetworkManager {
        pub peers: HashMap<String, PeerInfo>,
    }
    
    #[derive(Clone)]
    pub struct PeerInfo {
        pub id: String,
        pub address: String,
        pub latency_ms: u32,
        pub connected_at: chrono::DateTime<chrono::Utc>,
    }
    
    impl NetworkManager {
        pub async fn new() -> Self {
            let mut peers = HashMap::new();
            peers.insert("bootstrap1".to_string(), PeerInfo {
                id: "12D3KooWBootstrap1".to_string(),
                address: "/ip4/138.197.83.123/tcp/9000".to_string(),
                latency_ms: 45,
                connected_at: chrono::Utc::now(),
            });
            peers.insert("bootstrap2".to_string(), PeerInfo {
                id: "12D3KooWBootstrap2".to_string(),
                address: "/ip4/159.203.89.45/tcp/9000".to_string(),
                latency_ms: 67,
                connected_at: chrono::Utc::now(),
            });
            
            Self { peers }
        }
        
        pub fn peer_count(&self) -> usize {
            self.peers.len()
        }
        
        pub fn add_peer(&mut self, address: String) -> String {
            let peer_id = format!("12D3KooW{}", uuid::Uuid::new_v4().simple());
            let peer_key = format!("peer_{}", self.peers.len() + 1);
            self.peers.insert(peer_key, PeerInfo {
                id: peer_id.clone(),
                address,
                latency_ms: rand::thread_rng().gen_range(20..200),
                connected_at: chrono::Utc::now(),
            });
            peer_id
        }

        pub fn find_peer_by_id(&self, peer_id: &str) -> Option<&PeerInfo> {
            self.peers.values().find(|peer| peer.id == peer_id)
        }

        pub fn find_peer_by_address(&self, address: &str) -> Option<&PeerInfo> {
            self.peers.values().find(|peer| peer.address == address)
        }

        pub fn remove_peer(&mut self, peer_id: &str) -> bool {
            let peer_key = self.peers.iter()
                .find(|(_, peer)| peer.id == peer_id)
                .map(|(key, _)| key.clone());
            
            if let Some(key) = peer_key {
                self.peers.remove(&key);
                true
            } else {
                false
            }
        }
    }
}

use qudag_types::*;

#[derive(Clone)]
struct AppState {
    crypto: Arc<CryptoManager>,
    network: Arc<RwLock<NetworkManager>>,
    exchange_balances: Arc<RwLock<HashMap<String, u64>>>,
    dark_registry: Arc<RwLock<HashMap<String, String>>>,
}

impl AppState {
    async fn new() -> Self {
        let crypto = Arc::new(CryptoManager::new());
        let network = Arc::new(RwLock::new(NetworkManager::new().await));
        let exchange_balances = Arc::new(RwLock::new(HashMap::new()));
        let dark_registry = Arc::new(RwLock::new(HashMap::new()));
        
        Self {
            crypto,
            network,
            exchange_balances,
            dark_registry,
        }
    }
}

// Enhanced parameter validation utilities
struct NetworkValidator;

impl NetworkValidator {
    /// Validate multiaddr format for peer addresses
    fn validate_peer_address(address: &str) -> Result<(), QuDAGError> {
        debug!("Validating peer address: {}", address);
        
        if address.is_empty() {
            return Err(QuDAGError::new(
                error_codes::INVALID_PEER_ADDRESS,
                "Peer address cannot be empty",
                Some("Provide a valid multiaddr format like '/ip4/127.0.0.1/tcp/9000' or '/dns4/example.com/tcp/9000'")
            ));
        }

        // Basic multiaddr format validation
        if !address.starts_with('/') {
            return Err(QuDAGError::new(
                error_codes::INVALID_PEER_ADDRESS,
                "Invalid multiaddr format: must start with '/'",
                Some("Use multiaddr format like '/ip4/127.0.0.1/tcp/9000' or '/dns4/example.com/tcp/9000'")
            ));
        }

        let parts: Vec<&str> = address.split('/').filter(|s| !s.is_empty()).collect();
        if parts.len() < 4 {
            return Err(QuDAGError::new(
                error_codes::INVALID_PEER_ADDRESS,
                "Invalid multiaddr format: insufficient components",
                Some("Multiaddr must have format like '/ip4/127.0.0.1/tcp/9000' with at least protocol/address/protocol/port")
            ).with_details(serde_json::json!({
                "provided": address,
                "expected_components": "at least 4 (protocol/address/protocol/port)",
                "found_components": parts.len()
            })));
        }

        // Validate protocol types
        match parts[0] {
            "ip4" | "ip6" | "dns4" | "dns6" => {},
            other => {
                return Err(QuDAGError::new(
                    error_codes::INVALID_PEER_ADDRESS,
                    &format!("Unsupported address protocol: {}", other),
                    Some("Use supported protocols: ip4, ip6, dns4, or dns6")
                ).with_details(serde_json::json!({
                    "provided_protocol": other,
                    "supported_protocols": ["ip4", "ip6", "dns4", "dns6"]
                })));
            }
        }

        // Validate transport protocol
        if parts.len() >= 3 && parts[2] != "tcp" && parts[2] != "udp" {
            return Err(QuDAGError::new(
                error_codes::INVALID_PEER_ADDRESS,
                &format!("Unsupported transport protocol: {}", parts[2]),
                Some("Use supported transport protocols: tcp or udp")
            ).with_details(serde_json::json!({
                "provided_transport": parts[2],
                "supported_transports": ["tcp", "udp"]
            })));
        }

        // Validate port number
        if parts.len() >= 4 {
            if let Err(_) = parts[3].parse::<u16>() {
                return Err(QuDAGError::new(
                    error_codes::INVALID_PEER_ADDRESS,
                    &format!("Invalid port number: {}", parts[3]),
                    Some("Port must be a valid number between 1 and 65535")
                ).with_details(serde_json::json!({
                    "provided_port": parts[3],
                    "valid_range": "1-65535"
                })));
            }
        }

        Ok(())
    }

    /// Validate peer ID format (libp2p format)
    fn validate_peer_id(peer_id: &str) -> Result<(), QuDAGError> {
        debug!("Validating peer ID: {}", peer_id);
        
        if peer_id.is_empty() {
            return Err(QuDAGError::new(
                error_codes::INVALID_PEER_ID,
                "Peer ID cannot be empty",
                Some("Provide a valid libp2p peer ID starting with '12D3KooW'")
            ));
        }

        if !peer_id.starts_with("12D3KooW") {
            return Err(QuDAGError::new(
                error_codes::INVALID_PEER_ID,
                "Invalid peer ID format: must start with '12D3KooW'",
                Some("Peer ID should be in libp2p format starting with '12D3KooW' followed by base58 characters")
            ).with_details(serde_json::json!({
                "provided": peer_id,
                "expected_format": "12D3KooW[base58_characters]"
            })));
        }

        if peer_id.len() < 52 || peer_id.len() > 60 {
            return Err(QuDAGError::new(
                error_codes::INVALID_PEER_ID,
                &format!("Invalid peer ID length: {} characters", peer_id.len()),
                Some("Peer ID should be 52-60 characters long in libp2p format")
            ).with_details(serde_json::json!({
                "provided_length": peer_id.len(),
                "expected_range": "52-60 characters"
            })));
        }

        Ok(())
    }

    /// Validate broadcast message
    fn validate_message(message: &str) -> Result<(), QuDAGError> {
        debug!("Validating message length: {}", message.len());
        
        if message.is_empty() {
            return Err(QuDAGError::new(
                error_codes::MISSING_MESSAGE,
                "Message cannot be empty",
                Some("Provide a non-empty message to broadcast")
            ));
        }

        const MAX_MESSAGE_SIZE: usize = 1024 * 1024; // 1MB
        if message.len() > MAX_MESSAGE_SIZE {
            return Err(QuDAGError::new(
                error_codes::MESSAGE_TOO_LONG,
                &format!("Message too long: {} bytes", message.len()),
                Some(&format!("Message must be less than {} bytes (1MB)", MAX_MESSAGE_SIZE))
            ).with_details(serde_json::json!({
                "provided_size": message.len(),
                "max_size": MAX_MESSAGE_SIZE,
                "size_unit": "bytes"
            })));
        }

        Ok(())
    }

    /// Sanitize string input by removing control characters and limiting length
    fn sanitize_string(input: &str, max_len: usize) -> String {
        input.chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
            .take(max_len)
            .collect()
    }
}

/// Enhanced network tool execution with comprehensive error handling
async fn execute_network_tool(args: &serde_json::Value, state: &AppState) -> Result<serde_json::Value, String> {
    info!("Executing network tool with args: {}", args);

    // Step 1: Validate operation parameter
    let operation = match args["operation"].as_str() {
        Some(op) => {
            let sanitized = NetworkValidator::sanitize_string(op, 50);
            debug!("Network operation requested: {}", sanitized);
            sanitized
        },
        None => {
            let error = QuDAGError::new(
                error_codes::MISSING_OPERATION,
                "Missing required parameter: operation",
                Some("Specify a network operation: list_peers, connect_peer, disconnect_peer, network_stats, or broadcast_message")
            ).with_details(serde_json::json!({
                "available_operations": ["list_peers", "connect_peer", "disconnect_peer", "network_stats", "broadcast_message"],
                "provided_args": args
            }));
            error!("Network operation missing: {}", serde_json::to_string(&error).unwrap_or_default());
            return Err(serde_json::to_string(&error).unwrap_or_default());
        }
    };

    // Step 2: Validate operation is supported
    let valid_operations = ["list_peers", "connect_peer", "disconnect_peer", "network_stats", "broadcast_message"];
    if !valid_operations.contains(&operation.as_str()) {
        let error = QuDAGError::new(
            error_codes::INVALID_OPERATION,
            &format!("Unknown network operation: {}", operation),
            Some("Use one of the supported operations: list_peers, connect_peer, disconnect_peer, network_stats, broadcast_message")
        ).with_details(serde_json::json!({
            "provided_operation": operation,
            "available_operations": valid_operations
        }));
        error!("Invalid network operation: {}", serde_json::to_string(&error).unwrap_or_default());
        return Err(serde_json::to_string(&error).unwrap_or_default());
    }

    // Step 3: Execute operation with specific parameter validation
    let result = match operation.as_str() {
        "list_peers" => {
            debug!("Listing peers - no additional parameters required");
            execute_list_peers(state).await
        },
        "connect_peer" => {
            debug!("Connecting to peer - validating peer_address parameter");
            execute_connect_peer(args, state).await
        },
        "disconnect_peer" => {
            debug!("Disconnecting peer - validating peer_id parameter");
            execute_disconnect_peer(args, state).await
        },
        "network_stats" => {
            debug!("Getting network stats - no additional parameters required");
            execute_network_stats(state).await
        },
        "broadcast_message" => {
            debug!("Broadcasting message - validating message parameter");
            execute_broadcast_message(args, state).await
        },
        _ => {
            // This should never happen due to validation above, but keeping for safety
            let error = QuDAGError::new(
                error_codes::INVALID_OPERATION,
                &format!("Unhandled network operation: {}", operation),
                Some("This is an internal error - the operation passed validation but is not implemented")
            );
            error!("Unhandled network operation: {}", serde_json::to_string(&error).unwrap_or_default());
            Err(serde_json::to_string(&error).unwrap_or_default())
        }
    };

    match &result {
        Ok(_) => info!("Network operation '{}' completed successfully", operation),
        Err(e) => error!("Network operation '{}' failed: {}", operation, e)
    }

    result
}

/// List all connected peers
async fn execute_list_peers(state: &AppState) -> Result<serde_json::Value, String> {
    debug!("Executing list_peers operation");
    
    match state.network.read().await {
        network => {
            let peers: Vec<_> = network.peers.values().map(|peer| {
                serde_json::json!({
                    "id": peer.id,
                    "address": peer.address,
                    "latency_ms": peer.latency_ms,
                    "status": "connected",
                    "connected_at": peer.connected_at.to_rfc3339()
                })
            }).collect();
            
            let response = serde_json::json!({
                "peers": peers,
                "count": network.peer_count(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            info!("Listed {} peers successfully", network.peer_count());
            Ok(response)
        }
    }
}

/// Connect to a new peer
async fn execute_connect_peer(args: &serde_json::Value, state: &AppState) -> Result<serde_json::Value, String> {
    debug!("Executing connect_peer operation");
    
    // Step 1: Extract and validate peer_address parameter
    let peer_address = match args["peer_address"].as_str() {
        Some(addr) => {
            let sanitized = NetworkValidator::sanitize_string(addr, 200);
            debug!("Attempting to connect to peer at: {}", sanitized);
            sanitized
        },
        None => {
            let error = QuDAGError::new(
                error_codes::MISSING_PEER_ADDRESS,
                "Missing required parameter: peer_address",
                Some("Provide a peer_address in multiaddr format (e.g., '/ip4/127.0.0.1/tcp/9000' or '/dns4/example.com/tcp/9000')")
            ).with_details(serde_json::json!({
                "parameter": "peer_address",
                "format": "multiaddr",
                "examples": [
                    "/ip4/127.0.0.1/tcp/9000",
                    "/ip4/192.168.1.100/tcp/8080",
                    "/dns4/example.com/tcp/9000",
                    "/ip6/::1/tcp/9000"
                ]
            }));
            warn!("Connect peer failed - missing peer_address: {}", serde_json::to_string(&error).unwrap_or_default());
            return Err(serde_json::to_string(&error).unwrap_or_default());
        }
    };

    // Step 2: Validate peer address format
    if let Err(validation_error) = NetworkValidator::validate_peer_address(&peer_address) {
        warn!("Connect peer failed - invalid peer_address: {}", serde_json::to_string(&validation_error).unwrap_or_default());
        return Err(serde_json::to_string(&validation_error).unwrap_or_default());
    }

    // Step 3: Check if peer is already connected
    {
        let network = state.network.read().await;
        if network.find_peer_by_address(&peer_address).is_some() {
            let error = QuDAGError::new(
                error_codes::PEER_ALREADY_CONNECTED,
                &format!("Peer at address {} is already connected", peer_address),
                Some("Check connected peers with 'list_peers' operation or disconnect first")
            ).with_details(serde_json::json!({
                "peer_address": peer_address,
                "status": "already_connected"
            }));
            warn!("Connect peer failed - already connected: {}", serde_json::to_string(&error).unwrap_or_default());
            return Err(serde_json::to_string(&error).unwrap_or_default());
        }
    }

    // Step 4: Attempt connection (mock implementation)
    match state.network.write().await {
        mut network => {
            let peer_id = network.add_peer(peer_address.clone());
            
            let response = serde_json::json!({
                "peer_id": peer_id,
                "address": peer_address,
                "status": "connected",
                "connection_type": "outbound",
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            info!("Successfully connected to peer {} at {}", peer_id, peer_address);
            Ok(response)
        }
    }
}

/// Disconnect from a peer
async fn execute_disconnect_peer(args: &serde_json::Value, state: &AppState) -> Result<serde_json::Value, String> {
    debug!("Executing disconnect_peer operation");
    
    // Step 1: Extract and validate peer_id parameter
    let peer_id = match args["peer_id"].as_str() {
        Some(id) => {
            let sanitized = NetworkValidator::sanitize_string(id, 100);
            debug!("Attempting to disconnect peer: {}", sanitized);
            sanitized
        },
        None => {
            let error = QuDAGError::new(
                error_codes::MISSING_PEER_ID,
                "Missing required parameter: peer_id",
                Some("Provide a peer_id in libp2p format (e.g., '12D3KooWExample123...'). Use 'list_peers' to see connected peer IDs")
            ).with_details(serde_json::json!({
                "parameter": "peer_id",
                "format": "libp2p peer ID",
                "example": "12D3KooWExample123456789..."
            }));
            warn!("Disconnect peer failed - missing peer_id: {}", serde_json::to_string(&error).unwrap_or_default());
            return Err(serde_json::to_string(&error).unwrap_or_default());
        }
    };

    // Step 2: Validate peer ID format
    if let Err(validation_error) = NetworkValidator::validate_peer_id(&peer_id) {
        warn!("Disconnect peer failed - invalid peer_id: {}", serde_json::to_string(&validation_error).unwrap_or_default());
        return Err(serde_json::to_string(&validation_error).unwrap_or_default());
    }

    // Step 3: Check if peer exists and disconnect
    match state.network.write().await {
        mut network => {
            if network.remove_peer(&peer_id) {
                let response = serde_json::json!({
                    "peer_id": peer_id,
                    "status": "disconnected",
                    "timestamp": chrono::Utc::now().to_rfc3339()
                });
                
                info!("Successfully disconnected peer: {}", peer_id);
                Ok(response)
            } else {
                let error = QuDAGError::new(
                    error_codes::PEER_NOT_FOUND,
                    &format!("Peer not found: {}", peer_id),
                    Some("Check connected peers with 'list_peers' operation to see available peer IDs")
                ).with_details(serde_json::json!({
                    "peer_id": peer_id,
                    "available_peers": network.peers.values()
                        .map(|p| &p.id)
                        .collect::<Vec<_>>()
                }));
                warn!("Disconnect peer failed - peer not found: {}", serde_json::to_string(&error).unwrap_or_default());
                Err(serde_json::to_string(&error).unwrap_or_default())
            }
        }
    }
}

/// Get network statistics
async fn execute_network_stats(state: &AppState) -> Result<serde_json::Value, String> {
    debug!("Executing network_stats operation");
    
    match state.network.read().await {
        network => {
            let peer_count = network.peer_count();
            let response = serde_json::json!({
                "total_peers": peer_count,
                "active_connections": peer_count,
                "bandwidth": {
                    "in_bytes_per_sec": 1024 * peer_count,
                    "out_bytes_per_sec": 2048 * peer_count
                },
                "protocol": "qudag/1.0.0",
                "nat_status": "public",
                "uptime_seconds": 3600,
                "network_health": if peer_count > 0 { "healthy" } else { "isolated" },
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            
            info!("Retrieved network stats - {} peers connected", peer_count);
            Ok(response)
        }
    }
}

/// Broadcast a message to all peers
async fn execute_broadcast_message(args: &serde_json::Value, state: &AppState) -> Result<serde_json::Value, String> {
    debug!("Executing broadcast_message operation");
    
    // Step 1: Extract and validate message parameter
    let message = match args["message"].as_str() {
        Some(msg) => {
            let sanitized = NetworkValidator::sanitize_string(msg, 1024 * 1024); // 1MB max
            debug!("Broadcasting message of length: {}", sanitized.len());
            sanitized
        },
        None => {
            let error = QuDAGError::new(
                error_codes::MISSING_MESSAGE,
                "Missing required parameter: message",
                Some("Provide a message to broadcast to all connected peers")
            ).with_details(serde_json::json!({
                "parameter": "message",
                "max_size": "1MB (1048576 bytes)"
            }));
            warn!("Broadcast message failed - missing message: {}", serde_json::to_string(&error).unwrap_or_default());
            return Err(serde_json::to_string(&error).unwrap_or_default());
        }
    };

    // Step 2: Validate message
    if let Err(validation_error) = NetworkValidator::validate_message(&message) {
        warn!("Broadcast message failed - invalid message: {}", serde_json::to_string(&validation_error).unwrap_or_default());
        return Err(serde_json::to_string(&validation_error).unwrap_or_default());
    }

    // Step 3: Check if there are peers to broadcast to
    let network = state.network.read().await;
    let peer_count = network.peer_count();
    
    if peer_count == 0 {
        let error = QuDAGError::new(
            error_codes::NETWORK_ERROR,
            "No peers connected - cannot broadcast message",
            Some("Connect to peers first using 'connect_peer' operation before broadcasting messages")
        ).with_details(serde_json::json!({
            "connected_peers": 0,
            "message_length": message.len()
        }));
        warn!("Broadcast message failed - no peers: {}", serde_json::to_string(&error).unwrap_or_default());
        return Err(serde_json::to_string(&error).unwrap_or_default());
    }

    // Step 4: Broadcast message (mock implementation)
    let broadcast_id = uuid::Uuid::new_v4().to_string();
    let response = serde_json::json!({
        "broadcast_id": broadcast_id,
        "message_hash": hex::encode(Sha256::digest(message.as_bytes())),
        "recipients": peer_count,
        "status": "broadcasted",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "message_size": message.len()
    });
    
    info!("Successfully broadcasted message to {} peers", peer_count);
    Ok(response)
}

// Additional dependencies
use hex;
use uuid;
use chrono;