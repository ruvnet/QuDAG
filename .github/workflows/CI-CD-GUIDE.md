# QuDAG N-API CI/CD Workflows Guide

## Overview

This guide documents the complete GitHub Actions CI/CD workflow system for QuDAG N-API, supporting multi-platform builds, testing, security auditing, benchmarking, and automated releases.

## Workflow Files

### Primary Workflows

#### 1. **napi-ci.yml** - Continuous Integration
**Trigger**: Push to `main`/`develop`, Pull Requests

**Jobs**:
- **lint** - Format & Lint (Rust clippy, cargo fmt, ESLint, TypeScript)
- **security-audit** - Cargo-audit & npm audit checks
- **test-rust** - Rust tests on Linux/macOS/Windows
- **test-node** - Node.js tests on v18, v20, v22
- **build-napi** - Build N-API for all 8-9 platforms
- **universal-macos** - Create universal macOS binary
- **test-integration** - Integration tests on primary platforms
- **benchmark** - Performance benchmarks (main branch only)
- **coverage** - Code coverage with Codecov
- **summary** - Final CI status

**Build Matrix** (9 total):
- Linux: x86_64-gnu, aarch64-gnu, x86_64-musl, aarch64-musl
- macOS: x86_64, aarch64 (M1/M2/M3)
- Windows: x86_64, aarch64

**Execution Time**: ~40-50 minutes (parallel execution)

**Caching Strategy**:
- Cargo registry cache: `~/.cargo/registry`, `~/.cargo/git`
- Cargo build cache: `target/` (per target)
- npm cache: `node_modules`

---

#### 2. **napi-release.yml** - Release Automation
**Trigger**: Git tags (`v*`), Manual dispatch

**Jobs**:
1. **pre-flight** - Version validation, changelog verification
2. **build-release** - Build all platforms (8-9 variants)
3. **test-release** - Platform-specific testing
4. **universal-macos** - Create universal macOS binary
5. **package-npm** - Prepare npm packages
6. **publish-npm** - Publish to npm registry
7. **create-github-release** - Create GitHub release with artifacts
8. **post-release** - Update docs, send notifications
9. **release-summary** - Final status report

**Release Flow**:
```
Tag Push → Pre-flight → Build (parallel) → Test → Package → Publish → GitHub Release
```

**Execution Time**: ~45-60 minutes

**Artifacts**:
- Native bindings for all 9 platforms
- Checksums (SHA256)
- Universal macOS binary
- npm package

**Secrets Required**:
- `NPM_TOKEN` - npm publishing

---

#### 3. **napi-gpu.yml** - GPU-Accelerated Builds
**Trigger**: Push to `main`, Manual dispatch, Weekly schedule

**Jobs**:
- **build-cuda-linux** - CUDA build on Linux (container)
- **build-cuda-windows** - CUDA build on Windows (if available)
- **build-rocm-linux** - ROCm build on Linux (container)
- **test-gpu-builds** - Platform-specific GPU testing
- **publish-gpu-packages** - Optional: Publish GPU variants to npm
- **gpu-summary** - Status report

**GPU Support**:
- CUDA: Linux x86_64, Windows x86_64
- ROCm: Linux x86_64
- Optional npm packages: `@qudag/napi-cuda`, `@qudag/napi-rocm`

**Execution Time**: ~60-90 minutes (GPU dependent)

**Notes**:
- Uses Docker containers with pre-installed toolkits
- Self-hosted runners recommended for production
- Set `ENABLE_GPU_PUBLISH` variable to publish optional packages

---

#### 4. **security-audit.yml** - Security Scanning
**Trigger**: Push, Pull Requests, Daily schedule (3 AM UTC)

**Jobs**:
- **cargo-audit** - Rust dependency vulnerabilities
- **cargo-deny** - License and advisory compliance
- **npm-audit** - JavaScript dependency vulnerabilities
- **dependency-review** - GitHub dependency scanning (PR only)
- **upload-security-results** - SARIF upload for code scanning
- **security-advisory** - Generate advisory (scheduled)
- **crypto-security** - Cryptographic implementation analysis
- **security-summary** - Final report

