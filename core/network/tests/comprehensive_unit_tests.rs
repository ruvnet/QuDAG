//! Comprehensive unit tests for all network components
//!
//! This module provides exhaustive testing coverage for individual network components,
//! ensuring each module functions correctly in isolation.

use qudag_crypto::ml_dsa::MlDsaKeyPair;
use qudag_crypto::ml_kem::MlKem768;
use qudag_network::{
    connection::ConnectionManager,
    dark_resolver::{DarkDomainRecord, DarkResolver, DarkResolverError},
    discovery::{
        DiscoveredPeer, DiscoveryConfig, DiscoveryEvent, DiscoveryMethod, KademliaPeerDiscovery,
    },
    dns::{DnsRecord, RecordType},
    message::MessageEnvelope,
    onion::{
        MLKEMOnionRouter, MetadataConfig, MetadataProtector, MixConfig, MixMessage, MixMessageType,
        MixNode, OnionError, TrafficAnalysisConfig, TrafficAnalysisResistance,
    },
    quantum_crypto::{MlKemSecurityLevel, QuantumKeyExchange},
    router::Router,
    shadow_address::{
        DefaultShadowAddressHandler, NetworkType, ShadowAddressGenerator, ShadowAddressResolver,
    },
    transport::TransportConfig,
    types::{
        ConnectionStatus, MessagePriority, NetworkAddress, NetworkMessage, PeerId, RoutingStrategy,
    },
    NetworkConfig, NetworkManager, ReputationManager,
};
use std::net::SocketAddr;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// Network manager configuration without NAT traversal, so the manager never
/// contacts public STUN/UPnP endpoints during unit tests.
fn offline_network_config() -> NetworkConfig {
    NetworkConfig {
        enable_nat_traversal: false,
        ..NetworkConfig::default()
    }
}

/// `NetworkManager` records connections from a background event task, so the
/// connected-peer set converges shortly after `connect_peer`/`disconnect_peer`
/// return. Wait (bounded) for it to reach the expected size.
async fn wait_for_connected_peers(manager: &NetworkManager, expected: usize) -> usize {
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        let count = manager.get_connected_peers().await.len();
        if count == expected || Instant::now() >= deadline {
            return count;
        }
        tokio::time::sleep(Duration::from_millis(5)).await;
    }
}

mod connection_tests {
    use super::*;

    #[tokio::test]
    async fn test_connection_manager_lifecycle() {
        let manager = ConnectionManager::new(100);

        // Test basic connection operations
        let peer_id = PeerId::random();
        assert!(manager.connect(peer_id).await.is_ok());
        assert_eq!(manager.connection_count(), 1);

        // Test status updates
        manager.update_status(peer_id, ConnectionStatus::Connected);
        assert_eq!(
            manager.get_status(&peer_id),
            Some(ConnectionStatus::Connected)
        );

        // Test metrics
        manager.update_metrics(1000.0, 50);
        let metrics = manager.get_metrics();
        assert_eq!(metrics.active_connections, 1);
        assert!(metrics.messages_per_second > 0.0);

        // Test disconnection
        manager.disconnect(&peer_id);
        assert_eq!(manager.connection_count(), 0);
        assert_eq!(manager.get_status(&peer_id), None);
    }

    #[tokio::test]
    async fn test_connection_limits() {
        let manager = ConnectionManager::new(3); // Small limit for testing

        let peers: Vec<_> = (0..5).map(|_| PeerId::random()).collect();
        let mut successful_connections = 0;

        for peer in peers {
            if manager.connect(peer).await.is_ok() {
                successful_connections += 1;
            }
        }

        // Should enforce the limit
        assert!(successful_connections <= 3);
        assert!(manager.connection_count() <= 3);
    }

    #[tokio::test]
    async fn test_connection_health_monitoring() {
        let manager = ConnectionManager::new(10);

        // Create some connections
        let peers: Vec<_> = (0..5).map(|_| PeerId::random()).collect();
        for peer in &peers {
            manager.connect(*peer).await.unwrap();
            manager.update_status(*peer, ConnectionStatus::Connected);
        }

        // Simulate unhealthy connections
        manager.update_status(peers[0], ConnectionStatus::Failed("Timeout".into()));
        manager.update_status(peers[1], ConnectionStatus::Failed("Network error".into()));

        // Health statistics are now derived from health_check() (unhealthy
        // peers) and get_healthy_connections() (healthy peers by quality).
        assert_eq!(manager.connection_count(), 5);
        let unhealthy = manager.health_check().await.unwrap();
        assert_eq!(unhealthy.len(), 2);
        assert!(unhealthy.contains(&peers[0]));
        assert!(unhealthy.contains(&peers[1]));

        let healthy = manager.get_healthy_connections();
        assert_eq!(healthy.len(), 3);
        assert!(healthy
            .iter()
            .all(|(peer, _)| *peer != peers[0] && *peer != peers[1]));
    }

