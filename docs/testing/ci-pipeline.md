# QuDAG CI/CD Testing Pipeline Strategy

## Overview
This document outlines the comprehensive CI/CD pipeline for testing QuDAG's N-API integration, covering all test stages, platform support, and quality gates.

## 1. Pipeline Architecture

### 1.1 Complete Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Pull Request / Push                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
    ┌────▼────┐            ┌─────▼──────┐
    │  Format │            │    Lint    │
    │  Check  │            │   Check    │
    └────┬────┘            └─────┬──────┘
         │                       │
         └───────────┬───────────┘
                     │
            ┌────────▼────────┐
            │  Security Scan  │
            └────────┬────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
    ┌────▼────────┐        ┌──────▼──────┐
    │ Unit Tests  │        │  Doc Tests  │
    │  (Multi-OS) │        │             │
    └────┬────────┘        └──────┬──────┘
         │                        │
         └───────────┬────────────┘
                     │
         ┌───────────┴────────────────┐
         │                            │
    ┌────▼──────────┐        ┌───────▼────────┐
    │ Quantum Crypto│        │ DAG Consensus  │
    │   Tests       │        │    Tests       │
    └────┬──────────┘        └───────┬────────┘
         │                           │
         └───────────┬───────────────┘
                     │
    ┌────────────────┴──────────────────┐
    │                                   │
┌───▼──────┐  ┌──────────┐  ┌────────┐ │
│ Network  │  │  Vault   │  │Exchange│ │
│  Tests   │  │  Tests   │  │ Tests  │ │
└───┬──────┘  └──────────┘  └────────┘ │
    │                                   │
    └───────────────┬───────────────────┘
                    │
        ┌───────────┴──────────┐
        │                      │
    ┌───▼──────┐      ┌────────▼────┐
    │  N-API   │      │   WASM      │
    │ Bindings │      │   Build     │
    │  Tests   │      │             │
    └───┬──────┘      └────────┬────┘
        │                      │
        └───────────┬──────────┘
                    │
        ┌───────────┴──────────┐
        │                      │
    ┌───▼──────┐      ┌────────▼────┐
    │TypeScript│      │ Integration │
    │  Tests   │      │   Tests     │
    └───┬──────┘      └────────┬────┘
        │                      │
        └───────────┬──────────┘
                    │
        ┌───────────┴──────────┐
        │                      │
    ┌───▼──────┐      ┌────────▼────┐
    │Benchmarks│      │  Build      │
    │ & Perf   │      │  Artifacts  │
    └───┬──────┘      └────────┬────┘
        │                      │
        └───────────┬──────────┘
                    │
            ┌───────▼────────┐
            │  Code Coverage │
            │   & Reports    │
            └───────┬────────┘
                    │
            ┌───────▼────────┐
            │ Quality Gates  │
            │  & Approval    │
            └────────────────┘
```

## 2. Test Stages

### 2.1 Stage 1: Format & Linting (5 minutes)

```yaml
format-lint:
  stage: format-lint
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable
      with:
        components: rustfmt, clippy

    - name: Check Rust formatting
      run: cargo fmt --all -- --check
      timeout-minutes: 2

    - name: Run Clippy lints
      run: cargo clippy --all-targets --all-features -- -D warnings
      timeout-minutes: 3

    - name: Check TypeScript formatting
      run: npm run format:check
      timeout-minutes: 2

    - name: Run ESLint
      run: npm run lint
      timeout-minutes: 2
```

### 2.2 Stage 2: Security Analysis (10 minutes)

```yaml
security:
  stage: security
  needs: [format-lint]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable

    - name: Run cargo-audit
      run: cargo audit --deny warnings
      timeout-minutes: 3

    - name: Run cargo-deny
      run: cargo deny check
      timeout-minutes: 2

    - name: Run clippy security checks
      run: cargo clippy --all-targets -- -W clippy::security
      timeout-minutes: 3

    - name: Run npm audit
      run: npm audit --production
      timeout-minutes: 2
