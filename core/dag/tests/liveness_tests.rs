use qudag_dag::{ConsensusConfig, ConsensusStatus, DAGConsensus, QRAvalanche, Vertex, VertexId};
use std::thread;
use std::time::Duration;

// Since v2 (945fc6f) `DAGConsensus` admission is local and leaves every
// vertex `Pending`; finality is only established by the QR-Avalanche voting
// path. These liveness tests therefore check that admitted vertices stay
// tracked and that the voting path drives each of them to `Final`.

fn vid(id: &str) -> VertexId {
    VertexId::from_bytes(id.as_bytes().to_vec())
}

fn create_test_vertex(id: &str, parents: Vec<&str>, timestamp: u64) -> Vertex {
    Vertex {
        id: vid(id),
        parents: parents.into_iter().map(vid).collect(),
        timestamp,
        signature: vec![],
        payload: vec![],
    }
}

/// Runs the QR-Avalanche voting path for `id` with a quorum of honest voters.
fn finalize(consensus: &mut QRAvalanche, id: &str) {
    consensus.process_vertex(vid(id)).unwrap();
    for voter in 0..5 {
        consensus
            .record_vote(vid(id), vid(&format!("voter{}", voter)), true)
            .unwrap();
    }
}

fn status(consensus: &QRAvalanche, id: &str) -> Option<ConsensusStatus> {
    consensus.vertices.get(&vid(id)).cloned()
}

// Test termination property - vertices eventually reach finality
#[test]
fn test_termination() {
    let config = ConsensusConfig {
        query_sample_size: 5,
        finality_threshold: 0.8,
        finality_timeout: Duration::from_secs(5),
        confirmation_depth: 3,
    };

    let mut dag = DAGConsensus::with_config(config);
    let mut consensus = QRAvalanche::new();

    // Add sequence of vertices
    let vertex_a = create_test_vertex("A", vec![], 0);
    let vertex_b = create_test_vertex("B", vec!["A"], 1);
    let vertex_c = create_test_vertex("C", vec!["B"], 2);

    dag.add_vertex(vertex_a).unwrap();
    dag.add_vertex(vertex_b).unwrap();
    dag.add_vertex(vertex_c).unwrap();

    // Admission alone is Pending
    for id in ["A", "B", "C"] {
        assert_eq!(dag.get_confidence(id), Some(ConsensusStatus::Pending));
    }

    // Verify all vertices reach finality through voting
    for id in dag.get_total_order().unwrap() {
        finalize(&mut consensus, &id);
    }
    assert_eq!(status(&consensus, "A"), Some(ConsensusStatus::Final));
    assert_eq!(status(&consensus, "B"), Some(ConsensusStatus::Final));
    assert_eq!(status(&consensus, "C"), Some(ConsensusStatus::Final));
}

// Test progress property - system continues to make progress
#[test]
fn test_progress() {
    let config = ConsensusConfig {
        query_sample_size: 5,
        finality_threshold: 0.8,
        finality_timeout: Duration::from_secs(5),
        confirmation_depth: 3,
    };

    let mut dag = DAGConsensus::with_config(config);
    let mut consensus = QRAvalanche::new();
    let start_time = std::time::Instant::now();
    let timeout = Duration::from_secs(2);

    // Add vertices continuously
    let mut vertex_count = 0;
    while start_time.elapsed() < timeout {
        let id = format!("V{}", vertex_count);
        let parents = if vertex_count == 0 {
            vec![]
        } else {
            vec![vid(&format!("V{}", vertex_count - 1))]
        };

        let vertex = Vertex {
            id: vid(&id),
            parents,
            timestamp: vertex_count as u64,
            signature: vec![],
            payload: vec![],
        };

        dag.add_vertex(vertex).unwrap();
        finalize(&mut consensus, &id);
        vertex_count += 1;

        thread::sleep(Duration::from_millis(100));
    }

    // Verify system made progress
    assert!(vertex_count > 5, "System should process multiple vertices");
    assert_eq!(dag.get_tips(), vec![format!("V{}", vertex_count - 1)]);

    // Verify earlier vertices reached finality
    assert_eq!(status(&consensus, "V0"), Some(ConsensusStatus::Final));
    assert_eq!(consensus.metrics.total_vertices_processed, vertex_count);
}

// Test concurrent progress - multiple paths can progress simultaneously
#[test]
fn test_concurrent_progress() {
    let config = ConsensusConfig {
        query_sample_size: 5,
        finality_threshold: 0.8,
        finality_timeout: Duration::from_secs(5),
        confirmation_depth: 3,
    };

    let mut dag = DAGConsensus::with_config(config);
    let mut consensus = QRAvalanche::new();

    // Create two parallel chains
    let vertex_a = create_test_vertex("A", vec![], 0);
    let vertex_b1 = create_test_vertex("B1", vec!["A"], 1);
    let vertex_b2 = create_test_vertex("B2", vec!["A"], 1);
    let vertex_c1 = create_test_vertex("C1", vec!["B1"], 2);
    let vertex_c2 = create_test_vertex("C2", vec!["B2"], 2);

    // Add vertices
    dag.add_vertex(vertex_a).unwrap();
    dag.add_vertex(vertex_b1).unwrap();
    dag.add_vertex(vertex_b2).unwrap();
    dag.add_vertex(vertex_c1).unwrap();
    dag.add_vertex(vertex_c2).unwrap();

    // Both chain heads are tips
    let mut tips = dag.get_tips();
    tips.sort();
    assert_eq!(tips, vec!["C1", "C2"]);

    for id in dag.get_total_order().unwrap() {
        finalize(&mut consensus, &id);
    }

    // Verify both chains made progress
    assert_eq!(status(&consensus, "C1"), Some(ConsensusStatus::Final));
    assert_eq!(status(&consensus, "C2"), Some(ConsensusStatus::Final));
}

// Test no-deadlock property
#[test]
fn test_no_deadlock() {
    let config = ConsensusConfig {
        query_sample_size: 5,
        finality_threshold: 0.8,
        finality_timeout: Duration::from_secs(1),
        confirmation_depth: 3,
    };

    let mut dag = DAGConsensus::with_config(config);
    let mut consensus = QRAvalanche::new();

    // Create complex DAG structure with multiple paths
    let vertices = vec![
        create_test_vertex("A", vec![], 0),
        create_test_vertex("B1", vec!["A"], 1),
        create_test_vertex("B2", vec!["A"], 1),
        create_test_vertex("C1", vec!["B1", "B2"], 2),
        create_test_vertex("C2", vec!["B1"], 2),
        create_test_vertex("D", vec!["C1", "C2"], 3),
    ];

    // Add all vertices
    for vertex in vertices {
        dag.add_vertex(vertex).unwrap();
    }

    for id in dag.get_total_order().unwrap() {
        finalize(&mut consensus, &id);
    }

    // Verify system didn't deadlock
    assert_eq!(status(&consensus, "D"), Some(ConsensusStatus::Final));

    // Verify we can still add new vertices
    let vertex_e = create_test_vertex("E", vec!["D"], 4);
    assert!(dag.add_vertex(vertex_e).is_ok());
    assert_eq!(dag.get_tips(), vec!["E"]);
}
