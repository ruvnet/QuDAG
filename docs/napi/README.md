# @qudag/core N-API Package Design

## Overview

This directory contains the complete architectural design for `@qudag/core`, a high-performance N-API binding that exposes QuDAG's quantum-resistant DAG consensus and cryptographic primitives to Node.js.

## Documents

### 1. [Architecture](./architecture.md)

**Purpose:** High-level architectural overview and design philosophy

**Key Topics:**
- Overall architecture and component organization
- N-API framework selection (napi-rs)
- Async runtime strategy (shared tokio runtime)
- Error handling and type safety
- Memory management approach
- Performance considerations
- Security architecture

**Key Decisions:**
- ✅ **napi-rs v2.x** for Rust ⟷ Node.js bindings
- ✅ **Shared tokio runtime** for efficient async operations
- ✅ **Zero-copy buffer strategy** using TypedArrays
- ✅ **Type-safe API** with auto-generated TypeScript definitions
- ✅ **Per-platform binaries** via `@napi-rs/cli`

### 2. [Bindings Design](./bindings-design.md)

**Purpose:** Detailed N-API class bindings and module structure

**Key Topics:**
- Rust module organization (lib.rs, dag/, crypto/, network/, vault/)
- Complete N-API bindings for all components:
  - `QuantumDAG` - DAG consensus with QR-Avalanche
  - `MlDsaKeyPair`, `MlDsaPublicKey` - ML-DSA signatures
  - `MlKem` - ML-KEM key encapsulation
  - `NetworkManager` - P2P networking
- Error handling conversions
- Tokio runtime management
- Auto-generated TypeScript definitions

**Implementation Details:**
- `#[napi]` macro annotations
- Async/await integration patterns
- Error type conversions
- Build configuration (Cargo.toml, package.json)

### 3. [Buffer Strategy](./buffer-strategy.md)

**Purpose:** Zero-copy buffer management and memory optimization

**Key Topics:**
- Buffer types and sizes (cryptographic keys, signatures, state vectors)
- Zero-copy strategies:
  - Rust-owned, JavaScript-viewed buffers
  - JavaScript-owned, Rust-borrowed buffers
  - Arc-wrapped shared buffers
- Buffer pool implementation for common sizes
- TypedArray vs ArrayBuffer vs Buffer comparison
- Memory safety patterns (borrowed refs, cloned data, Arc sharing)
- Quantum state vector handling (large datasets)
- Performance benchmarks and targets
- Security considerations (constant-time, zeroization)

**Performance Targets:**
- ML-DSA operations: <8% overhead vs native
- ML-KEM operations: <7% overhead vs native
- DAG operations: <5% overhead vs native

## Quick Start

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js 18+
nvm install 18

# Install napi-rs CLI
npm install -g @napi-rs/cli
```

### Build

```bash
# Clone repository
git clone https://github.com/ruvnet/QuDAG
cd QuDAG

# Build N-API bindings
cd qudag-napi
cargo build --release
napi build --platform --release

# Run tests
npm test
```

### Usage Example

```typescript
import { QuantumDAG, MlDsaKeyPair, MlKem } from '@qudag/core';

// Create DAG instance
const dag = new QuantumDAG();

// Generate ML-DSA key pair
const keypair = MlDsaKeyPair.generate();

// Sign a message
const message = Buffer.from('Hello, quantum world!');
const signature = keypair.sign(message);

// Verify signature
const publicKey = keypair.toPublicKey();
const isValid = publicKey.verify(message, signature);
console.log('Signature valid:', isValid);

// Add vertex to DAG
await dag.addVertex({
    id: 'vertex-1',
    payload: message,
    parents: [],
    timestamp: Date.now()
});

// Get DAG tips
const tips = dag.getTips();
console.log('Current tips:', tips);

