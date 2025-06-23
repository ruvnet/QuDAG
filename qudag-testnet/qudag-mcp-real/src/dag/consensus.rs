//! QR-Avalanche Consensus Implementation
//!
//! This module implements the quantum-resistant Avalanche consensus protocol
//! for the QuDAG MCP server, handling voting rounds and finality decisions.

use anyhow::{Result, Context};
use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

use qudag_dag::{
    VertexId, ConsensusStatus, Confidence,
    QRAvalanche as CoreQRAvalanche,
    QRAvalancheConfig,
};

/// Consensus query message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusQuery {
    pub vertex_id: VertexId,
    pub round: u64,
    pub sender: String,
    pub timestamp: u64,
}

/// Consensus response message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusResponse {
    pub vertex_id: VertexId,
    pub round: u64,
    pub vote: bool,
    pub confidence: f64,
    pub sender: String,
}

/// Consensus state for a vertex
#[derive(Debug, Clone)]
pub struct VertexConsensusState {
    pub vertex_id: VertexId,
    pub status: ConsensusStatus,
    pub confidence: f64,
    pub rounds: u32,
    pub votes: HashMap<String, VoteRecord>,
    pub last_updated: std::time::Instant,
}

/// Vote record from a peer
#[derive(Debug, Clone)]
pub struct VoteRecord {
    pub vote: bool,
    pub confidence: f64,
    pub round: u64,
    pub timestamp: std::time::Instant,
}

/// Enhanced QR-Avalanche consensus manager
pub struct ConsensusManager {
    /// Core consensus engine
    core: Arc<RwLock<CoreQRAvalanche>>,
    
    /// Vertex consensus states
    states: Arc<RwLock<HashMap<VertexId, VertexConsensusState>>>,
    
    /// Consensus configuration
    config: QRAvalancheConfig,
    
    /// Node ID for this instance
    node_id: String,
    
    /// Active consensus rounds
    active_rounds: Arc<RwLock<HashMap<VertexId, u64>>>,
}