```

### 2.3 Stage 3: Unit Tests (15 minutes)

```yaml
unit-tests:
  stage: unit-tests
  needs: [format-lint, security]
  runs-on: ${{ matrix.os }}
  strategy:
    fail-fast: false
    matrix:
      os: [ubuntu-latest, macos-latest, windows-latest]
      rust: [stable, nightly]
  steps:
    - uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@master
      with:
        toolchain: ${{ matrix.rust }}

    - name: Cache cargo
      uses: actions/cache@v3
      with:
        path: |
          ~/.cargo/registry
          ~/.cargo/git
          target
        key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

    - name: Run unit tests
      run: |
        cargo test --lib --all-features --workspace
        cargo test --doc --workspace
      timeout-minutes: 15
      env:
        RUST_BACKTRACE: 1
        RUST_MIN_STACK: 8388608

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: unit-test-results-${{ matrix.os }}-${{ matrix.rust }}
        path: target/debug/deps/*.profraw
```

### 2.4 Stage 4: Component-Specific Tests (20 minutes)

```yaml
component-tests:
  stage: component-tests
  needs: [format-lint, security]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable

    - name: Quantum Crypto Tests
      run: |
        cd core/crypto
        cargo test --features "ml-dsa ml-kem hqc" -- --test-threads=1
        cargo test security -- --nocapture
        cargo test timing -- --ignored --nocapture
      timeout-minutes: 10

    - name: DAG Consensus Tests
      run: |
        cd core/dag
        cargo test qr_avalanche -- --nocapture
        cargo test byzantine -- --nocapture
      timeout-minutes: 5

    - name: Network Tests
      run: |
        cd core/network
        cargo test onion_routing -- --nocapture
        cargo test dark_addressing -- --nocapture
        cargo test nat_traversal -- --nocapture
      timeout-minutes: 5

    - name: Vault Tests
      run: |
        cd core/vault
        cargo test vault:: -- --nocapture
      timeout-minutes: 3

    - name: Exchange Tests
      run: |
        cd qudag-exchange
        cargo test exchange:: -- --nocapture
      timeout-minutes: 2
```

### 2.5 Stage 5: N-API & WASM (25 minutes)

```yaml
napi-wasm:
  stage: napi-wasm
  needs: [unit-tests]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: wasm32-unknown-unknown

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install wasm-pack
      run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

    - name: Build WASM for web
      run: |
        cd qudag-wasm
        wasm-pack build --target web --out-dir pkg
      timeout-minutes: 10

    - name: Build WASM for Node.js
      run: |
        cd qudag-wasm
        wasm-pack build --target nodejs --out-dir pkg-nodejs
      timeout-minutes: 10

    - name: Test WASM in Node.js
      run: |
        cd qudag-wasm
        npm install
        npm run test:wasm
      timeout-minutes: 5
```

### 2.6 Stage 6: Integration Tests (30 minutes)

```yaml
integration-tests:
  stage: integration-tests
  needs: [napi-wasm, component-tests]
  runs-on: ${{ matrix.os }}
  strategy:
    fail-fast: false
    matrix:
      os: [ubuntu-latest, macos-latest]
      node-version: ['18', '20', '22']
  steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable

    - name: Run vitest integration tests
      run: npm run test:integration
      timeout-minutes: 20
      env:
        TEST_TIMEOUT: 60000

    - name: Run E2E tests
      run: npm run test:e2e
      timeout-minutes: 10

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: integration-results-${{ matrix.os }}-node-${{ matrix.node-version }}
        path: |
          test-results/
          coverage/
```

### 2.7 Stage 7: MCP Server Tests (10 minutes)

```yaml
mcp-tests:
  stage: mcp-tests
  needs: [unit-tests]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable

    - name: Run MCP server tests
      run: |
        cd qudag-mcp
        cargo test --lib --all-features
        cargo test --doc
      timeout-minutes: 10

    - name: Test MCP integration
      run: |
        cd qudag-mcp
        cargo test --test '*' -- --nocapture
      timeout-minutes: 10
```

### 2.8 Stage 8: Performance & Benchmarks (45 minutes)

```yaml
performance:
  stage: performance
  needs: [unit-tests]
  runs-on: ubuntu-latest
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable

    - name: Cache benchmarks
      uses: actions/cache@v3
      with:
        path: target
        key: ${{ runner.os }}-bench-${{ hashFiles('**/Cargo.lock') }}

    - name: Run quantum crypto benchmarks
      run: |
        cd core/crypto
        cargo bench --bench ml_dsa_performance -- --output-format bencher | tee ml_dsa.txt
        cargo bench --bench ml_kem_benchmarks -- --output-format bencher | tee ml_kem.txt
      timeout-minutes: 20

    - name: Run DAG benchmarks
      run: |
        cd core/dag
        cargo bench --bench consensus_benchmarks -- --output-format bencher | tee consensus.txt
      timeout-minutes: 10

    - name: Run network benchmarks
      run: |
        cd core/network
        cargo bench --bench network_benchmarks -- --output-format bencher | tee network.txt
      timeout-minutes: 10

    - name: Store benchmark results
      uses: benchmark-action/github-action-benchmark@v1
      with:
        tool: 'cargo'
        output-file-path: 'core/crypto/ml_dsa.txt'
        github-token: ${{ secrets.GITHUB_TOKEN }}
        auto-push: true

    - name: Detect regressions
      run: |
        cargo run --bin regression-detector -- \
          --baseline baseline.json \
          --threshold 10 \
          --output regressions.json
      continue-on-error: true

    - name: Comment regression results
      if: always()
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          if (fs.existsSync('regressions.json')) {
            const regressions = JSON.parse(fs.readFileSync('regressions.json'));
            if (regressions.length > 0) {
              let comment = '## Performance Regressions\n\n';
              for (const r of regressions) {
                comment += `- **${r.benchmark}**: ${r.regression_percent.toFixed(1)}% slower\n`;
              }
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            }
          }
