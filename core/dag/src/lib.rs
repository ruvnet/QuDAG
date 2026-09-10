#![deny(unsafe_code)]
#![warn(missing_docs)]

//! DAG consensus implementation with QR-Avalanche algorithm.
//!
//! This module provides the core DAG (Directed Acyclic Graph) implementation
//! with quantum-resistant consensus using a modified Avalanche protocol.
//!
//! ## Key Types
//!
//! - [`QrDag`] - Main DAG consensus implementation (alias for `DAGConsensus`)
//! - [`Vertex`] / [`VertexId`] - DAG vertices and their identifiers
//! - [`Consensus`] / [`QRAvalanche`] - Consensus algorithms and implementations
//! - [`Graph`] - High-performance graph data structure with caching
//! - [`Node`] - Node representation with state management
//! - [`TipSelection`] - Algorithms for choosing vertices to extend
//!
//! ## Example Usage
//!
//! ```rust
//! use qudag_dag::{QrDag, Vertex, VertexId, ConsensusConfig};
//! use std::collections::{BTreeSet, HashMap, HashSet};
//!
//! // Create a new DAG consensus instance
//! let mut dag = QrDag::new();
//!
//! // Add a message to the DAG
//! let message = b"Hello, DAG!".to_vec();
//! dag.add_message(message.clone()).expect("Failed to add message");
//!
//! // Check if the message exists
//! assert!(dag.contains_message(&message));
//!
//! // Get current tips
//! let tips = dag.get_tips();
//! println!("Current tips: {:?}", tips);
//!
//! // Create a vertex directly
//! let vertex_id = VertexId::new();
//! let vertex = Vertex::new(vertex_id, b"vertex data".to_vec(), HashSet::new());
//! dag.add_vertex(vertex).expect("Failed to add vertex");
//! ```

/// Consensus algorithms and voting mechanisms for the DAG
pub mod consensus;
/// Core DAG data structure and message processing
pub mod dag;
/// Edge representation for DAG connections
pub mod edge;
/// Error types for DAG operations
pub mod error;
/// High-performance graph data structure with caching
pub mod graph;
/// Node representation with state management
pub mod node;
// Optimized DAG operations with caching and indexing (disabled for initial release)
// #[cfg(any(feature = "optimizations", feature = "validation-cache", feature = "traversal-index"))]
// pub mod optimized;
/// Tip selection algorithms for choosing vertices to extend
pub mod tip_selection;
/// Vertex representation and operations for the DAG structure
pub mod vertex;

#[cfg(test)]
mod consensus_tests;

#[cfg(test)]
mod invariant_tests;

#[cfg(test)]
mod module_exports_tests;

#[cfg(test)]
mod lib_test_compilation;

/// Result type alias for DAG operations
pub type Result<T> = std::result::Result<T, error::DagError>;
pub use edge::Edge;
pub use error::DagError;
pub use graph::{Graph, GraphMetrics, StorageConfig};
pub use node::{Node, NodeState, SerializableHash};

pub use consensus::{
    Confidence, Consensus, ConsensusError, ConsensusMetrics, ConsensusStatus, QRAvalanche,
    QRAvalancheConfig, VotingRecord,
};
pub use dag::{Dag, DagError as DagModuleError, DagMessage};
// #[cfg(any(feature = "optimizations", feature = "validation-cache", feature = "traversal-index"))]
// pub use optimized::{
//     ValidationCache, ValidationResult, TraversalIndex, IndexedDAG
// };
pub use tip_selection::{
    AdvancedTipSelection, ParentSelectionAlgorithm, TipSelection, TipSelectionConfig,
    TipSelectionError, VertexWeight,
};
pub use vertex::{Vertex, VertexError, VertexId, VertexOps};

/// Alias for QR-Avalanche DAG consensus implementation
pub type QrDag = DAGConsensus;

// Note: We export both Confidence (detailed confidence info) and ConsensusStatus (simple status)

use std::collections::{BTreeSet, HashMap, HashSet};
use std::time::Duration;

/// Configuration for DAG consensus algorithm
#[derive(Debug, Clone)]
pub struct ConsensusConfig {
    /// Number of nodes to query for consensus
    pub query_sample_size: usize,
    /// Threshold for finality (0.0 to 1.0)  
    pub finality_threshold: f64,
    /// Timeout for finality decisions
    pub finality_timeout: Duration,
    /// Depth required for confirmation
    pub confirmation_depth: usize,
}

