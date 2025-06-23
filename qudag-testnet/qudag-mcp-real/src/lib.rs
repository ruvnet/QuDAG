pub mod exchange;
pub mod mcp;
pub mod system;
pub mod dag;
pub mod network;
pub mod crypto;
pub mod dark;
pub mod vault;

// Re-export main components
pub use exchange::Exchange;
pub use mcp::{McpServer, McpRequest, McpResponse};

// Initialize the system
pub async fn initialize() {
    // Start system monitoring
    system::start_monitoring().await;
    
    // Initialize DAG manager
    dag::initialize().await;
    
    // Initialize network manager
    network::initialize().await;
    
    // Initialize crypto manager
    crypto::initialize().await;
    
    // Initialize dark registry
    dark::initialize().await;
    
    // Initialize vault manager
    vault::initialize().await;
    
    println!("✅ QuDAG MCP Real Implementation initialized");
}