    #[tokio::test]
    async fn test_connection_auto_recovery() {
        let manager = ConnectionManager::new(10);

        // Create connections and mark some as failed
        let peers: Vec<_> = (0..5).map(|_| PeerId::random()).collect();
        for peer in &peers {
            manager.connect(*peer).await.unwrap();
        }

        // Mark some as failed
        manager.update_status(peers[0], ConnectionStatus::Failed("Network error".into()));
        manager.update_status(peers[1], ConnectionStatus::Failed("Timeout".into()));

        // Test auto-recovery
        let recovered = manager.auto_recover().await.unwrap();
        assert_eq!(recovered, 2);

        // Verify connections are healthy again
        assert_eq!(
            manager.get_status(&peers[0]),
            Some(ConnectionStatus::Connected)
        );
        assert_eq!(
            manager.get_status(&peers[1]),
            Some(ConnectionStatus::Connected)
        );
    }
}

mod peer_tests {
    use super::*;

    #[tokio::test]
    async fn test_peer_discovery_integration() {
        // Test peer discovery with Kademlia
        let bootstrap: SocketAddr = "127.0.0.1:8080".parse().unwrap();
        let config = DiscoveryConfig {
            methods: vec![DiscoveryMethod::Kademlia],
            interval: 30,
            max_peers: 100,
            bootstrap_nodes: vec![bootstrap],
            ..DiscoveryConfig::default()
        };

        let discovery = KademliaPeerDiscovery::new(config);
        // Note: This would need actual network setup for full integration testing
        assert!(discovery.get_discovered_peers().await.is_empty());

        // Test discovery event handling
        let discovered_peer = libp2p::PeerId::random();
        let address: SocketAddr = "127.0.0.1:8081".parse().unwrap();
        let event = DiscoveryEvent::PeerDiscovered(DiscoveredPeer::new(
            discovered_peer,
            address,
            DiscoveryMethod::Kademlia,
        ));

        // In a real implementation, this would be handled by the discovery service
        match event {
            DiscoveryEvent::PeerDiscovered(peer) => {
                assert_eq!(peer.peer_id, discovered_peer);
                assert_eq!(peer.addresses, vec![address]);
                assert_eq!(peer.discovery_method, DiscoveryMethod::Kademlia);
                // A freshly discovered peer starts at the neutral score
                assert_eq!(peer.reputation, 50.0);
                assert_eq!(peer.connection_attempts, 0);
                assert!(!peer.is_blacklisted);
            }
            other => panic!("unexpected discovery event: {:?}", other),
        }
    }
}

mod router_tests {
    use super::*;

    #[tokio::test]
    async fn test_anonymous_routing() {
        let router = Router::new().await.unwrap();

        // Add test peers
        let peers: Vec<_> = (0..10).map(|_| PeerId::random()).collect();
        for peer in &peers {
            router.add_peer(*peer).await;
        }

        let msg = NetworkMessage {
            id: "test_route".into(),
            source: peers[0].to_bytes().to_vec(),
            destination: peers[9].to_bytes().to_vec(),
            payload: vec![0; 100],
            priority: MessagePriority::Normal,
            ttl: Duration::from_secs(60),
        };

        // Test anonymous routing
        let route = router
            .route(&msg, RoutingStrategy::Anonymous { hops: 3 })
            .await
            .unwrap();

        assert_eq!(route.len(), 3);

        // Verify route doesn't contain source or destination
        assert!(!route.contains(&peers[0]));
        assert!(!route.contains(&peers[9]));

        // Verify all peers in route are unique
        let mut unique_check = std::collections::HashSet::new();
        for peer in &route {
            assert!(unique_check.insert(*peer));
        }
    }

