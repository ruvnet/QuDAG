# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## QuDAG: Quantum-Resistant Multi-Platform Architecture

QuDAG is a revolutionary quantum-resistant distributed communication platform comprising multiple integrated systems:

1. **Core Rust Platform** - Quantum-resistant crypto, DAG consensus, P2P networking, vault
2. **CLI Tools** - Command-line interface for node management and operations  
3. **Business Intelligence API** - Node.js/TypeScript backend for organizational data
4. **Executive Dashboard** - React frontend for AI-CEO management interface
5. **WASM Bindings** - Browser and Node.js integration
6. **Exchange System** - rUv token trading with dynamic fee models
7. **MCP Integration** - Model Context Protocol server for AI coordination

## Platform Overview

### Multi-Architecture Support
QuDAG supports both x86_64 and ARM64 platforms with conditional compilation:

**x86_64 (Windows, Linux Intel, macOS Intel):**
- Pure Rust implementations via pqcrypto crates
- Zero C dependencies, simple builds
- AVX2 hardware acceleration where available

**ARM64 (Apple Silicon, Linux ARM64):**
- libcrux-ml-kem for ML-KEM-768 operations
- oqs + FFI for ML-DSA-87 with direct liboqs calls
- OpenSSL dependency for cryptographic primitives
- NEON hardware acceleration

## Core Build Commands

### Rust Core Platform
```bash
# Build all Rust components
cargo build --workspace                    # Debug build
cargo build --workspace --release          # Optimized release build

# Individual component builds
cargo build -p qudag-crypto               # Quantum cryptography
cargo build -p qudag-network              # P2P networking
cargo build -p qudag-dag                  # DAG consensus
cargo build -p qudag-protocol             # Protocol coordination
cargo build -p qudag-vault-core           # Password vault
cargo build -p qudag-cli                  # CLI tools
cargo build -p qudag-mcp                  # MCP server
cargo build -p qudag-exchange             # Token exchange

# CLI installation
cargo install --path tools/cli            # Install QuDAG CLI
```

### Business Intelligence API (Node.js)
```bash
cd business-intelligence-api
npm install                               # Install dependencies
npm run dev                               # Development server
npm run build                             # TypeScript compilation
npm run start                             # Production server
npm run seed                              # Database seeding
npm run test                              # Run tests
npm run lint                              # ESLint checking
npm run typecheck                         # TypeScript type checking
```

### Executive Dashboard (React)
```bash
cd qudag-executive
npm install                               # Install dependencies
npm run dev                               # Vite dev server (port 5173)
npm run build                             # Production build
npm run preview                           # Preview production build
npm run lint                              # ESLint checking
```

### WASM Development
```bash
cd qudag-wasm
wasm-pack build --target web              # Build for browsers
wasm-pack build --target nodejs           # Build for Node.js
wasm-pack build --target bundler          # Build for bundlers
wasm-pack test --headless --chrome        # Run browser tests
wasm-pack test --node                     # Run Node.js tests
npm run test:browser                      # Integration tests
npm run benchmark                         # Performance benchmarks
```

### Docker Development
```bash
# ARM64 builds (macOS Apple Silicon, Linux ARM64)
./build-arm64.sh                          # Full Docker build
./build-arm64-native.sh                   # Native ARM64 build
./build-arm64-essential.sh                # Core components only

# Multi-platform support
docker-compose up                         # Development environment
docker-compose -f docker-compose.dev.yml up  # Development services
```

## Architecture Overview