**Checks**:
- Denial of security vulnerabilities
- License compliance
- Timing attack resistance (crypto)
- Known CVEs

**Execution Time**: ~20-30 minutes

---

#### 5. **benchmark.yml** - Performance Testing
**Trigger**: Push to `main`, Manual dispatch

**Jobs**:
- **rust-benchmarks** - General Rust benchmarks
- **crypto-benchmarks** - ML-DSA, ML-KEM, HQC performance
- **dag-benchmarks** - QR-Avalanche consensus benchmarks
- **network-benchmarks** - P2P networking performance
- **napi-benchmarks** - Node.js/NAPI performance
- **memory-profile** - Memory usage analysis
- **benchmark-comparison** - Compare with baseline
- **benchmark-summary** - Summary report

**Metrics Tracked**:
- Signature generation/verification time
- Key encapsulation timing
- Consensus block finality
- Network throughput/latency
- Memory usage patterns

**Execution Time**: ~60-90 minutes

**Artifact Retention**: 30 days

---

#### 6. **docs.yml** - Documentation Generation
**Trigger**: Push to `main`, Changes in docs/

**Jobs**:
- **generate-rust-docs** - Rust API documentation (cargo doc)
- **generate-ts-docs** - TypeScript documentation (typedoc)
- **prepare-docs-site** - Combine docs into site
- **deploy-pages** - Deploy to GitHub Pages
- **docs-summary** - Completion status

**Output**:
- Rust crate documentation
- TypeScript/NAPI package docs
- Combined documentation site
- GitHub Pages deployment

**Execution Time**: ~15-20 minutes

---

### Reusable Workflows

Located in `.github/workflows/reusable/`:

#### **build-platform.yml**
Generic platform build workflow accepting:
- `target`: Build target triple
- `host`: GitHub runner
- `artifact_name`: Output name
- `setup_commands`: Optional dependencies
- `build_command`: Build command

Usage:
```yaml
uses: ./.github/workflows/reusable/build-platform.yml@main
with:
  target: x86_64-unknown-linux-gnu
  host: ubuntu-latest
  artifact_name: linux-x64-gnu
  build_command: cargo build --release
```

#### **test-platform.yml**
Generic platform test workflow accepting:
- `artifact_name`: Artifact to test
- `host`: GitHub runner
- `test_commands`: Custom test commands

Usage:
```yaml
uses: ./.github/workflows/reusable/test-platform.yml@main
with:
  artifact_name: linux-x64-gnu
  host: ubuntu-latest
```

---

## Platform Build Matrix

### Tier 1 (Full Support)
| Platform | Architecture | Target Triple | Runner | Binary |
|----------|-------------|---------------|--------|--------|
| Linux | x86_64 (glibc) | x86_64-unknown-linux-gnu | ubuntu-latest | .node/.so |
| Linux | aarch64 (glibc) | aarch64-unknown-linux-gnu | ubuntu-latest | .node/.so |
| macOS | x86_64 | x86_64-apple-darwin | macos-13 | .node/.dylib |
| macOS | aarch64 (M1+) | aarch64-apple-darwin | macos-14 | .node/.dylib |
| Windows | x86_64 | x86_64-pc-windows-msvc | windows-latest | .node/.dll |

### Tier 2 (Build Only)
| Platform | Architecture | Target Triple | Build Method |
|----------|-------------|---------------|--------------|
| Linux | x86_64 (musl) | x86_64-unknown-linux-musl | standard |
| Linux | aarch64 (musl) | aarch64-unknown-linux-musl | cross-compile |
| Windows | aarch64 | aarch64-pc-windows-msvc | cross-compile |

### Optional GPU
| Backend | Platform | Package |
|---------|----------|---------|
| CUDA | Linux x64, Windows x64 | @qudag/napi-cuda |
| ROCm | Linux x64 | @qudag/napi-rocm |

