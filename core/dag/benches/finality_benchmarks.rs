use blake3::Hash;
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use qudag_dag::{ConsensusError, ConsensusStatus, Graph, Node, QRAvalanche, VertexId};
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use std::time::{Duration, Instant};

/// Comprehensive benchmarks for consensus finality
/// Tests against QuDAG performance requirement: Sub-second consensus finality (99th percentile)

/// A generated DAG: the graph plus its vertices in insertion (topological) order.
struct SimGraph {
    graph: Graph,
    vertices: Vec<Hash>,
}

struct ConsensusSimulator {
    node_count: usize,
    byzantine_count: usize,
    rng: StdRng,
}

impl ConsensusSimulator {
    fn new(node_count: usize) -> Self {
        Self {
            node_count,
            byzantine_count: 0,
            rng: StdRng::seed_from_u64(42), // Fixed seed for reproducible results
        }
    }

    fn generate_vertex(&mut self, index: usize, parents: Vec<Hash>) -> Node {
        let mut payload = vec![0u8; 256]; // Simulate message payload
        payload[..8].copy_from_slice(&(index as u64).to_le_bytes());
        let origin = self.rng.gen_range(0..self.node_count) as u64; // Random node ID
        payload[8..16].copy_from_slice(&origin.to_le_bytes());
        Node::new(payload, parents)
    }

    fn create_graph(&mut self, vertex_count: usize) -> SimGraph {
        let graph = Graph::with_capacity(vertex_count.max(1));
        let mut vertices: Vec<Hash> = Vec::with_capacity(vertex_count);

        for i in 0..vertex_count {
            // Each vertex references 1-3 previous vertices
            let mut parents = Vec::new();
            if i > 0 {
                let ref_count = self.rng.gen_range(1..=3.min(i));
                for _ in 0..ref_count {
                    let parent = vertices[self.rng.gen_range(0..i)];
                    if !parents.contains(&parent) {
                        parents.push(parent);
                    }
                }
            }
            let node = self.generate_vertex(i, parents);
            vertices.push(node.hash());
            graph.add_node(node).unwrap();
        }

        SimGraph { graph, vertices }
    }

    /// Runs one QR-Avalanche round over every vertex of the graph. Each vertex
    /// is voted on by a sample of participants; Byzantine participants vote
    /// against it. Returns the number of finalized vertices.
    fn process_round(
        &self,
        consensus: &mut QRAvalanche,
        sim: &SimGraph,
    ) -> Result<usize, ConsensusError> {
        let sample = consensus.config.query_sample_size.min(self.node_count);
        let mut finalized = 0;
        for (index, hash) in sim.vertices.iter().enumerate() {
            let id = VertexId::from_bytes(hash.as_bytes().to_vec());
            consensus.process_vertex(id.clone())?;
            for k in 0..sample {
                let participant = (index + k) % self.node_count;
                let voter = VertexId::from_bytes((participant as u64).to_le_bytes().to_vec());
                let honest = participant >= self.byzantine_count;
                consensus.record_vote(id.clone(), voter, honest)?;
            }
            if consensus.vertices.get(&id) == Some(&ConsensusStatus::Final) {
                finalized += 1;
            }
        }
        if finalized == 0 && !sim.vertices.is_empty() {
            return Err(ConsensusError::ConsensusFailure);
        }
        Ok(finalized)
    }
}

fn benchmark_consensus_finality(c: &mut Criterion) {
    let mut group = c.benchmark_group("consensus_finality");

    // Test different network sizes
    let network_sizes = [10, 50, 100, 250, 500];

    for &node_count in &network_sizes {
        group.bench_with_input(
            BenchmarkId::new("single_round_finality", node_count),
            &node_count,
            |b, &node_count| {
                b.iter_custom(|iters| {
                    let mut total_duration = Duration::new(0, 0);
                    let mut max_latency = Duration::new(0, 0);
                    let mut latencies = Vec::with_capacity(iters as usize);

                    for _ in 0..iters {
                        let mut simulator = ConsensusSimulator::new(node_count);
                        let mut consensus = QRAvalanche::new();
                        let graph = simulator.create_graph(node_count * 2); // 2 vertices per node

                        let start = Instant::now();
                        let _ = simulator.process_round(&mut consensus, &graph);
                        let latency = start.elapsed();

                        latencies.push(latency);
                        max_latency = max_latency.max(latency);
                        total_duration += latency;
                    }

                    // Calculate 99th percentile
                    latencies.sort();
                    let p99_idx = (latencies.len() as f64 * 0.99) as usize;
                    let p99_latency = latencies[p99_idx];

                    println!(
                        "Node count: {}, 99th percentile latency: {}ms, Max latency: {}ms",
                        node_count,
                        p99_latency.as_millis(),
                        max_latency.as_millis()
                    );

                    // Verify we meet the sub-second finality requirement
                    if p99_latency > Duration::from_millis(1000) {
                        println!(
                            "WARNING: 99th percentile latency {}ms exceeds 1000ms target",
                            p99_latency.as_millis()
                        );
                    }

                    total_duration
                });
            },
        );
    }

    group.finish();
}

