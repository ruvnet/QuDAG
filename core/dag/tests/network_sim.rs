//! Simulated multi-node QR-Avalanche voting over a lossy, delayed network.
//!
//! Every simulated node runs its own `QRAvalanche` instance. Nodes vote on a
//! vertex according to a deterministic validity rule, votes travel to peers
//! with random latency and packet loss, and a node only feeds its tally into
//! consensus once it has heard from a quorum (2/3 of the network). The shared
//! `Graph` state is then advanced from the network-wide outcome.

use blake3::Hash;
use qudag_dag::{ConsensusStatus, Graph, Node, NodeState, QRAvalanche, VertexId};
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::sleep;

const NETWORK_SIZE: usize = 10;
const LATENCY_MIN: u64 = 10; // 10ms minimum latency
const LATENCY_MAX: u64 = 100; // 100ms maximum latency
const PACKET_LOSS_RATE: f64 = 0.05; // 5% packet loss
const QUORUM: usize = (NETWORK_SIZE * 2) / 3;
/// Honest nodes reject payloads larger than this.
const MAX_VALID_PAYLOAD: usize = 512;

struct NetworkSimulator {
    nodes: Vec<SimNode>,
    graph: Arc<Graph>,
    rng: StdRng,
}

struct SimNode {
    id: Hash,
    consensus: Arc<Mutex<QRAvalanche>>,
    inbox: Arc<Mutex<Vec<(VertexId, bool)>>>,
    peers: Vec<usize>,
}

fn to_vertex_id(hash: &Hash) -> VertexId {
    VertexId::from_bytes(hash.as_bytes().to_vec())
}

impl NetworkSimulator {
    fn new(size: usize) -> Self {
        let graph = Arc::new(Graph::new());
        let mut nodes = Vec::with_capacity(size);

        // Create nodes, fully connected topology for simplicity
        for i in 0..size {
            nodes.push(SimNode {
                id: blake3::hash(&[i as u8]),
                consensus: Arc::new(Mutex::new(QRAvalanche::new())),
                inbox: Arc::new(Mutex::new(Vec::new())),
                peers: (0..size).filter(|&j| j != i).collect(),
            });
        }

        Self {
            nodes,
            graph,
            rng: StdRng::seed_from_u64(0x5eed),
        }
    }

    async fn simulate_consensus(&mut self, test_node: Node) {
        let node_hash = test_node.hash();
        let vote = test_node.payload().len() <= MAX_VALID_PAYLOAD;

        // Add node to graph
        self.graph.add_node(test_node).unwrap();
        self.graph
            .update_node_state(&node_hash, NodeState::Verified)
            .unwrap();

        // Every node votes on the vertex and sends the vote to its peers.
        let mut deliveries = Vec::new();
        for node in &self.nodes {
            let voter = to_vertex_id(&node.id);
            node.inbox.lock().await.push((voter.clone(), vote));

            for &peer in &node.peers {
                if self.rng.gen::<f64>() < PACKET_LOSS_RATE {
                    continue;
                }
                let latency = self.rng.gen_range(LATENCY_MIN..LATENCY_MAX);
                let inbox = self.nodes[peer].inbox.clone();
                let voter = voter.clone();
                deliveries.push(tokio::spawn(async move {
                    sleep(Duration::from_millis(latency)).await;
                    inbox.lock().await.push((voter, vote));
                }));
            }
        }

        for delivery in deliveries {
            delivery.await.unwrap();
        }

        // Each node decides once it has heard from a quorum.
        let vertex_id = to_vertex_id(&node_hash);
        for node in &self.nodes {
            let votes = node.inbox.lock().await.clone();
            if votes.len() < QUORUM {
                continue;
            }
            let mut consensus = node.consensus.lock().await;
            consensus.process_vertex(vertex_id.clone()).unwrap();
            for (voter, accept) in votes {
                consensus
                    .record_vote(vertex_id.clone(), voter, accept)
                    .unwrap();
            }
        }
    }

