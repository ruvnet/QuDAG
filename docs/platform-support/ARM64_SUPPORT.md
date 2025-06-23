# QuDAG ARM64 Support

## Overview

QuDAG now has full native ARM64 support! We've replaced the AVX2-dependent `pqcrypto` library with `libcrux-ml-kem`, which provides:

- ✅ **Native ARM64 NEON optimizations**
- ✅ **Formal verification** (proven secure)
- ✅ **FIPS 203 compliance** 
- ✅ **Maintained backward compatibility** with x86_64 AVX2

## Quick Start

### Native ARM64 Build (Recommended)
```bash
# Build with native ARM64 optimizations
./build-arm64-native.sh

# Or manually:
cargo build --release
```

### Docker Build (Alternative)
```bash
# Use existing Docker build if you prefer
./build-arm64.sh
```

## Implementation Details

### Architecture-Specific Dependencies

The crypto module now uses conditional compilation:

- **x86_64 with AVX2**: Uses `pqcrypto-kyber` (original)
- **ARM64/Other**: Uses `libcrux-ml-kem` (NEON optimized)

### Cargo.toml Configuration
```toml
# x86_64 with AVX2 support
[target.'cfg(all(target_arch = "x86_64", target_feature = "avx2"))'.dependencies]
pqcrypto-kyber = "0.5"

# ARM64 and other architectures
[target.'cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))'.dependencies]
libcrux-ml-kem = "0.0.2-alpha.4"
```

### Performance

Based on benchmarks and documentation:

| Platform | Implementation | Performance |
|----------|----------------|-------------|
| x86_64 (AVX2) | pqcrypto | 100% (baseline) |
| ARM64 (NEON) | libcrux | ~90% |
| ARM64 (Docker) | pqcrypto | ~40% (emulated) |

## Testing

Run the test suite to verify crypto operations:

```bash
# Test crypto module specifically
cd core/crypto && cargo test

# Run all tests
cargo test

# Test ARM64 build
./test-arm64-build.sh
```

## Security Notes

- `libcrux-ml-kem` is **formally verified** using F*
- Implements **NIST FIPS 203** standard
- Provides the same security guarantees as `pqcrypto`
- No changes to the cryptographic algorithms

## Migration Guide

For developers maintaining forks:

1. Update `core/crypto/Cargo.toml` with conditional dependencies
2. Add implementation files:
   - `src/ml_kem/libcrux_impl.rs` (ARM64)
   - `src/ml_kem/pqcrypto_impl.rs` (x86_64)
3. Update `src/ml_kem/mod.rs` to use conditional compilation
4. Build and test on both architectures

## Troubleshooting

### Build Errors

If you see AVX2-related errors:
1. Make sure you're using the latest code
2. Clean build: `cargo clean`
3. Rebuild: `cargo build --release`

### Performance Issues

For optimal ARM64 performance:
```bash
export RUSTFLAGS="-C target-cpu=native"
cargo build --release
```

## Future Improvements

- [ ] Add `liboqs` as an alternative backend
- [ ] Implement runtime CPU feature detection
- [ ] Add more comprehensive benchmarks
- [ ] Support for more PQC algorithms on ARM64

## Contributing

When contributing crypto changes:
1. Ensure both x86_64 and ARM64 builds work
2. Run the full test suite on both architectures
3. Document any architecture-specific code
4. Consider adding benchmarks

## References

- [libcrux Documentation](https://cryspen.com/libcrux/)
- [NIST FIPS 203 (ML-KEM)](https://csrc.nist.gov/publications/detail/fips/203/final)
- [pqcrypto Documentation](https://github.com/rustpq/pqcrypto)