    #[tokio::test]
    async fn test_hop_information() {
        let router = Router::new().await.unwrap();

        let peers: Vec<_> = (0..5).map(|_| PeerId::random()).collect();
        for peer in &peers {
            router.add_peer(*peer).await;
        }

        let msg = NetworkMessage {
            id: "hop_test".into(),
            source: peers[0].to_bytes().to_vec(),
            destination: peers[4].to_bytes().to_vec(),
            payload: vec![0; 100],
            priority: MessagePriority::Normal,
            ttl: Duration::from_secs(60),
        };

        let route = router
            .route(&msg, RoutingStrategy::Anonymous { hops: 3 })
            .await
            .unwrap();
        assert_eq!(route.len(), 3);

        // Anonymous routes are now built from onion-directory relays, and hop
        // information is tracked for the peers added to the router, not for
        // the relays. Check hop information for every known peer.
        for (i, peer_id) in peers.iter().enumerate() {
            let hop_info = router.get_hop_info(peer_id).await;
            assert!(hop_info.is_ok());

            let info = hop_info.unwrap();
            assert!(info.can_decrypt_layer(i));
            assert!(!info.knows_peer(peer_id));

            // Verify isolation - each hop only knows a bounded subset of the
            // network (the router assigns at most 3 neighbours per peer).
            let known_peers = peers.iter().filter(|p| info.knows_peer(p)).count();
            assert!(known_peers <= 3);
        }

        // Unknown peers have no hop information
        assert!(router.get_hop_info(&PeerId::random()).await.is_err());
    }

    #[tokio::test]
    async fn test_routing_strategies() {
        let router = Router::new().await.unwrap();

        let peers: Vec<_> = (0..20).map(|_| PeerId::random()).collect();
        for peer in &peers {
            router.add_peer(*peer).await;
        }

        let msg = NetworkMessage {
            id: "strategy_test".into(),
            source: peers[0].to_bytes().to_vec(),
            destination: peers[19].to_bytes().to_vec(),
            payload: vec![0; 100],
            priority: MessagePriority::Normal,
            ttl: Duration::from_secs(60),
        };

        // Test different routing strategies
        let anonymous_route = router
            .route(&msg, RoutingStrategy::Anonymous { hops: 5 })
            .await
            .unwrap();
        assert_eq!(anonymous_route.len(), 5);

        let direct_route = router
            .route(&msg, RoutingStrategy::Direct(peers[19].to_bytes().to_vec()))
            .await
            .unwrap();
        assert_eq!(direct_route.len(), 1);
        assert_eq!(direct_route[0], peers[19]); // Should route directly to destination
    }
}

mod onion_tests {
    use super::*;

    #[tokio::test]
    async fn test_onion_layer_creation() {
        let router = MLKEMOnionRouter::new().await.unwrap();

        let payload = b"secret message".to_vec();
        // Hops are node ids from the directory the router resolves keys from
        let route = router
            .directory_client()
            .select_random_nodes(3)
            .await
            .unwrap();

        // Create onion layers
        let layers = router.encrypt_layers(payload, route.clone()).await;
        assert!(layers.is_ok());

        let onion_layers = layers.unwrap();
        assert_eq!(onion_layers.len(), 3);

        // Layers are returned outermost first and each outer layer wraps the
        // inner ones, so it is never smaller (encryption overhead).
        for i in 1..onion_layers.len() {
            assert!(onion_layers[i - 1].payload.len() >= onion_layers[i].payload.len());
        }

        // Each layer points at the next hop; the innermost one has no next hop.
        for i in 0..onion_layers.len() - 1 {
            assert_eq!(onion_layers[i].next_hop, route[i + 1]);
        }
        assert!(onion_layers.last().unwrap().next_hop.is_empty());
    }

    #[tokio::test]
    async fn test_onion_layer_peeling() {
        let router = MLKEMOnionRouter::new().await.unwrap();

        let original_payload = b"test message for onion routing".to_vec();
        let route = router
            .directory_client()
            .select_random_nodes(3)
            .await
            .unwrap();

        // Create onion layers
        let layers = router
            .encrypt_layers(original_payload.clone(), route)
            .await
            .unwrap();

        // Every layer is sealed to its hop's ML-KEM key; a node that is not
        // on the route (this router) must not be able to peel any of them.
        // Relay secret keys are held by the relays, so a full peel is not
        // reproducible from the public API.
        for layer in &layers {
            let peeled = router.decrypt_layer(layer.clone());
            assert!(matches!(
                peeled,
                Err(OnionError::MLKEMError(_)) | Err(OnionError::DecryptionError(_))
            ));
            // The plaintext never appears in any layer
            assert!(!layer
                .payload
                .windows(original_payload.len())
                .any(|w| w == original_payload.as_slice()));
        }
    }

