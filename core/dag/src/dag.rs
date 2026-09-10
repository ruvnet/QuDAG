use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{Mutex, RwLock, Semaphore};

use crate::consensus::{ConsensusError, QRAvalanche};
use crate::vertex::{Vertex, VertexError, VertexId};
// Optimization features disabled for initial release
// #[cfg(any(feature = "optimizations", feature = "validation-cache", feature = "traversal-index"))]
// use crate::optimized::{ValidationCache, ValidationResult};

/// Errors that can occur during DAG operations
#[derive(Error, Debug)]
pub enum DagError {
    /// Error from vertex operations
    #[error("Vertex error: {0}")]
    VertexError(#[from] VertexError),

    /// Error from consensus operations
    #[error("Consensus error: {0}")]
    ConsensusError(#[from] ConsensusError),

    /// Message processing channel was closed
    #[error("Channel closed")]
    ChannelClosed,

    /// Conflict detected between messages
    #[error("Conflict detected")]
    ConflictDetected,

    /// Failed to synchronize state between DAG instances
    #[error("State sync failed")]
    StateSyncFailed,
}

/// Message type for DAG processing
#[derive(Debug, Clone)]
pub struct DagMessage {
    /// Unique message ID
    pub id: VertexId,
    /// Message payload
    pub payload: Vec<u8>,
    /// Parent vertex IDs
    pub parents: HashSet<VertexId>,
    /// Message timestamp
    pub timestamp: u64,
}

/// Local asynchronous DAG admission. No network votes or finality are implied.
#[derive(Clone)]
pub struct Dag {
    /// Vertices in the local DAG. Callers must not mutate this map directly.
    pub vertices: Arc<RwLock<HashMap<VertexId, Vertex>>>,
    consensus: Arc<Mutex<QRAvalanche>>,
    permits: Arc<Semaphore>,
}

impl Dag {
    /// Construct without spawning tasks or requiring an active Tokio runtime.
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            vertices: Arc::new(RwLock::new(HashMap::new())),
            consensus: Arc::new(Mutex::new(QRAvalanche::new())),
            permits: Arc::new(Semaphore::new(max_concurrent.max(1))),
        }
    }

    /// Return only after local admission succeeds; saturation applies backpressure.
    pub async fn submit_message(&self, msg: DagMessage) -> Result<(), DagError> {
        let _permit = self
            .permits
            .acquire()
            .await
            .map_err(|_| DagError::ChannelClosed)?;
        let mut vertices = self.vertices.write().await;
        if vertices.contains_key(&msg.id) {
            return Err(DagError::ConflictDetected);
        }
        if msg.parents.contains(&msg.id) {
            return Err(VertexError::InvalidParent.into());
        }
        if msg
            .parents
            .iter()
            .any(|parent| !vertices.contains_key(parent))
        {
            return Err(VertexError::ParentNotFound.into());
        }
        // Siblings may share parents. Equivocation is duplicate identity, not
        // ordinary branching. Hold one graph write lock through admission.
        let mut vertex = Vertex::new(msg.id.clone(), msg.payload, msg.parents);
        vertex.timestamp = msg.timestamp;
        self.consensus.lock().await.process_vertex(msg.id.clone())?;
        vertices.insert(msg.id, vertex);
        Ok(())
    }

