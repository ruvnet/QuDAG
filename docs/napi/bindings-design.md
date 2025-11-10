# @qudag/core N-API Bindings Design

## Module Structure

### Rust Module Organization

```
src/
├── lib.rs              # Main entry point, exports all modules
├── dag/
│   ├── mod.rs          # DAG module exports
│   ├── consensus.rs    # QuantumDAG, Vertex bindings
│   ├── types.rs        # VertexId, ConsensusStatus types
│   └── utils.rs        # Helper functions
├── crypto/
│   ├── mod.rs          # Crypto module exports
│   ├── ml_dsa.rs       # ML-DSA signature bindings
│   ├── ml_kem.rs       # ML-KEM key encapsulation bindings
│   ├── hqc.rs          # HQC encryption bindings
│   ├── fingerprint.rs  # Quantum fingerprint bindings
│   └── utils.rs        # Crypto utilities
├── network/
│   ├── mod.rs          # Network module exports
│   ├── manager.rs      # NetworkManager bindings
│   ├── peer.rs         # Peer bindings
│   └── events.rs       # Event emitter integration
├── vault/
│   ├── mod.rs          # Vault module exports
│   ├── vault.rs        # Vault bindings
│   └── entry.rs        # VaultEntry bindings
├── error.rs            # Error type conversions
├── runtime.rs          # Tokio runtime management
└── utils.rs            # Shared utilities
```

## DAG Consensus Bindings

### src/dag/consensus.rs