    #[tokio::test]
    async fn test_metadata_protection() {
        let config = MetadataConfig {
            anonymize_ip: true,
            obfuscate_timing: true,
            normalize_size: true,
            randomize_headers: true,
            timing_bucket_ms: 100,
        };

        let protector = MetadataProtector::with_config(config);

        let original_data = b"sensitive data".to_vec();
        let before_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let protected = protector.protect_metadata(&original_data).unwrap();

        // Protected size should be larger due to padding, normalized to the
        // smallest standard packet size (512 bytes).
        assert!(protected.normalized_size >= original_data.len());
        assert_eq!(protected.normalized_size, 512);
        assert_eq!(
            protected.padding.len(),
            protected.normalized_size - original_data.len()
        );

        // Should have timing protection: the timestamp is bucketed with jitter
        // inside the 100ms bucket, so it stays within one bucket of "now".
        let after_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        assert!(protected.obfuscated_timestamp + 100 > before_ms);
        assert!(protected.obfuscated_timestamp < after_ms + 100);

        // Headers are randomized and routing ids are anonymous
        assert!(protected.random_headers.len() >= 2);
        assert!(!protected.anonymous_ids.is_empty());
    }

    #[tokio::test]
    async fn test_traffic_analysis_resistance() {
        let config = TrafficAnalysisConfig::default();
        let resistance = TrafficAnalysisResistance::with_config(config);

        let message = |content: Vec<u8>| MixMessage {
            content,
            priority: 1,
            timestamp: 0,
            message_type: MixMessageType::Real,
            normalized_size: 0,
        };

        // Message sizes are reshaped to the packet sizes of a known traffic
        // pattern (512..=4096 bytes): small messages are padded up and large
        // messages are cut down.
        let mut messages = vec![message(vec![0u8; 100]), message(vec![0u8; 3000])];
        resistance.apply_resistance(&mut messages).await.unwrap();

        for msg in &messages {
            assert!(msg.content.len() >= 512 && msg.content.len() <= 4096);
            assert_eq!(msg.content.len(), msg.normalized_size);
        }
    }

    #[tokio::test]
    async fn test_mix_node_operations() {
        let config = MixConfig {
            batch_size: 10,
            batch_timeout: Duration::from_millis(100),
            target_rate: 50.0,
            dummy_probability: 0.0,
            timing_obfuscation: true,
        };

        let mut mix_node = MixNode::with_config(b"mix-node".to_vec(), config);

        // Add a full batch of messages to mix (10 messages, so an unchanged
        // order after shuffling has probability 1/10!)
        let original_order: Vec<Vec<u8>> = (0..10)
            .map(|i| format!("message_{}", i).into_bytes())
            .collect();
        for content in &original_order {
            mix_node
                .add_message(MixMessage {
                    content: content.clone(),
                    priority: 1,
                    timestamp: 0,
                    message_type: MixMessageType::Real,
                    normalized_size: 0,
                })
                .await
                .unwrap();
        }
        assert_eq!(mix_node.get_stats().buffer_size, 10);
        assert!(mix_node.should_flush());

        // Process batch
        let mixed_messages = mix_node.flush_batch().await.unwrap();
        assert_eq!(mixed_messages.len(), 10);

        // Messages should be reordered (mixed) but none lost
        let mixed_contents: Vec<Vec<u8>> =
            mixed_messages.iter().map(|m| m.content.clone()).collect();
        assert_ne!(mixed_contents, original_order);
        let mut sorted = mixed_contents.clone();
        sorted.sort();
        let mut expected = original_order.clone();
        expected.sort();
        assert_eq!(sorted, expected);

        // Get statistics: the batch was drained and no dummies were needed
        let stats = mix_node.get_stats();
        assert_eq!(stats.buffer_size, 0);
        assert_eq!(stats.dummy_ratio, 0.0);
    }
}

mod quantum_crypto_tests {
    use super::*;

    #[tokio::test]
    async fn test_quantum_key_exchange() {
        // Test different security levels
        for level in [
            MlKemSecurityLevel::Level512,
            MlKemSecurityLevel::Level768,
            MlKemSecurityLevel::Level1024,
        ] {
            let mut alice_kx = QuantumKeyExchange::with_security_level(level);
            let mut bob_kx = QuantumKeyExchange::with_security_level(level);

            alice_kx.initialize().unwrap();
            let bob_public = bob_kx.initialize().unwrap();
            assert_eq!(bob_public.security_level, level);

            // Test encapsulation/decapsulation
            let (ciphertext, alice_shared_secret) =
                alice_kx.initiate_exchange(&bob_public).unwrap();

            // Verify ciphertext sizes are correct for security level
            match level {
                MlKemSecurityLevel::Level512 => assert_eq!(ciphertext.ciphertext.len(), 768),
                MlKemSecurityLevel::Level768 => assert_eq!(ciphertext.ciphertext.len(), 1088),
                MlKemSecurityLevel::Level1024 => assert_eq!(ciphertext.ciphertext.len(), 1568),
            }

            let bob_shared_secret = bob_kx.complete_exchange(&ciphertext).unwrap();

            // Shared secrets should match
            assert_eq!(alice_shared_secret.as_bytes(), bob_shared_secret.as_bytes());
            assert_eq!(alice_shared_secret.as_bytes().len(), 32); // 256 bits
        }
    }

