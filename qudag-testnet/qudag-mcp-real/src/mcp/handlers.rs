//! MCP protocol handlers

use anyhow::Result;
use std::sync::Arc;
use crate::AppState;

/// Main MCP handler that manages protocol operations
pub struct MpcHandler {
    state: Arc<AppState>,
}

impl MpcHandler {
    /// Create a new MCP handler
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }
    
    /// Handle incoming MCP requests
    pub async fn handle_request(&self, request: MpcRequest) -> Result<MpcResponse> {
        match request {
            MpcRequest::ListTools => {
                let tools = super::tools::list_all_tools(&self.state).await;
                Ok(MpcResponse::Tools(tools))
            }
            MpcRequest::ExecuteTool { name, params } => {
                let result = super::tools::execute_tool(&self.state, &name, params).await?;
                Ok(MpcResponse::ToolResult(result))
            }
            MpcRequest::ListResources => {
                let resources = super::resources::list_all_resources(&self.state).await;
                Ok(MpcResponse::Resources(resources))
            }
            MpcRequest::GetResource { uri } => {
                let resource = super::resources::get_resource(&self.state, &uri).await?;
                Ok(MpcResponse::Resource(resource))
            }
            MpcRequest::ListPrompts => {
                let prompts = super::prompts::list_all_prompts(&self.state).await;
                Ok(MpcResponse::Prompts(prompts))
            }
            MpcRequest::ExecutePrompt { name, params } => {
                let result = super::prompts::execute_prompt(&self.state, &name, params).await?;
                Ok(MpcResponse::PromptResult(result))
            }
        }
    }
}

/// MCP request types
#[derive(Debug, Clone)]
pub enum MpcRequest {
    ListTools,
    ExecuteTool {
        name: String,
        params: serde_json::Value,
    },
    ListResources,
    GetResource {
        uri: String,
    },
    ListPrompts,
    ExecutePrompt {
        name: String,
        params: serde_json::Value,
    },
}

/// MCP response types
#[derive(Debug, Clone)]
pub enum MpcResponse {
    Tools(Vec<super::Tool>),
    ToolResult(super::ToolResult),
    Resources(Vec<super::Resource>),
    Resource(super::Resource),
    Prompts(Vec<super::Prompt>),
    PromptResult(super::ToolResult),
}