// ML-KEM key exchange
const kemKeypair = MlKem.keygen();
const { ciphertext, sharedSecret } = MlKem.encapsulate(kemKeypair.publicKey);
const recoveredSecret = MlKem.decapsulate(kemKeypair.secretKey, ciphertext);
console.log('Secrets match:', Buffer.compare(sharedSecret, recoveredSecret) === 0);
```

## Key Architectural Decisions

### 1. Async Runtime: Shared Tokio Runtime

**Decision:** Use a single shared tokio runtime for all async operations

**Rationale:**
- ✅ Efficient thread pool utilization
- ✅ No per-call runtime creation overhead
- ✅ Natural integration with QuDAG's existing async code
- ⚠️ Requires careful shutdown handling
- ⚠️ Thread count tuning needed

**Alternative Considered:** Per-call runtime creation
- ❌ High overhead (100-500µs per call)
- ❌ Resource intensive

### 2. Buffer Strategy: Zero-Copy with TypedArrays

**Decision:** Use `Uint8Array` for all cryptographic buffers with Rust ownership

**Rationale:**
- ✅ Near-zero-copy performance (<5% overhead)
- ✅ Cross-platform compatibility (Node.js + future browser support)
- ✅ Type-safe with TypeScript
- ✅ Natural JavaScript API
- ⚠️ Requires lifetime management
- ⚠️ Must clone for async operations

**Alternative Considered:** Always copy buffers
- ❌ 10-20% performance overhead
- ❌ Higher memory pressure

### 3. Error Handling: Rich Error Types

**Decision:** Map Rust error enums to JavaScript Error classes with context

**Rationale:**
- ✅ Preserves error information
- ✅ Natural JavaScript try/catch
- ✅ Type-safe error handling
- ⚠️ Requires comprehensive error conversion code

**Alternative Considered:** Generic error strings
- ❌ Loss of error context
- ❌ No type safety

### 4. Memory Management: Arc-Based Sharing

**Decision:** Use `Arc<RwLock<T>>` for long-lived objects shared across threads

**Rationale:**
- ✅ Thread-safe reference counting
- ✅ Automatic cleanup via finalizers
- ✅ Works well with tokio async
- ⚠️ Small overhead for reference counting
- ⚠️ Potential for lock contention

**Alternative Considered:** Manual lifetime management
- ❌ Error-prone
- ❌ Requires explicit cleanup from JavaScript

### 5. Build Strategy: Per-Platform Binaries

**Decision:** Publish platform-specific packages with main package as selector

**Rationale:**
- ✅ Users download only their platform
- ✅ Smaller package sizes
- ✅ Standard approach for N-API packages
- ⚠️ More complex CI/CD
- ⚠️ Multiple packages to maintain

**Alternative Considered:** Universal WASM package
- ❌ Lower performance (~80% of native)
- ❌ Limited async support

## Concerns and Trade-offs

### Performance Concerns

| Concern | Impact | Mitigation |
|---------|--------|------------|
| N-API call overhead | 5-10% per call | Batch operations, buffer pooling |
| Async task scheduling | ~100µs per task | Shared runtime, sync alternatives for hot paths |
| Buffer copying (async) | 10-20% for large payloads | Clone only when necessary, use streaming APIs |
| Lock contention (Arc) | Variable | Use RwLock for read-heavy workloads, consider lock-free structures |

### Memory Concerns

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Buffer pool growth | Unbounded memory | Limit pool sizes (64 buffers per size) |
| Arc reference cycles | Memory leaks | Document ownership, provide explicit cleanup |
| JavaScript GC pressure | Reduced performance | Minimize allocations, reuse buffers |
| Large quantum states | High memory usage | Pin in Rust, provide views only |

### Security Concerns

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Timing attacks on crypto | Secret leakage | Maintain constant-time across boundary |
| Buffer use-after-free | Memory corruption | Careful lifetime management, Arc for shared |
| Secret key exposure | Cryptographic compromise | Zeroize on drop, never expose to JavaScript |
| Input validation | Crashes, exploits | Validate all inputs before Rust processing |

### Development Concerns

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Complex async patterns | Hard to maintain | Document patterns, provide examples |
| Platform-specific builds | CI complexity | Automate with GitHub Actions + `@napi-rs/cli` |
| TypeScript definition drift | Type safety loss | Auto-generate from Rust code |
| Error handling consistency | Poor DX | Create conversion utilities, document patterns |

## Performance Benchmarks (Targets)

| Operation | Native Rust | N-API Target | Overhead |
|-----------|-------------|--------------|----------|
| ML-DSA Sign | 1.2ms | 1.3ms | <8% |
| ML-DSA Verify | 0.8ms | 0.85ms | <6% |
| ML-KEM Keygen | 0.15ms | 0.16ms | <7% |
| ML-KEM Encapsulate | 0.18ms | 0.19ms | <6% |
| ML-KEM Decapsulate | 0.22ms | 0.23ms | <5% |
| DAG Add Vertex | 0.5ms | 0.52ms | <4% |
| Buffer Copy (1KB) | 1µs | 1.2µs | <20% |
| Buffer Copy (100KB) | 50µs | 60µs | <20% |

## Migration from WASM

### Comparison

| Aspect | WASM (@qudag/wasm) | N-API (@qudag/core) | Recommended Use |
|--------|-------------------|---------------------|-----------------|
| Performance | ~80% of native | ~95% of native | N-API for Node.js |
| Async Support | Limited | Full tokio integration | N-API |
| Buffer Sharing | SharedArrayBuffer only | Full zero-copy | N-API |
| Build Complexity | High (wasm-pack, bindgen) | Moderate (napi-rs) | N-API |
| Platform Support | Universal | Per-platform binaries | WASM for browsers |
| Package Size | ~2-5MB (universal) | ~500KB-1MB per platform | Tie |
| Type Safety | Good | Excellent (auto-gen) | N-API |

### Migration Strategy

**Phase 1:** Develop N-API bindings alongside WASM

**Phase 2:** Use platform detection for automatic selection
```typescript
// @qudag/platform package
export * from process.env.WASM_MODE
    ? '@qudag/wasm'
    : '@qudag/core';
