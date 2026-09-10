use std::sync::Arc;
use agentbbs_core::{board::Board,caps::Role,identity::Identity,service::Bbs,store::MemoryStore};
use agentbbs_mcp::{McpServer,serve_stdio};
#[tokio::main]
async fn main() {
 let (bbs,reporter)=Bbs::with_memory_reporter(Arc::new(MemoryStore::new()));
 let identity=Identity::generate();
 bbs.create_board(Role::Sysop.caps(),Board::new("general","Local validation",identity.id())).unwrap();
 let server=Arc::new(McpServer::new(bbs,identity,Role::Guest.caps(),reporter,384));
 serve_stdio(server,tokio::io::stdin(),tokio::io::stdout()).await.unwrap();
}