impl ConsensusManager {
    /// Create a new consensus manager
    pub fn new(node_id: String) -> Self {
        let config = QRAvalancheConfig {
            query_sample_size: 10,
            confidence_threshold: 0.8,
            finality_threshold: 0.95,
            max_rounds: 100,
            round_timeout: std::time::Duration::from_millis(500),
        };
        
        Self {
            core: Arc::new(RwLock::new(CoreQRAvalanche::with_config(config.clone()))),
            states: Arc::new(RwLock::new(HashMap::new())),
            config,
            node_id,
            active_rounds: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Initialize consensus for a new vertex
    pub async fn init_vertex(&self, vertex_id: VertexId) -> Result<()> {
        let mut states = self.states.write().await;
        
        if states.contains_key(&vertex_id) {
            return Ok(()); // Already initialized
        }
        
        states.insert(vertex_id.clone(), VertexConsensusState {
            vertex_id: vertex_id.clone(),
            status: ConsensusStatus::Pending,
            confidence: 0.0,
            rounds: 0,
            votes: HashMap::new(),
            last_updated: std::time::Instant::now(),
        });
        
        // Initialize in core consensus
        let mut core = self.core.write().await;
        core.vertices.insert(vertex_id.clone(), ConsensusStatus::Pending);
        
        info!("Initialized consensus for vertex {}", vertex_id);
        Ok(())
    }
    
    /// Start a new consensus round for a vertex
    pub async fn start_round(&self, vertex_id: VertexId) -> Result<u64> {
        // Ensure vertex is initialized
        self.init_vertex(vertex_id.clone()).await?;
        
        // Get current round
        let mut active_rounds = self.active_rounds.write().await;
        let round = active_rounds.entry(vertex_id.clone())
            .and_modify(|r| *r += 1)
            .or_insert(1);
        
        let round_num = *round;
        
        // Update state
        let mut states = self.states.write().await;
        if let Some(state) = states.get_mut(&vertex_id) {
            state.rounds += 1;
            state.last_updated = std::time::Instant::now();
        }
        
        debug!("Started consensus round {} for vertex {}", round_num, vertex_id);
        Ok(round_num)
    }
    
    /// Process a consensus query
    pub async fn process_query(&self, query: ConsensusQuery) -> Result<ConsensusResponse> {
        // Check if we know about this vertex
        let states = self.states.read().await;
        
        let (vote, confidence) = if let Some(state) = states.get(&query.vertex_id) {
            // Vote based on current confidence
            let vote = state.confidence >= self.config.confidence_threshold;
            (vote, state.confidence)
        } else {
            // Unknown vertex - vote no with zero confidence
            (false, 0.0)
        };
        
        Ok(ConsensusResponse {
            vertex_id: query.vertex_id,
            round: query.round,
            vote,
            confidence,
            sender: self.node_id.clone(),
        })
    }
    
    /// Process a consensus response
    pub async fn process_response(&self, response: ConsensusResponse) -> Result<ConsensusDecision> {
        let mut states = self.states.write().await;
        
        let state = states.get_mut(&response.vertex_id)
            .context("Vertex not found in consensus states")?;
        
        // Record vote
        state.votes.insert(response.sender.clone(), VoteRecord {
            vote: response.vote,
            confidence: response.confidence,
            round: response.round,
            timestamp: std::time::Instant::now(),
        });
        
        // Calculate new confidence
        let total_votes = state.votes.len();
        let positive_votes = state.votes.values()
            .filter(|v| v.vote)
            .count();
        
        state.confidence = if total_votes > 0 {
            positive_votes as f64 / total_votes as f64
        } else {
            0.0
        };
        
        state.last_updated = std::time::Instant::now();
        
        // Check for finality
        let decision = if state.confidence >= self.config.finality_threshold {
            state.status = ConsensusStatus::Final;
            ConsensusDecision::Finalized
        } else if state.confidence < (1.0 - self.config.finality_threshold) {
            // Strong rejection
            ConsensusDecision::Rejected
        } else if state.rounds >= self.config.max_rounds as u32 {
            // Max rounds reached
            if state.confidence >= self.config.confidence_threshold {
                state.status = ConsensusStatus::Final;
                ConsensusDecision::Finalized
            } else {
                ConsensusDecision::Rejected
            }
        } else {
            ConsensusDecision::Continue
        };
        
        // Update core consensus
        if matches!(decision, ConsensusDecision::Finalized) {
            let mut core = self.core.write().await;
            core.vertices.insert(response.vertex_id.clone(), ConsensusStatus::Final);
        }
        
        info!("Processed response for vertex {}: confidence={:.2}, decision={:?}", 
              response.vertex_id, state.confidence, decision);
        
        Ok(decision)
    }
    
    /// Get consensus state for a vertex
    pub async fn get_state(&self, vertex_id: &VertexId) -> Result<Option<VertexConsensusInfo>> {
        let states = self.states.read().await;
        
        Ok(states.get(vertex_id).map(|state| VertexConsensusInfo {
            vertex_id: state.vertex_id.clone(),
            status: match state.status {
                ConsensusStatus::Pending => "pending".to_string(),
                ConsensusStatus::Final => "final".to_string(),
            },
            confidence: state.confidence,
            rounds: state.rounds,
            votes_count: state.votes.len(),
            last_updated: state.last_updated.elapsed().as_secs(),
        }))
    }
    
    /// Get all vertices with their consensus status
    pub async fn get_all_vertices(&self) -> Result<Vec<VertexConsensusInfo>> {
        let states = self.states.read().await;
        
        Ok(states.values().map(|state| VertexConsensusInfo {
            vertex_id: state.vertex_id.clone(),
            status: match state.status {
                ConsensusStatus::Pending => "pending".to_string(),
                ConsensusStatus::Final => "final".to_string(),
            },
            confidence: state.confidence,
            rounds: state.rounds,
            votes_count: state.votes.len(),
            last_updated: state.last_updated.elapsed().as_secs(),
        }).collect())
    }
    
    /// Clean up old consensus states
    pub async fn cleanup_old_states(&self, max_age: std::time::Duration) -> Result<usize> {
        let mut states = self.states.write().await;
        let now = std::time::Instant::now();
        
        let before_count = states.len();
        states.retain(|_, state| {
            now.duration_since(state.last_updated) < max_age
        });
        let removed = before_count - states.len();
        
        if removed > 0 {
            info!("Cleaned up {} old consensus states", removed);
        }
        
        Ok(removed)
    }
    
    /// Get consensus metrics
    pub async fn get_metrics(&self) -> ConsensusMetrics {
        let states = self.states.read().await;
        let core = self.core.read().await;
        
        let finalized_count = states.values()
            .filter(|s| matches!(s.status, ConsensusStatus::Final))
            .count();
        
        let pending_count = states.values()
            .filter(|s| matches!(s.status, ConsensusStatus::Pending))
            .count();
        
        let avg_confidence = if !states.is_empty() {
            states.values().map(|s| s.confidence).sum::<f64>() / states.len() as f64
        } else {
            0.0
        };
        
        let avg_rounds = if !states.is_empty() {
            states.values().map(|s| s.rounds as f64).sum::<f64>() / states.len() as f64
        } else {
            0.0
        };
        
        ConsensusMetrics {
            total_vertices: states.len(),
            finalized_vertices: finalized_count,
            pending_vertices: pending_count,
            average_confidence: avg_confidence,
            average_rounds: avg_rounds,
            tips_count: core.tips.len(),
        }
    }
}

/// Consensus decision result
#[derive(Debug, Clone, PartialEq)]
pub enum ConsensusDecision {
    Finalized,
    Rejected,
    Continue,
}

/// Vertex consensus information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VertexConsensusInfo {
    pub vertex_id: VertexId,
    pub status: String,
    pub confidence: f64,
    pub rounds: u32,
    pub votes_count: usize,
    pub last_updated: u64, // seconds ago
}

/// Consensus metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusMetrics {
    pub total_vertices: usize,
    pub finalized_vertices: usize,
    pub pending_vertices: usize,
    pub average_confidence: f64,
    pub average_rounds: f64,
    pub tips_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_consensus_initialization() {
        let manager = ConsensusManager::new("test-node".to_string());
        let vertex_id = VertexId::new();
        
        // Initialize vertex
        manager.init_vertex(vertex_id.clone()).await.unwrap();
        
        // Check state
        let state = manager.get_state(&vertex_id).await.unwrap();
        assert!(state.is_some());
        assert_eq!(state.unwrap().status, "pending");
    }
    
    #[tokio::test]
    async fn test_consensus_voting() {
        let manager = ConsensusManager::new("test-node".to_string());
        let vertex_id = VertexId::new();
        
        // Initialize and start round
        manager.init_vertex(vertex_id.clone()).await.unwrap();
        let round = manager.start_round(vertex_id.clone()).await.unwrap();
        assert_eq!(round, 1);
        
        // Process positive responses
        for i in 0..10 {
            let response = ConsensusResponse {
                vertex_id: vertex_id.clone(),
                round,
                vote: true,
                confidence: 0.9,
                sender: format!("peer-{}", i),
            };
            
            let decision = manager.process_response(response).await.unwrap();
            
            if i >= 9 {
                // Should finalize after enough positive votes
                assert_eq!(decision, ConsensusDecision::Finalized);
            }
        }
        
        // Check final state
        let state = manager.get_state(&vertex_id).await.unwrap().unwrap();
        assert_eq!(state.status, "final");
        assert!(state.confidence >= 0.95);
    }
}