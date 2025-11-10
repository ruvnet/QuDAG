# QuDAG NAPI-RS GitHub Actions Workflow Design

## Overview

This document provides a comprehensive design for GitHub Actions workflows that will build, test, and publish QuDAG's napi-rs native bindings across all supported platforms with optimal CI efficiency.

## Workflow Architecture

### Workflow Files Structure

```
.github/workflows/
├── napi-ci.yml              # Continuous integration (PR checks)
├── napi-release.yml         # Release automation (tags)
├── napi-nightly.yml         # Nightly builds for testing
├── napi-gpu.yml             # GPU-enabled builds (CUDA/ROCm)
└── napi-artifacts.yml       # Reusable artifact management
```

## Primary Workflow: napi-ci.yml

### Purpose

Run on every PR and push to main, ensuring code quality and platform compatibility.

### Workflow Structure

```yaml
name: NAPI-RS CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'qudag-napi/**'
      - 'core/**'
      - '.github/workflows/napi-ci.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'qudag-napi/**'
      - 'core/**'

env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1
  NAPI_VERSION: 3

jobs:
  # Job 1: Lint and Format Checks
  lint:
    name: Lint & Format
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy

      - name: Cache cargo registry
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
          restore-keys: |
            ${{ runner.os }}-cargo-

      - name: Check formatting
        run: cargo fmt --all -- --check

      - name: Run clippy
        run: cargo clippy --all-features -- -D warnings

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd qudag-napi
          npm ci

      - name: Lint TypeScript
        run: |
          cd qudag-napi
          npm run lint

  # Job 2: Security Audit
  security:
    name: Security Audit
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Run cargo-audit
        uses: rustsec/audit-check@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Run npm audit
        run: |
          cd qudag-napi
          npm audit --audit-level=moderate

  # Job 3: Build Matrix for All Platforms
  build:
    name: Build ${{ matrix.settings.target }}
    needs: [lint, security]
    runs-on: ${{ matrix.settings.host }}
    strategy:
      fail-fast: false
      matrix:
        settings:
          # Linux x86_64
          - host: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            build: |
              cargo build --release --target x86_64-unknown-linux-gnu
            artifact_name: linux-x64-gnu

          # Linux aarch64
          - host: ubuntu-22.04
            target: aarch64-unknown-linux-gnu
            build: |
              export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc
              cargo build --release --target aarch64-unknown-linux-gnu
            setup: sudo apt-get update && sudo apt-get install -y gcc-aarch64-linux-gnu
            artifact_name: linux-arm64-gnu

          # Linux musl x86_64
          - host: ubuntu-22.04
            target: x86_64-unknown-linux-musl
            build: cargo build --release --target x86_64-unknown-linux-musl
            setup: sudo apt-get update && sudo apt-get install -y musl-tools
            artifact_name: linux-x64-musl

          # macOS x86_64
          - host: macos-13
            target: x86_64-apple-darwin
            build: cargo build --release --target x86_64-apple-darwin
            artifact_name: darwin-x64

          # macOS aarch64 (M1/M2)
          - host: macos-14
            target: aarch64-apple-darwin
            build: cargo build --release --target aarch64-apple-darwin
            artifact_name: darwin-arm64

          # Windows x86_64
          - host: windows-2022
            target: x86_64-pc-windows-msvc
            build: cargo build --release --target x86_64-pc-windows-msvc
            artifact_name: win32-x64-msvc

    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.settings.target }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install napi-cli
        run: npm install -g @napi-rs/cli

      - name: Setup platform dependencies
        if: matrix.settings.setup
        run: ${{ matrix.settings.setup }}

      - name: Cache cargo build
        uses: actions/cache@v4
        with:
          path: |
            target
            ~/.cargo/registry
            ~/.cargo/git
          key: ${{ matrix.settings.target }}-cargo-${{ hashFiles('**/Cargo.lock') }}
          restore-keys: |
            ${{ matrix.settings.target }}-cargo-

      - name: Build native addon
        run: |
          cd qudag-napi
          ${{ matrix.settings.build }}

      - name: Strip binary (Unix)
        if: matrix.settings.host != 'windows-2022'
        run: |
          cd qudag-napi
          strip target/${{ matrix.settings.target }}/release/*.so 2>/dev/null || \
          strip target/${{ matrix.settings.target }}/release/*.dylib 2>/dev/null || true

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: bindings-${{ matrix.settings.artifact_name }}
          path: qudag-napi/target/${{ matrix.settings.target }}/release/*.{so,dylib,dll,node}
          retention-days: 3

  # Job 4: Test Suite
  test:
    name: Test ${{ matrix.settings.target }}
    needs: build
    runs-on: ${{ matrix.settings.host }}
    strategy:
      fail-fast: false
      matrix:
        settings:
          - host: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            artifact_name: linux-x64-gnu
          - host: macos-13
            target: x86_64-apple-darwin
            artifact_name: darwin-x64
          - host: macos-14
            target: aarch64-apple-darwin
            artifact_name: darwin-arm64
          - host: windows-2022
            target: x86_64-pc-windows-msvc
            artifact_name: win32-x64-msvc

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          name: bindings-${{ matrix.settings.artifact_name }}
          path: qudag-napi/artifacts

      - name: Install dependencies
        run: |
          cd qudag-napi
          npm ci

      - name: Run unit tests
        run: |
          cd qudag-napi
          npm test

      - name: Run integration tests
        run: |
          cd qudag-napi
          npm run test:integration

      - name: Run crypto tests
        run: |
          cd qudag-napi
          npm run test:crypto

  # Job 5: TypeScript Type Checking
  typecheck:
    name: TypeScript Type Check
    needs: build
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Download Linux artifact
        uses: actions/download-artifact@v4
        with:
          name: bindings-linux-x64-gnu
          path: qudag-napi/artifacts

      - name: Install dependencies
        run: |
          cd qudag-napi
          npm ci

      - name: Generate TypeScript definitions
        run: |
          cd qudag-napi
          npm run build:types

      - name: Run TypeScript compiler
        run: |
          cd qudag-napi
          npm run typecheck

  # Job 6: Performance Benchmarks
  benchmark:
    name: Performance Benchmarks
    needs: build
    runs-on: ubuntu-22.04
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Download Linux artifact
        uses: actions/download-artifact@v4
        with:
          name: bindings-linux-x64-gnu
          path: qudag-napi/artifacts

      - name: Install dependencies
        run: |
          cd qudag-napi
          npm ci

      - name: Run benchmarks
        run: |
          cd qudag-napi
          npm run benchmark > benchmark_results.txt

      - name: Store benchmark results
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'benchmarkjs'
          output-file-path: qudag-napi/benchmark_results.txt
          github-token: ${{ secrets.GITHUB_TOKEN }}
          auto-push: true

  # Job 7: Universal macOS Binary
  universal-macos:
    name: Universal macOS Binary
    needs: build
    runs-on: macos-13
    steps:
      - uses: actions/checkout@v4

      - name: Download x64 artifact
        uses: actions/download-artifact@v4
        with:
          name: bindings-darwin-x64
          path: artifacts/x64

      - name: Download arm64 artifact
        uses: actions/download-artifact@v4
        with:
          name: bindings-darwin-arm64
          path: artifacts/arm64

      - name: Create universal binary
        run: |
          mkdir -p artifacts/universal
          lipo -create \
            artifacts/x64/*.node \
            artifacts/arm64/*.node \
            -output artifacts/universal/qudag.darwin-universal.node

      - name: Upload universal artifact
        uses: actions/upload-artifact@v4
        with:
          name: bindings-darwin-universal
          path: artifacts/universal/*.node
          retention-days: 3
```

