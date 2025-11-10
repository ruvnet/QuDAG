# QuDAG NAPI-RS Platform Build Matrix

## Overview

This document defines the complete platform build matrix for QuDAG's napi-rs native Node.js bindings, covering all target platforms, architectures, and optional feature combinations.

## Platform Strategy

QuDAG will support a comprehensive range of platforms to maximize accessibility while maintaining quantum-resistant security guarantees. The build matrix balances broad platform support with CI resource constraints.

## Core Platform Matrix

### Tier 1 Platforms (Full Support & Testing)

These platforms receive full CI testing, pre-built binaries, and priority support:

| Platform | Architecture | Target Triple | Runner | Priority |
|----------|-------------|---------------|--------|----------|
| **Linux (glibc)** | x86_64 | x86_64-unknown-linux-gnu | ubuntu-22.04 | **Critical** |
| **Linux (glibc)** | aarch64 | aarch64-unknown-linux-gnu | ubuntu-22.04 + cross | **Critical** |
| **macOS** | x86_64 | x86_64-apple-darwin | macos-13 | **High** |
| **macOS** | aarch64 | aarch64-apple-darwin | macos-14 | **High** |
| **Windows** | x86_64 | x86_64-pc-windows-msvc | windows-2022 | **High** |

### Tier 2 Platforms (Build Only, Limited Testing)

These platforms receive pre-built binaries but limited CI testing:

| Platform | Architecture | Target Triple | Build Method | Priority |
|----------|-------------|---------------|--------------|----------|
| **Linux (musl)** | x86_64 | x86_64-unknown-linux-musl | cross-compilation | Medium |
| **Linux (musl)** | aarch64 | aarch64-unknown-linux-musl | cross-compilation | Medium |
| **Windows** | aarch64 | aarch64-pc-windows-msvc | cross-compilation | Medium |
| **Linux (glibc)** | armv7 | armv7-unknown-linux-gnueabihf | cross-compilation | Low |

### Tier 3 Platforms (Community Support)

These platforms can be built on-demand but won't receive pre-built binaries:

| Platform | Architecture | Target Triple | Status |
|----------|-------------|---------------|--------|
| **FreeBSD** | x86_64 | x86_64-unknown-freebsd | Community |
| **Android** | aarch64 | aarch64-linux-android | Experimental |
| **Android** | armv7 | armv7-linux-androideabi | Experimental |

## Optional Features Matrix

### GPU Acceleration Features

QuDAG's quantum cryptography can benefit from GPU acceleration for certain operations. These are compiled as optional features:

#### CUDA Support (NVIDIA GPUs)

| Platform | CUDA Version | Target | Build Configuration |
|----------|-------------|--------|---------------------|
| Linux x86_64 | 12.x | x86_64-unknown-linux-gnu | `--features cuda` |
| Windows x86_64 | 12.x | x86_64-pc-windows-msvc | `--features cuda` |

**Requirements:**
- CUDA Toolkit 12.x installed on build host
- cuDNN 8.x for neural network acceleration (optional)
- Build-time detection via `cuda-sys` crate

**Package Strategy:**
- Publish as separate optional package: `@qudag/napi-cuda`
- Main package lists as `optionalDependency`
- Runtime detection falls back to CPU if CUDA unavailable

#### ROCm Support (AMD GPUs)

| Platform | ROCm Version | Target | Build Configuration |
|----------|-------------|--------|---------------------|
| Linux x86_64 | 6.x | x86_64-unknown-linux-gnu | `--features rocm` |

**Requirements:**
- ROCm 6.x installed on build host
- MIOpen for neural network acceleration (optional)
- Build-time detection via custom build script

**Package Strategy:**
- Publish as separate optional package: `@qudag/napi-rocm`
- Main package lists as `optionalDependency`
- Runtime detection falls back to CPU if ROCm unavailable

### SIMD Optimizations

Hardware-accelerated SIMD operations for quantum cryptography:

| Feature | Platforms | Detection | Fallback |
|---------|-----------|-----------|----------|
| **AVX2** | x86_64 (Linux, macOS, Windows) | Runtime CPUID | SSE4.2 |
| **AVX-512** | x86_64 (Linux, Windows) | Runtime CPUID | AVX2 |
| **NEON** | aarch64 (all platforms) | Compile-time | Portable |

