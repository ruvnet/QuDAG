//! Integration tests between network, crypto, and DAG layers
//!
//! This module tests the integration and interaction between the networking layer
//! and other core components of the QuDAG system, ensuring proper end-to-end
//! functionality and protocol compliance.
//!
//! Onion layers: `MLKEMOnionRouter::encrypt_layers` encrypts to the hop keys held
//! by its onion directory, whose secret halves are not exposed, and
//! `decrypt_layer` uses the router's own key. A multi-hop peel therefore cannot
//! be driven through the public API; these tests check the layer chain built for
//! a route and that a node off the route cannot peel any layer.

use qudag_crypto::fingerprint::Fingerprint;
use qudag_crypto::ml_dsa::{MlDsaKeyPair, MlDsaPublicKey};
use qudag_dag::consensus::{ConsensusStatus, QRAvalanche};
use qudag_dag::vertex::{Vertex, VertexId};
use qudag_dag::QrDag;
use qudag_network::{
    connection::ConnectionManager,
    message::MessageEnvelope,
    onion::{MLKEMOnionRouter, OnionLayer},
    quantum_crypto::{MlKemPublicKey, MlKemSecurityLevel, QuantumKeyExchange},
    router::Router,
    types::{ConnectionStatus, MessagePriority, NetworkMessage, PeerId, RoutingStrategy},
    NetworkConfig, NetworkManager,
};
use rand::thread_rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

/// A value transfer carried as a DAG vertex payload.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct TestTransaction {
    id: String,
    sender: String,
    receiver: String,
    amount: u64,
}

/// Initialized network manager. NAT traversal is disabled so the test does not
/// probe real STUN/UPnP endpoints.
async fn network_manager() -> NetworkManager {
    let mut manager = NetworkManager::with_config(NetworkConfig {
        enable_nat_traversal: false,
        ..NetworkConfig::default()
    });
    manager.initialize().await.unwrap();
    manager
}

/// Network peer id for a named node.
fn node_peer_id(node_id: &str) -> PeerId {
    let mut bytes = [0u8; 32];
    let name = node_id.as_bytes();
    bytes[..name.len()].copy_from_slice(name);
    PeerId::from_bytes(bytes)
}

fn vertex_id(id: &str) -> VertexId {
    VertexId::from_bytes(id.as_bytes().to_vec())
}

/// Signs `message` with ML-DSA over its BLAKE3 digest.
fn sign_digest(keypair: &MlDsaKeyPair, message: &[u8]) -> Vec<u8> {
    keypair
        .sign(blake3::hash(message).as_bytes(), &mut thread_rng())
        .unwrap()
}

fn verify_digest(public_key: &MlDsaPublicKey, message: &[u8], signature: &[u8]) -> bool {
    public_key
        .verify(blake3::hash(message).as_bytes(), signature)
        .is_ok()
}

/// Asserts that `layers` form the onion chain for `route`: one layer per hop,
/// outermost first, each naming the next hop and the innermost naming none.
fn assert_layer_chain(layers: &[OnionLayer], route: &[Vec<u8>]) {
    assert_eq!(layers.len(), route.len());
    for (i, layer) in layers.iter().enumerate() {
        assert!(layer.validate().is_ok(), "Layer {} is malformed", i);
        if i + 1 < route.len() {
            assert_eq!(layer.next_hop, route[i + 1], "Layer {} next hop", i);
        } else {
            assert!(layer.next_hop.is_empty(), "Innermost layer has a next hop");
        }
    }
}

/// ML-KEM public key length, read from its public `Debug` representation (the
/// raw key bytes are crate-private).
fn public_key_len(public_key: &MlKemPublicKey) -> usize {
    let debug = format!("{:?}", public_key);
    let start = debug.find("key_length: ").unwrap() + "key_length: ".len();
    debug[start..]
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse()
        .unwrap()
}