### 🏗️ System Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                    QuDAG Platform Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Layer (TypeScript/React)                             │
│  ├── Executive Dashboard (React + Vite)                        │
│  └── Business Intelligence API (Fastify + PostgreSQL)         │
├─────────────────────────────────────────────────────────────────┤
│  Core Platform (Rust)                                          │
│  ├── CLI Tools (qudag-cli)                                     │
│  ├── MCP Server (qudag-mcp)                                    │
│  ├── Exchange System (qudag-exchange)                          │
│  └── WASM Bindings (qudag-wasm)                               │
├─────────────────────────────────────────────────────────────────┤
│  🔒 Quantum Crypto Layer (Dual Architecture)                   │
│  ├── x86_64: Pure Rust pqcrypto (ML-DSA, ML-KEM)              │
│  └── ARM64: libcrux + oqs FFI (ML-DSA-87, ML-KEM-768)         │
├─────────────────────────────────────────────────────────────────┤
│  ⚡ DAG Consensus (QR-Avalanche)                               │
│  ├── Byzantine Fault Tolerant                                  │
│  └── Quantum-Resistant Finality                                │
├─────────────────────────────────────────────────────────────────┤
│  🌐 P2P Network (LibP2P + Kademlia DHT)                        │
│  ├── Dark Domain System (.dark TLD)                            │
│  ├── Anonymous Onion Routing                                   │
│  └── NAT Traversal & Traffic Obfuscation                       │
├─────────────────────────────────────────────────────────────────┤
│  🔐 Quantum-Resistant Vault                                    │
│  ├── AES-256-GCM + ML-KEM Encapsulation                        │
│  └── Secure Credential Management                              │
└─────────────────────────────────────────────────────────────────┘
```

### Core Workspace Structure
```
QuDAG/
├── core/                      # Core Rust components
│   ├── crypto/               # Quantum-resistant cryptography
│   ├── dag/                  # DAG consensus implementation  
│   ├── network/              # P2P networking & dark addressing
│   ├── protocol/             # Protocol coordination
│   └── vault/                # Password vault
├── tools/
│   └── cli/                  # Command-line interface
├── qudag-mcp/                # Model Context Protocol server
├── qudag-exchange/           # rUv token exchange system
├── qudag-wasm/              # WebAssembly bindings
├── business-intelligence-api/ # Node.js backend API
├── qudag-executive/          # React dashboard frontend
├── benchmarks/               # Performance benchmarking
├── examples/                 # Usage examples
├── docs/                     # Comprehensive documentation
└── qudag-testnet/           # Live testnet deployment
```

## CLI Operations Reference

### Node Management
```bash
qudag start [--port 8080] [--bootstrap-peers <peers>]  # Start QuDAG node
qudag stop                                             # Stop running node
qudag status                                          # Node health & status
qudag peer list                                       # List connected peers
qudag peer connect <multiaddr>                        # Connect to peer
qudag network status                                  # Network topology
```

### Dark Addressing System
```bash
qudag address register <domain.dark>                 # Register dark domain
qudag address resolve <domain.dark>                  # Resolve dark domain
qudag address generate [--type quantum|shadow|onion] # Generate addresses
qudag address shadow --ttl 3600                      # Temporary shadow address
qudag fingerprint create --data "text"               # Quantum fingerprint
```

### Quantum Cryptography
```bash
qudag key generate [--algorithm ml-dsa|ml-kem|hqc]   # Generate quantum keys
qudag sign <message> [--key <path>]                  # Quantum signatures
qudag encrypt <data> [--recipient <address>]         # Quantum encryption
qudag verify <signature> <message> --key <public-key> # Verify signatures
```

### Exchange Operations
```bash
# Account Management
qudag exchange create-account --name <name>          # Create rUv account
qudag exchange balance --account <name>              # Check balance
qudag exchange transfer --from <src> --to <dst> --amount <n> # Transfer tokens

# Fee Model Configuration
qudag exchange configure-fees --f-min 0.001 --f-max 0.01    # Set fee parameters
qudag exchange calculate-fee --account <name> --amount <n>   # Calculate fees
qudag exchange verify-agent <account> --proof-path <path>   # Verify agent

# Business Plan Operations
qudag exchange business-plan enable [--auto-distribution]   # Enable payouts
qudag exchange business-plan contributors register <id> <role> <vault> # Register contributor

# Immutable Deployment
qudag exchange deploy-immutable --grace-period 24           # Deploy immutable mode
qudag exchange immutable-status --format json              # Check status
```

### Vault Operations
```bash
qudag vault create <name>                            # Create new vault
qudag vault unlock <name>                           # Unlock vault
qudag vault generate --length 16                    # Generate password
qudag vault config show                             # Show configuration
```

## Testing Commands

### Rust Testing
```bash
# Comprehensive testing
cargo test --workspace                               # All tests
cargo test --workspace --release                    # Release mode tests

# Component-specific testing
cargo test -p qudag-crypto                          # Crypto tests
cargo test -p qudag-network                         # Network tests
cargo test -p qudag-dag                             # DAG consensus tests
cargo test -p qudag-protocol                        # Protocol tests

# Security & Performance testing
cargo test --features timing-attack-tests           # Timing attack resistance
cargo test --features stress-tests --release        # Stress testing
cargo bench                                         # Performance benchmarks
cargo audit                                         # Security audit
```

### Integration Testing
```bash
# Multi-node testing
./scripts/multi-node-test.sh                        # Multi-node scenarios
docker-compose up test-network                      # Test network

# WASM testing
cd qudag-wasm
npm run test:browser                                 # Browser integration
npm run test:crypto-wasm                            # Crypto operations
node test-nodejs.mjs                                # Node.js integration
```

### Frontend Testing
```bash
# Business Intelligence API
cd business-intelligence-api
npm test                                             # API tests
npm run test:integration                            # Integration tests

# Executive Dashboard
cd qudag-executive
npm run test                                         # Frontend tests (when implemented)
npm run lint                                         # Code quality
```

## Development Workflows

### Full Stack Development
```bash
# 1. Start backend services
cd business-intelligence-api
docker-compose up -d                                # PostgreSQL + Redis
npm run seed                                         # Seed database
npm run dev                                          # API server (port 8090)

# 2. Start frontend dashboard
cd ../qudag-executive
npm run dev                                          # React app (port 5173)

# 3. Start QuDAG node (in another terminal)
cargo run --bin qudag start --port 8080             # QuDAG node

# 4. Test integration
curl http://localhost:8090/api/v1/health            # API health
curl http://localhost:5173                          # Frontend
qudag status                                         # Node status
```

### Quantum Crypto Development
```bash
# ARM64 environment setup (macOS Apple Silicon)
export OPENSSL_DIR=/opt/homebrew/opt/openssl@3
export RUSTFLAGS="-L/opt/homebrew/opt/openssl@3/lib"

