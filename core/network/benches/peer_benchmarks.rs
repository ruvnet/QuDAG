use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use qudag_network::{MessageEnvelope, MessagePriority, NetworkMessage, PeerId};
use rand::RngCore;
use std::time::Duration;

const PEER_COUNTS: [usize; 3] = [10, 100, 1000];
const MSG_SIZES: [usize; 3] = [64, 1024, 65536];

fn generate_random_data(size: usize) -> Vec<u8> {
    let mut data = vec![0u8; size];
    rand::thread_rng().fill_bytes(&mut data);
    data
}

/// Builds an integrity-hashed message envelope addressed to every peer.
fn bench_peer_messaging(c: &mut Criterion) {
    let mut group = c.benchmark_group("peer_messaging");

    for &peer_count in PEER_COUNTS.iter() {
        for &msg_size in MSG_SIZES.iter() {
            group.bench_with_input(
                BenchmarkId::new(format!("peers_{}", peer_count), msg_size),
                &(peer_count, msg_size),
                |b, &(peer_count, msg_size)| {
                    let peers: Vec<PeerId> = (0..peer_count).map(|_| PeerId::random()).collect();
                    let source = PeerId::random().to_bytes().to_vec();
                    let data = generate_random_data(msg_size);

                    b.iter(|| {
                        for (i, peer) in peers.iter().enumerate() {
                            let msg = NetworkMessage {
                                id: i.to_string(),
                                source: source.clone(),
                                destination: peer.to_bytes().to_vec(),
                                payload: data.clone(),
                                priority: MessagePriority::Normal,
                                ttl: Duration::from_secs(60),
                            };
                            black_box(MessageEnvelope::new(msg));
                        }
                    });
                },
            );
        }
    }

    group.finish();
}

criterion_group!(benches, bench_peer_messaging);
criterion_main!(benches);