**Build Strategy:**
- Compile multiple code paths in single binary
- Runtime CPU detection selects optimal implementation
- No separate packages needed

## Build Matrix Dimensions

### Primary Matrix (No Optional Features)

```yaml
strategy:
  fail-fast: false
  matrix:
    settings:
      # Linux x86_64
      - host: ubuntu-22.04
        target: x86_64-unknown-linux-gnu
        build: cargo build --release

      # Linux aarch64
      - host: ubuntu-22.04
        target: aarch64-unknown-linux-gnu
        build: cross build --release --target aarch64-unknown-linux-gnu

      # macOS x86_64
      - host: macos-13
        target: x86_64-apple-darwin
        build: cargo build --release

      # macOS aarch64
      - host: macos-14
        target: aarch64-apple-darwin
        build: cargo build --release

      # Windows x86_64
      - host: windows-2022
        target: x86_64-pc-windows-msvc
        build: cargo build --release
```

### Extended Matrix (With Optional Features)

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      # Standard builds (15 total)
      # ... (primary matrix above)

      # CUDA builds (2 total)
      - host: ubuntu-22.04
        target: x86_64-unknown-linux-gnu
        features: cuda
        package-name: '@qudag/napi-cuda-linux-x64'

      - host: windows-2022
        target: x86_64-pc-windows-msvc
        features: cuda
        package-name: '@qudag/napi-cuda-win32-x64'

      # ROCm builds (1 total)
      - host: ubuntu-22.04
        target: x86_64-unknown-linux-gnu
        features: rocm
        package-name: '@qudag/napi-rocm-linux-x64'
```

**Total Build Combinations:** 18 builds (15 standard + 2 CUDA + 1 ROCm)

## Platform-Specific Challenges & Solutions

### Linux Challenges

#### GLIBC Version Compatibility

**Challenge:** Different Linux distributions use different glibc versions, causing binary incompatibility.

**Solution:**
- Build on Ubuntu 22.04 (glibc 2.35) for maximum compatibility
- Use `zig cc` as C compiler for cross-compilation to ensure glibc 2.17+ compatibility
- Statically link C++ standard library where possible

**Configuration:**
```toml
# .cargo/config.toml
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=lld", "-C", "target-feature=+crt-static"]
```

#### ARM Cross-Compilation

**Challenge:** GitHub Actions doesn't provide native ARM64 runners (except macOS).

**Solution:**
- Use `cross` tool with Docker-based cross-compilation
- Leverage `@napi-rs/cli --use-napi-cross` for streamlined builds
- Pre-install cross-compilation toolchains in CI

**Build Command:**
```bash
cargo install cross --git https://github.com/cross-rs/cross
cross build --release --target aarch64-unknown-linux-gnu
```

### macOS Challenges

#### Universal Binaries (x86_64 + aarch64)

**Challenge:** macOS supports universal binaries containing both architectures.

**Solution:**
- Build separately for x86_64 and aarch64
- Use `lipo` to create universal binary
- Publish as single package: `@qudag/napi-darwin-universal`

**Merge Script:**
```bash
lipo -create \
  target/x86_64-apple-darwin/release/libqudag.dylib \
  target/aarch64-apple-darwin/release/libqudag.dylib \
  -output target/universal-apple-darwin/release/libqudag.dylib