fn benchmark_multi_round_consensus(c: &mut Criterion) {
    let mut group = c.benchmark_group("multi_round_consensus");

    // Test consensus over multiple rounds
    let round_counts = [5, 10, 20, 50];

    for &round_count in &round_counts {
        group.bench_with_input(
            BenchmarkId::new("multi_round_finality", round_count),
            &round_count,
            |b, &round_count| {
                b.iter_custom(|iters| {
                    let mut total_duration = Duration::new(0, 0);

                    for _ in 0..iters {
                        let mut simulator = ConsensusSimulator::new(100); // Fixed 100 nodes
                        let mut consensus = QRAvalanche::new();

                        let start = Instant::now();

                        // Execute multiple consensus rounds
                        for round in 0..round_count {
                            let graph = simulator.create_graph(50 + round * 10); // Growing graph
                            let _ = simulator.process_round(&mut consensus, &graph);
                        }

                        let total_latency = start.elapsed();
                        let avg_latency = total_latency / round_count as u32;

                        println!(
                            "Round count: {}, Total latency: {}ms, Avg per round: {}ms",
                            round_count,
                            total_latency.as_millis(),
                            avg_latency.as_millis()
                        );

                        total_duration += total_latency;
                    }

                    total_duration
                });
            },
        );
    }

    group.finish();
}

fn benchmark_byzantine_resistance(c: &mut Criterion) {
    let mut group = c.benchmark_group("byzantine_resistance");

    // Test consensus with Byzantine nodes (up to 1/3 of network)
    let byzantine_ratios = [0.0, 0.1, 0.2, 0.33]; // 0%, 10%, 20%, 33%

    for &byzantine_ratio in &byzantine_ratios {
        group.bench_with_input(
            BenchmarkId::new("byzantine_consensus", (byzantine_ratio * 100.0) as u32),
            &byzantine_ratio,
            |b, &byzantine_ratio| {
                b.iter_custom(|iters| {
                    let mut total_duration = Duration::new(0, 0);
                    let node_count = 100;
                    let byzantine_count = (node_count as f64 * byzantine_ratio) as usize;

                    for _ in 0..iters {
                        let mut simulator = ConsensusSimulator::new(node_count);
                        let mut consensus = QRAvalanche::new();
                        let mut graph = simulator.create_graph(node_count);
                        simulator.byzantine_count = byzantine_count;

                        // Simulate Byzantine behavior by adding conflicting vertices
                        for i in 0..byzantine_count {
                            let mut payload = vec![0xFF; 256]; // Different payload
                            payload[..8].copy_from_slice(&((node_count + i) as u64).to_le_bytes());
                            let conflicting_vertex = Node::new(payload, vec![]);
                            graph.vertices.push(conflicting_vertex.hash());
                            graph.graph.add_node(conflicting_vertex).unwrap();
                        }

                        let start = Instant::now();
                        let result = simulator.process_round(&mut consensus, &graph);
                        let latency = start.elapsed();

                        println!(
                            "Byzantine ratio: {:.1}%, Latency: {}ms, Success: {}",
                            byzantine_ratio * 100.0,
                            latency.as_millis(),
                            result.is_ok()
                        );

                        total_duration += latency;
                    }

                    total_duration
                });
            },
        );
    }

    group.finish();
}

fn benchmark_consensus_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("consensus_throughput");

    // Test transaction throughput in consensus
    let transaction_counts = [100, 500, 1000, 5000, 10000];

    for &tx_count in &transaction_counts {
        group.throughput(Throughput::Elements(tx_count as u64));
        group.bench_with_input(
            BenchmarkId::new("transaction_throughput", tx_count),
            &tx_count,
            |b, &tx_count| {
                b.iter_custom(|iters| {
                    let mut total_duration = Duration::new(0, 0);

                    for _ in 0..iters {
                        let mut simulator = ConsensusSimulator::new(100);
                        let mut consensus = QRAvalanche::new();

                        // Create graph with many transactions
                        let graph = simulator.create_graph(tx_count);

                        let start = Instant::now();
                        let _ = simulator.process_round(&mut consensus, &graph);
                        let latency = start.elapsed();

                        let tps = tx_count as f64 / latency.as_secs_f64();
                        println!(
                            "Transaction count: {}, TPS: {:.2}, Latency: {}ms",
                            tx_count,
                            tps,
                            latency.as_millis()
                        );

                        // Verify we can process at least 1000 TPS
                        if tps < 1000.0 {
                            println!("WARNING: TPS {} below 1000 TPS target", tps);
                        }

                        total_duration += latency;
                    }

                    total_duration
                });
            },
        );
    }

    group.finish();
}