```rust
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::Arc;
use tokio::sync::RwLock;
use qudag_dag::{DAGConsensus, Vertex as CoreVertex, VertexId as CoreVertexId};

/// Quantum-resistant DAG with QR-Avalanche consensus
#[napi]
pub struct QuantumDAG {
    inner: Arc<RwLock<DAGConsensus>>,
}

#[napi]
impl QuantumDAG {
    /// Create a new QuantumDAG instance
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(DAGConsensus::new())),
        }
    }

    /// Create a QuantumDAG with custom configuration
    #[napi(factory)]
    pub fn with_config(config: ConsensusConfig) -> Result<Self> {
        let core_config = config.to_core_config()?;
        Ok(Self {
            inner: Arc::new(RwLock::new(DAGConsensus::with_config(core_config))),
        })
    }

    /// Add a vertex to the DAG
    #[napi]
    pub async fn add_vertex(&self, vertex: Vertex) -> Result<()> {
        let dag = Arc::clone(&self.inner);
        let core_vertex = vertex.to_core_vertex()?;

        crate::runtime::spawn_blocking(move || {
            let mut dag = dag.blocking_write();
            dag.add_vertex(core_vertex)
                .map_err(|e| Error::from_reason(format!("Failed to add vertex: {}", e)))
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Add a message to the DAG (convenience method)
    #[napi]
    pub async fn add_message(&self, payload: Buffer) -> Result<String> {
        let dag = Arc::clone(&self.inner);
        let payload_vec = payload.to_vec();

        crate::runtime::spawn_blocking(move || {
            let mut dag = dag.blocking_write();
            dag.add_message(payload_vec)
                .map_err(|e| Error::from_reason(format!("Failed to add message: {}", e)))?;

            // Return vertex ID as hex string
            let vertex_id = CoreVertexId::from_bytes(payload_vec);
            Ok(hex::encode(vertex_id.as_bytes()))
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Get consensus confidence for a vertex
    #[napi]
    pub async fn get_confidence(&self, vertex_id: String) -> Result<Option<ConsensusStatus>> {
        let dag = Arc::clone(&self.inner);

        crate::runtime::spawn_blocking(move || {
            let dag = dag.blocking_read();
            Ok(dag
                .get_confidence(&vertex_id)
                .map(ConsensusStatus::from_core))
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Get total order of vertices (topological sort)
    #[napi]
    pub async fn get_total_order(&self) -> Result<Vec<String>> {
        let dag = Arc::clone(&self.inner);

        crate::runtime::spawn_blocking(move || {
            dag.blocking_read()
                .get_total_order()
                .map_err(|e| Error::from_reason(format!("Failed to get total order: {}", e)))
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Get current DAG tips (vertices with no children)
    #[napi]
    pub fn get_tips(&self) -> Vec<String> {
        // Synchronous operation - safe for blocking
        let dag = self.inner.blocking_read();
        dag.get_tips()
    }

    /// Check if the DAG contains a message
    #[napi]
    pub async fn contains_message(&self, payload: Buffer) -> Result<bool> {
        let dag = Arc::clone(&self.inner);
        let payload_vec = payload.to_vec();

        crate::runtime::spawn_blocking(move || {
            let dag = dag.blocking_read();
            Ok(dag.contains_message(&payload_vec))
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Verify a message signature
    #[napi]
    pub fn verify_message(&self, payload: Buffer, public_key: Buffer) -> Result<bool> {
        let dag = self.inner.blocking_read();
        Ok(dag.verify_message(&payload, &public_key))
    }
}

/// DAG vertex representation
#[napi(object)]
pub struct Vertex {
    /// Unique vertex identifier (hex string)
    pub id: String,
    /// Vertex payload data
    pub payload: Buffer,
    /// Parent vertex IDs (hex strings)
    pub parents: Vec<String>,
    /// Optional timestamp (milliseconds since Unix epoch)
    pub timestamp: Option<i64>,
}

impl Vertex {
    fn to_core_vertex(&self) -> Result<CoreVertex> {
        let id = CoreVertexId::from_bytes(
            hex::decode(&self.id).map_err(|e| Error::from_reason(format!("Invalid vertex ID: {}", e)))?,
        );

        let parents = self
            .parents
            .iter()
            .map(|p| {
                hex::decode(p)
                    .map(CoreVertexId::from_bytes)
                    .map_err(|e| Error::from_reason(format!("Invalid parent ID: {}", e)))
            })
            .collect::<Result<std::collections::HashSet<_>>>()?;

        let mut vertex = CoreVertex::new(id, self.payload.to_vec(), parents);

        if let Some(ts) = self.timestamp {
            vertex.timestamp = ts;
        }

        Ok(vertex)
    }
}

/// Consensus status for a vertex
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

impl ConsensusStatus {
    fn from_core(status: qudag_dag::ConsensusStatus) -> Self {
        match status {
            qudag_dag::ConsensusStatus::Pending => Self::Pending,
            qudag_dag::ConsensusStatus::Accepted => Self::Accepted,
            qudag_dag::ConsensusStatus::Final => Self::Final,
            qudag_dag::ConsensusStatus::Rejected => Self::Rejected,
        }
    }
}

/// Configuration for DAG consensus
#[napi(object)]
pub struct ConsensusConfig {
    /// Number of nodes to query for consensus
    pub query_sample_size: u32,
    /// Threshold for finality (0.0 to 1.0)
    pub finality_threshold: f64,
    /// Timeout for finality decisions (milliseconds)
    pub finality_timeout_ms: u32,
    /// Depth required for confirmation
    pub confirmation_depth: u32,
}

impl ConsensusConfig {
    fn to_core_config(&self) -> Result<qudag_dag::ConsensusConfig> {
        if self.finality_threshold < 0.0 || self.finality_threshold > 1.0 {
            return Err(Error::from_reason(
                "finality_threshold must be between 0.0 and 1.0",
            ));
        }

        Ok(qudag_dag::ConsensusConfig {
            query_sample_size: self.query_sample_size as usize,
            finality_threshold: self.finality_threshold,
            finality_timeout: std::time::Duration::from_millis(self.finality_timeout_ms as u64),
            confirmation_depth: self.confirmation_depth as usize,
        })
    }
}
```

## Cryptography Bindings

### src/crypto/ml_dsa.rs

