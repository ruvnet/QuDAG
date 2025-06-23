use qudag_mcp_real::{initialize, mcp};
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the MCP server
    Start {
        /// Host to bind to
        #[arg(short, long, default_value = "0.0.0.0")]
        host: String,
        
        /// Port to listen on
        #[arg(short, long, default_value_t = 3000)]
        port: u16,
        
        /// Enable stdio mode for Claude Desktop
        #[arg(long)]
        stdio: bool,
    },
    
    /// Show server information
    Info,
}

#[tokio::main]
async fn main() {
    // Initialize logging
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    let cli = Cli::parse();
    
    match cli.command {
        Some(Commands::Start { host, port, stdio }) => {
            println!("🚀 Starting QuDAG MCP Real Implementation Server");
            
            // Initialize all systems
            initialize().await;
            
            // Start the MCP server
            if stdio {
                println!("📟 Running in stdio mode for Claude Desktop integration");
                mcp::transport::start_stdio_server().await;
            } else {
                println!("🌐 Starting HTTP/WebSocket server on {}:{}", host, port);
                mcp::transport::start_http_server(&host, port).await;
            }
        }
        
        Some(Commands::Info) => {
            println!("QuDAG MCP Real Implementation");
            println!("Version: 1.0.0");
            println!();
            println!("Features:");
            println!("  ✅ Real DAG consensus with quantum signatures");
            println!("  ✅ P2P networking with actual peer connections");
            println!("  ✅ Quantum-resistant cryptography (ML-DSA, ML-KEM, HQC)");
            println!("  ✅ Dark domain registration and resolution");
            println!("  ✅ Quantum-encrypted vault storage");
            println!("  ✅ rUv token exchange with dynamic fees");
            println!("  ✅ Business plan payout distribution");
            println!("  ✅ Real-time system monitoring");
            println!();
            println!("Endpoints:");
            println!("  POST /mcp - MCP protocol endpoint");
            println!("  GET  /sse - Server-sent events for real-time updates");
            println!("  WS   /ws  - WebSocket connection");
            println!("  GET  /health - Health check");
            println!("  GET  /tools - List available MCP tools");
        }
        
        None => {
            println!("QuDAG MCP Real Implementation");
            println!("Use --help for usage information");
        }
    }
}