    #[tokio::test]
    async fn test_quantum_security_properties() {
        let mut initiator = QuantumKeyExchange::new();
        let mut responder = QuantumKeyExchange::new();
        initiator.initialize().unwrap();
        let public_key = responder.initialize().unwrap();

        // Test freshness - each encapsulation should produce a different ciphertext
        let (ciphertext1, _) = initiator.initiate_exchange(&public_key).unwrap();
        let (ciphertext2, _) = initiator.initiate_exchange(&public_key).unwrap();
        assert_ne!(ciphertext1.ciphertext, ciphertext2.ciphertext);

        // Test that invalid ciphertexts are rejected
        let (valid_ciphertext, _) = initiator.initiate_exchange(&public_key).unwrap();
        let valid_secret = responder.complete_exchange(&valid_ciphertext).unwrap();

        // Corrupt the ciphertext
        let mut corrupted_ciphertext = valid_ciphertext.clone();
        corrupted_ciphertext.ciphertext[0] ^= 0xFF;

        // Decapsulation should fail or produce different shared secret
        let result = responder.complete_exchange(&corrupted_ciphertext);
        if let Ok(corrupted_secret) = result {
            assert_ne!(corrupted_secret.as_bytes(), valid_secret.as_bytes());
        }
    }

    #[tokio::test]
    async fn test_quantum_performance() {
        let mut initiator = QuantumKeyExchange::with_security_level(MlKemSecurityLevel::Level768);
        let mut responder = QuantumKeyExchange::with_security_level(MlKemSecurityLevel::Level768);
        initiator.initialize().unwrap();
        let public_key = responder.initialize().unwrap();

        let start = Instant::now();
        let iterations = 100;

        for _ in 0..iterations {
            let (ciphertext, _shared_secret) = initiator.initiate_exchange(&public_key).unwrap();
            let _decapsulated = responder.complete_exchange(&ciphertext).unwrap();
        }

        let elapsed = start.elapsed();
        let ops_per_sec = iterations as f64 / elapsed.as_secs_f64();

        // Performance should be reasonable (at least 10 ops/sec)
        assert!(
            ops_per_sec > 10.0,
            "Quantum crypto performance too slow: {} ops/sec",
            ops_per_sec
        );
    }
}

mod shadow_address_tests {
    use super::*;

    #[tokio::test]
    async fn test_shadow_address_generation() {
        let handler = DefaultShadowAddressHandler::new(NetworkType::Testnet, [7u8; 32]);

        // Shadow addresses are now view/spend key pairs bound to a network
        let addr = handler.generate_address(NetworkType::Testnet).unwrap();
        assert_eq!(addr.view_key.len(), 32);
        assert_eq!(addr.spend_key.len(), 32);
        assert_ne!(addr.view_key, addr.spend_key);
        assert_eq!(addr.metadata.network, NetworkType::Testnet);
        assert!(handler.validate_address(&addr).unwrap());

        // Addresses for another network are not valid for this handler
        let mainnet_addr = handler.generate_address(NetworkType::Mainnet).unwrap();
        assert!(!handler.validate_address(&mainnet_addr).unwrap());
    }

    #[tokio::test]
    async fn test_shadow_address_resolution() {
        let handler = DefaultShadowAddressHandler::new(NetworkType::Testnet, [9u8; 32]);

        // Create test shadow address
        let shadow_addr = handler.generate_address(NetworkType::Testnet).unwrap();

        // Test resolution
        let resolved = handler.resolve_address(&shadow_addr);
        assert!(resolved.is_ok());

        let resolved_bytes = resolved.unwrap();
        assert_eq!(&resolved_bytes[..32], shadow_addr.view_key.as_slice());
        assert_eq!(&resolved_bytes[32..64], shadow_addr.spend_key.as_slice());
        assert!(handler
            .check_address(&shadow_addr, &resolved_bytes)
            .unwrap());

        // A different address does not resolve to the same one-time bytes
        let other = handler.generate_address(NetworkType::Testnet).unwrap();
        assert!(!handler.check_address(&other, &resolved_bytes).unwrap());
    }