```

### 2.9 Stage 9: Code Coverage (15 minutes)

```yaml
coverage:
  stage: coverage
  needs: [unit-tests, integration-tests]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable

    - name: Install tarpaulin
      run: cargo install cargo-tarpaulin

    - name: Generate coverage report
      run: |
        cargo tarpaulin \
          --workspace \
          --all-features \
          --out Xml \
          --output-dir coverage \
          --timeout 300 \
          --exclude-files tests
      timeout-minutes: 15

    - name: Upload to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/cobertura.xml
        flags: unittests
        fail_ci_if_error: true

    - name: Check coverage thresholds
      run: |
        python3 << 'EOF'
        import xml.etree.ElementTree as ET
        tree = ET.parse('coverage/cobertura.xml')
        root = tree.getroot()

        line_rate = float(root.get('line-rate', 0))
        branch_rate = float(root.get('branch-rate', 0))

        print(f"Line coverage: {line_rate*100:.1f}%")
        print(f"Branch coverage: {branch_rate*100:.1f}%")

        if line_rate < 0.85:
            print("ERROR: Line coverage below 85% threshold")
            exit(1)
        if branch_rate < 0.80:
            print("ERROR: Branch coverage below 80% threshold")
            exit(1)
        EOF
```

### 2.10 Stage 10: Build & Artifacts (15 minutes)

```yaml
build:
  stage: build
  needs: [format-lint, unit-tests, coverage]
  runs-on: ${{ matrix.os }}
  strategy:
    matrix:
      include:
        - os: ubuntu-latest
          target: x86_64-unknown-linux-gnu
          artifact: qudag-linux-amd64

        - os: ubuntu-latest
          target: aarch64-unknown-linux-gnu
          use_cross: true
          artifact: qudag-linux-arm64

        - os: macos-latest
          target: x86_64-apple-darwin
          artifact: qudag-macos-amd64

        - os: macos-latest
          target: aarch64-apple-darwin
          artifact: qudag-macos-arm64

        - os: windows-latest
          target: x86_64-pc-windows-msvc
          artifact: qudag-windows-amd64.exe

  steps:
    - uses: actions/checkout@v4

    - name: Install Rust toolchain
      uses: dtolnay/rust-toolchain@stable
      with:
        targets: ${{ matrix.target }}

    - name: Install cross
      if: matrix.use_cross
      run: cargo install cross

    - name: Build release
      run: |
        ${{ matrix.use_cross && 'cross' || 'cargo' }} build \
          --release \
          --target ${{ matrix.target }} \
          --features "cli full"
      timeout-minutes: 30

    - name: Prepare artifacts
      run: |
        mkdir -p artifacts
        cp target/${{ matrix.target }}/release/qudag* artifacts/${{ matrix.artifact }} || true

    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: ${{ matrix.artifact }}
        path: artifacts/
