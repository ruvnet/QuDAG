use blake3::Hash;
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use qudag_dag::{ConsensusStatus, Graph, Node, QRAvalanche, VertexId};
use rand::Rng;

fn to_vertex_id(hash: &Hash) -> VertexId {
    VertexId::from_bytes(hash.as_bytes().to_vec())
}

/// Runs one QR-Avalanche round over every vertex: registration followed by a
/// vote from each participant. Returns the number of finalized vertices.
fn process_round(graph_vertices: &[Hash], participants: &[VertexId]) -> usize {
    let mut consensus = QRAvalanche::new();
    for hash in graph_vertices {
        let id = to_vertex_id(hash);
        consensus.process_vertex(id.clone()).unwrap();
        for voter in participants {
            consensus
                .record_vote(id.clone(), voter.clone(), true)
                .unwrap();
        }
    }
    consensus
        .vertices
        .values()
        .filter(|s| **s == ConsensusStatus::Final)
        .count()
}

fn consensus_round_benchmark(c: &mut Criterion) {
    let mut group = c.benchmark_group("consensus");

    // Test different network sizes
    for size in [10, 50, 100].iter() {
        group.bench_function(format!("consensus_round_{}_nodes", size), |b| {
            let mut rng = rand::thread_rng();
            let graph = Graph::new();
            let mut hashes: Vec<Hash> = Vec::with_capacity(*size);

            // Add random vertices and edges
            for i in 0..*size {
                let parents = if i > 0 {
                    vec![hashes[rng.gen_range(0..i)]]
                } else {
                    vec![]
                };
                let node = Node::new((i as u64).to_le_bytes().to_vec(), parents);
                hashes.push(node.hash());
                graph.add_node(node).unwrap();
            }

            let participants: Vec<VertexId> = (0..*size)
                .map(|i| VertexId::from_bytes(format!("participant_{}", i).into_bytes()))
                .collect();

            b.iter(|| {
                let finalized = process_round(black_box(&hashes), &participants);
                assert_eq!(finalized, graph.len());
            });
        });
    }
    group.finish();
}

criterion_group!(benches, consensus_round_benchmark);
criterion_main!(benches);