    #[tokio::test]
    async fn test_shadow_address_privacy() {
        let handler = DefaultShadowAddressHandler::new(NetworkType::Testnet, [3u8; 32]);

        // Generate multiple addresses and ensure they're different
        let mut addresses = std::collections::HashSet::new();
        for _ in 0..100 {
            let addr = handler.generate_address(NetworkType::Testnet).unwrap();
            assert!(addresses.insert(addr.view_key)); // Should be unique
        }

        // Test that addresses don't reveal patterns
        let addresses: Vec<_> = addresses.into_iter().collect();
        for i in 0..addresses.len() - 1 {
            let addr1 = &addresses[i];
            let addr2 = &addresses[i + 1];

            // Should not have obvious sequential patterns
            let common_prefix_len = addr1
                .iter()
                .zip(addr2.iter())
                .take_while(|(a, b)| a == b)
                .count();

            // Common prefix of the random key bytes should be small
            assert!(common_prefix_len < 5);
        }
    }
}

mod transport_tests {
    use super::*;

    #[tokio::test]
    async fn test_transport_config() {
        let config = TransportConfig {
            max_message_size: 1024 * 1024,
            connection_timeout: Duration::from_secs(30),
            handshake_timeout: Duration::from_secs(10),
            buffer_size: 64 * 1024,
            ..TransportConfig::default()
        };

        // Test that config values are reasonable
        assert!(config.max_message_size > 0);
        assert!(config.connection_timeout > Duration::ZERO);
        assert!(config.handshake_timeout > Duration::ZERO);
        assert!(config.buffer_size > 0);

        // Test validation
        assert!(config.max_message_size <= 16 * 1024 * 1024); // Reasonable max
        assert!(config.connection_timeout <= Duration::from_secs(300)); // Reasonable timeout
        assert!(config.handshake_timeout <= config.connection_timeout);
    }

    #[tokio::test]
    async fn test_async_transport_interface() {
        // This would test the AsyncTransport trait implementation
        // For now, we test the interface design

        let config = TransportConfig::default();

        // In a real implementation, this would create an actual transport
        // For testing, we verify the default configuration. The default
        // maximum message size is now 16 MiB.
        assert_eq!(config.max_message_size, 16 * 1024 * 1024);
        assert_eq!(config.connection_timeout, Duration::from_secs(30));
        assert!(config.use_post_quantum);
    }
}

mod dns_tests {
    use super::*;

    #[tokio::test]
    async fn test_dns_record_creation() {
        let record = DnsRecord {
            name: "test.example.com".to_string(),
            record_type: RecordType::A,
            content: "192.0.2.1".to_string(),
            ttl: 300,
            proxied: false,
        };

        assert_eq!(record.name, "test.example.com");
        assert!(matches!(record.record_type, RecordType::A));
        assert_eq!(record.content, "192.0.2.1");
        assert_eq!(record.ttl, 300);
        assert!(!record.proxied);
    }
}

mod dark_resolver_tests {
    use super::*;

    #[tokio::test]
    async fn test_dark_domain_record() {
        let mut rng = rand::thread_rng();
        let signing_keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let (encryption_key, _) = MlKem768::keygen().unwrap();
        let owner = PeerId::random();

        let record = DarkDomainRecord::new(
            &signing_keypair,
            encryption_key.as_bytes().to_vec(),
            vec![NetworkAddress::new([192, 0, 2, 100], 8080)],
            Some("dark.test".to_string()),
            3600,
            owner,
        )
        .unwrap();

        assert_eq!(record.alias.as_deref(), Some("dark.test"));
        assert_eq!(
            record.addresses,
            vec![NetworkAddress::new([192, 0, 2, 100], 8080)]
        );
        assert_eq!(record.addresses[0].port, 8080);
        assert_eq!(record.owner_id, owner);
        assert_eq!(record.expires_at, record.registered_at + 3600);
        assert!(!record.is_expired());
        assert!(record.verify_signature().is_ok());
    }

    #[tokio::test]
    async fn test_dark_resolver_operations() {
        let resolver = DarkResolver::new();
        let mut rng = rand::thread_rng();
        let target = NetworkAddress::new([10, 0, 0, 1], 9999);

        // Test adding record
        let registered = resolver.register_domain(
            Some("testdark"),
            vec![target.clone()],
            None,
            3600,
            PeerId::random(),
            &mut rng,
        );
        assert!(registered.is_ok());
        assert_eq!(registered.unwrap().domain, "testdark.dark");

        // Test resolving
        let resolved = resolver.lookup_domain("testdark.dark");
        assert!(resolved.is_ok());

        let resolved_record = resolved.unwrap();
        assert_eq!(resolved_record.addresses, vec![target.clone()]);
        assert_eq!(resolved_record.addresses[0].port, 9999);
        assert_eq!(
            resolver.resolve_addresses("testdark.dark").unwrap(),
            vec![target]
        );

        // Records are removed when they expire (there is no manual removal):
        // register one with a zero TTL and let it lapse.
        resolver
            .register_domain(
                Some("shortlived"),
                vec![NetworkAddress::new([10, 0, 0, 2], 9999)],
                None,
                0,
                PeerId::random(),
                &mut rng,
            )
            .unwrap();
        tokio::time::sleep(Duration::from_millis(1100)).await;
        assert_eq!(resolver.cleanup_expired().unwrap(), 1);

        // Should no longer resolve
        let not_found = resolver.lookup_domain("shortlived.dark");
        assert!(matches!(not_found, Err(DarkResolverError::DomainNotFound)));

        // The live record is unaffected
        assert!(resolver.lookup_domain("testdark.dark").is_ok());
    }
}

