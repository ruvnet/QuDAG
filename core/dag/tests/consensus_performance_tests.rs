use blake3::Hash;
use qudag_dag::{ConsensusError, ConsensusStatus, Graph, Node, NodeState, QRAvalanche, VertexId};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

const TEST_NODES: usize = 1000;
const MAX_PARENTS: usize = 5;
const CONCURRENT_VOTES: usize = 100;
const TARGET_FINALITY_MS: u64 = 1000; // 1 second target

fn to_vertex_id(hash: &Hash) -> VertexId {
    VertexId::from_bytes(hash.as_bytes().to_vec())
}

async fn setup_test_dag(nodes: usize) -> (Arc<Graph>, Vec<Hash>) {
    let graph = Arc::new(Graph::new());
    let mut node_hashes = Vec::with_capacity(nodes);

    // Create root node
    let root = Node::new(vec![0], vec![]);
    let root_hash = root.hash();
    graph.add_node(root).unwrap();
    node_hashes.push(root_hash);

    // Create remaining nodes with parents drawn from existing nodes
    for i in 1..nodes {
        let data = (i as u64).to_le_bytes().to_vec();
        let mut parents = Vec::new();

        let parent_count = (i % MAX_PARENTS) + 1;
        for p in 0..parent_count {
            let parent_idx = (i + p * 7) % node_hashes.len();
            if !parents.contains(&node_hashes[parent_idx]) {
                parents.push(node_hashes[parent_idx]);
            }
        }

        let node = Node::new(data, parents);
        let node_hash = node.hash();
        graph.add_node(node).unwrap();
        node_hashes.push(node_hash);
    }

    (graph, node_hashes)
}

async fn simulate_concurrent_voting(
    consensus: &Arc<Mutex<QRAvalanche>>,
    node_hash: Hash,
    vote_count: usize,
) -> Result<(), ConsensusError> {
    let mut handles = Vec::with_capacity(vote_count);

    for i in 0..vote_count {
        let voter_id = to_vertex_id(&blake3::hash(&(i as u64).to_le_bytes()));
        let consensus = consensus.clone();
        let vertex_id = to_vertex_id(&node_hash);

        let handle = tokio::spawn(async move {
            consensus
                .lock()
                .await
                .record_vote(vertex_id, voter_id, true)
        });

        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap()?;
    }

    Ok(())
}

async fn status(consensus: &Arc<Mutex<QRAvalanche>>, node_hash: &Hash) -> Option<ConsensusStatus> {
    consensus
        .lock()
        .await
        .vertices
        .get(&to_vertex_id(node_hash))
        .cloned()
}

#[tokio::test]
async fn test_finality_latency() {
    let (graph, node_hashes) = setup_test_dag(TEST_NODES).await;
    let consensus = Arc::new(Mutex::new(QRAvalanche::new()));

    let mut total_latency = Duration::ZERO;
    let mut finalized_count = 0;

    for &node_hash in &node_hashes {
        graph
            .update_node_state(&node_hash, NodeState::Verified)
            .unwrap();

        let start = Instant::now();
        consensus
            .lock()
            .await
            .process_vertex(to_vertex_id(&node_hash))
            .unwrap();

        // Simulate concurrent voting
        simulate_concurrent_voting(&consensus, node_hash, CONCURRENT_VOTES)
            .await
            .unwrap();

        // Verify finalization
        assert_eq!(
            status(&consensus, &node_hash).await,
            Some(ConsensusStatus::Final)
        );
        graph
            .update_node_state(&node_hash, NodeState::Final)
            .unwrap();
        let latency = start.elapsed();
        total_latency += latency;
        finalized_count += 1;

        // Verify sub-second finality
        assert!(
            latency.as_millis() < TARGET_FINALITY_MS as u128,
            "Finality took {}ms, exceeding target of {}ms",
            latency.as_millis(),
            TARGET_FINALITY_MS
        );
    }

    assert_eq!(finalized_count, TEST_NODES);
    for node_hash in &node_hashes {
        assert_eq!(graph.get_node(node_hash).unwrap().state(), NodeState::Final);
    }

    let avg_latency = total_latency / finalized_count as u32;
    println!(
        "Average finality latency: {}ms over {} nodes",
        avg_latency.as_millis(),
        finalized_count
    );
}

#[tokio::test]
async fn test_concurrent_path_validation() {
    let (graph, node_hashes) = setup_test_dag(TEST_NODES).await;
    let consensus = Arc::new(Mutex::new(QRAvalanche::new()));

    // Process nodes in parallel batches
    let batch_size = 10;
    let mut handles = Vec::new();

    for nodes in node_hashes.chunks(batch_size) {
        for &node_hash in nodes {
            graph
                .update_node_state(&node_hash, NodeState::Verified)
                .unwrap();

            let consensus = consensus.clone();
            let handle = tokio::spawn(async move {
                consensus
                    .lock()
                    .await
                    .process_vertex(to_vertex_id(&node_hash))
                    .unwrap();
                simulate_concurrent_voting(&consensus, node_hash, CONCURRENT_VOTES)
                    .await
                    .unwrap();
                node_hash
            });

            handles.push(handle);
        }
    }

    // Verify all nodes were finalized
    let mut finalized_nodes = std::collections::HashSet::new();

    for handle in handles {
        let node_hash = handle.await.unwrap();
        assert_eq!(
            status(&consensus, &node_hash).await,
            Some(ConsensusStatus::Final)
        );
        finalized_nodes.insert(node_hash);
    }

    assert_eq!(finalized_nodes.len(), TEST_NODES);
}

#[tokio::test]
async fn test_vertex_processing_performance() {
    let (_graph, node_hashes) = setup_test_dag(TEST_NODES).await;
    let mut consensus = QRAvalanche::new();

    let start = Instant::now();
    let mut processed = 0;

    for node_hash in &node_hashes {
        let status = consensus.process_vertex(to_vertex_id(node_hash)).unwrap();
        assert_eq!(status, ConsensusStatus::Pending);
        processed += 1;
    }

    let processing_time = start.elapsed();
    let vertices_per_second = processed as f64 / processing_time.as_secs_f64();

    println!(
        "Processed {} vertices in {}ms ({} vertices/second)",
        processed,
        processing_time.as_millis(),
        vertices_per_second as u64
    );

    assert_eq!(consensus.metrics.total_vertices_processed, TEST_NODES);
    assert!(
        vertices_per_second > 1000.0,
        "Vertex processing rate below target: {} vertices/second",
        vertices_per_second
    );
}
