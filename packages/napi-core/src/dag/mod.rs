// DAG module - quantum-resistant DAG consensus
//
// This is a simplified implementation for the initial release.
// A full implementation would include complete QR-Avalanche consensus.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Quantum-resistant DAG with simplified consensus
///
/// This is a basic implementation that stores vertices and tracks their relationships.
/// Future versions will include full QR-Avalanche consensus protocol.
#[napi]
pub struct QuantumDAG {
    vertices: Arc<RwLock<HashMap<String, VertexData>>>,
    tips: Arc<RwLock<Vec<String>>>,
}

struct VertexData {
    id: String,
    payload: Vec<u8>,
    parents: Vec<String>,
    timestamp: i64,
}

#[napi]
impl QuantumDAG {
    /// Create a new QuantumDAG instance
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            vertices: Arc::new(RwLock::new(HashMap::new())),
            tips: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Add a vertex to the DAG
    ///
    /// # Arguments
    /// * `vertex` - The vertex to add
    ///
    /// # Example
    /// ```js
    /// const dag = new QuantumDAG();
    /// await dag.addVertex({
    ///   id: "vertex-1",
    ///   payload: Buffer.from("data"),
    ///   parents: [],
    ///   timestamp: Date.now()
    /// });
    /// ```
    #[napi]
    pub async fn add_vertex(&self, vertex: Vertex) -> Result<()> {
        let vertices = Arc::clone(&self.vertices);
        let tips = Arc::clone(&self.tips);
        let vertex_id = vertex.id.clone();

        crate::runtime::spawn(async move {
            let mut vertices = vertices.write().await;
            let mut tips = tips.write().await;

            // Remove parents from tips (they're no longer tips)
            for parent in &vertex.parents {
                tips.retain(|id| id != parent);
            }

            // Add new vertex as tip
            tips.push(vertex_id.clone());

            // Store vertex data
            vertices.insert(
                vertex_id.clone(),
                VertexData {
                    id: vertex_id,
                    payload: vertex.payload.to_vec(),
                    parents: vertex.parents,
                    timestamp: vertex.timestamp.unwrap_or_else(|| {
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_millis() as i64
                    }),
                },
            );

            Ok::<(), Error>(())
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))??;

        Ok(())
    }

    /// Add a message to the DAG (convenience method)
    ///
    /// Automatically creates a vertex from a payload and adds it to the DAG.
    ///
    /// # Arguments
    /// * `payload` - The message payload
    ///
    /// # Returns
    /// The vertex ID (hex encoded hash of the payload)
    #[napi]
    pub async fn add_message(&self, payload: Buffer) -> Result<String> {
        // Generate vertex ID from payload hash
        let vertex_id = hex::encode(blake3::hash(&payload).as_bytes());

        // Get current tips as parents
        let parents = {
            let tips = self.tips.read().await;
            tips.clone()
        };

        // Create and add vertex
        let vertex = Vertex {
            id: vertex_id.clone(),
            payload,
            parents,
            timestamp: Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_err(|e| Error::from_reason(format!("Time error: {}", e)))?
                    .as_millis() as i64,
            ),
        };

        self.add_vertex(vertex).await?;

        Ok(vertex_id)
    }

    /// Get current DAG tips (vertices with no children)
    ///
    /// Tips are vertices that have been added but haven't been referenced
    /// as parents by other vertices yet.
    #[napi]
    pub async fn get_tips(&self) -> Result<Vec<String>> {
        let tips = self.tips.read().await;
        Ok(tips.clone())
    }

    /// Check if the DAG contains a vertex
    ///
    /// # Arguments
    /// * `vertex_id` - The vertex ID to check
    #[napi]
    pub async fn contains_vertex(&self, vertex_id: String) -> Result<bool> {
        let vertices = self.vertices.read().await;
        Ok(vertices.contains_key(&vertex_id))
    }

    /// Get the number of vertices in the DAG
    #[napi]
    pub async fn vertex_count(&self) -> Result<u32> {
        let vertices = self.vertices.read().await;
        Ok(vertices.len() as u32)
    }

    /// Get a vertex by ID
    ///
    /// # Arguments
    /// * `vertex_id` - The vertex ID
    ///
    /// # Returns
    /// The vertex data, or null if not found
    #[napi]
    pub async fn get_vertex(&self, vertex_id: String) -> Result<Option<Vertex>> {
        let vertices = self.vertices.read().await;

        if let Some(data) = vertices.get(&vertex_id) {
            Ok(Some(Vertex {
                id: data.id.clone(),
                payload: Buffer::from(data.payload.clone()),
                parents: data.parents.clone(),
                timestamp: Some(data.timestamp),
            }))
        } else {
            Ok(None)
        }
    }
}

/// DAG vertex representation
#[napi(object)]
pub struct Vertex {
    /// Unique vertex identifier (usually a hex string)
    pub id: String,
    /// Vertex payload data
    pub payload: Buffer,
    /// Parent vertex IDs
    pub parents: Vec<String>,
    /// Optional timestamp (milliseconds since Unix epoch)
    pub timestamp: Option<i64>,
}

/// Consensus status for a vertex (simplified)
#[napi(string_enum)]
#[derive(Debug)]
pub enum ConsensusStatus {
    /// Vertex is pending consensus
    Pending,
    /// Vertex has reached consensus
    Accepted,
    /// Vertex has been finalized
    Final,
    /// Vertex was rejected
    Rejected,
}
