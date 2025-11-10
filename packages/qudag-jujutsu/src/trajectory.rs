//! Agent trajectory tracking with QuantumDAG consensus

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

use qudag_dag::{Dag, DagMessage};
use qudag_dag::vertex::VertexId;

use crate::QuantumVcsError;

/// Operation type for trajectory tracking
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationType {
    Commit,
    Branch,
    Merge,
    Rebase,
    Review,
    Test,
    Deploy,
    Rollback,
}

impl OperationType {
    /// Convert to string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Commit => "COMMIT",
            Self::Branch => "BRANCH",
            Self::Merge => "MERGE",
            Self::Rebase => "REBASE",
            Self::Review => "REVIEW",
            Self::Test => "TEST",
            Self::Deploy => "DEPLOY",
            Self::Rollback => "ROLLBACK",
        }
    }
}

/// Agent trajectory record
#[derive(Debug, Clone)]
pub struct AgentTrajectory {
    /// Trajectory ID
    pub id: String,

    /// Agent ID
    pub agent_id: String,

    /// Operation type
    pub operation_type: OperationType,

    /// Related commits
    pub commits: Vec<String>,

    /// Start timestamp
    pub start_time: u64,

    /// End timestamp (None if ongoing)
    pub end_time: Option<u64>,

    /// Success status
    pub success: Option<bool>,

    /// Metadata
    pub metadata: HashMap<String, String>,
}

impl AgentTrajectory {
    /// Create a new trajectory
    pub fn new(agent_id: String, operation_type: OperationType) -> Self {
        let id = format!("traj_{}_{}", agent_id, uuid::Uuid::new_v4());
        let start_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            id,
            agent_id,
            operation_type,
            commits: Vec::new(),
            start_time,
            end_time: None,
            success: None,
            metadata: HashMap::new(),
        }
    }

    /// Add a commit to this trajectory
    pub fn add_commit(&mut self, commit_hash: String) {
        self.commits.push(commit_hash);
    }

    /// Finalize the trajectory
    pub fn finalize(&mut self, success: bool) {
        self.end_time = Some(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        );
        self.success = Some(success);
    }

    /// Get trajectory duration in seconds
    pub fn duration(&self) -> Option<u64> {
        self.end_time.map(|end| end - self.start_time)
    }

    /// Check if trajectory is complete
    pub fn is_complete(&self) -> bool {
        self.end_time.is_some()
    }

    /// Add metadata entry
    pub fn add_metadata(&mut self, key: String, value: String) {
        self.metadata.insert(key, value);
    }
}

/// Verified trajectory with consensus confirmation
#[derive(Debug, Clone)]
pub struct VerifiedTrajectory {
    /// The trajectory
    pub trajectory: AgentTrajectory,

    /// Consensus confirmation
    pub consensus_confirmed: bool,

    /// Number of confirming nodes
    pub confirmation_count: usize,
}

/// Trajectory consensus coordinator
///
/// Combines trajectory tracking with QuantumDAG consensus verification
pub struct TrajectoryConsensus {
    /// QuantumDAG for consensus
    dag: Arc<Dag>,

    /// Active trajectories
    trajectories: Arc<RwLock<HashMap<String, AgentTrajectory>>>,

    /// Completed trajectories
    completed: Arc<RwLock<Vec<AgentTrajectory>>>,
}