## Release Workflow: napi-release.yml

### Purpose

Triggered on git tags (e.g., `v1.2.3`), builds all platforms and publishes to npm.

### Workflow Structure

```yaml
name: NAPI-RS Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., 1.2.3)'
        required: true
        type: string

env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1

permissions:
  contents: write
  packages: write

jobs:
  # Job 1: Create GitHub Release
  create-release:
    name: Create GitHub Release
    runs-on: ubuntu-22.04
    outputs:
      upload_url: ${{ steps.create_release.outputs.upload_url }}
      version: ${{ steps.version.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Extract version
        id: version
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            VERSION="${{ inputs.version }}"
          else
            VERSION="${GITHUB_REF#refs/tags/v}"
          fi
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Generate changelog
        id: changelog
        run: |
          # Extract changelog for this version
          awk '/^## \['"${{ steps.version.outputs.version }}"'\]/,/^## \[/{print}' CHANGELOG.md | head -n -1 > RELEASE_CHANGELOG.md

      - name: Create Release
        id: create_release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ steps.version.outputs.version }}
          release_name: QuDAG NAPI v${{ steps.version.outputs.version }}
          body_path: RELEASE_CHANGELOG.md
          draft: true
          prerelease: ${{ contains(steps.version.outputs.version, '-') }}

  # Job 2: Build all platforms
  build-release:
    name: Build ${{ matrix.settings.target }}
    needs: create-release
    runs-on: ${{ matrix.settings.host }}
    strategy:
      fail-fast: false
      matrix:
        settings:
          # ... (same matrix as CI workflow)

    steps:
      # ... (same build steps as CI workflow)

      - name: Package for npm
        run: |
          cd qudag-napi
          napi build --release --target ${{ matrix.settings.target }} --strip

      - name: Upload to GitHub Release
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ needs.create-release.outputs.upload_url }}
          asset_path: qudag-napi/${{ matrix.settings.artifact_name }}.node
          asset_name: qudag.${{ matrix.settings.artifact_name }}.node
          asset_content_type: application/octet-stream

  # Job 3: Publish to npm
  publish-npm:
    name: Publish to npm
    needs: [create-release, build-release]
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: qudag-napi/npm

      - name: Update version
        run: |
          cd qudag-napi
          npm version ${{ needs.create-release.outputs.version }} --no-git-tag-version

      - name: Publish main package
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          cd qudag-napi
          npm publish --access public

      - name: Publish platform packages
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          cd qudag-napi
          node scripts/publish-platform-packages.js

  # Job 4: Finalize Release
  finalize:
    name: Finalize Release
    needs: [create-release, build-release, publish-npm]
    runs-on: ubuntu-22.04
    steps:
      - name: Publish GitHub Release
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            github.rest.repos.updateRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              release_id: ${{ needs.create-release.outputs.release_id }},
              draft: false
            })
```