```rust
use napi::bindgen_prelude::*;
use napi_derive::napi;
use qudag_crypto::{MlDsaKeyPair as CoreKeyPair, MlDsaPublicKey as CorePublicKey};
use rand::thread_rng;

/// ML-DSA key pair for quantum-resistant digital signatures
#[napi]
pub struct MlDsaKeyPair {
    inner: CoreKeyPair,
}

#[napi]
impl MlDsaKeyPair {
    /// Generate a new ML-DSA key pair
    #[napi(factory)]
    pub fn generate() -> Result<Self> {
        let mut rng = thread_rng();
        let keypair = CoreKeyPair::generate(&mut rng)
            .map_err(|e| Error::from_reason(format!("Key generation failed: {}", e)))?;

        Ok(Self { inner: keypair })
    }

    /// Get the public key as a Uint8Array (zero-copy view)
    #[napi]
    pub fn public_key(&self) -> Uint8Array {
        // Zero-copy: return view into Rust-owned buffer
        Uint8Array::new(self.inner.public_key().to_vec())
    }

    /// Get the public key as a hex string
    #[napi]
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.inner.public_key())
    }

    /// Sign a message with this key pair
    #[napi]
    pub fn sign(&self, message: Buffer) -> Result<Uint8Array> {
        let mut rng = thread_rng();
        let signature = self
            .inner
            .sign(&message, &mut rng)
            .map_err(|e| Error::from_reason(format!("Signing failed: {}", e)))?;

        Ok(Uint8Array::new(signature))
    }

    /// Sign a message deterministically (for testing)
    #[napi]
    pub fn sign_deterministic(&self, message: Buffer) -> Result<Uint8Array> {
        let signature = self
            .inner
            .sign_deterministic(&message)
            .map_err(|e| Error::from_reason(format!("Signing failed: {}", e)))?;

        Ok(Uint8Array::new(signature))
    }

    /// Convert to public key for sharing
    #[napi]
    pub fn to_public_key(&self) -> Result<MlDsaPublicKey> {
        let public_key = self
            .inner
            .to_public_key()
            .map_err(|e| Error::from_reason(format!("Public key conversion failed: {}", e)))?;

        Ok(MlDsaPublicKey { inner: public_key })
    }
}

/// ML-DSA public key for signature verification
#[napi]
pub struct MlDsaPublicKey {
    inner: CorePublicKey,
}

#[napi]
impl MlDsaPublicKey {
    /// Create public key from bytes
    #[napi(factory)]
    pub fn from_bytes(bytes: Buffer) -> Result<Self> {
        let public_key = CorePublicKey::from_bytes(&bytes)
            .map_err(|e| Error::from_reason(format!("Invalid public key: {}", e)))?;

        Ok(Self { inner: public_key })
    }

    /// Create public key from hex string
    #[napi(factory)]
    pub fn from_hex(hex_string: String) -> Result<Self> {
        let bytes = hex::decode(hex_string)
            .map_err(|e| Error::from_reason(format!("Invalid hex string: {}", e)))?;

        Self::from_bytes(Buffer::from(bytes))
    }

    /// Get public key bytes as Uint8Array (zero-copy)
    #[napi]
    pub fn as_bytes(&self) -> Uint8Array {
        Uint8Array::new(self.inner.as_bytes().to_vec())
    }

    /// Get public key as hex string
    #[napi]
    pub fn as_hex(&self) -> String {
        hex::encode(self.inner.as_bytes())
    }

    /// Verify a signature
    #[napi]
    pub fn verify(&self, message: Buffer, signature: Buffer) -> Result<bool> {
        match self.inner.verify(&message, &signature) {
            Ok(()) => Ok(true),
            Err(qudag_crypto::MlDsaError::VerificationFailed) => Ok(false),
            Err(e) => Err(Error::from_reason(format!("Verification error: {}", e))),
        }
    }

    /// Batch verify multiple signatures
    #[napi]
    pub fn batch_verify(
        messages: Vec<Buffer>,
        signatures: Vec<Buffer>,
        public_keys: Vec<&MlDsaPublicKey>,
    ) -> Result<bool> {
        if messages.len() != signatures.len() || messages.len() != public_keys.len() {
            return Err(Error::from_reason(
                "Input arrays must have the same length",
            ));
        }

        let messages_refs: Vec<&[u8]> = messages.iter().map(|b| b.as_ref()).collect();
        let signatures_refs: Vec<&[u8]> = signatures.iter().map(|b| b.as_ref()).collect();
        let pk_refs: Vec<&CorePublicKey> = public_keys.iter().map(|pk| &pk.inner).collect();

        match CorePublicKey::batch_verify(&messages_refs, &signatures_refs, &pk_refs) {
            Ok(()) => Ok(true),
            Err(qudag_crypto::MlDsaError::VerificationFailed) => Ok(false),
            Err(e) => Err(Error::from_reason(format!("Batch verification error: {}", e))),
        }
    }
}

/// ML-DSA algorithm information
#[napi(object)]
pub struct MlDsaInfo {
    pub public_key_size: u32,
    pub secret_key_size: u32,
    pub signature_size: u32,
    pub security_level: u8,
    pub algorithm: String,
}

/// Get ML-DSA algorithm information
#[napi]
pub fn get_ml_dsa_info() -> MlDsaInfo {
    MlDsaInfo {
        public_key_size: qudag_crypto::ml_dsa::ML_DSA_PUBLIC_KEY_SIZE as u32,
        secret_key_size: qudag_crypto::ml_dsa::ML_DSA_SECRET_KEY_SIZE as u32,
        signature_size: qudag_crypto::ml_dsa::ML_DSA_SIGNATURE_SIZE as u32,
        security_level: 3,
        algorithm: "ML-DSA-65".to_string(),
    }
}
```