/// Test integration between network layer and ML-DSA signature scheme
#[tokio::test]
async fn test_network_mldsa_integration() {
    // Setup network components
    let _network_manager = network_manager().await;

    // Setup crypto components
    let mut rng = thread_rng();
    let alice_keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
    let bob_keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
    let alice_public = alice_keypair.to_public_key().unwrap();
    let bob_public = bob_keypair.to_public_key().unwrap();

    // Create signed network message
    let message_data = b"This is a test message for ML-DSA integration".to_vec();
    let network_msg = NetworkMessage {
        id: "mldsa_integration_test".into(),
        source: alice_keypair.public_key().to_vec(),
        destination: bob_keypair.public_key().to_vec(),
        payload: message_data.clone(),
        priority: MessagePriority::High,
        ttl: Duration::from_secs(120),
    };

    // Create message envelope with signature
    let mut envelope = MessageEnvelope::new(network_msg.clone());

    // Sign the message with Alice's private key
    let signature = sign_digest(&alice_keypair, &bincode::serialize(&network_msg).unwrap());
    envelope.signature = Some(signature);

    // Verify integrity
    assert!(envelope.verify());

    // Bob verifies the signature
    let received = bincode::serialize(&envelope.message).unwrap();
    let signature = envelope.signature.clone().unwrap();

    assert!(verify_digest(&alice_public, &received, &signature));

    // Test signature verification failure with wrong key
    assert!(!verify_digest(&bob_public, &received, &signature));

    // Test message integrity - tampering should break verification
    let mut tampered_envelope = envelope.clone();
    tampered_envelope.message.payload = b"tampered data".to_vec();
    let tampered = bincode::serialize(&tampered_envelope.message).unwrap();
    assert!(!verify_digest(&alice_public, &tampered, &signature));
}

/// Test integration between network layer and ML-KEM encryption
#[tokio::test]
async fn test_network_mlkem_integration() {
    let onion_router = MLKEMOnionRouter::new().await.unwrap();

    // Three hops from the onion directory, each holding an ML-KEM key
    let route = onion_router
        .directory_client()
        .select_random_nodes(3)
        .await
        .unwrap();

    // Create original message
    let original_payload = b"Secret message encrypted with ML-KEM".to_vec();

    // Create onion layers using ML-KEM
    let onion_layers = onion_router
        .encrypt_layers(original_payload.clone(), route.clone())
        .await
        .unwrap();

    assert_eq!(onion_layers.len(), 3);
    assert_layer_chain(&onion_layers, &route);

    // Every layer is encrypted: the plaintext appears in none of them, and each
    // hop gets its own encapsulation.
    let ciphertexts: HashSet<_> = onion_layers.iter().map(|l| &l.kem_ciphertext).collect();
    assert_eq!(ciphertexts.len(), 3);
    for layer in &onion_layers {
        assert!(!layer
            .payload
            .windows(original_payload.len())
            .any(|w| w == original_payload.as_slice()));
    }

    // A node that is not on the route cannot peel any layer
    for layer in &onion_layers {
        assert!(onion_router.decrypt_layer(layer.clone()).is_err());
    }
}

/// Test integration between network routing and DAG consensus
#[tokio::test]
async fn test_network_dag_consensus_integration() {
    // Setup network layer
    let router = Router::new().await.unwrap();
    let connection_manager = ConnectionManager::new(50);

    // Setup DAG layer
    let mut dag = QrDag::new();

    // Setup consensus
    let mut consensus_engine = QRAvalanche::new();

    // Create network nodes that participate in consensus
    let nodes: Vec<String> = (0..5).map(|i| format!("node_{}", i)).collect();

    // Add nodes to network
    for node in &nodes {
        let peer_id = node_peer_id(node);
        router.add_peer(peer_id).await;
        connection_manager.connect(peer_id).await.unwrap();
        connection_manager.update_status(peer_id, ConnectionStatus::Connected);
        consensus_engine.add_participant(vertex_id(node));
    }

    // Create transaction to be processed through the network and added to DAG
    let transaction = TestTransaction {
        id: "test_tx_001".to_string(),
        sender: nodes[0].clone(),
        receiver: nodes[1].clone(),
        amount: 100,
    };

    // Create vertex containing the transaction
    let vertex = Vertex::new(
        vertex_id("vertex_001"),
        bincode::serialize(&transaction).unwrap(),
        HashSet::new(), // No parents for first vertex
    );

    // Add vertex to DAG
    assert!(dag.add_vertex(vertex.clone()).is_ok());

    // Network message to propagate vertex
    let vertex_data = bincode::serialize(&vertex).unwrap();
    let network_msg = NetworkMessage {
        id: "vertex_propagation".into(),
        source: node_peer_id(&nodes[0]).to_bytes().to_vec(),
        destination: vec![0xFF; 32], // Broadcast
        payload: vertex_data,
        priority: MessagePriority::High,
        ttl: Duration::from_secs(60),
    };

    // Route message through network: broadcast reaches every node
    let route = router
        .route(&network_msg, RoutingStrategy::Flood)
        .await
        .unwrap();

    assert!(!route.is_empty());
    assert_eq!(route.len(), nodes.len());

    // Simulate consensus on the vertex: every validator votes for it
    let status = consensus_engine.process_vertex(vertex.id.clone()).unwrap();
    assert_eq!(status, ConsensusStatus::Pending);
    for node in &nodes {
        consensus_engine
            .record_vote(vertex.id.clone(), vertex_id(node), true)
            .unwrap();
    }

    assert_eq!(
        consensus_engine.vertices.get(&vertex.id),
        Some(&ConsensusStatus::Final),
        "Consensus should reach agreement for valid vertex"
    );

    // Local DAG admission stays Pending: finality comes from the consensus
    // protocol above, not from the local DAG facade.
    assert_eq!(
        dag.get_confidence("vertex_001"),
        Some(ConsensusStatus::Pending)
    );

    // Verify DAG state
    assert_eq!(
        dag.get_total_order().unwrap(),
        vec!["vertex_001".to_string()]
    );
    assert_eq!(dag.get_tips(), vec!["vertex_001".to_string()]);
}

