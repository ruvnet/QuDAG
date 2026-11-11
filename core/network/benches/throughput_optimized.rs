use bytes::Bytes;
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use qudag_network::connection::{ConnectionManager, SecureConfig, SecureConnection, TransportKeys};
use qudag_network::types::{ConnectionStatus, PeerId};
use quinn::Endpoint;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::runtime::Runtime;

/// Starts a loopback QUIC server with a self-signed certificate for the `qudag`
/// server name and returns a client endpoint that trusts it, plus the server
/// address and endpoint. Must be called from inside a Tokio runtime.
fn loopback_quic() -> (Endpoint, SocketAddr, Endpoint) {
    let cert = rcgen::generate_simple_self_signed(vec!["qudag".to_string()]).unwrap();
    let cert_der = cert.cert.der().clone();
    let key = rustls::pki_types::PrivateKeyDer::Pkcs8(cert.key_pair.serialize_der().into());

    let server_config =
        quinn::ServerConfig::with_single_cert(vec![cert_der.clone()], key).expect("server config");
    let server =
        Endpoint::server(server_config, "127.0.0.1:0".parse().unwrap()).expect("server endpoint");
    let server_addr = server.local_addr().unwrap();

    let acceptor = server.clone();
    tokio::spawn(async move {
        while let Some(incoming) = acceptor.accept().await {
            tokio::spawn(async move {
                if let Ok(conn) = incoming.await {
                    // Hold the connection open until the client goes away.
                    let _ = conn.closed().await;
                }
            });
        }
    });

    let mut roots = rustls::RootCertStore::empty();
    roots.add(cert_der).unwrap();
    let client_config =
        quinn::ClientConfig::with_root_certificates(Arc::new(roots)).expect("client config");
    let mut client = Endpoint::client("127.0.0.1:0".parse().unwrap()).expect("client endpoint");
    client.set_default_client_config(client_config);

    (client, server_addr, server)
}

/// Deterministic peer id whose first four bytes encode `n`.
fn peer_from_index(n: u32) -> PeerId {
    let mut id = [0u8; 32];
    id[0..4].copy_from_slice(&n.to_le_bytes());
    PeerId::from_bytes(id)
}