impl Default for ConsensusConfig {
    fn default() -> Self {
        Self {
            query_sample_size: 10,
            finality_threshold: 0.8,
            finality_timeout: Duration::from_secs(5),
            confirmation_depth: 3,
        }
    }
}

/// Deterministic local DAG admission facade. Admission remains Pending until
/// a separately authenticated consensus protocol establishes finality.
pub struct DAGConsensus {
    vertices: HashMap<VertexId, Vertex>,
    #[allow(dead_code)]
    config: ConsensusConfig,
    consensus: QRAvalanche,
}

impl Default for DAGConsensus {
    fn default() -> Self {
        Self::new()
    }
}

impl DAGConsensus {
    /// Creates a new DAG consensus instance with default configuration
    pub fn new() -> Self {
        Self::with_config(ConsensusConfig::default())
    }

    /// Creates a new DAG consensus instance with custom configuration
    pub fn with_config(config: ConsensusConfig) -> Self {
        Self {
            vertices: HashMap::new(),
            config,
            consensus: QRAvalanche::new(),
        }
    }

    /// Adds a vertex to the DAG
    pub fn add_vertex(&mut self, vertex: Vertex) -> Result<()> {
        // Check for existing vertex with same ID (fork detection)
        let vertex_id_str = String::from_utf8_lossy(vertex.id.as_bytes()).to_string();
        if self.consensus.vertices.contains_key(&vertex.id) {
            return Err(DagError::ConsensusError(format!(
                "Fork detected: vertex {} already exists",
                vertex_id_str
            )));
        }

        // Check for self-references (cycles)
        if vertex.parents.contains(&vertex.id) {
            return Err(DagError::ConsensusError(format!(
                "Validation error: vertex {} references itself",
                vertex_id_str
            )));
        }

        // Validate vertex parents exist (except for genesis)
        if !vertex.parents.is_empty() {
            for parent in &vertex.parents {
                if !self.consensus.vertices.contains_key(parent) {
                    return Err(DagError::ConsensusError(format!(
                        "Invalid vertex: parent {:?} not found",
                        parent
                    )));
                }
            }
        }

        // Commit only after every structural check passes. Local admission is
        // not a distributed vote and cannot establish finality.
        self.consensus
            .vertices
            .insert(vertex.id.clone(), ConsensusStatus::Pending);
        for parent in &vertex.parents {
            self.consensus.tips.remove(parent);
        }
        self.consensus.tips.insert(vertex.id.clone());
        self.vertices.insert(vertex.id.clone(), vertex);

        Ok(())
    }

    /// Gets the confidence/consensus status for a vertex
    pub fn get_confidence(&self, vertex_id: &str) -> Option<ConsensusStatus> {
        let id = VertexId::from_bytes(vertex_id.as_bytes().to_vec());
        self.consensus.vertices.get(&id).cloned()
    }

    /// Deterministic local topological order, using raw IDs to break ties.
    /// This is not a finalized distributed ordering. The string API rejects
    /// non-UTF8 IDs rather than silently aliasing them through lossy decoding.
    pub fn get_total_order(&self) -> Result<Vec<String>> {
        let mut indegree = HashMap::new();
        let mut children: HashMap<VertexId, Vec<VertexId>> = HashMap::new();
        let mut ready = BTreeSet::new();
        for (id, vertex) in &self.vertices {
            let parents = vertex.parents();
            indegree.insert(id.clone(), parents.len());
            if parents.is_empty() {
                ready.insert(id.as_bytes().to_vec());
            }
            for parent in parents {
                children.entry(parent).or_default().push(id.clone());
            }
        }
        let mut order = Vec::with_capacity(self.vertices.len());
        while let Some(bytes) = ready.pop_first() {
            let id = VertexId::from_bytes(bytes.clone());
            order.push(String::from_utf8(bytes).map_err(|_| {
                DagError::ConsensusError("String order API requires UTF-8 IDs".into())
            })?);
            for child in children.get(&id).into_iter().flatten() {
                let count = indegree
                    .get_mut(child)
                    .ok_or_else(|| DagError::ConsensusError("Missing child".into()))?;
                *count -= 1;
                if *count == 0 {
                    ready.insert(child.as_bytes().to_vec());
                }
            }
        }
        if order.len() != self.vertices.len() {
            return Err(DagError::ConsensusError("Cycle or missing parent".into()));
        }
        Ok(order)
    }