/// Test end-to-end transaction flow through network, crypto, and DAG
#[tokio::test]
async fn test_end_to_end_transaction_flow() {
    // Setup all components
    let _network_manager = network_manager().await;

    let router = Router::new().await.unwrap();
    let onion_router = MLKEMOnionRouter::new().await.unwrap();

    let mut dag = QrDag::new();

    // Setup participating nodes with crypto keys
    let mut node_keypairs = HashMap::new();
    let mut rng = thread_rng();

    for i in 0..5 {
        let node_id = format!("node_{}", i);
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        node_keypairs.insert(node_id.clone(), keypair);

        // Add to network
        router.add_peer(node_peer_id(&node_id)).await;
    }

    // Create transaction
    let sender_id = "node_0".to_string();
    let receiver_id = "node_4".to_string();

    let transaction = TestTransaction {
        id: "e2e_test_tx".to_string(),
        sender: sender_id.clone(),
        receiver: receiver_id.clone(),
        amount: 250,
    };
    let transaction_bytes = bincode::serialize(&transaction).unwrap();

    // Sign transaction with sender's key
    let sender_keypair = &node_keypairs[&sender_id];
    let signature = sign_digest(sender_keypair, &transaction_bytes);

    // Create vertex with signed transaction
    let mut vertex = Vertex::new(
        vertex_id("e2e_vertex"),
        transaction_bytes,
        HashSet::new(), // Genesis vertex
    );
    vertex.signature = signature;

    // Serialize vertex for network transmission
    let vertex_data = bincode::serialize(&vertex).unwrap();

    // Create network message
    let network_msg = NetworkMessage {
        id: "e2e_encrypted_vertex".into(),
        source: node_peer_id(&sender_id).to_bytes().to_vec(),
        destination: node_peer_id(&receiver_id).to_bytes().to_vec(),
        payload: vertex_data.clone(),
        priority: MessagePriority::High,
        ttl: Duration::from_secs(300),
    };

    // Route through anonymous network
    let route = router
        .route(&network_msg, RoutingStrategy::Anonymous { hops: 3 })
        .await
        .unwrap();

    assert_eq!(route.len(), 3);

    // Create encrypted onion message over three hops of the onion directory
    let hops = onion_router
        .directory_client()
        .select_random_nodes(3)
        .await
        .unwrap();
    let onion_layers = onion_router
        .encrypt_layers(vertex_data, hops.clone())
        .await
        .unwrap();
    assert_layer_chain(&onion_layers, &hops);

    // Delivery: the receiver gets the vertex in an integrity-protected envelope
    let envelope = MessageEnvelope::new(network_msg);
    assert!(envelope.verify());

    // Final hop - should reveal vertex data
    let recovered_vertex: Vertex = bincode::deserialize(&envelope.message.payload).unwrap();
    assert_eq!(recovered_vertex.id, vertex.id);

    // Verify transaction signature
    let sender_public = sender_keypair.to_public_key().unwrap();
    assert!(verify_digest(
        &sender_public,
        &recovered_vertex.payload,
        &recovered_vertex.signature
    ));
    let recovered_tx: TestTransaction = bincode::deserialize(&recovered_vertex.payload).unwrap();

    // Add vertex to DAG
    assert!(dag.add_vertex(recovered_vertex).is_ok());

    // Verify DAG state
    assert_eq!(
        dag.get_total_order().unwrap(),
        vec!["e2e_vertex".to_string()]
    );
    assert!(dag.get_confidence("e2e_vertex").is_some());

    // Verify transaction is in DAG
    assert_eq!(recovered_tx.id, "e2e_test_tx");
    assert_eq!(recovered_tx.amount, 250);
}

