//! Model Context Protocol (MCP) server implementation

use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::AppState;

pub mod handlers;
pub mod tools;
pub mod resources;
pub mod prompts;
pub mod transport;

pub use handlers::MpcHandler;

/// MCP server that handles all protocol operations
pub struct MpcServer {
    state: Arc<AppState>,
}

impl MpcServer {
    /// Create a new MCP server
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }
    
    /// List available tools
    pub async fn list_tools(
        State(state): State<Arc<AppState>>
    ) -> impl IntoResponse {
        let tools = tools::list_all_tools(&state).await;
        Json(tools)
    }
    
    /// Execute a tool
    pub async fn execute_tool(
        State(state): State<Arc<AppState>>,
        Path(name): Path<String>,
        Json(params): Json<serde_json::Value>,
    ) -> impl IntoResponse {
        match tools::execute_tool(&state, &name, params).await {
            Ok(result) => (StatusCode::OK, Json(result)),
            Err(e) => (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": e.to_string()
                }))
            ),
        }
    }
    
    /// List available resources
    pub async fn list_resources(
        State(state): State<Arc<AppState>>
    ) -> impl IntoResponse {
        let resources = resources::list_all_resources(&state).await;
        Json(resources)
    }
    
    /// Get a specific resource
    pub async fn get_resource(
        State(state): State<Arc<AppState>>,
        Path(uri): Path<String>,
    ) -> impl IntoResponse {
        match resources::get_resource(&state, &uri).await {
            Ok(resource) => (StatusCode::OK, Json(resource)),
            Err(e) => (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": e.to_string()
                }))
            ),
        }
    }
    
    /// List available prompts
    pub async fn list_prompts(
        State(state): State<Arc<AppState>>
    ) -> impl IntoResponse {
        let prompts = prompts::list_all_prompts(&state).await;
        Json(prompts)
    }
    
    /// Execute a prompt
    pub async fn execute_prompt(
        State(state): State<Arc<AppState>>,
        Path(name): Path<String>,
        Json(params): Json<serde_json::Value>,
    ) -> impl IntoResponse {
        match prompts::execute_prompt(&state, &name, params).await {
            Ok(result) => (StatusCode::OK, Json(result)),
            Err(e) => (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": e.to_string()
                }))
            ),
        }
    }
}

/// MCP protocol structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub uri: String,
    pub name: String,
    pub description: String,
    pub mime_type: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    pub name: String,
    pub description: String,
    pub arguments: Vec<PromptArgument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptArgument {
    pub name: String,
    pub description: String,
    pub required: bool,
    pub default: Option<serde_json::Value>,
}

/// Tool execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub content: Vec<ToolContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolContent {
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: Option<String>,
    pub data: Option<serde_json::Value>,
}

impl ToolContent {
    pub fn text(text: String) -> Self {
        Self {
            content_type: "text".to_string(),
            text: Some(text),
            data: None,
        }
    }
    
    pub fn json(data: serde_json::Value) -> Self {
        Self {
            content_type: "json".to_string(),
            text: None,
            data: Some(data),
        }
    }
}