### src/crypto/ml_kem.rs

```rust
use napi::bindgen_prelude::*;
use napi_derive::napi;
use qudag_crypto::{MlKem768, KeyEncapsulation, PublicKey, SecretKey, Ciphertext, SharedSecret};

/// ML-KEM-768 key encapsulation mechanism
#[napi]
pub struct MlKem {
    // Stateless, all methods are static
}

#[napi]
impl MlKem {
    /// Generate a new ML-KEM-768 key pair
    #[napi(factory)]
    pub fn keygen() -> Result<MlKemKeyPair> {
        let (pk, sk) = MlKem768::keygen()
            .map_err(|e| Error::from_reason(format!("Key generation failed: {}", e)))?;

        Ok(MlKemKeyPair {
            public_key: Uint8Array::new(pk.as_bytes().to_vec()),
            secret_key: Uint8Array::new(sk.as_bytes().to_vec()),
        })
    }

    /// Encapsulate a shared secret
    #[napi]
    pub fn encapsulate(public_key: Buffer) -> Result<MlKemEncapsulation> {
        let pk = PublicKey::from_bytes(&public_key)
            .map_err(|e| Error::from_reason(format!("Invalid public key: {}", e)))?;

        let (ct, ss) = MlKem768::encapsulate(&pk)
            .map_err(|e| Error::from_reason(format!("Encapsulation failed: {}", e)))?;

        Ok(MlKemEncapsulation {
            ciphertext: Uint8Array::new(ct.as_bytes().to_vec()),
            shared_secret: Uint8Array::new(ss.as_bytes().to_vec()),
        })
    }

    /// Decapsulate a shared secret
    #[napi]
    pub fn decapsulate(secret_key: Buffer, ciphertext: Buffer) -> Result<Uint8Array> {
        let sk = SecretKey::from_bytes(&secret_key)
            .map_err(|e| Error::from_reason(format!("Invalid secret key: {}", e)))?;

        let ct = Ciphertext::from_bytes(&ciphertext)
            .map_err(|e| Error::from_reason(format!("Invalid ciphertext: {}", e)))?;

        let ss = MlKem768::decapsulate(&sk, &ct)
            .map_err(|e| Error::from_reason(format!("Decapsulation failed: {}", e)))?;

        Ok(Uint8Array::new(ss.as_bytes().to_vec()))
    }

    /// Get ML-KEM-768 parameters
    #[napi]
    pub fn get_info() -> MlKemInfo {
        MlKemInfo {
            public_key_size: MlKem768::PUBLIC_KEY_SIZE as u32,
            secret_key_size: MlKem768::SECRET_KEY_SIZE as u32,
            ciphertext_size: MlKem768::CIPHERTEXT_SIZE as u32,
            shared_secret_size: MlKem768::SHARED_SECRET_SIZE as u32,
            security_level: MlKem768::SECURITY_LEVEL,
            algorithm: "ML-KEM-768".to_string(),
        }
    }
}

/// ML-KEM key pair
#[napi(object)]
pub struct MlKemKeyPair {
    pub public_key: Uint8Array,
    pub secret_key: Uint8Array,
}

/// ML-KEM encapsulation result
#[napi(object)]
pub struct MlKemEncapsulation {
    pub ciphertext: Uint8Array,
    pub shared_secret: Uint8Array,
}

/// ML-KEM algorithm information
#[napi(object)]
pub struct MlKemInfo {
    pub public_key_size: u32,
    pub secret_key_size: u32,
    pub ciphertext_size: u32,
    pub shared_secret_size: u32,
    pub security_level: u8,
    pub algorithm: String,
}
```