    /// Synchronizes state with another DAG instance
    pub async fn sync_state(&self, other: &Dag) -> Result<(), DagError> {
        // Snapshot before taking a local write lock, so self-sync and opposite
        // direction sync cannot deadlock through two graph locks.
        let other_vertices = other.vertices.read().await.clone();
        let mut vertices = self.vertices.write().await;
        let mut staged = vertices.clone();
        for (id, vertex) in other_vertices {
            if let Some(existing) = staged.get(&id) {
                if existing.payload != vertex.payload
                    || existing.parents() != vertex.parents()
                    || existing.timestamp != vertex.timestamp
                    || existing.signature != vertex.signature
                {
                    return Err(DagError::ConflictDetected);
                }
            } else {
                staged.insert(id, vertex);
            }
        }
        // Validate the complete union before committing any changes.
        let mut resolved = HashSet::new();
        while resolved.len() < staged.len() {
            let before = resolved.len();
            for (id, vertex) in &staged {
                if vertex
                    .parents
                    .iter()
                    .all(|parent| resolved.contains(parent))
                {
                    resolved.insert(id.clone());
                }
            }
            if resolved.len() == before {
                return Err(VertexError::InvalidParent.into());
            }
        }
        *vertices = staged;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio::time::sleep;

    #[tokio::test]
    async fn test_parallel_message_processing() {
        let dag = Dag::new(4);

        let mut messages = Vec::new();
        for i in 0..10 {
            messages.push(DagMessage {
                id: VertexId::new(),
                payload: vec![i as u8],
                parents: HashSet::new(),
                timestamp: i as u64,
            });
        }

        // Submit messages concurrently
        let mut handles = Vec::new();
        for msg in messages {
            let dag = dag.clone();
            handles.push(tokio::spawn(async move { dag.submit_message(msg).await }));
        }

        // Wait for all messages to be processed
        for handle in handles {
            handle.await.unwrap().unwrap();
        }

        sleep(Duration::from_millis(100)).await;

        let vertices = dag.vertices.read().await;
        assert_eq!(vertices.len(), 10);
    }

    #[tokio::test]
    async fn test_conflict_detection() {
        let dag = Dag::new(4);

        // A repeated identity with different payload is a conflict. Shared
        // parents alone are legitimate DAG branches.
        let id = VertexId::new();
        let msg1 = DagMessage {
            id: id.clone(),
            payload: vec![1],
            parents: HashSet::new(),
            timestamp: 1,
        };
        let msg2 = DagMessage {
            id,
            payload: vec![2],
            parents: HashSet::new(),
            timestamp: 2,
        };
        dag.submit_message(msg1).await.unwrap();

        // Second message should detect conflict
        let result = dag.submit_message(msg2).await;
        assert!(result.is_err());
        match result {
            Err(DagError::ConflictDetected) => (),
            _ => panic!("Expected conflict detection"),
        }
    }

    #[tokio::test]
    async fn test_state_sync() {
        let dag1 = Dag::new(4);
        let dag2 = Dag::new(4);

        // Add messages to first DAG
        let msg = DagMessage {
            id: VertexId::new(),
            payload: vec![1],
            parents: HashSet::new(),
            timestamp: 1,
        };

        dag1.submit_message(msg).await.unwrap();
        sleep(Duration::from_millis(50)).await;

        // Sync state to second DAG
        dag2.sync_state(&dag1).await.unwrap();

        let vertices1 = dag1.vertices.read().await;
        let vertices2 = dag2.vertices.read().await;
        assert_eq!(vertices1.len(), vertices2.len());
    }
}

#[cfg(test)]
mod admission_regressions {
    use super::*;
    #[tokio::test]
    async fn invalid_parent_is_reported_and_siblings_are_retained() {
        let dag = Dag::new(1);
        let parent = VertexId::new();
        let child = DagMessage {
            id: VertexId::new(),
            payload: vec![1],
            parents: [parent.clone()].into_iter().collect(),
            timestamp: 0,
        };
        assert!(dag.submit_message(child.clone()).await.is_err());
        assert!(dag.vertices.read().await.is_empty());
        dag.submit_message(DagMessage {
            id: parent,
            payload: vec![],
            parents: HashSet::new(),
            timestamp: 99,
        })
        .await
        .unwrap();
        let mut sibling = child.clone();
        sibling.id = VertexId::new();
        dag.submit_message(child).await.unwrap();
        dag.submit_message(sibling).await.unwrap();
        assert_eq!(dag.vertices.read().await.len(), 3);
    }
    #[tokio::test]
    async fn self_sync_completes_and_conflicting_sync_is_atomic() {
        let a = Dag::new(1);
        let b = Dag::new(1);
        let message = DagMessage {
            id: VertexId::new(),
            payload: vec![1],
            parents: HashSet::new(),
            timestamp: 1,
        };
        a.submit_message(message.clone()).await.unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(1), a.sync_state(&a))
            .await
            .unwrap()
            .unwrap();
        let mut conflict = message;
        conflict.payload = vec![2];
        b.submit_message(conflict).await.unwrap();
        assert!(a.sync_state(&b).await.is_err());
        assert_eq!(
            a.vertices.read().await.values().next().unwrap().payload,
            vec![1]
        );
    }
}