## GPU Builds Workflow: napi-gpu.yml

### Purpose

Build GPU-accelerated versions (CUDA/ROCm) on specialized hardware.

### Workflow Structure

```yaml
name: NAPI-RS GPU Builds

on:
  push:
    branches: [main]
    paths:
      - 'qudag-napi/**'
      - 'core/crypto/**'
  workflow_dispatch:

jobs:
  # Job 1: CUDA Build
  build-cuda:
    name: Build CUDA ${{ matrix.cuda_version }}
    runs-on: ubuntu-22.04
    container:
      image: nvidia/cuda:${{ matrix.cuda_version }}-devel-ubuntu22.04
    strategy:
      matrix:
        cuda_version: ['12.3.0']
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        run: |
          curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
          echo "$HOME/.cargo/bin" >> $GITHUB_PATH

      - name: Install Node.js
        run: |
          curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
          apt-get install -y nodejs

      - name: Build with CUDA
        run: |
          cd qudag-napi
          cargo build --release --features cuda

      - name: Package CUDA addon
        run: |
          cd qudag-napi
          npm install -g @napi-rs/cli
          napi build --release --features cuda

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: bindings-linux-x64-cuda
          path: qudag-napi/*.node

  # Job 2: ROCm Build
  build-rocm:
    name: Build ROCm
    runs-on: self-hosted # Requires AMD GPU
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Build with ROCm
        env:
          ROCM_PATH: /opt/rocm
        run: |
          cd qudag-napi
          cargo build --release --features rocm

      - name: Package ROCm addon
        run: |
          cd qudag-napi
          napi build --release --features rocm

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: bindings-linux-x64-rocm
          path: qudag-napi/*.node

  # Job 3: Test GPU Builds
  test-gpu:
    name: Test GPU ${{ matrix.backend }}
    needs: [build-cuda, build-rocm]
    runs-on: self-hosted
    strategy:
      matrix:
        backend: [cuda, rocm]
    steps:
      - uses: actions/checkout@v4

      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: bindings-linux-x64-${{ matrix.backend }}

      - name: Run GPU tests
        run: |
          cd qudag-napi
          npm ci
          npm run test:gpu:${{ matrix.backend }}
```