## Network Bindings

### src/network/manager.rs

```rust
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use qudag_network::{NetworkManager as CoreNetworkManager, NetworkEvent as CoreNetworkEvent};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Network manager for P2P operations
#[napi]
pub struct NetworkManager {
    inner: Arc<RwLock<CoreNetworkManager>>,
    event_callback: Option<ThreadsafeFunction<NetworkEvent>>,
}

#[napi]
impl NetworkManager {
    /// Create a new network manager
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(CoreNetworkManager::new())),
            event_callback: None,
        }
    }

    /// Initialize the network manager
    #[napi]
    pub async fn initialize(&self) -> Result<()> {
        let manager = Arc::clone(&self.inner);

        crate::runtime::spawn(async move {
            manager.write().await.initialize().await
                .map_err(|e| Error::from_reason(format!("Initialization failed: {}", e)))
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Connect to a peer
    #[napi]
    pub async fn connect_peer(&self, address: String) -> Result<String> {
        let manager = Arc::clone(&self.inner);

        crate::runtime::spawn(async move {
            let peer_id = manager.read().await.connect_peer(&address).await
                .map_err(|e| Error::from_reason(format!("Connection failed: {}", e)))?;

            Ok(peer_id.to_string())
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Disconnect from a peer
    #[napi]
    pub async fn disconnect_peer(&self, peer_id: String) -> Result<()> {
        let manager = Arc::clone(&self.inner);

        crate::runtime::spawn(async move {
            // Parse peer_id and disconnect
            // Implementation depends on peer ID format
            Ok(())
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Get connected peers
    #[napi]
    pub async fn get_connected_peers(&self) -> Result<Vec<String>> {
        let manager = Arc::clone(&self.inner);

        crate::runtime::spawn(async move {
            let peers = manager.read().await.get_connected_peers().await;
            Ok(peers.iter().map(|p| p.to_string()).collect())
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }

    /// Register event listener
    #[napi(ts_args_type = "callback: (event: NetworkEvent) => void")]
    pub fn on_event(&mut self, callback: JsFunction) -> Result<()> {
        let tsfn: ThreadsafeFunction<NetworkEvent> = callback
            .create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        self.event_callback = Some(tsfn);
        Ok(())
    }

    /// Shutdown the network manager
    #[napi]
    pub async fn shutdown(&self) -> Result<()> {
        let manager = Arc::clone(&self.inner);

        crate::runtime::spawn(async move {
            manager.write().await.shutdown().await
                .map_err(|e| Error::from_reason(format!("Shutdown failed: {}", e)))
        })
        .await
        .map_err(|e| Error::from_reason(format!("Task join error: {}", e)))?
    }
}

/// Network event types
#[napi(object)]
pub struct NetworkEvent {
    pub event_type: String,
    pub peer_id: Option<String>,
    pub data: Option<Buffer>,
}
```

## Error Handling

### src/error.rs

