//! Vertex Management for QuDAG MCP
//!
//! This module handles vertex creation, validation, serialization,
//! and network propagation for the DAG structure.

use anyhow::{Result, Context};
use serde::{Serialize, Deserialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, debug};

use qudag_dag::{Vertex as CoreVertex, VertexId, VertexOps};
use qudag_crypto::{QuantumSigner, QuantumVerifier};

use crate::crypto::CryptoManager;

/// Enhanced vertex with MCP metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpVertex {
    /// Core vertex data
    #[serde(flatten)]
    pub core: CoreVertex,
    
    /// MCP-specific metadata
    pub metadata: VertexMetadata,
    
    /// Quantum-resistant signature
    pub signature: Vec<u8>,
}

/// Vertex metadata for MCP
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VertexMetadata {
    /// Node that created this vertex
    pub creator: String,
    
    /// Creation timestamp
    pub created_at: u64,
    
    /// Transaction type
    pub tx_type: TransactionType,
    
    /// Additional properties
    pub properties: HashMap<String, serde_json::Value>,
}

/// Transaction types supported by the DAG
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TransactionType {
    /// Data storage transaction
    Data,
    /// Token transfer transaction
    Transfer,
    /// Smart contract execution
    Contract,
    /// Consensus participation
    Consensus,
    /// System transaction
    System,
}

/// Vertex validation result
#[derive(Debug)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Vertex builder for creating new vertices
pub struct VertexBuilder {
    data: Option<Vec<u8>>,
    parents: HashSet<VertexId>,
    tx_type: TransactionType,
    properties: HashMap<String, serde_json::Value>,
}

impl VertexBuilder {
    /// Create a new vertex builder
    pub fn new() -> Self {
        Self {
            data: None,
            parents: HashSet::new(),
            tx_type: TransactionType::Data,
            properties: HashMap::new(),
        }
    }
    
    /// Set vertex data
    pub fn with_data(mut self, data: Vec<u8>) -> Self {
        self.data = Some(data);
        self
    }
    
    /// Add parent vertex
    pub fn add_parent(mut self, parent: VertexId) -> Self {
        self.parents.insert(parent);
        self
    }
    
    /// Add multiple parents
    pub fn add_parents(mut self, parents: impl IntoIterator<Item = VertexId>) -> Self {
        self.parents.extend(parents);
        self
    }
    
    /// Set transaction type
    pub fn with_type(mut self, tx_type: TransactionType) -> Self {
        self.tx_type = tx_type;
        self
    }
    
    /// Add property
    pub fn add_property(mut self, key: String, value: serde_json::Value) -> Self {
        self.properties.insert(key, value);
        self
    }
    
    /// Build the vertex
    pub async fn build(self, creator: String, crypto: &CryptoManager) -> Result<McpVertex> {
        let data = self.data.context("Vertex data is required")?;
        
        // Create core vertex
        let vertex_id = VertexId::new();
        let core = CoreVertex::new(vertex_id, data, self.parents);
        
        // Create metadata
        let metadata = VertexMetadata {
            creator: creator.clone(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs(),
            tx_type: self.tx_type,
            properties: self.properties,
        };
        
        // Create MCP vertex (without signature first)
        let mut mcp_vertex = McpVertex {
            core: core.clone(),
            metadata,
            signature: vec![],
        };
        
        // Sign the vertex
        let vertex_bytes = bincode::serialize(&mcp_vertex)?;
        let signature = crypto.sign(&vertex_bytes).await?;
        mcp_vertex.signature = signature;
        
        Ok(mcp_vertex)
    }
}

/// Vertex manager for handling vertex operations
pub struct VertexManager {
    /// Stored vertices
    vertices: Arc<RwLock<HashMap<VertexId, McpVertex>>>,
    
    /// Vertex index by creator
    by_creator: Arc<RwLock<HashMap<String, HashSet<VertexId>>>>,
    
    /// Vertex index by type
    by_type: Arc<RwLock<HashMap<TransactionType, HashSet<VertexId>>>>,
    
    /// Crypto manager for verification
    crypto: Arc<CryptoManager>,
}

impl VertexManager {
    /// Create a new vertex manager
    pub fn new(crypto: Arc<CryptoManager>) -> Self {
        Self {
            vertices: Arc::new(RwLock::new(HashMap::new())),
            by_creator: Arc::new(RwLock::new(HashMap::new())),
            by_type: Arc::new(RwLock::new(HashMap::new())),
            crypto,
        }
    }
    
    /// Store a vertex
    pub async fn store_vertex(&self, vertex: McpVertex) -> Result<()> {
        let vertex_id = vertex.core.id.clone();
        
        // Validate before storing
        let validation = self.validate_vertex(&vertex).await?;
        if !validation.is_valid {
            return Err(anyhow::anyhow!(
                "Vertex validation failed: {:?}", 
                validation.errors
            ));
        }
        
        // Store vertex
        {
            let mut vertices = self.vertices.write().await;
            vertices.insert(vertex_id.clone(), vertex.clone());
        }
        
        // Update indices
        {
            let mut by_creator = self.by_creator.write().await;
            by_creator.entry(vertex.metadata.creator.clone())
                .or_insert_with(HashSet::new)
                .insert(vertex_id.clone());
        }
        
        {
            let mut by_type = self.by_type.write().await;
            by_type.entry(vertex.metadata.tx_type.clone())
                .or_insert_with(HashSet::new)
                .insert(vertex_id.clone());
        }
        
        info!("Stored vertex {} from {}", vertex_id, vertex.metadata.creator);
        Ok(())
    }
    