```

#### Code Signing

**Challenge:** macOS requires notarization for distribution.

**Solution:**
- Sign binaries with Apple Developer certificate in CI
- Notarize with Apple's notarization service
- Staple notarization ticket to binary

**Implementation:**
```bash
codesign --sign "$APPLE_DEVELOPER_ID" --timestamp libqudag.dylib
xcrun notarytool submit libqudag.dylib --wait
xcrun stapler staple libqudag.dylib
```

### Windows Challenges

#### MSVC Runtime Linking

**Challenge:** Windows requires Visual C++ runtime to be available.

**Solution:**
- Statically link MSVC runtime (`/MT` flag)
- Document runtime requirements in README
- Provide detection script for missing runtimes

**Configuration:**
```toml
[target.x86_64-pc-windows-msvc]
rustflags = ["-C", "target-feature=+crt-static"]
```

#### Windows ARM64

**Challenge:** Limited ARM64 Windows testing infrastructure.

**Solution:**
- Cross-compile from x86_64 Windows runner
- Mark as Tier 2 with community testing
- Document installation on ARM64 devices

### CUDA/ROCm Challenges

#### Build Environment

**Challenge:** GPU SDKs require specific versions and large installations.

**Solution:**
- Use Docker containers with pre-installed CUDA/ROCm
- Cache Docker images in GitHub Actions
- Provide Dockerfile for reproducible builds

**CUDA Dockerfile Example:**
```dockerfile
FROM nvidia/cuda:12.3.0-devel-ubuntu22.04
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN cargo install napi-cli
```

#### Runtime Detection

**Challenge:** Users may not have GPU drivers installed.

**Solution:**
- Implement runtime detection in JavaScript wrapper
- Fall back to CPU version gracefully
- Provide diagnostic tools

**Detection Script:**
```javascript
async function loadBestBackend() {
  try {
    // Try CUDA first
    if (await detectCUDA()) {
      return require('@qudag/napi-cuda');
    }
  } catch {}

  try {
    // Try ROCm
    if (await detectROCm()) {
      return require('@qudag/napi-rocm');
    }
  } catch {}

  // Fall back to CPU
  return require('@qudag/napi');
}
```

## Testing Strategy

### Tier 1 Platform Testing

- **Unit Tests:** Run full Rust test suite on all Tier 1 platforms
- **Integration Tests:** Run JavaScript integration tests
- **Smoke Tests:** Verify basic crypto operations
- **Performance Tests:** Ensure no regression vs baseline

### Tier 2 Platform Testing

- **Build Verification:** Ensure binary builds successfully
- **Smoke Tests Only:** Basic functionality verification
- **Community Testing:** Rely on user reports

### GPU Feature Testing

- **CUDA:** Test on GitHub GPU runners (if available) or self-hosted
- **ROCm:** Self-hosted runners with AMD GPUs
- **Fallback Testing:** Verify graceful CPU fallback

## Build Time Estimates

| Platform | Build Time | Cache Hit Time | Notes |
|----------|-----------|----------------|-------|
| Linux x86_64 | 8-12 min | 3-5 min | Fastest platform |
| Linux aarch64 | 15-20 min | 5-8 min | Cross-compilation overhead |
| macOS x86_64 | 10-15 min | 4-6 min | Xcode overhead |
| macOS aarch64 | 12-18 min | 5-7 min | Native M1/M2 |
| Windows x86_64 | 15-20 min | 6-9 min | MSVC compilation slower |
| Linux x86_64 CUDA | 20-30 min | 8-12 min | CUDA SDK overhead |
| Linux x86_64 ROCm | 25-35 min | 10-15 min | ROCm SDK overhead |

**Total CI Time (Parallel):** ~30-40 minutes for full matrix

## Resource Requirements

### GitHub Actions Minutes

- **Standard Platforms:** ~200 minutes per full build
- **GPU Platforms:** ~60 minutes per build
- **Total per Release:** ~260 minutes (~4.3 hours)

### Storage Requirements

- **Artifacts per Platform:** 15-30 MB compressed
- **Total Release Artifacts:** ~500 MB
- **npm Registry Storage:** ~200 MB per version

### Self-Hosted Runner Considerations

For GPU builds, consider self-hosted runners:

- **CUDA Runner:** Ubuntu 22.04, NVIDIA GPU, 16GB RAM, 100GB SSD
- **ROCm Runner:** Ubuntu 22.04, AMD GPU, 16GB RAM, 100GB SSD

## Future Platform Expansions

### Short-term (6 months)

- **Linux RISC-V:** As RISC-V support matures in Rust
- **Windows ARM64:** As toolchain improves

### Long-term (12+ months)

- **WebAssembly:** Compile core cryptography to WASM
- **iOS/Android:** Native mobile support via napi-rs React Native

## Platform Matrix Maintenance

- **Quarterly Review:** Assess platform usage metrics
- **Annual Audit:** Re-evaluate Tier 2/3 platform support
- **Deprecation Policy:** 6-month notice for platform removal

## References

- [napi-rs Cross-Build Documentation](https://napi.rs/docs/cross-build)
- [Rust Platform Support](https://doc.rust-lang.org/nightly/rustc/platform-support.html)
- [GitHub Actions Runner Images](https://github.com/actions/runner-images)
- [CUDA Toolkit Documentation](https://docs.nvidia.com/cuda/)
- [ROCm Documentation](https://rocm.docs.amd.com/)