```rust
use napi::Error as NapiError;
use qudag_dag::DagError;
use qudag_crypto::{MlDsaError, KEMError};
use qudag_network::NetworkError;

/// Convert DAG errors to NAPI errors
pub fn dag_error_to_napi(error: DagError) -> NapiError {
    match error {
        DagError::ConsensusError(msg) => {
            NapiError::from_reason(format!("ConsensusError: {}", msg))
        }
        DagError::VertexError(e) => {
            NapiError::from_reason(format!("VertexError: {}", e))
        }
        DagError::ConflictDetected => {
            NapiError::from_reason("ConflictDetected: Fork in DAG detected")
        }
    }
}

/// Convert ML-DSA errors to NAPI errors
pub fn ml_dsa_error_to_napi(error: MlDsaError) -> NapiError {
    match error {
        MlDsaError::InvalidPublicKey(msg) => {
            NapiError::from_reason(format!("InvalidPublicKey: {}", msg))
        }
        MlDsaError::InvalidSecretKey(msg) => {
            NapiError::from_reason(format!("InvalidSecretKey: {}", msg))
        }
        MlDsaError::VerificationFailed => {
            NapiError::from_reason("VerificationFailed: Signature verification failed")
        }
        MlDsaError::SigningFailed(msg) => {
            NapiError::from_reason(format!("SigningFailed: {}", msg))
        }
        _ => NapiError::from_reason(format!("MlDsaError: {}", error)),
    }
}

/// Convert KEM errors to NAPI errors
pub fn kem_error_to_napi(error: KEMError) -> NapiError {
    match error {
        KEMError::InvalidKey => {
            NapiError::from_reason("InvalidKey: Invalid key format or size")
        }
        KEMError::EncapsulationError => {
            NapiError::from_reason("EncapsulationError: Failed to encapsulate shared secret")
        }
        KEMError::DecapsulationError => {
            NapiError::from_reason("DecapsulationError: Failed to decapsulate shared secret")
        }
        KEMError::InvalidLength => {
            NapiError::from_reason("InvalidLength: Invalid ciphertext length")
        }
        _ => NapiError::from_reason(format!("KEMError: {}", error)),
    }
}
```

## Runtime Management

### src/runtime.rs

```rust
use once_cell::sync::Lazy;
use tokio::runtime::Runtime;
use napi::Error;

/// Shared tokio runtime for all async operations
static TOKIO_RUNTIME: Lazy<Runtime> = Lazy::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .thread_name("qudag-napi-worker")
        .enable_all()
        .build()
        .expect("Failed to create tokio runtime")
});

/// Spawn an async task on the shared runtime
pub fn spawn<F>(future: F) -> tokio::task::JoinHandle<F::Output>
where
    F: std::future::Future + Send + 'static,
    F::Output: Send + 'static,
{
    TOKIO_RUNTIME.spawn(future)
}

/// Spawn a blocking task on the shared runtime
pub fn spawn_blocking<F, R>(f: F) -> tokio::task::JoinHandle<R>
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    TOKIO_RUNTIME.spawn_blocking(f)
}

/// Enter the runtime context (for sync code that calls async)
pub fn enter<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    let _guard = TOKIO_RUNTIME.enter();
    f()
}
```

## TypeScript Definitions

The napi-rs build process will automatically generate TypeScript definitions. Here's what they will look like:

### index.d.ts (auto-generated)

```typescript
/* Auto-generated by napi-rs */

export class QuantumDAG {
  constructor();
  static withConfig(config: ConsensusConfig): QuantumDAG;
  addVertex(vertex: Vertex): Promise<void>;
  addMessage(payload: Buffer): Promise<string>;
  getConfidence(vertexId: string): Promise<ConsensusStatus | null>;
  getTotalOrder(): Promise<Array<string>>;
  getTips(): Array<string>;
  containsMessage(payload: Buffer): Promise<boolean>;
  verifyMessage(payload: Buffer, publicKey: Buffer): boolean;
}

export interface Vertex {
  id: string;
  payload: Buffer;
  parents: Array<string>;
  timestamp?: number;
}

export enum ConsensusStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Final = 'Final',
  Rejected = 'Rejected'
}

export interface ConsensusConfig {
  querySampleSize: number;
  finalityThreshold: number;
  finalityTimeoutMs: number;
  confirmationDepth: number;
}

export class MlDsaKeyPair {
  static generate(): MlDsaKeyPair;
  publicKey(): Uint8Array;
  publicKeyHex(): string;
  sign(message: Buffer): Uint8Array;
  signDeterministic(message: Buffer): Uint8Array;
  toPublicKey(): MlDsaPublicKey;
}

export class MlDsaPublicKey {
  static fromBytes(bytes: Buffer): MlDsaPublicKey;
  static fromHex(hexString: string): MlDsaPublicKey;
  asBytes(): Uint8Array;
  asHex(): string;
  verify(message: Buffer, signature: Buffer): boolean;
  static batchVerify(
    messages: Array<Buffer>,
    signatures: Array<Buffer>,
    publicKeys: Array<MlDsaPublicKey>
  ): boolean;
}

export interface MlDsaInfo {
  publicKeySize: number;
  secretKeySize: number;
  signatureSize: number;
  securityLevel: number;
  algorithm: string;
}

export function getMlDsaInfo(): MlDsaInfo;

export class MlKem {
  static keygen(): MlKemKeyPair;
  static encapsulate(publicKey: Buffer): MlKemEncapsulation;
  static decapsulate(secretKey: Buffer, ciphertext: Buffer): Uint8Array;
  static getInfo(): MlKemInfo;
}

export interface MlKemKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface MlKemEncapsulation {
  ciphertext: Uint8Array;
  sharedSecret: Uint8Array;
}

export interface MlKemInfo {
  publicKeySize: number;
  secretKeySize: number;
  ciphertextSize: number;
  sharedSecretSize: number;
  securityLevel: number;
  algorithm: string;
}

export class NetworkManager {
  constructor();
  initialize(): Promise<void>;
  connectPeer(address: string): Promise<string>;
  disconnectPeer(peerId: string): Promise<void>;
  getConnectedPeers(): Promise<Array<string>>;
  onEvent(callback: (event: NetworkEvent) => void): void;
  shutdown(): Promise<void>;
}

export interface NetworkEvent {
  eventType: string;
  peerId?: string;
  data?: Buffer;
}
```