```

**Phase 3:** Maintain both for different use cases
- `@qudag/core` → Node.js servers, CLI tools
- `@qudag/wasm` → Browsers, edge workers, Deno

## Next Steps

### Implementation Phases

**Phase 1: Core Crypto Bindings** (2-3 weeks)
- [ ] Set up napi-rs project structure
- [ ] Implement ML-DSA bindings (sign, verify, keygen)
- [ ] Implement ML-KEM bindings (encap, decap, keygen)
- [ ] Implement HQC bindings (encrypt, decrypt)
- [ ] Write unit tests and benchmarks

**Phase 2: DAG Consensus Bindings** (2-3 weeks)
- [ ] Implement QuantumDAG bindings
- [ ] Implement Vertex and consensus types
- [ ] Add async operations (addVertex, getConfidence)
- [ ] Write integration tests

**Phase 3: Network Bindings** (2-3 weeks)
- [ ] Implement NetworkManager bindings
- [ ] Add event emitter for network events
- [ ] Implement peer management
- [ ] Write network integration tests

**Phase 4: Polish and Optimization** (1-2 weeks)
- [ ] Buffer pool implementation
- [ ] Performance benchmarking and optimization
- [ ] Documentation and examples
- [ ] CI/CD setup for multi-platform builds

**Phase 5: Production Readiness** (1-2 weeks)
- [ ] Security audit of bindings
- [ ] Comprehensive test coverage
- [ ] API documentation
- [ ] npm package publishing

### Success Criteria

- ✅ All performance targets met (<10% overhead)
- ✅ Zero memory leaks in 24-hour stress test
- ✅ Comprehensive test coverage (>90%)
- ✅ Type-safe TypeScript definitions
- ✅ Multi-platform binaries (Linux, macOS, Windows)
- ✅ Security audit passed
- ✅ Documentation complete

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT OR Apache-2.0

## References

- [napi-rs Documentation](https://napi.rs/)
- [Node-API Documentation](https://nodejs.org/api/n-api.html)
- [Tokio Documentation](https://tokio.rs/)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [QuDAG Repository](https://github.com/ruvnet/QuDAG)
