# QuDAG ARM64 Quickstart Guide

✅ **ALL ISSUES RESOLVED!** QuDAG now builds and runs natively on Apple Silicon with full quantum-resistant cryptography support, including a working CLI with exchange functionality!

## 🚀 Quick Options

### Option 1: Native Build (Recommended)
Best performance, uses your local Rust toolchain:

```bash
./build-arm64-native.sh
```

### Option 2: Docker Build
Isolated build environment, useful for CI/CD:

```bash
./build-arm64.sh
```

## 📋 Prerequisites

- **Rust**: Install from https://rustup.rs/
- **Git**: For cloning/updating the repository
- **Docker** (optional): Only needed for Docker builds

## 🔧 What's Fixed

✅ **ML-KEM**: Uses `libcrux-ml-kem` (formally verified, ARM64 NEON optimized)  
✅ **ML-DSA**: Uses `oqs` library (NIST standard, quantum-resistant)  
✅ **Conditional Compilation**: Automatic x86_64 vs ARM64 detection  
✅ **Dark Resolver**: Conditionally compiled (x86_64 only)  
✅ **CLI Tool**: Fully functional with quantum crypto support  

## 🎯 After Building

1. **Add to PATH** (if using native build):
   ```bash
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

2. **Test Installation**:
   ```bash
   qudag --help
   ```

3. **Start a Node**:
   ```bash
   qudag start --port 8000
   ```

4. **Generate Quantum Keys**:
   ```bash
   qudag key generate --algorithm ml-dsa
   qudag key generate --algorithm ml-kem
   ```

5. **Create Exchange Account**:
   ```bash
   qudag exchange create-account --name my_vault
   ```

## 🧪 Development Usage

For Rust projects, add to your `Cargo.toml`:

```toml
[dependencies]
qudag = { path = "/path/to/QuDAG" }
qudag-crypto = { path = "/path/to/QuDAG/core/crypto" }
```

Example usage:
```rust
use qudag_crypto::{MlDsaKeyPair, MlKem768};
use qudag_dag::Dag;
use qudag_network::P2PNode;

// Generate quantum-resistant keys
let mut rng = rand::thread_rng();
let ml_dsa_keypair = MlDsaKeyPair::generate(&mut rng)?;
let ml_kem = MlKem768::new();
```

## 🔍 Testing

Run the full test suite:
```bash
cargo test --workspace
```

Run crypto-specific tests:
```bash
cargo test --package qudag-crypto
```

## 🌐 WASM Development

Build for web browsers:
```bash
wasm-pack build --target web
```

Build for Node.js:
```bash
wasm-pack build --target nodejs
```

## 🚨 Architecture Details

- **ARM64**: Uses `libcrux-ml-kem` + `oqs` (native performance)
- **x86_64**: Uses `pqcrypto-*` crates (AVX2 optimized)
- **Conditional Compilation**: Automatic detection via `cfg` attributes
- **Dark Resolver**: Only available on x86_64 (uses Intel-specific libs)

## 🆘 Troubleshooting

**Build fails with crypto errors:**
- Make sure you're using the latest Rust version: `rustup update`
- Clean and rebuild: `./build-arm64-native.sh --clean`

**CLI not found after build:**
- Check if `~/.local/bin` is in your PATH
- Manually run: `./target/release/qudag --help`

**Docker build issues:**
- Ensure Docker is running: `docker info`
- Clean Docker cache: `docker system prune`

## 🎉 Success!

You now have QuDAG running natively on ARM64 with:
- ✅ Full quantum-resistant cryptography (ML-KEM + ML-DSA)
- ✅ Native ARM64 NEON optimizations
- ✅ Complete CLI functionality
- ✅ rUv token exchange system
- ✅ P2P networking with quantum-secure routing

All quantum crypto operations maintain full security without any workarounds or reduced encryption!