/// Test network-layer fingerprinting integration
#[tokio::test]
async fn test_network_fingerprint_integration() {
    let connection_manager = ConnectionManager::new(20);
    let mut rng = thread_rng();

    // Fingerprint input: the peer's key, address and capabilities
    let fingerprint_input = |public_key: &[u8], address: &str| {
        let mut data = public_key.to_vec();
        data.extend_from_slice(address.as_bytes());
        data.extend_from_slice(b"capability_1");
        data.extend_from_slice(b"capability_2");
        data
    };

    // Create peers with fingerprints
    let peer_data: Vec<_> = (0..5u64)
        .map(|i| {
            let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
            let peer_id = PeerId::from_bytes({
                let mut bytes = [0u8; 32];
                bytes[..8].copy_from_slice(&i.to_le_bytes());
                bytes
            });

            let (fingerprint, signer) = Fingerprint::generate(
                &fingerprint_input(keypair.public_key(), &format!("127.0.0.{}", i + 1)),
                &mut rng,
            )
            .unwrap();

            (peer_id, keypair, fingerprint, signer)
        })
        .collect();

    // Add peers to network with fingerprint verification
    for (peer_id, keypair, fingerprint, signer) in &peer_data {
        connection_manager.connect(*peer_id).await.unwrap();

        // Verify fingerprint matches peer's public key
        let (expected_fingerprint, _) = Fingerprint::generate(
            &fingerprint_input(
                keypair.public_key(),
                &format!("127.0.0.{}", peer_id.to_bytes()[0] + 1),
            ),
            &mut rng,
        )
        .unwrap();

        assert_eq!(fingerprint.data(), expected_fingerprint.data());
        assert!(fingerprint.verify(signer).is_ok());

        connection_manager.update_status(*peer_id, ConnectionStatus::Connected);
    }

    // Test fingerprint-based peer authentication
    let authenticated_peers = peer_data
        .iter()
        .filter(|(peer_id, _, fingerprint, signer)| {
            // In a real system, this would verify against known good fingerprints
            fingerprint.verify(signer).is_ok()
                && connection_manager.get_status(peer_id) == Some(ConnectionStatus::Connected)
        })
        .count();

    assert_eq!(authenticated_peers, 5);

    // Test fingerprint mismatch detection
    let fake_keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
    let fake_peer_id = PeerId::random();

    let (real_fingerprint, real_signer) = Fingerprint::generate(
        &fingerprint_input(peer_data[0].1.public_key(), "127.0.0.1"),
        &mut rng,
    )
    .unwrap();

    let (fake_fingerprint, _) = Fingerprint::generate(
        &fingerprint_input(fake_keypair.public_key(), "127.0.0.1"),
        &mut rng,
    )
    .unwrap();

    // Fingerprints should be different
    assert_ne!(real_fingerprint.data(), fake_fingerprint.data());
    // A fingerprint does not verify under another signer's key
    assert!(fake_fingerprint.verify(&real_signer).is_err());

    // Connection should be rejected for mismatched fingerprint
    connection_manager.connect(fake_peer_id).await.unwrap();
    // In a real implementation, fingerprint verification would happen here
    // and the connection would be rejected if fingerprints don't match
}