fn benchmark_dag_growth_handling(c: &mut Criterion) {
    let mut group = c.benchmark_group("dag_growth_handling");

    // Test how consensus handles growing DAG size
    let dag_sizes = [1000, 5000, 10000, 50000, 100000];

    for &dag_size in &dag_sizes {
        group.bench_with_input(
            BenchmarkId::new("dag_size_handling", dag_size),
            &dag_size,
            |b, &dag_size| {
                b.iter_custom(|iters| {
                    let mut total_duration = Duration::new(0, 0);

                    for _ in 0..iters {
                        let mut simulator = ConsensusSimulator::new(100);
                        let mut consensus = QRAvalanche::new();

                        // Create large DAG
                        let graph = simulator.create_graph(dag_size);

                        let start = Instant::now();
                        let _ = simulator.process_round(&mut consensus, &graph);
                        let latency = start.elapsed();

                        let vertices_per_sec = dag_size as f64 / latency.as_secs_f64();
                        println!(
                            "DAG size: {}, Vertices/sec: {:.2}, Latency: {}ms",
                            dag_size,
                            vertices_per_sec,
                            latency.as_millis()
                        );

                        total_duration += latency;
                    }

                    total_duration
                });
            },
        );
    }

    group.finish();
}

fn benchmark_consensus_memory_usage(c: &mut Criterion) {
    let mut group = c.benchmark_group("consensus_memory_usage");

    // Test memory usage during consensus
    group.bench_function("memory_efficiency", |b| {
        b.iter_custom(|iters| {
            let mut total_duration = Duration::new(0, 0);

            for _ in 0..iters {
                let mut simulator = ConsensusSimulator::new(100);
                let mut consensus = QRAvalanche::new();

                // Create graph with substantial data
                let graph = simulator.create_graph(10000);

                let start = Instant::now();
                let _ = simulator.process_round(&mut consensus, &graph);
                let latency = start.elapsed();

                // Estimate memory usage
                let estimated_memory = 10000 * (256 + 64) + // Vertices + edges
                                     1000 * 1024; // Consensus state

                println!(
                    "Estimated memory usage: {} MB",
                    estimated_memory / (1024 * 1024)
                );

                // Verify memory usage is reasonable
                if estimated_memory > 100 * 1024 * 1024 {
                    println!(
                        "WARNING: Memory usage {} exceeds 100MB target",
                        estimated_memory / (1024 * 1024)
                    );
                }

                total_duration += latency;
            }

            total_duration
        });
    });

    group.finish();
}

fn benchmark_consensus_consistency(c: &mut Criterion) {
    let mut group = c.benchmark_group("consensus_consistency");

    // Test consensus consistency across multiple runs
    group.bench_function("deterministic_consensus", |b| {
        b.iter_custom(|iters| {
            let mut total_duration = Duration::new(0, 0);
            let mut results = Vec::new();

            for _ in 0..iters {
                let mut simulator = ConsensusSimulator::new(50);
                let mut consensus = QRAvalanche::new();
                let graph = simulator.create_graph(100);

                let start = Instant::now();
                let result = simulator.process_round(&mut consensus, &graph);
                let latency = start.elapsed();

                results.push(result);
                total_duration += latency;
            }

            // Verify consistency (all results should be similar)
            let success_count = results.iter().filter(|r| r.is_ok()).count();
            let consistency_ratio = success_count as f64 / results.len() as f64;

            println!("Consistency ratio: {:.2}%", consistency_ratio * 100.0);

            if consistency_ratio < 0.95 {
                println!("WARNING: Consistency ratio below 95%");
            }

            total_duration
        });
    });

    group.finish();
}

criterion_group!(
    name = finality_benches;
    config = Criterion::default()
        .sample_size(50)
        .measurement_time(Duration::from_secs(60))
        .warm_up_time(Duration::from_secs(10));
    targets =
        benchmark_consensus_finality,
        benchmark_multi_round_consensus,
        benchmark_byzantine_resistance,
        benchmark_consensus_throughput,
        benchmark_dag_growth_handling,
        benchmark_consensus_memory_usage,
        benchmark_consensus_consistency
);
criterion_main!(finality_benches);