fn benchmark_optimized_throughput(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    // `ConnectionManager::connect` simulates a 10 ms handshake per new peer, so the
    // workloads below are sized to keep one iteration around 1 s.
    const MSG_COUNT: usize = 1_600;
    const BATCH_SIZE: usize = 32;
    const CONCURRENT_SENDERS: usize = 16;
    const MSG_SIZE: usize = 512; // Optimal message size for network MTU

    // Benchmark high-throughput connection setup with batching
    c.bench_function("ultra_high_throughput", |b| {
        b.iter(|| {
            rt.block_on(async {
                let manager = Arc::new(ConnectionManager::new(10000)); // Higher connection limit
                let mut handles = vec![];

                // Spawn concurrent senders with optimized batching
                for i in 0..CONCURRENT_SENDERS {
                    let manager = manager.clone();

                    let handle = tokio::spawn(async move {
                        let messages_per_sender = MSG_COUNT / CONCURRENT_SENDERS;
                        let peer_base = (i * 1000) as u32; // Unique peer space per sender

                        for j in (0..messages_per_sender).step_by(BATCH_SIZE) {
                            let batch_peers: Vec<PeerId> = (j..(j + BATCH_SIZE)
                                .min(messages_per_sender))
                                .map(|k| peer_from_index(peer_base + k as u32))
                                .collect();

                            // Process batch
                            for batch_peer in batch_peers {
                                manager.connect(batch_peer).await.unwrap();
                                manager.update_status(batch_peer, ConnectionStatus::Connected);
                            }
                        }
                    });
                    handles.push(handle);
                }

                // Wait for all sends to complete
                for handle in handles {
                    handle.await.unwrap();
                }
            })
        })
    });

    // Benchmark optimized connection pooling
    c.bench_function("optimized_connection_pooling", |b| {
        b.iter(|| {
            rt.block_on(async {
                let manager = Arc::new(ConnectionManager::with_pool_timeout(
                    10000,
                    Duration::from_secs(300),
                ));

                let test_peers: Vec<PeerId> = (0..1000).map(peer_from_index).collect();

                // Setup initial connections in parallel
                let setup_handles: Vec<_> = test_peers
                    .chunks(100)
                    .map(|chunk| {
                        let manager = manager.clone();
                        let peers = chunk.to_vec();
                        tokio::spawn(async move {
                            for peer in peers {
                                manager.connect(peer).await.unwrap();
                            }
                        })
                    })
                    .collect();

                for handle in setup_handles {
                    handle.await.unwrap();
                }

                // Disconnecting a healthy connection returns it to the pool.
                for peer in &test_peers {
                    manager.disconnect(peer);
                }

                // Test rapid connection reuse
                let mut reuse_times = Vec::new();
                for chunk in test_peers.chunks(100) {
                    let start = Instant::now();
                    for peer in chunk {
                        manager.connect(*peer).await.unwrap();
                    }
                    reuse_times.push(start.elapsed());
                }

                let avg_reuse = reuse_times.iter().sum::<Duration>() / reuse_times.len() as u32;
                black_box(avg_reuse);
            })
        })
    });

    // Benchmark zero-copy message encryption
    c.bench_function("zero_copy_encryption_benchmark", |b| {
        b.iter(|| {
            rt.block_on(async {
                let config = SecureConfig {
                    transport_keys: TransportKeys::generate(),
                    timeout: std::time::Duration::from_secs(5),
                    keepalive: std::time::Duration::from_secs(10),
                };
                let (endpoint, server_addr, server) = loopback_quic();

                let mut connection = SecureConnection::new(&endpoint, server_addr, config)
                    .await
                    .unwrap();

                // Pre-allocate message buffers for zero-copy operations
                let mut message_buffers: Vec<Bytes> = Vec::with_capacity(10000);
                for i in 0..10000u32 {
                    let mut data = vec![0u8; MSG_SIZE];
                    data[0..4].copy_from_slice(&i.to_le_bytes());
                    message_buffers.push(Bytes::from(data));
                }

                let start = Instant::now();
                for data in message_buffers {
                    connection.send(data).await.unwrap();
                }
                let elapsed = start.elapsed();

                let throughput = 10000.0 / elapsed.as_secs_f64();
                let mb_per_sec = (throughput * MSG_SIZE as f64) / (1024.0 * 1024.0);
                black_box((throughput, mb_per_sec));

                // Stop the loopback server's accept loop.
                server.close(0u32.into(), b"done");
                endpoint.close(0u32.into(), b"done");
            })
        })
    });

    // Benchmark concurrent connection management under extreme load
    c.bench_function("extreme_load_connection_management", |b| {
        b.iter(|| {
            rt.block_on(async {
                let manager = Arc::new(ConnectionManager::new(50000)); // Very high limit
                let mut handles = vec![];

                // Simulate extreme load with many concurrent workers
                for worker_id in 0..32u32 {
                    let manager = manager.clone();
                    let handle = tokio::spawn(async move {
                        for i in 0..100u32 {
                            let peer = peer_from_index(worker_id * 1000 + i);

                            // Rapid connect/update/query/disconnect cycle
                            manager.connect(peer).await.unwrap();
                            manager.update_status(peer, ConnectionStatus::Connected);
                            black_box(manager.get_status(&peer));
                            manager.update_metrics(5000.0, 10);
                            manager.disconnect(&peer);
                        }
                    });
                    handles.push(handle);
                }

                for handle in handles {
                    handle.await.unwrap();
                }
            })
        })
    });

    // Benchmark metrics collection performance
    c.bench_function("high_frequency_metrics_collection", |b| {
        b.iter(|| {
            let manager = ConnectionManager::new(1000);

            // Rapid metrics updates
            for i in 0..10000u64 {
                let msgs_per_sec = 1000.0 + (i as f64 * 0.1);
                let latency_ms = 10 + (i % 100);

                manager.update_metrics(msgs_per_sec, latency_ms);

                if i % 100 == 0 {
                    black_box(manager.get_metrics());
                    black_box(manager.get_queue_metrics());
                    black_box(manager.get_latency_metrics());
                    black_box(manager.get_throughput_metrics());
                }
            }
        })
    });

    // Benchmark auto-recovery mechanisms
    c.bench_function("connection_auto_recovery", |b| {
        b.iter(|| {
            rt.block_on(async {
                let manager = Arc::new(ConnectionManager::new(1000));

                // Setup some connections
                for i in 0..100 {
                    manager.connect(peer_from_index(i)).await.unwrap();
                }

                // Simulate some connection failures
                for i in 0..50 {
                    manager.update_status(
                        peer_from_index(i),
                        ConnectionStatus::Failed("Simulated failure".into()),
                    );
                }

                // Test recovery
                let start = Instant::now();
                let recovered = black_box(manager.auto_recover().await.unwrap());
                let recovery_time = start.elapsed();

                black_box((recovered, recovery_time));
            })
        })
    });
}

criterion_group!(
    name = optimized_benches;
    config = Criterion::default().sample_size(10);
    targets = benchmark_optimized_throughput
);
criterion_main!(optimized_benches);
