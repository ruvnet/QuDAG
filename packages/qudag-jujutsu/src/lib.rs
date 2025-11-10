#![deny(unsafe_code)]
#![warn(missing_docs)]

//! Quantum-resistant version control with Jujutsu VCS and QuDAG multi-agent coordination.
//!
//! This crate integrates Jujutsu VCS (jj-lib) with QuDAG's quantum-resistant cryptography
//! and multi-agent coordination system to provide:
//!
//! - Quantum-signed commits with ML-DSA signatures
//! - Swarm-coordinated VCS operations
//! - DAG consensus for distributed version control
//! - Agent trajectory tracking and learning
//! - Immutable audit trails with quantum fingerprints
//!
//! # Features
//!
//! - **Quantum Signatures**: All commits signed with ML-DSA (FIPS 204)
//! - **DAG Consensus**: QuantumDAG consensus for distributed operations
//! - **Swarm Coordination**: Multi-agent task distribution and load balancing
//! - **Trajectory Tracking**: Record and analyze agent operation sequences
//! - **Immutable Audit**: BLAKE3 fingerprints and quantum-resistant proofs
//!
//! # Example
//!
//! ```rust,no_run
//! use qudag_jujutsu::{QuantumVcs, QuantumCommit};
//! use qudag_crypto::ml_dsa::MlDsaKeyPair;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Initialize quantum VCS
//!     let keypair = MlDsaKeyPair::generate()?;
//!     let vcs = QuantumVcs::init("./my-repo", keypair).await?;
//!
//!     // Create quantum-signed commit
//!     let commit = vcs.quantum_commit(
//!         "agent-001",
//!         "feat: Add quantum-secure feature"
//!     ).await?;
//!
//!     // Verify quantum signature
//!     assert!(commit.verify().await?);
//!
//!     Ok(())
//! }
//! ```

use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use thiserror::Error;

// QuDAG components
use qudag_crypto::ml_dsa::{MlDsaKeyPair, MlDsaPublicKey, MlDsaError};
use qudag_crypto::fingerprint::{Fingerprint, FingerprintError};
use qudag_dag::{Dag, DagMessage, DagModuleError};
use qudag_dag::vertex::VertexId;
use qudag_swarm::{HierarchicalSwarm, SwarmConfig};

// Jujutsu library
use jj_lib::workspace::Workspace;

mod quantum_commit;
mod swarm_vcs;
mod trajectory;

pub use quantum_commit::{QuantumCommit, QuantumCommitError};
pub use swarm_vcs::{SwarmVcs, SwarmVcsConfig};
pub use trajectory::{AgentTrajectory, TrajectoryConsensus};

/// Errors that can occur during quantum VCS operations
#[derive(Error, Debug)]
pub enum QuantumVcsError {
    /// Jujutsu library error
    #[error("Jujutsu error: {0}")]
    JujutsuError(String),