    /// Get a vertex by ID
    pub async fn get_vertex(&self, vertex_id: &VertexId) -> Result<Option<McpVertex>> {
        let vertices = self.vertices.read().await;
        Ok(vertices.get(vertex_id).cloned())
    }
    
    /// Get vertices by creator
    pub async fn get_by_creator(&self, creator: &str) -> Result<Vec<McpVertex>> {
        let by_creator = self.by_creator.read().await;
        let vertices = self.vertices.read().await;
        
        if let Some(vertex_ids) = by_creator.get(creator) {
            Ok(vertex_ids.iter()
                .filter_map(|id| vertices.get(id).cloned())
                .collect())
        } else {
            Ok(vec![])
        }
    }
    
    /// Get vertices by type
    pub async fn get_by_type(&self, tx_type: TransactionType) -> Result<Vec<McpVertex>> {
        let by_type = self.by_type.read().await;
        let vertices = self.vertices.read().await;
        
        if let Some(vertex_ids) = by_type.get(&tx_type) {
            Ok(vertex_ids.iter()
                .filter_map(|id| vertices.get(id).cloned())
                .collect())
        } else {
            Ok(vec![])
        }
    }
    
    /// Validate a vertex
    pub async fn validate_vertex(&self, vertex: &McpVertex) -> Result<ValidationResult> {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        
        // Validate signature
        let mut vertex_copy = vertex.clone();
        let signature = vertex_copy.signature.clone();
        vertex_copy.signature = vec![];
        
        let vertex_bytes = bincode::serialize(&vertex_copy)?;
        if !self.crypto.verify(&vertex_bytes, &signature, &vertex.metadata.creator).await? {
            errors.push("Invalid signature".to_string());
        }
        
        // Validate structure
        if vertex.core.payload.is_empty() {
            warnings.push("Empty payload".to_string());
        }
        
        if vertex.core.payload.len() > 1_000_000 {
            errors.push("Payload too large (max 1MB)".to_string());
        }
        
        // Validate parents
        if vertex.core.parents.len() > 8 {
            warnings.push("Too many parents (recommended max 8)".to_string());
        }
        
        // Check for self-reference
        if vertex.core.parents.contains(&vertex.core.id) {
            errors.push("Vertex references itself".to_string());
        }
        
        // Validate timestamp
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        
        if vertex.metadata.created_at > now + 300 {
            errors.push("Timestamp too far in future".to_string());
        }
        
        if vertex.metadata.created_at < now - 86400 {
            warnings.push("Timestamp older than 24 hours".to_string());
        }
        
        Ok(ValidationResult {
            is_valid: errors.is_empty(),
            errors,
            warnings,
        })
    }
    
    /// Get vertex statistics
    pub async fn get_stats(&self) -> VertexStats {
        let vertices = self.vertices.read().await;
        let by_creator = self.by_creator.read().await;
        let by_type = self.by_type.read().await;
        
        let mut type_counts = HashMap::new();
        for (tx_type, ids) in by_type.iter() {
            type_counts.insert(
                format!("{:?}", tx_type),
                ids.len()
            );
        }
        
        VertexStats {
            total_vertices: vertices.len(),
            unique_creators: by_creator.len(),
            vertices_by_type: type_counts,
            average_parents: if vertices.is_empty() {
                0.0
            } else {
                vertices.values()
                    .map(|v| v.core.parents.len() as f64)
                    .sum::<f64>() / vertices.len() as f64
            },
        }
    }
    
    /// Prune old vertices
    pub async fn prune_old_vertices(&self, max_age: std::time::Duration) -> Result<usize> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        
        let cutoff = now - max_age.as_secs();
        
        let mut vertices = self.vertices.write().await;
        let mut by_creator = self.by_creator.write().await;
        let mut by_type = self.by_type.write().await;
        
        let before_count = vertices.len();
        
        // Find vertices to remove
        let to_remove: Vec<_> = vertices.iter()
            .filter(|(_, v)| v.metadata.created_at < cutoff)
            .map(|(id, _)| id.clone())
            .collect();
        
        // Remove from all indices
        for vertex_id in &to_remove {
            if let Some(vertex) = vertices.remove(vertex_id) {
                // Remove from creator index
                if let Some(creator_vertices) = by_creator.get_mut(&vertex.metadata.creator) {
                    creator_vertices.remove(vertex_id);
                }
                
                // Remove from type index
                if let Some(type_vertices) = by_type.get_mut(&vertex.metadata.tx_type) {
                    type_vertices.remove(vertex_id);
                }
            }
        }
        
        let removed = before_count - vertices.len();
        
        if removed > 0 {
            info!("Pruned {} old vertices", removed);
        }
        
        Ok(removed)
    }
}

/// Vertex statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VertexStats {
    pub total_vertices: usize,
    pub unique_creators: usize,
    pub vertices_by_type: HashMap<String, usize>,
    pub average_parents: f64,
}

/// Serialize vertex for network transmission
pub fn serialize_vertex(vertex: &McpVertex) -> Result<Vec<u8>> {
    bincode::serialize(vertex).context("Failed to serialize vertex")
}

/// Deserialize vertex from network
pub fn deserialize_vertex(data: &[u8]) -> Result<McpVertex> {
    bincode::deserialize(data).context("Failed to deserialize vertex")
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_vertex_builder() {
        // Test would require mock crypto manager
    }
    
    #[tokio::test]
    async fn test_vertex_validation() {
        // Test validation logic
    }
}