impl TrajectoryConsensus {
    /// Create a new trajectory consensus coordinator
    ///
    /// # Arguments
    ///
    /// * `dag` - QuantumDAG instance for consensus
    pub fn new(dag: Arc<Dag>) -> Self {
        Self {
            dag,
            trajectories: Arc::new(RwLock::new(HashMap::new())),
            completed: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Start a new agent trajectory
    ///
    /// Creates a trajectory and adds it to the DAG for consensus tracking
    ///
    /// # Arguments
    ///
    /// * `agent_id` - Agent starting the trajectory
    /// * `operation_type` - Type of operation
    ///
    /// # Returns
    ///
    /// Trajectory ID
    pub async fn start_trajectory(
        &self,
        agent_id: String,
        operation_type: OperationType,
    ) -> Result<String, QuantumVcsError> {
        let trajectory = AgentTrajectory::new(agent_id.clone(), operation_type);
        let trajectory_id = trajectory.id.clone();

        // Add to DAG for consensus
        let dag_message = DagMessage {
            id: VertexId::from_bytes(trajectory_id.as_bytes().to_vec()),
            payload: format!(
                "trajectory:{}:{}",
                agent_id,
                operation_type.as_str()
            )
            .into_bytes(),
            parents: std::collections::HashSet::new(),
            timestamp: trajectory.start_time,
        };

        self.dag.submit_message(dag_message).await?;

        // Store trajectory
        let mut trajectories = self.trajectories.write().await;
        trajectories.insert(trajectory_id.clone(), trajectory);

        Ok(trajectory_id)
    }

    /// Add a commit to an active trajectory
    ///
    /// # Arguments
    ///
    /// * `trajectory_id` - Trajectory to update
    /// * `commit_hash` - Commit hash to add
    pub async fn add_commit_to_trajectory(
        &self,
        trajectory_id: &str,
        commit_hash: String,
    ) -> Result<(), QuantumVcsError> {
        let mut trajectories = self.trajectories.write().await;

        if let Some(trajectory) = trajectories.get_mut(trajectory_id) {
            trajectory.add_commit(commit_hash);
            Ok(())
        } else {
            Err(QuantumVcsError::NotInitialized)
        }
    }

    /// Finalize a trajectory with consensus
    ///
    /// # Arguments
    ///
    /// * `trajectory_id` - Trajectory to finalize
    /// * `success` - Whether the operation succeeded
    pub async fn finalize_trajectory(
        &self,
        trajectory_id: &str,
        success: bool,
    ) -> Result<(), QuantumVcsError> {
        let mut trajectories = self.trajectories.write().await;

        if let Some(mut trajectory) = trajectories.remove(trajectory_id) {
            trajectory.finalize(success);

            // Move to completed
            let mut completed = self.completed.write().await;
            completed.push(trajectory);

            Ok(())
        } else {
            Err(QuantumVcsError::NotInitialized)
        }
    }

    /// Query trajectories for a specific agent
    ///
    /// # Arguments
    ///
    /// * `agent_id` - Agent to query
    ///
    /// # Returns
    ///
    /// Vector of completed trajectories
    pub async fn query_trajectories(&self, agent_id: &str) -> Vec<AgentTrajectory> {
        let completed = self.completed.read().await;
        completed
            .iter()
            .filter(|t| t.agent_id == agent_id)
            .cloned()
            .collect()
    }

    /// Query trajectories with consensus verification
    ///
    /// # Arguments
    ///
    /// * `agent_id` - Agent to query
    ///
    /// # Returns
    ///
    /// Vector of verified trajectories with consensus confirmation
    pub async fn query_consensus_trajectories(
        &self,
        agent_id: &str,
    ) -> Vec<VerifiedTrajectory> {
        let completed = self.completed.read().await;
        let dag_vertices = self.dag.vertices.read().await;

        completed
            .iter()
            .filter(|t| t.agent_id == agent_id)
            .map(|trajectory| {
                // Check if trajectory has DAG consensus
                let vertex_id = VertexId::from_bytes(trajectory.id.as_bytes().to_vec());
                let consensus_confirmed = dag_vertices.contains_key(&vertex_id);
                let confirmation_count = if consensus_confirmed { 1 } else { 0 };

                VerifiedTrajectory {
                    trajectory: trajectory.clone(),
                    consensus_confirmed,
                    confirmation_count,
                }
            })
            .collect()
    }

    /// Get learning statistics for an agent
    ///
    /// Analyzes trajectory patterns to extract learning insights
    ///
    /// # Arguments
    ///
    /// * `agent_id` - Agent to analyze
    ///
    /// # Returns
    ///
    /// Learning statistics
    pub async fn get_learning_stats(&self, agent_id: &str) -> LearningStats {
        let trajectories = self.query_trajectories(agent_id).await;

        let total_operations = trajectories.len();
        let successful_operations = trajectories.iter().filter(|t| t.success == Some(true)).count();
        let failed_operations = trajectories.iter().filter(|t| t.success == Some(false)).count();

        let avg_duration = if !trajectories.is_empty() {
            let total_duration: u64 = trajectories
                .iter()
                .filter_map(|t| t.duration())
                .sum();
            total_duration / trajectories.len() as u64
        } else {
            0
        };

        // Count operation types
        let mut operation_counts = HashMap::new();
        for trajectory in &trajectories {
            *operation_counts
                .entry(trajectory.operation_type.as_str().to_string())
                .or_insert(0) += 1;
        }

        LearningStats {
            agent_id: agent_id.to_string(),
            total_operations,
            successful_operations,
            failed_operations,
            success_rate: if total_operations > 0 {
                successful_operations as f64 / total_operations as f64
            } else {
                0.0
            },
            avg_duration_secs: avg_duration,
            operation_counts,
        }
    }

    /// Get active trajectory count
    pub async fn active_count(&self) -> usize {
        let trajectories = self.trajectories.read().await;
        trajectories.len()
    }

    /// Get completed trajectory count
    pub async fn completed_count(&self) -> usize {
        let completed = self.completed.read().await;
        completed.len()
    }
}

/// Learning statistics for an agent
#[derive(Debug, Clone)]
pub struct LearningStats {
    /// Agent ID
    pub agent_id: String,

    /// Total operations
    pub total_operations: usize,

    /// Successful operations
    pub successful_operations: usize,

    /// Failed operations
    pub failed_operations: usize,

    /// Success rate (0.0 to 1.0)
    pub success_rate: f64,

    /// Average operation duration in seconds
    pub avg_duration_secs: u64,

    /// Operation type counts
    pub operation_counts: HashMap<String, usize>,
}

// Simple UUID generation
mod uuid {
    use std::time::{SystemTime, UNIX_EPOCH};

    pub struct Uuid;

    impl Uuid {
        pub fn new_v4() -> String {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();

            format!("{:032x}", timestamp)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_trajectory_creation() {
        let dag = Arc::new(Dag::new(100));
        let consensus = TrajectoryConsensus::new(dag);

        let traj_id = consensus
            .start_trajectory("agent-001".to_string(), OperationType::Commit)
            .await
            .unwrap();

        assert!(traj_id.starts_with("traj_agent-001_"));
        assert_eq!(consensus.active_count().await, 1);
    }

    #[tokio::test]
    async fn test_trajectory_finalization() {
        let dag = Arc::new(Dag::new(100));
        let consensus = TrajectoryConsensus::new(dag);

        let traj_id = consensus
            .start_trajectory("agent-001".to_string(), OperationType::Commit)
            .await
            .unwrap();

        consensus.finalize_trajectory(&traj_id, true).await.unwrap();

        assert_eq!(consensus.active_count().await, 0);
        assert_eq!(consensus.completed_count().await, 1);
    }

    #[tokio::test]
    async fn test_trajectory_query() {
        let dag = Arc::new(Dag::new(100));
        let consensus = TrajectoryConsensus::new(dag);

        // Create and finalize multiple trajectories
        for i in 0..3 {
            let traj_id = consensus
                .start_trajectory(
                    "agent-001".to_string(),
                    if i % 2 == 0 {
                        OperationType::Commit
                    } else {
                        OperationType::Test
                    },
                )
                .await
                .unwrap();

            consensus.finalize_trajectory(&traj_id, i % 2 == 0).await.unwrap();
        }

        let trajectories = consensus.query_trajectories("agent-001").await;
        assert_eq!(trajectories.len(), 3);
    }

    #[tokio::test]
    async fn test_learning_stats() {
        let dag = Arc::new(Dag::new(100));
        let consensus = TrajectoryConsensus::new(dag);

        // Create successful and failed trajectories
        for i in 0..10 {
            let traj_id = consensus
                .start_trajectory("agent-001".to_string(), OperationType::Commit)
                .await
                .unwrap();

            // 70% success rate
            consensus
                .finalize_trajectory(&traj_id, i < 7)
                .await
                .unwrap();
        }

        let stats = consensus.get_learning_stats("agent-001").await;

        assert_eq!(stats.total_operations, 10);
        assert_eq!(stats.successful_operations, 7);
        assert_eq!(stats.failed_operations, 3);
        assert!((stats.success_rate - 0.7).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_consensus_verification() {
        let dag = Arc::new(Dag::new(100));
        let consensus = TrajectoryConsensus::new(dag);

        let traj_id = consensus
            .start_trajectory("agent-001".to_string(), OperationType::Commit)
            .await
            .unwrap();

        // Allow DAG to process the message
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        consensus.finalize_trajectory(&traj_id, true).await.unwrap();

        let verified = consensus
            .query_consensus_trajectories("agent-001")
            .await;

        assert_eq!(verified.len(), 1);
        assert!(verified[0].consensus_confirmed, "Expected trajectory to be confirmed by DAG consensus");
    }
}
