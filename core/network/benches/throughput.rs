use bytes::Bytes;
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use qudag_network::connection::{ConnectionManager, SecureConfig, SecureConnection, TransportKeys};
use qudag_network::types::{ConnectionStatus, PeerId};
use quinn::Endpoint;
use std::net::SocketAddr;
use std::sync::Arc;
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

fn benchmark_message_throughput(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    // Test configuration. `ConnectionManager::connect` simulates a 10 ms handshake
    // per new peer, so the peer count is sized to keep one iteration around 1 s.
    const MSG_COUNT: usize = 800;
    const CONCURRENT_SENDERS: usize = 8;

    // Benchmark concurrent connection setup through one shared manager
    c.bench_function("message_throughput", |b| {
        b.iter(|| {
            rt.block_on(async {
                let manager = Arc::new(ConnectionManager::new(1000));
                let mut handles = vec![];

                // Spawn concurrent senders
                for _ in 0..CONCURRENT_SENDERS {
                    let manager = manager.clone();

                    let handle = tokio::spawn(async move {
                        let messages_per_sender = MSG_COUNT / CONCURRENT_SENDERS;

                        for _ in 0..messages_per_sender {
                            let peer = PeerId::random();
                            manager.connect(peer).await.unwrap();
                            manager.update_status(peer, ConnectionStatus::Connected);
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

    // Benchmark a single connect / status update / lookup round trip
    c.bench_function("message_routing_anonymous_batched", |b| {
        b.iter(|| {
            rt.block_on(async {
                let manager = ConnectionManager::new(100);

                let peer = PeerId::random();
                manager.connect(peer).await.unwrap();
                manager.update_status(peer, ConnectionStatus::Connected);
                black_box(manager.get_status(&peer));
            })
        })
    });
}

fn benchmark_connection_management(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    // Benchmark connection management under load
    c.bench_function("connection_management_high_load", |b| {
        b.iter(|| {
            rt.block_on(async {
                let manager = Arc::new(ConnectionManager::new(1000));
                let mut handles = vec![];

                // Simulate high-load connection management
                for _ in 0..100 {
                    let manager = manager.clone();
                    let handle = tokio::spawn(async move {
                        for _ in 0..100 {
                            let peer = PeerId::random();
                            manager.connect(peer).await.unwrap();
                            manager.update_status(peer, ConnectionStatus::Connected);
                            black_box(manager.get_status(&peer));
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
}

fn benchmark_encryption_performance(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    const MSG_SIZE: usize = 1024;

    // Benchmark encryption performance
    c.bench_function("message_encryption_throughput", |b| {
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
                let data = Bytes::from(vec![0u8; MSG_SIZE]);

                for _ in 0..1000 {
                    connection.send(data.clone()).await.unwrap();
                }

                // Stop the loopback server's accept loop.
                server.close(0u32.into(), b"done");
                endpoint.close(0u32.into(), b"done");
            })
        })
    });
}

criterion_group!(
    name = benches;
    config = Criterion::default().sample_size(10);
    targets = benchmark_message_throughput, benchmark_connection_management, benchmark_encryption_performance
);
criterion_main!(benches);
