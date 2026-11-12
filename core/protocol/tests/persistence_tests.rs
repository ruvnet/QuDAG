use qudag_dag::vertex::{Vertex, VertexId};
use qudag_network::types::PeerId;
use qudag_protocol::persistence::{
    ConsensusStatus, DagState, MemoryBackend, PeerInfo, PersistedState, PersistenceManager,
    SqliteBackend, StateProvider, StateStore, VotingRecord, CURRENT_STATE_VERSION,
};
use qudag_protocol::{Node, NodeConfig, NodeStateProvider};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::RwLock;

#[tokio::test]
async fn test_memory_backend_persistence() {
    let backend = Arc::new(MemoryBackend::default());

    // The in-memory backend keeps vertices and peers; it does not snapshot
    // whole-node state (save_state is a documented no-op).
    let vertex = create_test_vertex(1);
    backend.save_vertex(&vertex).await.unwrap();
    let peer_id = PeerId::random();
    backend
        .save_peer(&peer_id, &create_test_peer_info(75, true))
        .await
        .unwrap();

    let loaded = backend.load_vertex(&vertex.id).await.unwrap();
    assert!(loaded.is_some());
    assert_eq!(loaded.unwrap().payload, vertex.payload);
    assert_eq!(backend.load_peers().await.unwrap()[0].0, peer_id);

    backend.save_state(&create_test_state()).await.unwrap();
    assert!(backend.recover_state().await.unwrap().is_none());
}

#[tokio::test]
async fn test_sqlite_backend_persistence() {
    let temp_dir = TempDir::new().unwrap();
    std::fs::create_dir_all(temp_dir.path()).unwrap();
    let db_path = temp_dir.path().join("test.db");

    let backend = Arc::new(SqliteBackend::new(db_path.clone()).await.unwrap());

    // Create test state
    let state = create_test_state();

    // Save state
    backend.save_state(&state).await.unwrap();

    // Load state
    let loaded = backend.recover_state().await.unwrap();
    assert!(loaded.is_some());

    let loaded_state = loaded.unwrap();
    assert_eq!(loaded_state.version, state.version);
    assert_eq!(loaded_state.node_id, state.node_id);

    // Test persistence across backend instances
    drop(backend);

    // Create new backend instance
    let backend2 = Arc::new(SqliteBackend::new(db_path).await.unwrap());
    let loaded2 = backend2.recover_state().await.unwrap();
    assert!(loaded2.is_some());
    assert_eq!(loaded2.unwrap().node_id, state.node_id);
}

#[tokio::test]
async fn test_peer_persistence() {
    let backend = Arc::new(MemoryBackend::default());

    let trusted_peer = PeerId::random();
    let untrusted_peer = PeerId::random();
    let mut trusted_info = create_test_peer_info(80, true);
    trusted_info.connection_count = 10;
    trusted_info.bytes_exchanged = 3072;
    let mut untrusted_info = create_test_peer_info(60, false);
    untrusted_info.address = "192.168.1.100:9000".to_string();

    // Save peers
    backend
        .save_peer(&trusted_peer, &trusted_info)
        .await
        .unwrap();
    backend
        .save_peer(&untrusted_peer, &untrusted_info)
        .await
        .unwrap();

    // Load peers
    let loaded: HashMap<PeerId, PeerInfo> =
        backend.load_peers().await.unwrap().into_iter().collect();
    assert_eq!(loaded.len(), 2);
    assert_eq!(loaded[&trusted_peer].reputation, 80);
    assert!(loaded[&trusted_peer].trusted);
    assert_eq!(loaded[&trusted_peer].connection_count, 10);
    assert_eq!(loaded[&untrusted_peer].reputation, 60);
    assert!(!loaded[&untrusted_peer].trusted);
    assert_eq!(loaded[&untrusted_peer].address, "192.168.1.100:9000");
}

#[tokio::test]
async fn test_dag_state_persistence() {
    let temp_dir = TempDir::new().unwrap();
    let backend = Arc::new(
        SqliteBackend::new(temp_dir.path().to_path_buf())
            .await
            .unwrap(),
    );

    let vertex = create_test_vertex(7);
    let mut state = create_test_state();
    state.dag_state = DagState {
        vertices: HashMap::from([(vertex.id.clone(), vertex.clone())]),
        tips: HashSet::from([vertex.id.clone()]),
        voting_records: HashMap::from([(
            vertex.id.clone(),
            VotingRecord {
                vertex_id: vertex.id.clone(),
                votes: HashMap::from([(vec![1, 2, 3], true), (vec![4, 5, 6], false)]),
                started_at: 1234567890,
                status: ConsensusStatus::Pending,
            },
        )]),
        last_checkpoint: None,
    };

    // Save DAG state as part of the node state
    backend.save_state(&state).await.unwrap();

    // Load DAG state
    let loaded = backend.recover_state().await.unwrap().unwrap().dag_state;
    assert_eq!(loaded.vertices.len(), 1);
    assert_eq!(loaded.vertices[&vertex.id].payload, vertex.payload);
    assert!(loaded.tips.contains(&vertex.id));
    let record = &loaded.voting_records[&vertex.id];
    assert_eq!(record.votes.len(), 2);
    assert!(record.votes[&vec![1, 2, 3]]);
    assert!(!record.votes[&vec![4, 5, 6]]);
}

