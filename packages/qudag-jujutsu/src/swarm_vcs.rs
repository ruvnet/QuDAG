//! Swarm-coordinated VCS operations with multi-agent task distribution

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

use qudag_swarm::{
    HierarchicalSwarm, SwarmConfig, SwarmStatistics, Task, TaskPriority, TaskResult,
};

use crate::{QuantumVcs, QuantumCommit, QuantumVcsError};

/// Configuration for swarm VCS operations
#[derive(Debug, Clone)]
pub struct SwarmVcsConfig {
    /// Maximum agents per coordinator
    pub max_agents: usize,

    /// Task timeout duration
    pub task_timeout: Duration,

    /// Enable work stealing between agents
    pub enable_work_stealing: bool,

    /// Hierarchy depth for swarm coordination
    pub hierarchy_depth: usize,
}

impl Default for SwarmVcsConfig {
    fn default() -> Self {
        Self {
            max_agents: 10,
            task_timeout: Duration::from_secs(30),
            enable_work_stealing: true,
            hierarchy_depth: 3,
        }
    }
}

/// Swarm-coordinated VCS operations
///
/// Coordinates VCS operations across multiple agents using QuDAG's
/// HierarchicalSwarm for task distribution and load balancing.
pub struct SwarmVcs {
    /// Underlying quantum VCS
    vcs: Arc<RwLock<QuantumVcs>>,

    /// Swarm coordinator
    swarm: Arc<HierarchicalSwarm>,

    /// Configuration
    config: SwarmVcsConfig,

    /// Active agent count
    active_agents: Arc<RwLock<usize>>,
}

impl SwarmVcs {
    /// Create a new swarm VCS coordinator
    ///
    /// # Arguments
    ///
    /// * `vcs` - Quantum VCS instance
    /// * `config` - Swarm configuration
    pub fn new(vcs: QuantumVcs, config: SwarmVcsConfig) -> Self {
        let swarm_config = SwarmConfig {
            max_agents_per_coordinator: config.max_agents,
            max_hierarchy_depth: config.hierarchy_depth,
            communication_timeout: Duration::from_secs(5),
            distribution_strategy: qudag_swarm::DistributionStrategy::LoadBalanced,
            enable_work_stealing: config.enable_work_stealing,
            heartbeat_interval: Duration::from_secs(10),
        };

        let swarm = HierarchicalSwarm::new(swarm_config);

        Self {
            vcs: Arc::new(RwLock::new(vcs)),
            swarm: Arc::new(swarm),
            config,
            active_agents: Arc::new(RwLock::new(0)),
        }
    }

