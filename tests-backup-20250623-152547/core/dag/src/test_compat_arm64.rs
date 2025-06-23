//! Compatibility layer for tests

use crate::consensus::NodeState as ConsensusNodeState;
use crate::Dag;

/// Test-compatible NodeState that includes Processing variant
#[derive(Debug, Clone, PartialEq)]
pub enum NodeState {
    Processing,
    Active,
    Inactive,
    Failed,
}

impl From<NodeState> for ConsensusNodeState {
    fn from(state: NodeState) -> Self {
        match state {
            NodeState::Processing => ConsensusNodeState::Active,
            NodeState::Active => ConsensusNodeState::Active,
            NodeState::Inactive => ConsensusNodeState::Inactive,
            NodeState::Failed => ConsensusNodeState::Failed,
        }
    }
}

/// Extension trait for test compatibility
pub trait DagTestExt {
    fn update_node_state(&self, node_id: &str, state: NodeState);
    fn get_node(&self, node_id: &str) -> Option<crate::Node>;
    fn node_count(&self) -> usize;
    fn add_node(&self, node: crate::Node) -> Result<(), crate::DagError>;
}

impl DagTestExt for std::sync::Arc<crate::DAGConsensus> {
    fn update_node_state(&self, _node_id: &str, _state: NodeState) {
        // Implement based on actual DAG API
    }
    
    fn get_node(&self, _node_id: &str) -> Option<crate::Node> {
        None // Implement based on actual API
    }
    
    fn node_count(&self) -> usize {
        0 // Implement based on actual API
    }
    
    fn add_node(&self, _node: crate::Node) -> Result<(), crate::DagError> {
        Ok(()) // Implement based on actual API
    }
}
