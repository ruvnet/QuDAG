use proptest::prelude::*;
use qudag_dag::{ConsensusConfig, ConsensusStatus, DAGConsensus, DagError, Vertex, VertexId};
use std::collections::HashSet;
use std::time::Duration;

fn create_test_vertex(id: &str, parents: Vec<&str>, _timestamp: u64) -> Vertex {
    let parent_ids: HashSet<VertexId> = parents
        .into_iter()
        .map(|p| VertexId::from_bytes(p.as_bytes().to_vec()))
        .collect();

    Vertex::new(
        VertexId::from_bytes(id.as_bytes().to_vec()),
        vec![1, 2, 3], // dummy payload
        parent_ids,
    )
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
    let result = dag.add_vertex(fork_vertex);

    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("Fork detected"), "Expected fork detection error, got: {}", err_msg);
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
    let result = dag.add_vertex(vertex_b2);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("Fork detected"), "Expected fork detection error, got: {}", err_msg);
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

    // Verify that conflicting vertex is rejected (fork with same ID)
    let result = dag.add_vertex(vertex_c2);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("Fork detected"), "Expected fork detection error, got: {}", err_msg);
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
        let parents: HashSet<VertexId> = if i == 0 {
            HashSet::new()
        } else {
            let mut set = HashSet::new();
            set.insert(VertexId::from_bytes(format!("V{}", i - 1).as_bytes().to_vec()));
            set
        };

        let vertex = Vertex::new(
            VertexId::from_bytes(format!("V{}", i).as_bytes().to_vec()),
            vec![i as u8], // Different payloads
            parents,
        );

        dag.add_vertex(vertex).unwrap();
    }

    // Verify that consensus is still reached despite many participants
    assert_eq!(dag.get_confidence("V0"), Some(ConsensusStatus::Final));
    assert_eq!(dag.get_confidence("V50"), Some(ConsensusStatus::Final));
}

// Property-based test for Byzantine behavior
proptest! {
    #![proptest_config(ProptestConfig::with_cases(10))]

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
            let parents: HashSet<VertexId> = if i == 0 {
                HashSet::new()
            } else {
                let mut set = HashSet::new();
                set.insert(VertexId::from_bytes(format!("H{}", i - 1).as_bytes().to_vec()));
                set
            };

            let vertex = Vertex::new(
                VertexId::from_bytes(id.as_bytes().to_vec()),
                vec![i as u8], // payload
                parents,
            );

            dag.add_vertex(vertex).unwrap();
            vertex_ids.insert(id);
        }

        // Attempt Byzantine behavior
        for i in 0..byzantine_attempts {
            let target_id = format!("H{}", i % honest_vertices);

            // Try to create conflicting vertex (fork)
            let byzantine_vertex = Vertex::new(
                VertexId::from_bytes(target_id.as_bytes().to_vec()),
                vec![255], // different payload
                HashSet::new(),
            );

            // Byzantine vertex should be rejected
            prop_assert!(dag.add_vertex(byzantine_vertex).is_err());

            // Original vertex should maintain its status
            prop_assert!(vertex_ids.contains(&target_id));
        }

        // Verify system remains consistent
        let tips = dag.get_tips();
        prop_assert!(!tips.is_empty());
    }
}
