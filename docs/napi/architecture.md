# @qudag/core N-API Architecture

## Executive Summary

This document outlines the architectural design for `@qudag/core`, a high-performance N-API binding that exposes QuDAG's quantum-resistant DAG consensus and cryptographic primitives to Node.js. The design prioritizes zero-copy buffer operations, async/await integration with tokio, and type-safe JavaScript/TypeScript interfaces.

## Architecture Overview

### Design Philosophy

1. **Zero-Copy Performance**: Minimize memory copies between Rust and JavaScript
2. **Type Safety**: Comprehensive TypeScript definitions with runtime validation
3. **Async-First**: Full async/await support bridging tokio and Node.js event loops
4. **Error Transparency**: Rich error types mapped to JavaScript Error classes
5. **Memory Safety**: Explicit lifecycle management for long-lived Rust objects

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              JavaScript/TypeScript Layer                 │
│  - Type definitions (.d.ts)                              │
│  - High-level API wrappers                               │
│  - Error handling & validation                           │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────┐
│                N-API Binding Layer                       │
│  - #[napi] annotated Rust structs                       │
│  - TypedArray / Buffer wrapping                          │
│  - Async task scheduling                                 │
│  - Error conversions                                     │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────┐
│              QuDAG Core (Rust)                           │
│  - QuantumDAG / QuantumNode                              │
│  - ML-DSA, ML-KEM, HQC crypto                            │
│  - P2P networking                                        │
│  - Tokio async runtime                                   │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Quantum Cryptography Bindings

**Components:**
- `MlDsaKeyPair`, `MlDsaPublicKey` - ML-DSA-65 signatures
- `MlKem768` - ML-KEM key encapsulation
- `Hqc128`, `Hqc192`, `Hqc256` - HQC encryption
- `QuantumFingerprint` - Quantum-resistant fingerprinting

**Key Sizes:**
- ML-DSA Public Key: 1952 bytes
- ML-DSA Secret Key: 4032 bytes
- ML-DSA Signature: 3309 bytes
- ML-KEM-768 Public Key: 1184 bytes
- ML-KEM-768 Secret Key: 2400 bytes
- ML-KEM-768 Ciphertext: 1088 bytes
- Shared Secret: 32 bytes

**Design Decision:**
Use `Uint8Array` views backed by Rust-owned buffers for all cryptographic material to enable zero-copy operations. Keys remain in Rust memory with JavaScript holding non-owning views.

### 2. DAG Consensus Bindings

**Components:**
- `QuantumDAG` - Main DAG with QR-Avalanche consensus
- `Vertex` - DAG vertices with quantum signatures
- `ConsensusStatus` - Consensus state tracking

**Async Operations:**
- `addVertex(vertex: Vertex): Promise<void>`
- `getConfidence(vertexId: string): Promise<ConsensusStatus>`
- `getTotalOrder(): Promise<string[]>`
- `getTips(): Promise<string[]>`

**Design Decision:**
All DAG operations are inherently async due to tokio runtime. Bridge using `napi::tokio_runtime` to schedule work on shared tokio runtime, avoiding runtime-per-call overhead.

### 3. Network Management Bindings

**Components:**
- `NetworkManager` - P2P network coordination
- `Peer` - Peer connection management
- `NatTraversal` - NAT traversal operations

**Event System:**
Use `EventEmitter` pattern for network events (peer connected/disconnected, messages received).

### 4. Vault Integration

**Components:**
- `Vault` - Secure key storage
- `VaultEntry` - Encrypted vault entries

**Security Consideration:**
Vault secrets never leave Rust memory. JavaScript receives opaque handles/identifiers only.

## Technical Architecture

### N-API Framework: napi-rs

**Choice Rationale:**
- `napi-rs` v2.x provides mature, production-ready Rust ⟷ Node.js bindings
- Proc-macro based API (`#[napi]`) reduces boilerplate
- Built-in TypeScript definition generation
- Zero-cost abstractions over raw N-API
- Excellent async support with tokio integration

**Alternatives Considered:**
- `node-bindgen`: Less mature, smaller ecosystem
- Raw N-API: Too verbose, error-prone
- `neon`: Lacks async/await support, different model

### Async Runtime Strategy

**Problem:**
QuDAG core uses tokio extensively. N-API operates on Node.js event loop. Need to bridge these two async runtimes without blocking either.

**Solution: Shared Tokio Runtime**