---

## Caching Strategy

### Three-Tier Caching

1. **Cargo Registry Cache** (2GB+)
   ```
   ~/.cargo/registry
   ~/.cargo/git
   ```
   Key: `${runner.os}-${target}-cargo-registry-${hashFiles('**/Cargo.lock')}`
   Hit rate: ~90% (Rust dependency changes infrequent)

2. **Cargo Build Cache** (1-3GB per target)
   ```
   target/
   ```
   Key: `${target}-cargo-build-${hashFiles('**/Cargo.lock')}`
   Hit rate: ~70% (incremental compilation)

3. **npm Cache** (500MB+)
   ```
   node_modules
   .npm
   ```
   Key: Built-in via `cache: npm`
   Hit rate: ~85% (node deps stable)

### Cache Hit Impact
- **With cache**: 3-5 minutes build time
- **Without cache**: 10-15 minutes build time
- **Monthly savings**: ~200 CI minutes (~$1)

---

## Concurrency & Cancellation

All workflows use concurrency groups to cancel redundant runs:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Effect**: Only latest commit's workflow runs; previous ones canceled.

---

## Environment Variables

### Global
```env
CARGO_TERM_COLOR: always
RUST_BACKTRACE: 1
CARGO_INCREMENTAL: 0           # Disable incremental for CI
RUST_LOG: debug
NAPI_VERSION: 3
```

### Build-Specific
```env
RUST_MIN_STACK: 8388608        # For quantum crypto tests
ROCM_PATH: /opt/rocm           # GPU builds
CUDA_PATH: /usr/local/cuda     # GPU builds
```

---

## Secrets & Permissions

### Required Secrets

- **NPM_TOKEN** - npm publishing token
  - Scope: `read:packages, write:packages`
  - Used in: `napi-release.yml`

### Optional Variables

- **SLACK_WEBHOOK_URL** - Slack notifications (optional)
- **ENABLE_GPU_PUBLISH** - Enable GPU package publishing
- **CODECOV_TOKEN** - Code coverage (recommended)

### GitHub Token

`GITHUB_TOKEN` is auto-provided with:
- `contents: write` - Create releases
- `pages: write` - Deploy GitHub Pages
- `id-token: write` - OpenID Connect

---

## Execution Flow Diagram

### CI Workflow (on push/PR)
```
┌─ lint ──────────────────────┐
│ (5 min)                      │
├─ security-audit ───────────┤
│ (5 min)                      │
├─ test-rust ─────────────────┤
│ (30 min, 3 OS parallel)      │
├─ test-node ─────────────────┤
│ (20 min, 3 versions)         │
│                              ├─ build-napi ──────────────┐
│                              │ (45 min, 9 platforms)      │
│                              │                            │
│                              ├─ universal-macos ─────────┤
│                              │ (5 min)                    │
│                              │                            │
│                              ├─ test-integration ────────┤
│                              │ (30 min, 4 platforms)      │
│                              │                            │
│                              ├─ benchmark ───────────────┤
│                              │ (main only, 45 min)        │
│                              │                            │
│                              ├─ coverage ────────────────┤
│                              │ (20 min)                   │
│                              │                            │
│                              ├─ summary ─────────────────┤
│                              │ (1 min)                    │
└──────────────────────────────┘
Total: ~50 minutes
```

### Release Workflow (on tag)
```
Tag v1.2.3
    ↓
pre-flight (5 min)
    ↓
build-release (all platforms) (60 min)
    ↓
test-release (30 min, 4 platforms)
    ↓
universal-macos (5 min)
    ↓
package-npm (5 min)
    ↓
publish-npm (10 min)
    ↓
create-github-release (5 min)
    ↓
post-release (5 min)
    ↓
Total: ~60 minutes
npm published ✓
GitHub release created ✓
GitHub Pages updated ✓
```

---

## Performance Metrics