    async fn collect_results(&self, node_hash: &Hash) -> HashMap<Hash, ConsensusStatus> {
        let vertex_id = to_vertex_id(node_hash);
        let mut results = HashMap::new();

        for node in &self.nodes {
            if let Some(status) = node.consensus.lock().await.vertices.get(&vertex_id) {
                results.insert(node.id, status.clone());
            }
        }

        results
    }

    /// Applies the network-wide outcome to the shared graph.
    fn apply_outcome(&self, node_hash: &Hash, results: &HashMap<Hash, ConsensusStatus>) {
        let count = |status: ConsensusStatus| results.values().filter(|s| **s == status).count();
        if count(ConsensusStatus::Final) >= QUORUM {
            self.graph
                .update_node_state(node_hash, NodeState::Final)
                .unwrap();
        } else if count(ConsensusStatus::Rejected) >= QUORUM {
            self.graph
                .update_node_state(node_hash, NodeState::Rejected)
                .unwrap();
        }
    }
}

#[tokio::test]
async fn test_network_consensus_basic() {
    let mut sim = NetworkSimulator::new(NETWORK_SIZE);

    // Create test node
    let test_node = Node::new(vec![1, 2, 3], vec![]);
    let node_hash = test_node.hash();

    // Run simulation
    sim.simulate_consensus(test_node).await;

    // Check results
    let results = sim.collect_results(&node_hash).await;
    sim.apply_outcome(&node_hash, &results);

    // Verify consensus was reached
    let finalized = results
        .values()
        .filter(|&state| *state == ConsensusStatus::Final)
        .count();

    assert!(
        finalized >= QUORUM,
        "Expected at least 2/3 nodes to reach finality, got {}",
        finalized
    );

    // Verify final state in graph
    let node = sim.graph.get_node(&node_hash).unwrap();
    assert_eq!(node.state(), NodeState::Final);
}

#[tokio::test]
async fn test_network_consensus_with_failures() {
    let mut sim = NetworkSimulator::new(NETWORK_SIZE);

    // Create test node with invalid data
    let test_node = Node::new(vec![0; 1024], vec![]); // Large invalid payload
    let node_hash = test_node.hash();

    // Run simulation
    sim.simulate_consensus(test_node).await;

    // Check results
    let results = sim.collect_results(&node_hash).await;
    sim.apply_outcome(&node_hash, &results);

    // Verify rejection
    let rejected = results
        .values()
        .filter(|&state| *state == ConsensusStatus::Rejected)
        .count();

    assert!(
        rejected >= QUORUM,
        "Expected at least 2/3 nodes to reject invalid node, got {}",
        rejected
    );

    // Verify rejected state in graph
    let node = sim.graph.get_node(&node_hash).unwrap();
    assert_eq!(node.state(), NodeState::Rejected);
}

#[tokio::test]
async fn test_network_consensus_partition() {
    let mut sim = NetworkSimulator::new(NETWORK_SIZE);

    // Create network partition by removing half of each node's peers
    for node in &mut sim.nodes {
        node.peers.truncate(node.peers.len() / 2);
    }

    // Create test node
    let test_node = Node::new(vec![1, 2, 3], vec![]);
    let node_hash = test_node.hash();

    // Run simulation
    sim.simulate_consensus(test_node).await;

    // Check results
    let results = sim.collect_results(&node_hash).await;
    sim.apply_outcome(&node_hash, &results);

    // Verify consensus cannot be reached with network partition
    let finalized = results
        .values()
        .filter(|&state| *state == ConsensusStatus::Final)
        .count();

    assert!(
        finalized < QUORUM,
        "Expected consensus to fail under network partition"
    );

    // Verify node remains in Verified state
    let node = sim.graph.get_node(&node_hash).unwrap();
    assert_eq!(node.state(), NodeState::Verified);
}