```

## 3. Quality Gates

### 3.1 Required Quality Checks

```yaml
quality-gates:
  name: Quality Gates
  needs: [format-lint, security, unit-tests, coverage, integration-tests]
  runs-on: ubuntu-latest
  if: always()
  steps:
    - name: Check all tests passed
      run: |
        if [ "${{ needs.unit-tests.result }}" != "success" ]; then
          echo "Unit tests failed"
          exit 1
        fi
        if [ "${{ needs.integration-tests.result }}" != "success" ]; then
          echo "Integration tests failed"
          exit 1
        fi

    - name: Check coverage threshold
      run: |
        coverage=$(cat coverage/coverage.txt | grep -oP 'Overall coverage: \K[0-9.]+')
        if (( $(echo "$coverage < 85" | bc -l) )); then
          echo "Coverage below 85% threshold: $coverage%"
          exit 1
        fi

    - name: Check security audit
      run: |
        if [ "${{ needs.security.result }}" != "success" ]; then
          echo "Security audit failed"
          exit 1
        fi

    - name: Approve for merge
      run: echo "All quality gates passed! Ready for merge."
```

## 4. Platform-Specific Considerations

### 4.1 Linux (Ubuntu Latest)
- Primary test platform
- Full feature set testing
- Security audit focus
- Performance baseline

### 4.2 macOS
- Intel and ARM64 targets
- Xcode compilation verification
- Framework compatibility
- Performance comparison

### 4.3 Windows
- MSVC toolchain validation
- Path handling verification
- Native API compatibility
- DLL generation

## 5. Test Timeouts

| Stage | Timeout | Critical |
|-------|---------|----------|
| Format & Lint | 5 min | Yes |
| Security | 10 min | Yes |
| Unit Tests | 20 min | Yes |
| Component Tests | 20 min | Yes |
| N-API & WASM | 25 min | Yes |
| Integration Tests | 30 min | Yes |
| MCP Tests | 10 min | No |
| Performance | 45 min | No |
| Coverage | 15 min | Yes |
| Build | 30 min | No |

## 6. Failure Handling

### 6.1 Automatic Retry
- Unit test failures: Retry 1 time
- Integration test failures: Retry 1 time
- Network timeouts: Retry 2 times
- Resource exhaustion: Retry 1 time

### 6.2 Notification
- Slack notifications on critical failures
- Email on repeated failures
- GitHub issue auto-creation for regressions
- PR comment on test results

### 6.3 Auto-Skip
- Long-running tests skipped on PR (run on main only)
- Memory-intensive tests skipped on macOS/Windows
- Load tests only on schedule

## 7. Caching Strategy

### Cache Keys
```yaml
# Rust cache
- path: ~/.cargo/registry
  key: ${{ runner.os }}-cargo-registry-${{ hashFiles('**/Cargo.lock') }}

# Build cache
- path: target
  key: ${{ runner.os }}-cargo-build-${{ hashFiles('**/Cargo.lock') }}

# WASM cache
- path: qudag-wasm/pkg*
  key: wasm-${{ hashFiles('qudag-wasm/Cargo.toml') }}

# Node modules
- path: node_modules
  key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
```

## 8. Artifact Retention

| Artifact | Retention |
|----------|-----------|
| Test results | 30 days |
| Coverage reports | 90 days |
| Benchmark data | 1 year |
| Build artifacts | 30 days |
| Performance data | 1 year |
| Security reports | 1 year |

## 9. Reporting & Monitoring

### 9.1 Dashboard Metrics
- Overall pass rate
- Test execution times
- Coverage trend
- Performance trend
- Security findings

### 9.2 Weekly Reports
- Test metrics summary
- Coverage analysis
- Performance comparison
- Security status
- Failure analysis

### 9.3 Alerting
- Immediate: Critical test failures
- Daily: Coverage drops > 5%
- Daily: Performance regressions > 20%
- Daily: Security vulnerabilities

## 10. Maintenance & Updates

### Scheduled Updates
- Rust toolchain: Weekly (stable only)
- Dependencies: Bi-weekly
- GitHub Actions: As released
- Node.js versions: Quarterly

### Quarterly Review
- Test relevance assessment
- Timeout optimization
- Performance baseline update
- Coverage target review
- Security advisory updates
