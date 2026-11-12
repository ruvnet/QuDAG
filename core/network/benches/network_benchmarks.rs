#![deny(unsafe_code)]

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use qudag_network::{
    connection::ConnectionManager, message::MessageQueue, ConnectionStatus, MessagePriority,
    NetworkMessage, PeerId, Router, RoutingStrategy,
};
use std::time::Duration;
use tokio::runtime::Runtime;

/// Messages pushed through the queue per iteration.
const QUEUE_MESSAGES: u64 = 10_000;
/// Anonymous routes computed per iteration.
const ROUTES: u64 = 1_000;
/// Peers cycled through the connection manager per iteration. `connect` simulates a
/// 10 ms handshake per new peer, so this is kept small.
const CONNECTIONS: u64 = 100;

fn test_message(id: String) -> NetworkMessage {
    NetworkMessage {
        id,
        source: vec![1],
        destination: vec![2],
        payload: vec![0; 1000],
        priority: MessagePriority::Normal,
        ttl: Duration::from_secs(60),
    }
}

fn benchmark_message_queue(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    c.benchmark_group("message_queue")
        .throughput(criterion::Throughput::Elements(QUEUE_MESSAGES))
        .bench_function("enqueue_dequeue", |b| {
            b.iter(|| {
                rt.block_on(async {
                    // The notification receiver is not used here; dropping it keeps
                    // `enqueue` from waiting on a full notification channel.
                    let (queue, _) = MessageQueue::new();

                    // Enqueue messages
                    for i in 0..QUEUE_MESSAGES {
                        queue.enqueue(test_message(i.to_string())).await.unwrap();
                    }

                    // Dequeue messages
                    for _ in 0..QUEUE_MESSAGES {
                        black_box(queue.dequeue().await.unwrap());
                    }
                });
            });
        });
}

fn benchmark_routing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let router = rt.block_on(async {
        let router = Router::new().await.unwrap();
        // Add test peers
        for _ in 0..100 {
            router.add_peer(PeerId::random()).await;
        }
        router
    });
    let msg = test_message("test".into());

    // Make sure the benchmark times successful routing, not an error path.
    let route = rt
        .block_on(router.route(&msg, RoutingStrategy::Anonymous { hops: 3 }))
        .expect("anonymous routing should succeed");
    assert_eq!(route.len(), 3, "anonymous route should have 3 hops");
    black_box(route);

    c.benchmark_group("routing")
        .throughput(criterion::Throughput::Elements(ROUTES))
        .bench_function("anonymous_routing", |b| {
            b.iter(|| {
                rt.block_on(async {
                    // Route messages
                    for _ in 0..ROUTES {
                        black_box(
                            router
                                .route(&msg, RoutingStrategy::Anonymous { hops: 3 })
                                .await
                                .unwrap(),
                        );
                    }
                });
            });
        });
}

fn benchmark_connection_manager(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    c.benchmark_group("connection_manager")
        .throughput(criterion::Throughput::Elements(CONNECTIONS))
        .bench_function("connection_operations", |b| {
            b.iter(|| {
                rt.block_on(async {
                    let manager = ConnectionManager::new(CONNECTIONS as usize);
                    let peers: Vec<_> = (0..CONNECTIONS).map(|_| PeerId::random()).collect();

                    // Benchmark connection operations
                    for peer in peers.iter() {
                        manager.connect(*peer).await.unwrap();
                        manager.update_status(*peer, ConnectionStatus::Connected);
                        black_box(manager.get_status(peer));
                    }

                    for peer in peers.iter() {
                        manager.disconnect(peer);
                    }
                });
            });
        });
}

criterion_group!(
    benches,
    benchmark_message_queue,
    benchmark_routing,
    benchmark_connection_manager
);
criterion_main!(benches);