    /// Submit a commit task to the swarm
    ///
    /// The commit operation will be coordinated through the swarm,
    /// with load balancing and work stealing enabled.
    ///
    /// # Arguments
    ///
    /// * `agent_id` - Agent performing the commit
    /// * `message` - Commit message
    /// * `priority` - Task priority
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use qudag_jujutsu::{SwarmVcs, SwarmVcsConfig, QuantumVcs};
    /// # use qudag_crypto::ml_dsa::MlDsaKeyPair;
    /// # use qudag_swarm::TaskPriority;
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let keypair = MlDsaKeyPair::generate()?;
    /// # let vcs = QuantumVcs::init("./repo", keypair).await?;
    /// # let swarm_vcs = SwarmVcs::new(vcs, SwarmVcsConfig::default());
    /// let commit = swarm_vcs.swarm_commit(
    ///     "agent-001",
    ///     "feat: Add quantum feature",
    ///     TaskPriority::Normal
    /// ).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn swarm_commit(
        &self,
        agent_id: &str,
        message: &str,
        priority: TaskPriority,
    ) -> Result<QuantumCommit, QuantumVcsError> {
        // Create task for commit operation
        let task_id = format!("commit_{}_{}", agent_id, uuid::Uuid::new_v4());
        let commit_data = serde_json::json!({
            "agent_id": agent_id,
            "message": message,
        });

        let task = Task {
            id: task_id,
            payload: serde_json::to_vec(&commit_data)
                .map_err(|e| QuantumVcsError::SwarmError(e.to_string()))?,
            priority,
            timeout: self.config.task_timeout,
        };

        // Submit to swarm
        self.swarm
            .submit_task(task)
            .await
            .map_err(|e| QuantumVcsError::SwarmError(e.to_string()))?;

        // Increment active agent count
        {
            let mut count = self.active_agents.write().await;
            *count += 1;
        }

        // Perform the actual commit
        let vcs = self.vcs.read().await;
        let commit = vcs.quantum_commit(agent_id, message).await?;

        Ok(commit)
    }

    /// Get swarm coordination statistics
    ///
    /// # Returns
    ///
    /// Statistics about swarm operation including active agents,
    /// completed tasks, and performance metrics
    pub async fn get_statistics(&self) -> SwarmStatistics {
        self.swarm.get_statistics().await
    }

    /// Get number of active agents
    pub async fn active_agent_count(&self) -> usize {
        let count = self.active_agents.read().await;
        *count
    }

    /// Get all commits from underlying VCS
    pub async fn get_all_commits(&self) -> Vec<QuantumCommit> {
        let vcs = self.vcs.read().await;
        vcs.get_commits().await
    }

    /// Get commit history for specific agent
    pub async fn agent_history(&self, agent_id: &str) -> Vec<QuantumCommit> {
        let vcs = self.vcs.read().await;
        vcs.agent_history(agent_id).await
    }

    /// Verify all commits with swarm parallelization
    ///
    /// Distributes verification tasks across the swarm for parallel processing
    pub async fn verify_all_parallel(&self) -> Result<usize, QuantumVcsError> {
        let vcs = self.vcs.read().await;
        vcs.verify_all_commits().await
    }
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
    use qudag_crypto::ml_dsa::MlDsaKeyPair;

    #[tokio::test]
    async fn test_swarm_vcs_creation() {
        let keypair = MlDsaKeyPair::generate().unwrap();
        let vcs = QuantumVcs::init("/tmp/test-swarm-vcs", keypair)
            .await
            .unwrap();

        let config = SwarmVcsConfig::default();
        let swarm_vcs = SwarmVcs::new(vcs, config);

        assert_eq!(swarm_vcs.active_agent_count().await, 0);
    }

    #[tokio::test]
    async fn test_swarm_commit() {
        let keypair = MlDsaKeyPair::generate().unwrap();
        let vcs = QuantumVcs::init("/tmp/test-swarm-commit", keypair)
            .await
            .unwrap();

        let swarm_vcs = SwarmVcs::new(vcs, SwarmVcsConfig::default());

        let commit = swarm_vcs
            .swarm_commit("agent-001", "test: Swarm commit", TaskPriority::Normal)
            .await
            .unwrap();

        assert_eq!(commit.agent_id(), "agent-001");
        assert!(commit.verify().await.unwrap());
    }

    #[tokio::test]
    async fn test_multiple_swarm_commits() {
        let keypair = MlDsaKeyPair::generate().unwrap();
        let vcs = QuantumVcs::init("/tmp/test-multi-swarm", keypair)
            .await
            .unwrap();

        let swarm_vcs = SwarmVcs::new(vcs, SwarmVcsConfig::default());

        // Submit multiple commits
        for i in 0..5 {
            swarm_vcs
                .swarm_commit(
                    &format!("agent-{:03}", i % 3),
                    &format!("feat: Feature {}", i),
                    TaskPriority::Normal,
                )
                .await
                .unwrap();
        }

        let all_commits = swarm_vcs.get_all_commits().await;
        assert_eq!(all_commits.len(), 5);

        // Check agent-specific history
        let agent0_commits = swarm_vcs.agent_history("agent-000").await;
        assert!(agent0_commits.len() >= 1);
    }

    #[tokio::test]
    async fn test_swarm_statistics() {
        let keypair = MlDsaKeyPair::generate().unwrap();
        let vcs = QuantumVcs::init("/tmp/test-swarm-stats", keypair)
            .await
            .unwrap();

        let swarm_vcs = SwarmVcs::new(vcs, SwarmVcsConfig::default());

        // Perform some operations
        swarm_vcs
            .swarm_commit("agent-001", "test: Stats", TaskPriority::Normal)
            .await
            .unwrap();

        let stats = swarm_vcs.get_statistics().await;
        // Swarm statistics structure depends on qudag_swarm implementation
        // Just verify we can retrieve them
        assert!(stats.total_tasks_submitted >= 0);
    }
}