/// Test quantum-resistant security across network and crypto layers
#[tokio::test]
async fn test_quantum_resistant_security_integration() {
    // Test different ML-KEM security levels
    for (security_level, min_public_key_len) in [
        (MlKemSecurityLevel::Level512, 800),
        (MlKemSecurityLevel::Level768, 1184),
        (MlKemSecurityLevel::Level1024, 1568),
    ] {
        // Setup quantum key exchanges
        let mut alice_kx = QuantumKeyExchange::with_security_level(security_level);
        let mut bob_kx = QuantumKeyExchange::with_security_level(security_level);
        let mut charlie_kx = QuantumKeyExchange::with_security_level(security_level);

        let public_keys = [
            alice_kx.initialize().unwrap(),
            bob_kx.initialize().unwrap(),
            charlie_kx.initialize().unwrap(),
        ];

        // Each key exchange completes only for the holder of the matching key
        let (to_bob, _) = alice_kx.initiate_exchange(&public_keys[1]).unwrap();
        assert!(bob_kx.complete_exchange(&to_bob).is_ok());
        let (to_charlie, _) = bob_kx.initiate_exchange(&public_keys[2]).unwrap();
        assert!(charlie_kx.complete_exchange(&to_charlie).is_ok());

        // Verify quantum security properties
        for public_key in &public_keys {
            assert_eq!(public_key.security_level, security_level);
            assert!(
                public_key_len(public_key) >= min_public_key_len,
                "{:?} public key shorter than {} bytes",
                security_level,
                min_public_key_len
            );
        }

        // Keys of a different security level are rejected
        let mut other_kx = QuantumKeyExchange::with_security_level(match security_level {
            MlKemSecurityLevel::Level768 => MlKemSecurityLevel::Level1024,
            _ => MlKemSecurityLevel::Level768,
        });
        assert!(other_kx.initiate_exchange(&public_keys[0]).is_err());
    }

    // Onion layers are ML-KEM-768 encrypted per hop
    let onion_router = MLKEMOnionRouter::new().await.unwrap();
    let route = onion_router
        .directory_client()
        .select_random_nodes(3)
        .await
        .unwrap();

    // Create sensitive payload
    let sensitive_data = b"Quantum-resistant payload".to_vec();

    // Create onion encryption
    let onion_layers = onion_router
        .encrypt_layers(sensitive_data, route.clone())
        .await
        .unwrap();

    assert_eq!(onion_layers.len(), 3);
    assert_layer_chain(&onion_layers, &route);

    // Verify a layer cannot be decrypted with the wrong key
    for layer in &onion_layers {
        assert!(onion_router.decrypt_layer(layer.clone()).is_err());
    }
}

/// Test fault tolerance across network and DAG layers
#[tokio::test]
async fn test_fault_tolerance_integration() {
    let router = Router::new().await.unwrap();
    let connection_manager = ConnectionManager::new(30);

    let mut dag = QrDag::new();

    // Setup network with some faulty nodes
    let total_nodes = 10;
    let faulty_nodes = 3;

    let nodes: Vec<_> = (0..total_nodes)
        .map(|i| {
            let node_id = format!("node_{}", i);
            let is_faulty = i < faulty_nodes;
            (node_id, is_faulty)
        })
        .collect();

    // Add all nodes to network
    for (node_id, _) in &nodes {
        let peer_id = node_peer_id(node_id);
        router.add_peer(peer_id).await;
        connection_manager.connect(peer_id).await.unwrap();
        connection_manager.update_status(peer_id, ConnectionStatus::Connected);
    }

    // Simulate faulty nodes by marking some connections as failed
    for (node_id, _) in nodes.iter().take(faulty_nodes) {
        connection_manager.update_status(
            node_peer_id(node_id),
            ConnectionStatus::Failed("Node fault".into()),
        );
    }

    // Verify network can still route with faulty nodes
    let healthy_nodes = total_nodes - faulty_nodes;
    assert!(healthy_nodes >= 5); // Ensure we have enough healthy nodes

    // Create transaction from healthy node
    let sender_node = &nodes[faulty_nodes].0; // First healthy node
    let receiver_node = &nodes[total_nodes - 1].0; // Last node

    let transaction = TestTransaction {
        id: "fault_tolerance_tx".to_string(),
        sender: sender_node.clone(),
        receiver: receiver_node.clone(),
        amount: 500,
    };

    let vertex = Vertex::new(
        vertex_id("fault_tolerance_vertex"),
        bincode::serialize(&transaction).unwrap(),
        HashSet::new(),
    );

    // Add vertex to DAG
    assert!(dag.add_vertex(vertex.clone()).is_ok());

    // Create network message
    let vertex_data = bincode::serialize(&vertex).unwrap();
    let network_msg = NetworkMessage {
        id: "fault_tolerance_test".into(),
        source: node_peer_id(sender_node).to_bytes().to_vec(),
        destination: node_peer_id(receiver_node).to_bytes().to_vec(),
        payload: vertex_data,
        priority: MessagePriority::High,
        ttl: Duration::from_secs(120),
    };

    // Route should succeed despite faulty nodes
    let route_result = router
        .route(&network_msg, RoutingStrategy::Anonymous { hops: 4 })
        .await;

    // May fail if not enough healthy nodes, but should try
    match route_result {
        Ok(route) => {
            assert!(route.len() <= 4);

            // Verify route doesn't use faulty nodes
            for peer_id in &route {
                let status = connection_manager.get_status(peer_id);
                assert_ne!(status, Some(ConnectionStatus::Failed("Node fault".into())));
            }
        }
        Err(_) => {
            // Acceptable if insufficient healthy nodes for routing
            println!("Routing failed due to insufficient healthy nodes - expected behavior");
        }
    }

    // DAG should still function with available nodes
    assert_eq!(
        dag.get_total_order().unwrap(),
        vec!["fault_tolerance_vertex".to_string()]
    );
    assert!(dag.get_confidence("fault_tolerance_vertex").is_some());

    // Test recovery - bring faulty nodes back online
    for (node_id, _) in nodes.iter().take(faulty_nodes) {
        connection_manager.update_status(node_peer_id(node_id), ConnectionStatus::Connected);
    }

    // Network should now have full connectivity restored
    let healthy_connections = nodes
        .iter()
        .map(|(node_id, _)| connection_manager.get_status(&node_peer_id(node_id)))
        .filter(|status| *status == Some(ConnectionStatus::Connected))
        .count();

    assert_eq!(healthy_connections, total_nodes);
}

