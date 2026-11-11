use proptest::prelude::*;
use qudag_dag::{
    ConsensusConfig, ConsensusStatus, DAGConsensus, DagError, QRAvalanche, Vertex, VertexId,
};
use std::collections::HashSet;
use std::time::Duration;

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

fn is_fork_error(result: Result<(), DagError>) -> bool {
    matches!(result, Err(DagError::ConsensusError(msg)) if msg.contains("Fork detected"))
}

// Test fork detection and handling
#[test]
fn test_fork_detection() {
    let mut dag = DAGConsensus::new();

    // Create initial vertex
    let vertex_a = create_test_vertex("A", vec![], 0);
    dag.add_vertex(vertex_a).unwrap();

    // Try to create a fork (same ID, different parents)
    let fork_vertex = create_test_vertex("A", vec![], 1);
    assert!(is_fork_error(dag.add_vertex(fork_vertex)));
}

// Test equivocation resistance
#[test]
fn test_equivocation_resistance() {
    let config = ConsensusConfig {
        query_sample_size: 5,
        finality_threshold: 0.8,
        finality_timeout: Duration::from_secs(2),
        confirmation_depth: 3,
    };

    let mut dag = DAGConsensus::with_config(config);

    // Create two conflicting vertices with same parent
    let vertex_a = create_test_vertex("A", vec![], 0);
    let vertex_b1 = create_test_vertex("B", vec!["A"], 1);
    let vertex_b2 = create_test_vertex("B", vec!["A"], 1);

    dag.add_vertex(vertex_a).unwrap();
    dag.add_vertex(vertex_b1).unwrap();

    // Second vertex with same ID should be rejected
    assert!(is_fork_error(dag.add_vertex(vertex_b2)));
}

// Test Byzantine agreement under partial synchrony
#[test]
fn test_byzantine_agreement() {
    let config = ConsensusConfig {
        query_sample_size: 10,
        finality_threshold: 0.8,
        finality_timeout: Duration::from_secs(5),
        confirmation_depth: 4,
    };

    let mut dag = DAGConsensus::with_config(config);

    // Create vertices with conflicting parent sets
    let vertex_a = create_test_vertex("A", vec![], 0);
    let vertex_b = create_test_vertex("B", vec!["A"], 1);
    let vertex_c1 = create_test_vertex("C", vec!["B"], 2);
    let vertex_c2 = create_test_vertex("C", vec!["A"], 2); // Conflicting parent set

    dag.add_vertex(vertex_a).unwrap();
    dag.add_vertex(vertex_b).unwrap();
    dag.add_vertex(vertex_c1).unwrap();

    // Verify that conflicting vertex is rejected
    assert!(is_fork_error(dag.add_vertex(vertex_c2)));
}

// Test resistance to Sybil attacks
#[test]
fn test_sybil_resistance() {
    let config = ConsensusConfig {
        query_sample_size: 20,
        finality_threshold: 0.8,
        finality_timeout: Duration::from_secs(5),
        confirmation_depth: 4,
    };

    let mut dag = DAGConsensus::with_config(config);

    // Create a large number of vertices from different "identities"
    for i in 0..100 {
        let vertex = Vertex {
            id: vid(&format!("V{}", i)),
            parents: if i == 0 {
                vec![]
            } else {
                vec![vid(&format!("V{}", i - 1))]
            },
            timestamp: i as u64,
            signature: vec![i as u8], // Different signatures
            payload: vec![],
        };

        dag.add_vertex(vertex).unwrap();
    }

    // Since v2 (945fc6f) local admission never establishes finality: every
    // admitted vertex stays Pending until an authenticated vote finalizes it.
    assert_eq!(dag.get_confidence("V0"), Some(ConsensusStatus::Pending));
    assert_eq!(dag.get_confidence("V50"), Some(ConsensusStatus::Pending));
    assert_eq!(dag.get_total_order().unwrap().len(), 100);

    // Finality comes from the QR-Avalanche voting path. A minority of Sybil
    // identities voting against a vertex cannot stop honest finalization.
    let mut consensus = QRAvalanche::new();
    for target in ["V0", "V50"] {
        consensus.process_vertex(vid(target)).unwrap();
        for honest in 0..9 {
            consensus
                .record_vote(vid(target), vid(&format!("honest{}", honest)), true)
                .unwrap();
        }
        consensus
            .record_vote(vid(target), vid("sybil"), false)
            .unwrap();
        assert_eq!(
            consensus.vertices.get(&vid(target)),
            Some(&ConsensusStatus::Final)
        );
    }
}

// Property-based test for Byzantine behavior
proptest! {
    #[test]
    fn prop_byzantine_resistance(
        honest_vertices in 5..20usize,
        byzantine_attempts in 1..10usize
    ) {
        let config = ConsensusConfig {
            query_sample_size: 10,
            finality_threshold: 0.8,
            finality_timeout: Duration::from_secs(5),
            confirmation_depth: 3,
        };

        let mut dag = DAGConsensus::with_config(config);
        let mut vertex_ids = HashSet::new();

        // Add honest vertices
        for i in 0..honest_vertices {
            let id = format!("H{}", i);
            let parents = if i == 0 {
                vec![]
            } else {
                vec![vid(&format!("H{}", i-1))]
            };

            let vertex = Vertex {
                id: vid(&id),
                parents,
                timestamp: i as u64,
                signature: vec![],
                payload: vec![],
            };

            dag.add_vertex(vertex).unwrap();
            vertex_ids.insert(id);
        }

        // Attempt Byzantine behavior
        for i in 0..byzantine_attempts {
            let target_id = format!("H{}", i % honest_vertices);

            // Try to create conflicting vertex
            let byzantine_vertex = Vertex {
                id: vid(&target_id),
                parents: vec![],
                timestamp: (honest_vertices + i) as u64,
                signature: vec![],
                payload: vec![],
            };

            // Byzantine vertex should be rejected
            prop_assert!(is_fork_error(dag.add_vertex(byzantine_vertex)));

            // Original vertex should maintain its status
            prop_assert!(vertex_ids.contains(&target_id));
            prop_assert_eq!(
                dag.get_confidence(&target_id),
                Some(ConsensusStatus::Pending)
            );
        }

        // Verify system remains consistent
        let tips = dag.get_tips();
        prop_assert!(!tips.is_empty());
        prop_assert_eq!(dag.get_total_order().unwrap().len(), honest_vertices);
    }
}