```rust
use once_cell::sync::Lazy;
use tokio::runtime::Runtime;

static TOKIO_RUNTIME: Lazy<Runtime> = Lazy::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(4)
        .thread_name("qudag-napi-worker")
        .enable_all()
        .build()
        .expect("Failed to create tokio runtime")
});

#[napi]
impl QuantumDAG {
    #[napi]
    pub async fn add_vertex(&self, vertex: Vertex) -> Result<()> {
        let dag = self.inner.clone();

        // Schedule work on shared tokio runtime
        TOKIO_RUNTIME.spawn(async move {
            dag.add_vertex(vertex).await
        }).await.map_err(|e| Error::from_reason(e.to_string()))?
    }
}
```

**Benefits:**
- Single tokio runtime shared across all async operations
- No per-call runtime creation overhead
- Efficient thread pool utilization
- Natural integration with existing QuDAG async code

**Trade-offs:**
- Global runtime requires careful shutdown handling
- Thread count tuning needed for optimal performance

### Error Handling Strategy

**Rust Error Types:**
- `DagError` - DAG consensus errors
- `MlDsaError` - ML-DSA signature errors
- `KEMError` - Key encapsulation errors
- `NetworkError` - P2P networking errors
- `VaultError` - Vault operation errors

**JavaScript Error Mapping:**

```rust
use napi::Error as NapiError;

// Custom error conversion trait
trait ToNapiError {
    fn to_napi_error(self) -> NapiError;
}

impl ToNapiError for DagError {
    fn to_napi_error(self) -> NapiError {
        match self {
            DagError::ConsensusError(msg) => {
                NapiError::from_reason(format!("ConsensusError: {}", msg))
            }
            DagError::VertexError(e) => {
                NapiError::from_reason(format!("VertexError: {}", e))
            }
            DagError::ConflictDetected => {
                NapiError::from_reason("ConflictDetected: Fork in DAG")
            }
        }
    }
}
```

**Error Class Hierarchy:**

```typescript
class QuDAGError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown>;
}

class ConsensusError extends QuDAGError {}
class CryptoError extends QuDAGError {}
class NetworkError extends QuDAGError {}
class VaultError extends QuDAGError {}
```

### Memory Management Strategy

**Ownership Model:**

1. **Rust-Owned, JavaScript-Viewed:**
   - Cryptographic keys and signatures
   - Internal DAG structures
   - Network buffers

2. **JavaScript-Owned, Rust-Borrowed:**
   - User-provided payloads
   - Configuration objects
   - Temporary buffers

3. **Shared Ownership (Arc<T>):**
   - Long-lived objects like `QuantumDAG`, `NetworkManager`
   - Thread-safe reference counting

**Lifecycle Management:**

```rust
#[napi]
pub struct QuantumDAG {
    inner: Arc<RwLock<DAGConsensus>>,
}

#[napi]
impl QuantumDAG {
    #[napi(factory)]
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(DAGConsensus::new())),
        }
    }

    // JavaScript holds reference, Rust clones Arc (cheap)
    // When JavaScript GCs the object, Arc refcount decrements
}
```

**Finalization:**
N-API finalizers ensure Rust resources are cleaned up when JavaScript objects are garbage collected.

## Performance Considerations

### Zero-Copy Buffer Strategy

**Critical Path Operations:**
- Signature verification: ~50,000 ops/sec target
- Key encapsulation: ~30,000 ops/sec target
- DAG vertex insertion: ~10,000 ops/sec target

**Zero-Copy Techniques:**

1. **TypedArray Backing:**
   ```rust
   #[napi]
   pub fn get_public_key(&self) -> Uint8Array {
       // Create Uint8Array backed by Rust-owned buffer
       self.keypair.public_key().into()
   }
   ```

2. **Buffer Pooling:**
   Pre-allocate buffers for common sizes (1952, 3309, 4032 bytes) to reduce allocation overhead.

3. **Reference Semantics:**
   Pass large objects (DAG vertices, network messages) by reference/Arc rather than copying.

### Async Performance

**Task Scheduling:**
- Use `napi::tokio_runtime` for async bridges
- Batch operations where possible to reduce scheduling overhead
- Consider sync alternatives for hot paths (<1ms operations)

**Benchmarking Strategy:**
- Measure Rust-only baseline
- Measure N-API overhead (should be <10% for most operations)
- Profile with Node.js `--perf-prof` and Rust flamegraphs