mod network_manager_tests {
    use super::*;

    #[tokio::test]
    async fn test_network_manager_initialization() {
        let mut manager = NetworkManager::with_config(offline_network_config());

        // Test initialization
        assert!(manager.initialize().await.is_ok());
        assert!(manager.local_peer_id().is_some());

        // Test configuration
        let config = NetworkConfig {
            max_connections: 25,
            connection_timeout: Duration::from_secs(15),
            discovery_interval: Duration::from_secs(30),
            bootstrap_peers: vec!["127.0.0.1:8080".to_string()],
            enable_dht: true,
            quantum_resistant: true,
            enable_nat_traversal: false,
            nat_traversal_config: None,
        };

        // The configuration is private; verify it through behaviour: the
        // connection limit is enforced at max_connections.
        let mut configured_manager = NetworkManager::with_config(config.clone());
        configured_manager.initialize().await.unwrap();
        // Each address is a distinct peer (the peer id is derived from the address)
        for port in 8080..8105 {
            assert!(configured_manager
                .connect_peer(&format!("127.0.0.1:{}", port))
                .await
                .is_ok());
        }
        assert!(configured_manager
            .connect_peer("127.0.0.1:8105")
            .await
            .is_err());
    }

    #[tokio::test]
    async fn test_peer_management() {
        let mut manager = NetworkManager::with_config(offline_network_config());
        manager.initialize().await.unwrap();

        // Test connecting to peer
        let peer_id = manager.connect_peer("127.0.0.1:8080").await.unwrap();

        assert_eq!(wait_for_connected_peers(&manager, 1).await, 1);
        let connected_peers = manager.get_connected_peers().await;
        assert!(connected_peers.contains(&peer_id));

        // Test getting peer metadata
        let metadata = manager.get_peer_metadata(&peer_id).await;
        assert!(metadata.is_some());

        // Test sending message
        let message_data = b"test message".to_vec();
        assert!(manager.send_message(&peer_id, message_data).await.is_ok());

        // Test disconnecting
        assert!(manager.disconnect_peer(&peer_id).await.is_ok());

        assert_eq!(wait_for_connected_peers(&manager, 0).await, 0);
    }

    #[tokio::test]
    async fn test_reputation_management() {
        let mut manager = NetworkManager::with_config(offline_network_config());
        manager.initialize().await.unwrap();

        let peer_id = manager.connect_peer("127.0.0.1:8080").await.unwrap();
        assert_eq!(wait_for_connected_peers(&manager, 1).await, 1);

        // Test adding trusted peer
        manager.add_trusted_peer(peer_id).await;

        let stats = manager.get_network_stats().await;
        assert_eq!(stats.trusted_peers, 1);

        // Test blacklisting peer
        manager.blacklist_peer(peer_id).await;

        assert_eq!(wait_for_connected_peers(&manager, 0).await, 0); // Should be disconnected
        let updated_stats = manager.get_network_stats().await;
        assert_eq!(updated_stats.blacklisted_peers, 1);
        assert_eq!(updated_stats.connected_peers, 0);

        // Test that blacklisted peer cannot reconnect
        let reconnect_result = manager.connect_peer("127.0.0.1:8080").await;
        assert!(reconnect_result.is_err());
    }

    #[tokio::test]
    async fn test_maintenance_operations() {
        let mut manager = NetworkManager::with_config(offline_network_config());
        manager.initialize().await.unwrap();

        // Connect some peers
        let _peer1 = manager.connect_peer("127.0.0.1:8080").await.unwrap();
        let _peer2 = manager.connect_peer("127.0.0.1:8081").await.unwrap();

        assert_eq!(wait_for_connected_peers(&manager, 2).await, 2);

        // Run maintenance - recently active peers must survive it
        manager.maintenance().await;
        assert_eq!(manager.get_connected_peers().await.len(), 2);

        // For this test, we'd need to simulate time passage or modify timestamps
        // In a real scenario, inactive peers would be disconnected

        // Test shutdown
        assert!(manager.shutdown().await.is_ok());
        assert_eq!(wait_for_connected_peers(&manager, 0).await, 0);
    }
}