### CI Pipeline
| Component | Time | Parallelism |
|-----------|------|------------|
| Lint | 5 min | 1 |
| Security | 5 min | 1 |
| Rust Tests | 30 min | 3 (OS) |
| Node Tests | 20 min | 3 (versions) |
| NAPI Build | 45 min | 9 (platforms) |
| Integration | 30 min | 4 (platforms) |
| Benchmark | 45 min | 1 |
| Coverage | 20 min | 1 |

**Total Time**: 50 minutes (with parallelization)
**GitHub Minutes**: ~200 per run

### Release Pipeline
| Stage | Time |
|-------|------|
| Pre-flight | 5 min |
| Builds | 60 min |
| Tests | 30 min |
| Packaging | 5 min |
| Publishing | 10 min |
| Release | 5 min |

**Total**: 60 minutes
**GitHub Minutes**: ~260 per release

---

## Troubleshooting

### Build Failures

**Cache Miss Issues**
- Clear cache if: `Cargo.lock` modified, cargo version changes
- Manual cache clear: Settings → Actions → Clear all caches

**Cross-Compilation Errors**
- Verify `cross` is installed: `cargo install cross`
- Check for missing dependencies: See job logs
- Linux ARM64: May need `gcc-aarch64-linux-gnu`

**Platform-Specific Issues**
- macOS: Ensure Xcode tools: `xcode-select --install`
- Windows: Install Visual Studio Build Tools
- Linux: Install development headers: `apt-get install libssl-dev pkg-config`

### Test Failures

**Timeout Issues**
- Increase `timeout-minutes` if builds legitimately take longer
- Check for infinite loops in tests
- Monitor system resources during builds

**Artifact Not Found**
- Verify build succeeded before tests
- Check artifact retention not expired
- Ensure correct artifact name in download

### Security Scan Alerts

**Cargo Audit**
- Run locally: `cargo audit`
- Update dependencies: `cargo update`
- Review RUSTSEC advisories

**npm Audit**
- Run locally: `npm audit`
- Fix automatically: `npm audit fix`
- Review vulnerability details

---

## Cost Optimization

### GitHub Actions Pricing
- **Included**: 2,000 minutes/month per account
- **Rate**: $0.24 per 1,000 additional minutes
- **Estimate**: ~200 minutes per CI run

### Monthly Cost
- **5 commits/day**: 5 × 200 min = 1,000 min (free)
- **20 commits/day**: 20 × 200 min = 4,000 min (~$0.48)
- **1 release/week**: 260 min × 4 = 1,040 min (~$0.25)

### Optimization Tips
1. **Skip docs builds** for non-doc changes: `paths: ignore`
2. **Limit benchmarks** to main branch only
3. **Aggressive caching** for faster builds
4. **Parallel execution** reduces total time
5. **Skip GPU builds** on every push (only on dispatch)

---

## Maintenance

### Weekly Tasks
- Monitor action version updates
- Check for new Rust versions
- Review security scan results

### Monthly Tasks
- Audit CI/CD performance
- Update workflow dependencies
- Review cache effectiveness

### Quarterly Tasks
- Evaluate new GitHub Actions features
- Benchmark against baseline
- Plan platform deprecations

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [napi-rs CLI Guide](https://napi.rs/docs/cli/napi)
- [Rust Platform Support](https://doc.rust-lang.org/nightly/rustc/platform-support.html)
- [NAPI Version Support Matrix](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Cross Compilation Guide](https://rust-lang.github.io/rustup/cross-compilation.html)

---

## Contributing to CI/CD

### Adding New Workflows

1. Create workflow file in `.github/workflows/`
2. Define triggers appropriately
3. Set up caching for performance
4. Test locally with `act` if possible
5. Add documentation
6. Create PR and request review

### Modifying Existing Workflows

1. Update in branch
2. Test changes
3. Verify no regressions
4. Update this guide
5. Merge and monitor first run

---

## Contact & Support

For CI/CD issues or questions:
- Check workflow logs in GitHub Actions tab
- Review this guide for troubleshooting
- Open issue on GitHub repository
- Contact maintainers