#[tokio::test]
async fn test_backup_and_restore() {
    let temp_dir = TempDir::new().unwrap();
    let backend = Arc::new(
        SqliteBackend::new(temp_dir.path().join("data"))
            .await
            .unwrap(),
    );

    // Create and save state
    let state = create_test_state();
    backend.save_state(&state).await.unwrap();

    // Create backup
    let backup_path = temp_dir.path().join("backup");
    backend.create_backup(&backup_path).await.unwrap();

    // Overwrite state
    let mut modified_state = create_test_state();
    modified_state.node_id = vec![99, 99, 99];
    modified_state.protocol_state = qudag_protocol::state::ProtocolState::Initial;
    modified_state.peers = vec![];
    backend.save_state(&modified_state).await.unwrap();

    // Verify state changed
    let modified = backend.recover_state().await.unwrap().unwrap();
    assert_eq!(modified.node_id, vec![99, 99, 99]);

    // Restore from backup
    backend.restore_backup(&backup_path).await.unwrap();

    // Verify state restored
    let restored = backend.recover_state().await.unwrap().unwrap();
    assert_eq!(restored.node_id, state.node_id);
    assert_eq!(restored.peers.len(), state.peers.len());
}

#[tokio::test]
async fn test_persistence_manager() {
    let temp_dir = TempDir::new().unwrap();
    let backend = Arc::new(
        SqliteBackend::new(temp_dir.path().to_path_buf())
            .await
            .unwrap(),
    );
    let manager: PersistenceManager = backend.clone();

    // Test state recovery with no existing state
    let recovered = manager.recover_state().await.unwrap();
    assert!(recovered.is_none());

    // Save state
    let state = create_test_state();
    backend.save_state(&state).await.unwrap();

    // Test state recovery
    let recovered = manager.recover_state().await.unwrap();
    assert!(recovered.is_some());
    assert_eq!(recovered.unwrap().node_id, state.node_id);
}

#[tokio::test]
async fn test_node_with_persistence() {
    let temp_dir = TempDir::new().unwrap();
    let config = NodeConfig {
        data_dir: temp_dir.path().to_path_buf(),
        ..Default::default()
    };

    // Create directory for SQLite
    std::fs::create_dir_all(&config.data_dir).unwrap();

    // Create node with persistence
    let mut node = Node::with_persistence(config.clone()).await.unwrap();

    // Start node
    node.start().await.unwrap();

    // Save state
    node.save_state().await.unwrap();

    // Create backup
    let backup_path = temp_dir.path().join("backup");
    std::fs::create_dir_all(&backup_path).unwrap();
    node.create_backup(backup_path.clone()).await.unwrap();

    // Stop node
    node.stop().await.unwrap();

    // Create new node and verify persistence works
    let node2 = Node::with_persistence(config).await.unwrap();
    // Note: In a real implementation, the node ID would be loaded from persistence
    assert!(node2.has_persistence());
}

#[tokio::test]
async fn test_node_state_provider() {
    let config = NodeConfig::default();
    let node = Arc::new(RwLock::new(Node::new(config).await.unwrap()));

    // Create state provider
    let provider = NodeStateProvider::new(node.clone());
    assert!(provider.get_state_store().health_check().await.unwrap());

    // Get current state
    let state = node.read().await.get_current_state().await.unwrap();
    assert_eq!(state.version, CURRENT_STATE_VERSION);
    assert!(!state.node_id.is_empty());
}

fn create_test_vertex(seed: u8) -> Vertex {
    Vertex::new(VertexId::new(), vec![seed, 2, 3, 4], HashSet::new())
}

fn create_test_peer_info(reputation: u8, trusted: bool) -> PeerInfo {
    PeerInfo {
        address: "127.0.0.1:8000".to_string(),
        last_seen: 1234567890,
        reputation,
        trusted,
        connection_count: 0,
        bytes_exchanged: 0,
        metadata: HashMap::new(),
    }
}

// Helper function to create test state
fn create_test_state() -> PersistedState {
    PersistedState {
        version: CURRENT_STATE_VERSION,
        node_id: vec![1, 2, 3, 4, 5, 6, 7, 8],
        protocol_state: qudag_protocol::state::ProtocolState::Active(
            qudag_protocol::state::ActiveState::Normal,
        ),
        sessions: HashMap::new(),
        peers: vec![(PeerId::random(), create_test_peer_info(75, false))],
        dag_state: DagState {
            vertices: HashMap::new(),
            tips: HashSet::new(),
            voting_records: HashMap::new(),
            last_checkpoint: None,
        },
        metrics: qudag_protocol::state::StateMachineMetrics {
            current_state: qudag_protocol::state::ProtocolState::Active(
                qudag_protocol::state::ActiveState::Normal,
            ),
            uptime: std::time::Duration::from_secs(100),
            active_sessions: 5,
            total_state_transitions: 10,
            total_messages_sent: 1000,
            total_messages_received: 1200,
            total_bytes_sent: 100000,
            total_bytes_received: 120000,
            total_errors: 2,
        },
        last_saved: 1234567890,
    }
}