# Development cycle
cargo build -p qudag-crypto                         # Build crypto components
cargo test -p qudag-crypto --features security-tests # Security testing
cargo bench --bench crypto_benchmarks               # Performance testing
```

### Exchange Development
```bash
# Set up test accounts
qudag exchange create-account --name alice
qudag exchange create-account --name bob
qudag exchange mint --account alice --amount 10000

# Test fee model
qudag exchange transfer --from alice --to bob --amount 1000
qudag exchange calculate-fee --account alice --amount 5000
qudag exchange fee-status --examples

# Test business plan
qudag exchange business-plan enable --auto-distribution
qudag exchange business-plan configure threshold 100
```

## ARM64 Specific Instructions

### macOS Apple Silicon Setup
```bash
# Install dependencies
brew install openssl@3

# Set environment variables
export OPENSSL_DIR=/opt/homebrew/opt/openssl@3
export RUSTFLAGS="-L/opt/homebrew/opt/openssl@3/lib"

# Build with ARM64 optimizations
cargo build --release
./build-arm64-native.sh                             # Native ARM64 build
```

### Linux ARM64 Setup
```bash
# Install system dependencies
sudo apt-get install libssl-dev pkg-config

# Build with ARM64 optimizations
cargo build --release
./build-arm64.sh                                    # Docker-based build
```

## Key Integration Points

### Business Intelligence Integration
- **Database**: PostgreSQL with multi-tenant schema
- **Cache**: Redis for session management and caching
- **API**: RESTful endpoints with comprehensive business metrics
- **Real-time**: WebSocket support for live updates

### Executive Dashboard Integration
- **Frontend**: React 19 with TypeScript and Tailwind CSS
- **State**: TanStack Query for data fetching and caching
- **API Integration**: Axios client with error handling
- **Theme**: Dark/light mode with persistent storage

### MCP Server Integration
- **Protocols**: stdio, HTTP, WebSocket transports
- **Tools**: 6 built-in tools (vault, dag, network, crypto, system, config)
- **Resources**: 4 dynamic resources with real-time updates
- **Authentication**: JWT-based with configurable RBAC

### WASM Integration
- **Targets**: Web browsers, Node.js, bundlers
- **Crypto**: Quantum-resistant operations in WASM
- **Performance**: Optimized for both browser and server environments

## Production Deployment

### Live Testnet
QuDAG operates a live testnet across 4 global regions:
- **node1** (Toronto): Bootstrap + MCP Server with HTTPS
- **node2** (Amsterdam): Full node with P2P mesh
- **node3** (Singapore): Full node with P2P mesh  
- **node4** (San Francisco): Full node with P2P mesh

```bash
# Connect to testnet
qudag start --bootstrap-peers /ip4/109.105.222.156/tcp/4001

# Test MCP integration
curl https://qudag-testnet-node1.fly.dev/mcp | jq
```

### Environment Configuration
```bash
# Backend API (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/qudag
REDIS_URL=redis://localhost:6379
API_PORT=8090

# Frontend (.env.local)
VITE_API_BASE_URL=http://localhost:8090
VITE_ENABLE_QUANTUM_CRYPTO=true

# QuDAG Node
QUDAG_PORT=8080
QUDAG_BOOTSTRAP_PEERS=/ip4/109.105.222.156/tcp/4001
```

## Code Style & Conventions

### Rust Code Style
- Use `Result<T, E>` and `Option<T>` idioms consistently
- Implement `async/await` for all asynchronous operations
- Follow snake_case for Rust identifiers
- Use `#![deny(unsafe_code)]` for memory safety
- Document all quantum crypto operations with security considerations

### TypeScript/JavaScript Code Style
- Use ES modules (import/export) syntax
- Destructure imports when possible
- Use camelCase for identifiers
- Implement comprehensive JSDoc comments for APIs
- Use `async/await` instead of Promise chains
- Prefer `const/let` over `var`

### Testing Requirements
- **Quantum Crypto Security**: All operations must pass timing attack tests
- **WASM Compatibility**: Test in both browser and Node.js environments
- **Network Resilience**: Test P2P functionality under network partitions
- **Integration Testing**: End-to-end workflows across all components
- **Performance Benchmarking**: Regular performance regression testing

## Important Development Notes

### Memory Safety
- All Rust code uses `#![deny(unsafe_code)]` for guaranteed memory safety
- Cryptographic secrets use `ZeroizeOnDrop` for automatic cleanup
- WASM bindings include proper memory management

### Security Considerations
- All cryptographic operations use quantum-resistant algorithms
- Timing attack resistance in all crypto implementations
- Regular security audits with `cargo audit`
- Comprehensive fuzzing with property-based testing

### Performance Optimization
- SIMD acceleration (AVX2/NEON) where available
- Hardware-optimized crypto operations
- Efficient memory pooling and connection management
- Multi-level caching (L1: Memory, L2: Redis, L3: Disk)

This configuration provides comprehensive guidance for developing across all components of the QuDAG quantum-resistant platform, from core Rust implementation to frontend React applications.