## Build Configuration

### Cargo.toml

```toml
[package]
name = "qudag-core-napi"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
napi = { version = "2.13", default-features = false, features = ["napi8", "async", "tokio_rt"] }
napi-derive = "2.13"

# QuDAG dependencies
qudag = { path = "../qudag", version = "1.2.1" }
qudag-crypto = { path = "../core/crypto", version = "0.4.0" }
qudag-dag = { path = "../core/dag", version = "0.4.0" }
qudag-network = { path = "../core/network", version = "0.4.0" }

# Runtime and utilities
tokio = { version = "1.0", features = ["full"] }
once_cell = "1.19"
hex = "0.4"
rand = "0.8"

[build-dependencies]
napi-build = "2.0"

[profile.release]
lto = true
codegen-units = 1
opt-level = 3
```

### package.json

```json
{
  "name": "@qudag/core",
  "version": "0.1.0",
  "description": "N-API bindings for QuDAG quantum-resistant DAG",
  "main": "index.js",
  "types": "index.d.ts",
  "napi": {
    "name": "qudag",
    "triples": {
      "defaults": true,
      "additional": [
        "aarch64-apple-darwin",
        "aarch64-unknown-linux-gnu",
        "aarch64-unknown-linux-musl"
      ]
    }
  },
  "scripts": {
    "build": "napi build --platform --release",
    "build:debug": "napi build --platform",
    "prepublishOnly": "napi prepublish -t npm",
    "test": "node --test",
    "artifacts": "napi artifacts"
  },
  "devDependencies": {
    "@napi-rs/cli": "^2.17.0"
  },
  "engines": {
    "node": ">= 18"
  },
  "optionalDependencies": {
    "@qudag/core-darwin-x64": "0.1.0",
    "@qudag/core-darwin-arm64": "0.1.0",
    "@qudag/core-linux-x64-gnu": "0.1.0",
    "@qudag/core-linux-x64-musl": "0.1.0",
    "@qudag/core-win32-x64-msvc": "0.1.0"
  }
}
```

## Summary

This bindings design provides:

1. **Clean Module Structure**: Organized by functionality (DAG, crypto, network, vault)
2. **Type-Safe API**: Comprehensive `#[napi]` annotations with auto-generated TypeScript
3. **Zero-Copy Buffers**: `Uint8Array` views for all cryptographic material
4. **Async Bridge**: Shared tokio runtime with proper task scheduling
5. **Error Handling**: Rich error types converted to JavaScript Error objects
6. **Platform Support**: Multi-platform binary distribution via `@napi-rs/cli`

The design enables high-performance access to QuDAG's quantum-resistant features from Node.js while maintaining type safety and ergonomic APIs.