mod reputation_tests {
    use super::*;

    #[tokio::test]
    async fn test_reputation_manager() {
        let mut rep_manager = ReputationManager::default();

        let peer_id = libp2p::PeerId::random();

        // Test initial reputation
        assert_eq!(rep_manager.get_reputation(&peer_id), 0.0);

        // Test reputation updates
        rep_manager.update_reputation(peer_id, 25.0);
        assert_eq!(rep_manager.get_reputation(&peer_id), 25.0);

        rep_manager.update_reputation(peer_id, -10.0);
        assert_eq!(rep_manager.get_reputation(&peer_id), 15.0);

        // Test reputation bounds
        rep_manager.update_reputation(peer_id, 200.0); // Should be clamped
        assert_eq!(rep_manager.get_reputation(&peer_id), 100.0);

        rep_manager.update_reputation(peer_id, -300.0); // Should be clamped and blacklisted
        assert_eq!(rep_manager.get_reputation(&peer_id), -100.0);
        assert!(rep_manager.is_blacklisted(&peer_id));
    }

    #[tokio::test]
    async fn test_trusted_peers() {
        let mut rep_manager = ReputationManager::default();

        let peer_id = libp2p::PeerId::random();

        // Test adding trusted peer
        rep_manager.add_trusted(peer_id);
        assert!(rep_manager.is_trusted(&peer_id));
        assert_eq!(rep_manager.get_reputation(&peer_id), 75.0);
    }

    #[tokio::test]
    async fn test_blacklist_cleanup() {
        let mut rep_manager = ReputationManager::default();

        let peer_id = libp2p::PeerId::random();

        // Blacklist peer
        rep_manager.update_reputation(peer_id, -100.0);
        assert!(rep_manager.is_blacklisted(&peer_id));

        // Test cleanup (would need time manipulation in real test)
        rep_manager.cleanup_expired();

        // For now, peer should still be blacklisted since time hasn't passed
        assert!(rep_manager.is_blacklisted(&peer_id));
    }
}

#[tokio::test]
async fn test_message_envelope_integrity() {
    let msg = NetworkMessage {
        id: "integrity_test".into(),
        source: vec![1, 2, 3, 4],
        destination: vec![5, 6, 7, 8],
        payload: b"test payload".to_vec(),
        priority: MessagePriority::High,
        ttl: Duration::from_secs(60),
    };

    let envelope = MessageEnvelope::new(msg.clone());

    // Test verification
    assert!(envelope.verify());

    // Test that tampering is detected
    let mut tampered_envelope = envelope.clone();
    tampered_envelope.message.payload = b"tampered payload".to_vec();

    // Should fail verification due to hash mismatch
    assert!(!tampered_envelope.verify());
}

#[tokio::test]
async fn test_comprehensive_integration() {
    // Test integration between multiple components
    let mut network_manager = NetworkManager::with_config(offline_network_config());
    network_manager.initialize().await.unwrap();

    let router = Router::new().await.unwrap();
    let connection_manager = ConnectionManager::new(100);

    // Add peers to router
    let peers: Vec<_> = (0..5).map(|_| PeerId::random()).collect();
    for peer in &peers {
        router.add_peer(*peer).await;
        connection_manager.connect(*peer).await.unwrap();
    }

    // Create and route a message
    let msg = NetworkMessage {
        id: "integration_test".into(),
        source: peers[0].to_bytes().to_vec(),
        destination: peers[4].to_bytes().to_vec(),
        payload: b"integration test message".to_vec(),
        priority: MessagePriority::Normal,
        ttl: Duration::from_secs(60),
    };

    let route = router
        .route(&msg, RoutingStrategy::Anonymous { hops: 3 })
        .await
        .unwrap();

    assert_eq!(route.len(), 3);
    assert!(!route.contains(&peers[0]));
    assert!(!route.contains(&peers[4]));

    // Anonymous routes run over onion-directory relays rather than the peers
    // held by the connection manager; the simulated handshake completes, so
    // every peer the manager connected is Connected.
    for peer in &peers {
        assert_eq!(
            connection_manager.get_status(peer),
            Some(ConnectionStatus::Connected)
        );
    }

    // Test network statistics
    let stats = network_manager.get_network_stats().await;
    assert_eq!(stats.connected_peers, 0);
    assert!(stats.average_reputation >= -100.0 && stats.average_reputation <= 100.0);
}