    /// Gets current DAG tips
    pub fn get_tips(&self) -> Vec<String> {
        self.consensus
            .tips
            .iter()
            .map(|id| String::from_utf8_lossy(id.as_bytes()).to_string())
            .collect()
    }

    /// Add a message to the DAG (for test compatibility)
    pub fn add_message(&mut self, message: Vec<u8>) -> Result<()> {
        let vertex_id = VertexId::from_bytes(message.clone());
        let vertex = Vertex::new(vertex_id, message, HashSet::new());
        self.add_vertex(vertex)
    }

    /// Check if the DAG contains a message (for test compatibility)
    pub fn contains_message(&self, message: &[u8]) -> bool {
        let vertex_id = VertexId::from_bytes(message.to_vec());
        self.vertices.contains_key(&vertex_id)
    }

    /// Legacy unsigned API cannot establish authenticity and always rejects.
    #[deprecated(note = "Use verify_signed_message with an explicit ML-DSA signature")]
    pub fn verify_message(&self, _message: &[u8], _public_key: &[u8]) -> bool {
        false
    }
}

impl DAGConsensus {
    /// Verify an explicitly supplied ML-DSA signature. Trust in the supplied key
    /// must be established by the caller; this does not grant DAG membership.
    pub fn verify_signed_message(
        &self,
        message: &[u8],
        signature: &[u8],
        public_key: &[u8],
    ) -> bool {
        qudag_crypto::ml_dsa::MlDsaPublicKey::from_bytes(public_key)
            .and_then(|key| key.verify(message, signature))
            .is_ok()
    }
}

#[cfg(test)]
mod signature_boundary_tests {
    use super::*;
    #[test]
    #[allow(deprecated)]
    fn unsigned_and_forged_messages_are_rejected() {
        let dag = DAGConsensus::new();
        assert!(!dag.verify_message(b"untrusted", b"arbitrary"));
        assert!(!dag.verify_signed_message(b"untrusted", b"forged", b"arbitrary"));
    }
    #[test]
    fn authentic_message_passes_but_mutation_fails() {
        let mut rng = rand::thread_rng();
        let key = qudag_crypto::ml_dsa::MlDsaKeyPair::generate(&mut rng).unwrap();
        let sig = key.sign(b"message", &mut rng).unwrap();
        let dag = DAGConsensus::new();
        assert!(dag.verify_signed_message(b"message", &sig, key.public_key()));
        assert!(!dag.verify_signed_message(b"tampered", &sig, key.public_key()));
    }
}

#[cfg(test)]
mod v2_admission_tests {
    use super::*;
    fn vertex(id: &str, parents: &[&str], timestamp: u64) -> Vertex {
        let mut v = Vertex::new(
            VertexId::from_bytes(id.as_bytes().to_vec()),
            vec![1],
            parents
                .iter()
                .map(|p| VertexId::from_bytes(p.as_bytes().to_vec()))
                .collect(),
        );
        v.timestamp = timestamp;
        v
    }
    #[test]
    fn admission_is_atomic_pending_and_parent_ordered() {
        let mut dag = DAGConsensus::new();
        dag.add_vertex(vertex("parent", &[], 999)).unwrap();
        assert!(dag.add_vertex(vertex("invalid", &["absent"], 0)).is_err());
        assert_eq!(dag.get_confidence("invalid"), None);
        dag.add_vertex(vertex("child", &["parent"], 0)).unwrap();
        assert_eq!(dag.get_total_order().unwrap(), vec!["parent", "child"]);
        assert_eq!(dag.get_tips(), vec!["child"]);
        assert_eq!(dag.get_confidence("child"), Some(ConsensusStatus::Pending));
    }
    #[test]
    fn arrival_order_does_not_change_topological_order() {
        let mut a = DAGConsensus::new();
        let mut b = DAGConsensus::new();
        for id in ["a", "b"] {
            a.add_vertex(vertex(id, &[], 1)).unwrap();
        }
        for id in ["b", "a"] {
            b.add_vertex(vertex(id, &[], 1)).unwrap();
        }
        assert_eq!(a.get_total_order().unwrap(), b.get_total_order().unwrap());
    }
}