## Security Considerations

### Memory Safety

1. **No Unsafe Code in Bindings:**
   Rely on napi-rs safe abstractions. Any unsafe blocks require thorough review.

2. **Constant-Time Operations:**
   Ensure cryptographic operations remain constant-time across N-API boundary.

3. **Zeroization:**
   Secret key material automatically zeroized on drop via `zeroize` crate.

### Input Validation

**Defense in Depth:**
1. TypeScript type checking (compile-time)
2. Runtime validation in JavaScript wrapper
3. Rust validation before core operations

### Side-Channel Resistance

**Timing Attacks:**
- ML-DSA verification remains constant-time
- No early returns based on secret data
- Verify with timing analysis benchmarks

## API Design Principles

### 1. Ergonomic JavaScript API

**Good:**
```typescript
const dag = new QuantumDAG();
await dag.addVertex({
    id: 'vertex-123',
    payload: Buffer.from('data'),
    parents: ['parent-1', 'parent-2']
});
```

**Avoid:**
```typescript
// Too verbose, C-style
const dag = qudag_create_dag();
qudag_add_vertex(dag, vertex_ptr, error_out);
```

### 2. Promise-Based Async

All async operations return Promises. No callbacks.

### 3. Type Safety

Comprehensive TypeScript definitions auto-generated from Rust code.

### 4. Error Transparency

Errors include context and are catchable with standard try/catch.

## Build and Distribution

### Package Structure

```
@qudag/core/
├── package.json
├── index.js          # JavaScript entry point
├── index.d.ts        # TypeScript definitions (generated)
├── qudag.node        # N-API binary (per-platform)
├── src/
│   ├── lib.rs        # Rust entry point
│   ├── dag.rs        # DAG bindings
│   ├── crypto.rs     # Crypto bindings
│   ├── network.rs    # Network bindings
│   └── vault.rs      # Vault bindings
└── __test__/         # JavaScript tests
```

### Platform Support

**Target Platforms:**
- Linux x64 (glibc, musl)
- macOS x64, ARM64
- Windows x64

**Pre-built Binaries:**
Use `@napi-rs/cli` to build and publish platform-specific packages:
- `@qudag/core-linux-x64-gnu`
- `@qudag/core-darwin-x64`
- etc.

Main package has optionalDependencies on platform packages.

### CI/CD Strategy

**Build Pipeline:**
1. Rust tests (cargo test)
2. N-API build (napi build)
3. TypeScript type checking
4. JavaScript integration tests
5. Platform-specific binary builds
6. npm publish

## Migration Path from WASM

### Comparison: WASM vs N-API

| Aspect | WASM | N-API |
|--------|------|-------|
| Performance | Good (~80% native) | Excellent (~95% native) |
| Async Support | Limited (requires polyfills) | Native (tokio → Node.js) |
| Buffer Sharing | Limited (SharedArrayBuffer) | Full zero-copy |
| Type Safety | Good (TypeScript) | Excellent (generated) |
| Build Complexity | High (wasm-pack) | Moderate (napi-rs) |
| Platform Support | Universal | Per-platform binaries |

### Coexistence Strategy

**Short-term:**
- `@qudag/wasm` for browser environments
- `@qudag/core` (N-API) for Node.js environments

**Package Selection:**
```typescript
// Automatic platform detection
import { QuantumDAG } from '@qudag/platform';
// → Uses @qudag/core on Node.js
// → Uses @qudag/wasm on browsers
```

## Future Enhancements

### 1. Worker Thread Support

Offload heavy cryptographic operations to worker threads for better concurrency.

### 2. Streaming APIs

Support for streaming large payloads without buffering entire content in memory.

### 3. GPU Acceleration

Investigate GPU acceleration for NTT operations in ML-DSA/ML-KEM via Vulkan/CUDA bindings.

### 4. NAPI v9 Features

Adopt NAPI v9 features like `napi_type_tag` for better type safety when available.

## Conclusion

This architecture provides a solid foundation for exposing QuDAG's quantum-resistant capabilities to Node.js with excellent performance, type safety, and developer experience. The use of napi-rs, shared tokio runtime, and zero-copy buffer strategies ensures near-native performance while maintaining the safety guarantees of Rust.

## References

- [napi-rs Documentation](https://napi.rs/)
- [Node-API Documentation](https://nodejs.org/api/n-api.html)
- [Tokio Documentation](https://tokio.rs/)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
