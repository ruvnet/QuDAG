# Build Documentation

This directory contains documentation for building QuDAG across different platforms and configurations.

## Build Guides

- [**Best Practice Build**](BEST_PRACTICE_BUILD.md) - Comprehensive build guide and best practices

## Platform-Specific Builds

### ARM64 (Apple Silicon)

```bash
# Native ARM64 build with optimizations
./build-arm64-native.sh

# Cross-compilation via Docker
./build-arm64.sh

# Test ARM64 compatibility
./test-arm64.sh
```

### x86_64 (Intel/AMD)

```bash
# Standard build with AVX2 optimizations
cargo build --release

# Run comprehensive tests
./run-all-tests.sh
```

### WebAssembly (WASM)

```bash
# Build WASM components
cd qudag-wasm
./build-wasm.sh
```

## Build Configuration

### Environment Variables

- `OPENSSL_DIR`: OpenSSL installation directory
- `RUSTFLAGS`: Rust compiler flags for optimization
- `PKG_CONFIG_PATH`: Package configuration path

### Target Features

- **x86_64**: `target-feature=+avx2` for SIMD optimizations
- **ARM64**: `target-cpu=native` for NEON optimizations
- **WASM**: `--target wasm32-unknown-unknown`

## Dependencies

### Core Dependencies

- **Rust**: 1.70+ with target platform support
- **OpenSSL**: 3.0+ for cryptographic operations
- **pkg-config**: For dependency discovery

### Platform Dependencies

- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential, libssl-dev
- **Docker**: For cross-compilation

## Performance Optimization

### Compilation Flags

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = 'abort'
```

### Target-Specific Optimizations

- CPU-specific instruction sets
- SIMD vectorization
- Link-time optimization
- Profile-guided optimization (PGO)

## Troubleshooting

Common build issues and solutions:

1. **OpenSSL not found**: Set `OPENSSL_DIR` environment variable
2. **AVX2 errors on ARM64**: Use ARM64-specific build scripts
3. **Memory issues**: Increase Docker memory limits
4. **Test failures**: Check platform-specific test requirements

For detailed troubleshooting, see [Platform Support Documentation](../platform-support/).
