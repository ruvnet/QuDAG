# Platform Support Documentation

This directory contains documentation for platform-specific features and support.

## ARM64 (Apple Silicon) Support

- [**ARM64 Support Overview**](ARM64_SUPPORT.md) - Complete ARM64 support documentation
- [**PRISTINE ARM64 Plan**](PRISTINE_ARM64_PLAN.md) - Technical plan for ARM64 compatibility
- [**ARM64 PRISTINE Status**](ARM64_PRISTINE_STATUS.md) - Current status and achievements
- [**ARM64 Quickstart**](QUICKSTART_ARM64.md) - Quick setup guide for Apple Silicon
- [**ARM64 Solution Summary**](ARM64_SOLUTION_SUMMARY.md) - Technical solution overview
- [**ARM64 Test Summary**](TEST_SUMMARY_ARM64.md) - Test results and validation

## Cross-Platform Compatibility

QuDAG is designed to work across multiple platforms with platform-specific optimizations where beneficial:

- **x86_64**: Full feature support with AVX2 optimizations
- **ARM64**: Native support with NEON optimizations and fallback implementations
- **WASM**: WebAssembly builds for browser integration

## Platform-Specific Features

### Cryptography

- **x86_64**: Full ML-DSA, ML-KEM, and HQC support
- **ARM64**: ML-KEM via libcrux, ML-DSA via FFI, HQC disabled

### Performance Optimizations

- **x86_64**: AVX2 SIMD instructions
- **ARM64**: NEON SIMD instructions
- **Both**: CPU-specific tuning via `target-cpu=native`

## Building for Different Platforms

See [Build Documentation](../build/) for platform-specific build instructions and optimization guides.