## Nightly Builds Workflow: napi-nightly.yml

### Purpose

Build nightly versions for early testing with latest dependencies.

```yaml
name: NAPI-RS Nightly

on:
  schedule:
    - cron: '0 2 * * *' # 2 AM UTC daily
  workflow_dispatch:

jobs:
  nightly-build:
    name: Nightly Build
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Update Cargo.lock
        run: cargo update

      - name: Build and test
        run: |
          cd qudag-napi
          cargo build --release
          cargo test

      - name: Publish nightly tag
        if: success()
        run: |
          cd qudag-napi
          npm version prerelease --preid=nightly.$(date +%Y%m%d) --no-git-tag-version
          npm publish --tag nightly
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Optimization Strategies

### Caching Strategy

**Three-tier caching approach:**

1. **Cargo Registry Cache:** Cache `~/.cargo/registry` and `~/.cargo/git`
2. **Build Cache:** Cache `target/` directory per platform
3. **npm Cache:** Cache `node_modules` per platform

**Cache Keys:**
```yaml
key: ${{ runner.os }}-${{ matrix.target }}-cargo-${{ hashFiles('**/Cargo.lock') }}
restore-keys: |
  ${{ runner.os }}-${{ matrix.target }}-cargo-
  ${{ runner.os }}-cargo-
```

### Artifact Management

**Naming Convention:**
```
qudag.<platform>-<arch>-<abi>.node

Examples:
- qudag.linux-x64-gnu.node
- qudag.darwin-arm64.node
- qudag.win32-x64-msvc.node
```

**Compression:**
- Use `tar.gz` for Unix platforms
- Use `zip` for Windows
- Strip debug symbols before archiving

### Parallel Execution

**Job Dependencies:**
```
lint, security → build → test → publish
                    ↓
              universal-macos
```

- Lint and security run in parallel
- All builds run in parallel after checks pass
- Tests run after builds complete
- Universal macOS binary created after both macOS builds

### Resource Limits

**Per-job limits:**
```yaml
timeout-minutes: 30
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}-${{ matrix.target }}
  cancel-in-progress: true
```

## Environment Variables

### Required Secrets

```yaml
secrets:
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}              # npm publishing
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}        # GitHub releases
  APPLE_DEVELOPER_ID: ${{ secrets.APPLE_DEVELOPER_ID }}  # macOS signing
  CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}      # Code coverage
```

### Build Environment

```yaml
env:
  CARGO_TERM_COLOR: always
  RUST_BACKTRACE: 1
  CARGO_INCREMENTAL: 0           # Disable incremental compilation in CI
  CARGO_PROFILE_RELEASE_LTO: fat # Enable LTO for release builds
  RUSTFLAGS: -D warnings         # Treat warnings as errors
```

## Pre-release Testing Gates

### Automated Gates

1. **All tests pass** on Tier 1 platforms
2. **Code coverage** ≥ 80%
3. **No security vulnerabilities** in dependencies
4. **Benchmark regression** < 5% slower than previous
5. **Binary size** < 20 MB per platform

### Manual Gates (Release Only)

1. **Smoke testing** on 3 major platforms
2. **Documentation review**
3. **Changelog review**
4. **Version number validation**

## Monitoring & Alerting

### Metrics to Track

- **Build Success Rate:** Target >95%
- **Build Duration:** Monitor for regressions
- **Artifact Size:** Track binary size growth
- **Cache Hit Rate:** Optimize for >80%

### Alerts

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'NAPI-RS build failed on ${{ matrix.target }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Cost Optimization

### GitHub Actions Minutes

**Current usage estimates:**
- CI per commit: ~200 minutes
- Release: ~350 minutes
- Nightly: ~150 minutes

**Monthly estimate:** ~15,000 minutes (~$75 at GitHub pricing)

### Optimization Strategies

1. **Skip builds** for documentation-only changes
2. **Cancel redundant builds** on new pushes
3. **Use cache** aggressively
4. **Limit nightly** to main branch only

## References

- [napi-rs CLI Documentation](https://napi.rs/docs/cli/napi)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cross-compilation Guide](https://napi.rs/docs/cross-build)
