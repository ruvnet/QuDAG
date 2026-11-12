use criterion::{black_box, criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion};
use qudag_network::{
    CircuitManager, MLKEMOnionRouter, MessagePriority, NetworkMessage, PeerId, Router,
    RoutingStrategy,
};
use std::time::Duration;

async fn setup_test_network(size: usize) -> Router {
    let router = Router::new().await.unwrap();

    // Add test peers
    for _ in 0..size {
        router.add_peer(PeerId::random()).await;
    }

    router
}

fn test_message(payload_size: usize) -> NetworkMessage {
    NetworkMessage {
        id: "test".into(),
        source: PeerId::random().to_bytes().to_vec(),
        destination: PeerId::random().to_bytes().to_vec(),
        payload: vec![0; payload_size],
        priority: MessagePriority::Normal,
        ttl: Duration::from_secs(60),
    }
}

fn bench_route_computation(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let mut group = c.benchmark_group("route_computation");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::new("anonymous_route", size),
            size,
            |b, &size| {
                let router = rt.block_on(setup_test_network(size));
                let msg = test_message(32);

                b.to_async(&rt).iter(|| async {
                    black_box(
                        router
                            .route(&msg, RoutingStrategy::Anonymous { hops: 3 })
                            .await
                            .unwrap(),
                    )
                });
            },
        );
    }

    group.finish();
}

fn bench_circuit_setup(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    // Circuits are built from the onion router's node directory.
    let directory =
        rt.block_on(async { MLKEMOnionRouter::new().await.unwrap().directory_client() });

    let mut group = c.benchmark_group("circuit_setup");

    group.bench_function("setup", |b| {
        // A circuit manager rate-limits circuit creation, so each iteration builds
        // its circuit with a fresh manager.
        b.to_async(&rt).iter_batched(
            CircuitManager::new,
            |mut manager| {
                let directory = &directory;
                async move {
                    let circuit_id = manager.build_circuit(3, directory).await.unwrap();
                    manager.activate_circuit(circuit_id).unwrap();
                    black_box(circuit_id)
                }
            },
            BatchSize::SmallInput,
        );
    });

    group.finish();
}

fn bench_message_routing(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let mut group = c.benchmark_group("message_routing");

    for size in [10, 100, 1000].iter() {
        group.bench_with_input(BenchmarkId::new("route_message", size), size, |b, &size| {
            let router = rt.block_on(setup_test_network(size));
            let msg = test_message(1024); // 1KB message

            // Routing a message onion-encrypts its payload along the circuit.
            b.to_async(&rt).iter(|| async {
                black_box(
                    router
                        .route(&msg, RoutingStrategy::Anonymous { hops: 3 })
                        .await
                        .unwrap(),
                )
            });
        });
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_route_computation,
    bench_circuit_setup,
    bench_message_routing
);
criterion_main!(benches);