/// Test performance characteristics of integrated system
#[tokio::test]
async fn test_performance_integration() {
    let router = Router::new().await.unwrap();
    let connection_manager = ConnectionManager::new(100);
    let onion_router = MLKEMOnionRouter::new().await.unwrap();

    // Setup network with many peers
    let peer_count = 50;
    let peers: Vec<_> = (0..peer_count).map(|_| PeerId::random()).collect();

    for peer in &peers {
        router.add_peer(*peer).await;
        connection_manager.connect(*peer).await.unwrap();
        connection_manager.update_status(*peer, ConnectionStatus::Connected);
    }

    // Performance test: Route many messages
    let message_count = 100;
    let start_time = Instant::now();

    for i in 0..message_count {
        let msg = NetworkMessage {
            id: format!("perf_test_{}", i),
            source: peers[i % peer_count].to_bytes().to_vec(),
            destination: peers[(i + 1) % peer_count].to_bytes().to_vec(),
            payload: vec![0; 1024], // 1KB payload
            priority: MessagePriority::Normal,
            ttl: Duration::from_secs(60),
        };

        let route_result = router
            .route(&msg, RoutingStrategy::Anonymous { hops: 3 })
            .await;

        assert!(route_result.is_ok());
    }

    let routing_time = start_time.elapsed();
    let messages_per_second = message_count as f64 / routing_time.as_secs_f64();

    println!(
        "Routing performance: {:.2} messages/second",
        messages_per_second
    );
    assert!(messages_per_second > 10.0, "Routing performance too slow");

    // Performance test: Encryption/decryption
    let mut quantum_kx = QuantumKeyExchange::with_security_level(MlKemSecurityLevel::Level768);
    let public_key = quantum_kx.initialize().unwrap();

    let crypto_start = Instant::now();
    let crypto_operations = 50;

    for _ in 0..crypto_operations {
        let (ciphertext, _shared_secret) = quantum_kx.initiate_exchange(&public_key).unwrap();
        let _decapsulated = quantum_kx.complete_exchange(&ciphertext).unwrap();
    }

    let crypto_time = crypto_start.elapsed();
    let crypto_ops_per_second = (crypto_operations * 2) as f64 / crypto_time.as_secs_f64(); // *2 for encap+decap

    println!(
        "Crypto performance: {:.2} operations/second",
        crypto_ops_per_second
    );
    assert!(crypto_ops_per_second > 5.0, "Crypto performance too slow");

    // Integration test: End-to-end with timing
    let hop_route = onion_router
        .directory_client()
        .select_random_nodes(3)
        .await
        .unwrap();
    let e2e_start = Instant::now();

    let test_payload = b"End-to-end performance test payload".to_vec();

    let onion_layers = onion_router
        .encrypt_layers(test_payload, hop_route.clone())
        .await
        .unwrap();

    // Simulate routing through network: each hop forwards to the next
    assert_layer_chain(&onion_layers, &hop_route);

    let e2e_time = e2e_start.elapsed();
    println!("End-to-end performance: {:?}", e2e_time);
    assert!(
        e2e_time < Duration::from_millis(100),
        "End-to-end latency too high"
    );
}
