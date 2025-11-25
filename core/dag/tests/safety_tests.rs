//! Safety property tests for DAG consensus
//!
//! Tests that the consensus system maintains safety properties:
//! - Total order: all correct nodes see the same order
//! - Agreement: all correct nodes agree on finalized vertices
//! - Validity: only valid vertices can be finalized

use proptest::prelude::*;
use qudag_dag::{ConsensusConfig, ConsensusStatus, DAGConsensus, DagError, Vertex, VertexId};
use std::collections::HashSet;
use std::time::Duration;

fn create_test_vertex(id: &str, parents: Vec<&str>) -> Vertex {
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

// Test Total Order Property
#[test]
fn test_total_order() {
    let mut dag = DAGConsensus::new();

    // Create a simple chain: A -> B -> C
    let vertex_a = create_test_vertex("A", vec![]);
    let vertex_b = create_test_vertex("B", vec!["A"]);
    let vertex_c = create_test_vertex("C", vec!["B"]);

    dag.add_vertex(vertex_a).unwrap();
    dag.add_vertex(vertex_b).unwrap();
    dag.add_vertex(vertex_c).unwrap();

    // Verify that vertices are ordered correctly
    let order = dag.get_total_order().unwrap();
    assert_eq!(order, vec!["A", "B", "C"]);
}

// Test Agreement Property
#[test]
fn test_agreement() {
    let config = ConsensusConfig {
        query_sample_size: 5,
        finality_threshold: 0.8,
        finality_timeout: Duration::from_secs(2),
        confirmation_depth: 3,
    };

    let mut dag1 = DAGConsensus::with_config(config.clone());
    let mut dag2 = DAGConsensus::with_config(config);

    // Create identical vertices in both DAGs
    let vertex_a = create_test_vertex("A", vec![]);
    let vertex_b = create_test_vertex("B", vec!["A"]);

    // Add to both DAGs
    dag1.add_vertex(vertex_a.clone()).unwrap();
    dag1.add_vertex(vertex_b.clone()).unwrap();

    dag2.add_vertex(vertex_a).unwrap();
    dag2.add_vertex(vertex_b).unwrap();

    // Both DAGs should reach the same final state
    assert_eq!(dag1.get_confidence("B"), dag2.get_confidence("B"));
}

// Test Validity Property
#[test]
fn test_validity() {
    let mut dag = DAGConsensus::new();

    // Create valid vertex
    let vertex_a = create_test_vertex("A", vec![]);
    assert!(dag.add_vertex(vertex_a).is_ok());

    // Try to add vertex with non-existent parent
    let invalid_vertex = create_test_vertex("invalid", vec!["nonexistent"]);
    let result = dag.add_vertex(invalid_vertex);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("parent") || err_msg.contains("not found"),
        "Expected parent not found error, got: {}",
        err_msg
    );

    // Try to add vertex that creates a cycle (self-reference)
    let cycle_vertex = create_test_vertex("A", vec!["A"]);
    let result = dag.add_vertex(cycle_vertex);
    assert!(result.is_err());
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("Fork detected") || err_msg.contains("references itself"),
        "Expected fork or self-reference error, got: {}",
        err_msg
    );
}

// Property-based test for safety properties
proptest! {
    #![proptest_config(ProptestConfig::with_cases(10))]

    #[test]
    fn prop_total_order_consistency(
        vertex_count in 2..10usize,
    ) {
        let mut dag = DAGConsensus::new();
        let mut vertex_ids = Vec::new();

        // Add vertices in a chain
        for i in 0..vertex_count {
            let id = format!("V{}", i);
            let parents: HashSet<VertexId> = if i == 0 {
                HashSet::new()
            } else {
                let mut set = HashSet::new();
                set.insert(VertexId::from_bytes(format!("V{}", i - 1).as_bytes().to_vec()));
                set
            };

            let vertex = Vertex::new(
                VertexId::from_bytes(id.as_bytes().to_vec()),
                vec![i as u8],
                parents,
            );

            vertex_ids.push(id.clone());
            dag.add_vertex(vertex).unwrap();
        }

        // Verify total order properties
        let order = dag.get_total_order().unwrap();
        prop_assert_eq!(order.len(), vertex_count);

        // Verify that parents come before children (order should be V0, V1, V2, ...)
        for i in 1..vertex_ids.len() {
            let parent = &vertex_ids[i - 1];
            let child = &vertex_ids[i];
            let parent_idx = order.iter().position(|id| id == parent).unwrap();
            let child_idx = order.iter().position(|id| id == child).unwrap();
            prop_assert!(parent_idx < child_idx);
        }
    }
}