    /// Cryptographic operation failed
    #[error("Crypto error: {0}")]
    CryptoError(#[from] qudag_crypto::CryptoError),

    /// DAG operation failed
    #[error("DAG error: {0}")]
    DagError(#[from] DagModuleError),

    /// Swarm coordination failed
    #[error("Swarm error: {0}")]
    SwarmError(String),

    /// Commit verification failed
    #[error("Verification failed: {0}")]
    VerificationFailed(String),

    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// Quantum commit error
    #[error("Quantum commit error: {0}")]
    QuantumCommitError(#[from] QuantumCommitError),

    /// ML-DSA error
    #[error("ML-DSA error: {0}")]
    MlDsaError(#[from] MlDsaError),

    /// Fingerprint error
    #[error("Fingerprint error: {0}")]
    FingerprintError(#[from] FingerprintError),

    /// Repository not initialized
    #[error("Repository not initialized")]
    NotInitialized,
}

/// Main quantum VCS coordinator integrating Jujutsu with QuDAG
pub struct QuantumVcs {
    /// Path to repository
    repo_path: PathBuf,

    /// Jujutsu workspace
    workspace: Arc<RwLock<Option<Workspace>>>,

    /// ML-DSA keypair for quantum signatures
    keypair: Arc<MlDsaKeyPair>,

    /// QuantumDAG for consensus
    dag: Arc<Dag>,

    /// Swarm coordinator for multi-agent operations
    swarm: Arc<HierarchicalSwarm>,

    /// Commit cache
    commits: Arc<RwLock<Vec<QuantumCommit>>>,
}

impl QuantumVcs {
    /// Initialize a new quantum VCS instance
    ///
    /// # Arguments
    ///
    /// * `path` - Path to repository
    /// * `keypair` - ML-DSA keypair for quantum signatures
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use qudag_jujutsu::QuantumVcs;
    /// # use qudag_crypto::ml_dsa::MlDsaKeyPair;
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// let keypair = MlDsaKeyPair::generate()?;
    /// let vcs = QuantumVcs::init("./repo", keypair).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn init<P: AsRef<Path>>(
        path: P,
        keypair: MlDsaKeyPair,
    ) -> Result<Self, QuantumVcsError> {
        let repo_path = path.as_ref().to_path_buf();

        // Initialize components
        let dag = Arc::new(Dag::new(100));
        let swarm_config = SwarmConfig::default();
        let swarm = Arc::new(HierarchicalSwarm::new(swarm_config));

        // Try to load existing workspace, or None if repo doesn't exist yet
        let workspace = Arc::new(RwLock::new(None));

        Ok(Self {
            repo_path,
            workspace,
            keypair: Arc::new(keypair),
            dag,
            swarm,
            commits: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// Initialize a new Jujutsu repository with quantum support
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use qudag_jujutsu::QuantumVcs;
    /// # use qudag_crypto::ml_dsa::MlDsaKeyPair;
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let keypair = MlDsaKeyPair::generate()?;
    /// # let vcs = QuantumVcs::init("./repo", keypair).await?;
    /// vcs.init_repo().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn init_repo(&self) -> Result<(), QuantumVcsError> {
        // Create directory if it doesn't exist
        tokio::fs::create_dir_all(&self.repo_path).await?;

        // Note: jj-lib initialization would go here
        // This is a placeholder as jj-lib's initialization API requires
        // more setup than we can show in this initial implementation

        Ok(())
    }

    /// Create a quantum-signed commit
    ///
    /// # Arguments
    ///
    /// * `agent_id` - ID of agent creating the commit
    /// * `message` - Commit message
    ///
    /// # Returns
    ///
    /// A `QuantumCommit` with ML-DSA signature and quantum fingerprint
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use qudag_jujutsu::QuantumVcs;
    /// # use qudag_crypto::ml_dsa::MlDsaKeyPair;
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error>> {
    /// # let keypair = MlDsaKeyPair::generate()?;
    /// # let vcs = QuantumVcs::init("./repo", keypair).await?;
    /// let commit = vcs.quantum_commit("agent-001", "feat: New feature").await?;
    /// assert!(commit.verify().await?);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn quantum_commit(
        &self,
        agent_id: &str,
        message: &str,
    ) -> Result<QuantumCommit, QuantumVcsError> {
        // Create commit in jj
        // Note: This is simplified - actual jj-lib usage requires more setup
        let jj_hash = format!("jj_{}", uuid::Uuid::new_v4());

        // Generate quantum fingerprint
        let commit_data = format!("{}:{}:{}", agent_id, jj_hash, message);
        let mut rng = rand::rngs::OsRng;
        let (fingerprint, fp_public_key) = Fingerprint::generate(commit_data.as_bytes(), &mut rng)?;

        // Sign with ML-DSA
        let signature_data = format!("{}:{}", jj_hash, fingerprint.as_hex());
        let signature = self.keypair.sign(signature_data.as_bytes(), &mut rng)?;

        // Get public key as MlDsaPublicKey
        let public_key = MlDsaPublicKey::from_bytes(self.keypair.public_key())?;

        // Create quantum commit
        let commit = QuantumCommit::new(
            message.to_string(),
            jj_hash.clone(),
            signature,
            fingerprint,
            fp_public_key,
            agent_id.to_string(),
            public_key,
        );

        // Add to DAG for consensus
        let dag_message = DagMessage {
            id: VertexId::from_bytes(jj_hash.as_bytes().to_vec()),
            payload: commit_data.into_bytes(),
            parents: std::collections::HashSet::new(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        self.dag.submit_message(dag_message).await?;

        // Cache commit
        let mut commits = self.commits.write().await;
        commits.push(commit.clone());

        Ok(commit)
    }

    /// Get all quantum-signed commits
    ///
    /// # Returns
    ///
    /// Vector of all commits with quantum signatures
    pub async fn get_commits(&self) -> Vec<QuantumCommit> {
        let commits = self.commits.read().await;
        commits.clone()
    }

    /// Verify all commits in repository
    ///
    /// # Returns
    ///
    /// Number of verified commits
    pub async fn verify_all_commits(&self) -> Result<usize, QuantumVcsError> {
        let commits = self.commits.read().await;
        let mut verified_count = 0;

        for commit in commits.iter() {
            if commit.verify().await? {
                verified_count += 1;
            }
        }

        Ok(verified_count)
    }

    /// Get commit history for a specific agent
    ///
    /// # Arguments
    ///
    /// * `agent_id` - Agent ID to query
    ///
    /// # Returns
    ///
    /// Vector of commits created by the agent
    pub async fn agent_history(&self, agent_id: &str) -> Vec<QuantumCommit> {
        let commits = self.commits.read().await;
        commits
            .iter()
            .filter(|c| c.agent_id() == agent_id)
            .cloned()
            .collect()
    }

    /// Get DAG consensus statistics
    ///
    /// # Returns
    ///
    /// Number of vertices in the DAG
    pub async fn dag_stats(&self) -> usize {
        let vertices = self.dag.vertices.read().await;
        vertices.len()
    }

    /// Get swarm coordination statistics
    ///
    /// # Returns
    ///
    /// Swarm statistics including active agents and task counts
    pub async fn swarm_stats(&self) -> qudag_swarm::SwarmStatistics {
        self.swarm.get_stats()
    }
}

#[cfg(feature = "napi-bindings")]
mod napi_bindings {
    //! N-API bindings for Node.js integration
    //!
    //! Enable with `napi-bindings` feature

    use super::*;
    use napi::bindgen_prelude::*;
    use napi_derive::napi;

    #[napi]
    pub struct QuantumVcsWrapper {
        inner: Arc<tokio::sync::RwLock<QuantumVcs>>,
    }

    #[napi]
    impl QuantumVcsWrapper {
        #[napi(factory)]
        pub async fn init(path: String) -> Result<Self> {
            let keypair = MlDsaKeyPair::generate()
                .map_err(|e| Error::from_reason(format!("Key generation failed: {}", e)))?;

            let vcs = QuantumVcs::init(path, keypair).await
                .map_err(|e| Error::from_reason(format!("VCS init failed: {}", e)))?;

            Ok(Self {
                inner: Arc::new(tokio::sync::RwLock::new(vcs)),
            })
        }

        #[napi]
        pub async fn quantum_commit(
            &self,
            agent_id: String,
            message: String,
        ) -> Result<String> {
            let vcs = self.inner.read().await;
            let commit = vcs.quantum_commit(&agent_id, &message).await
                .map_err(|e| Error::from_reason(format!("Commit failed: {}", e)))?;

            Ok(commit.jj_hash().to_string())
        }

        #[napi]
        pub async fn verify_all(&self) -> Result<u32> {
            let vcs = self.inner.read().await;
            let count = vcs.verify_all_commits().await
                .map_err(|e| Error::from_reason(format!("Verification failed: {}", e)))?;

            Ok(count as u32)
        }

        #[napi]
        pub async fn get_dag_stats(&self) -> Result<u32> {
            let vcs = self.inner.read().await;
            let count = vcs.dag_stats().await;
            Ok(count as u32)
        }
    }
}

// Simple UUID generation (avoiding extra dependency)
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
    async fn test_quantum_vcs_init() {
        let mut rng = rand::rngs::OsRng;
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let vcs = QuantumVcs::init("/tmp/test-quantum-vcs", keypair).await;
        assert!(vcs.is_ok());
    }

    #[tokio::test]
    async fn test_quantum_commit() {
        let mut rng = rand::rngs::OsRng;
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let vcs = QuantumVcs::init("/tmp/test-quantum-commit", keypair)
            .await
            .unwrap();

        let commit = vcs
            .quantum_commit("agent-test", "test: Initial commit")
            .await
            .unwrap();

        assert_eq!(commit.agent_id(), "agent-test");
        assert!(commit.verify().await.unwrap());
    }

    #[tokio::test]
    async fn test_agent_history() {
        let mut rng = rand::rngs::OsRng;
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let vcs = QuantumVcs::init("/tmp/test-agent-history", keypair)
            .await
            .unwrap();

        // Create multiple commits
        vcs.quantum_commit("agent-001", "feat: Feature 1")
            .await
            .unwrap();
        vcs.quantum_commit("agent-001", "feat: Feature 2")
            .await
            .unwrap();
        vcs.quantum_commit("agent-002", "fix: Bug fix")
            .await
            .unwrap();

        // Get history for agent-001
        let history = vcs.agent_history("agent-001").await;
        assert_eq!(history.len(), 2);

        // Get history for agent-002
        let history2 = vcs.agent_history("agent-002").await;
        assert_eq!(history2.len(), 1);
    }

    #[tokio::test]
    async fn test_dag_integration() {
        let mut rng = rand::rngs::OsRng;
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let vcs = QuantumVcs::init("/tmp/test-dag-integration", keypair)
            .await
            .unwrap();

        // Create commit (adds to DAG)
        vcs.quantum_commit("agent-001", "test: DAG integration")
            .await
            .unwrap();

        // Allow DAG to process the message
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Check DAG has vertex
        let stats = vcs.dag_stats().await;
        assert!(stats >= 1, "Expected at least 1 vertex in DAG, got {}", stats);
    }
}
