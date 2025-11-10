# QuDAG NAPI-RS Release Process & Versioning

## Overview

This document defines the complete release process, versioning strategy, and automation for QuDAG's napi-rs native Node.js bindings. The process is designed to ensure reliable, reproducible releases with minimal manual intervention.

## Versioning Strategy

### Semantic Versioning (SemVer)

QuDAG napi bindings follow **strict Semantic Versioning 2.0.0**:

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]

Examples:
- 1.0.0         # Stable release
- 1.2.3         # Patch release
- 2.0.0-beta.1  # Pre-release
- 1.5.0+cuda    # Build metadata
```

### Version Components

#### MAJOR Version

Increment when making **incompatible API changes**:

- Breaking changes to public API
- Removal of deprecated features
- Major architectural changes
- Incompatible data format changes

**Examples:**
- `v1.x.x → v2.0.0`: Change from callbacks to Promises
- `v2.x.x → v3.0.0`: Remove deprecated crypto algorithms

#### MINOR Version

Increment when adding **backwards-compatible functionality**:

- New public APIs
- New optional features
- Performance improvements
- Non-breaking enhancements

**Examples:**
- `v1.0.x → v1.1.0`: Add new quantum signature algorithm
- `v1.5.x → v1.6.0`: Add GPU acceleration support

#### PATCH Version

Increment for **backwards-compatible bug fixes**:

- Security patches
- Bug fixes
- Documentation updates
- Internal refactoring

**Examples:**
- `v1.2.3 → v1.2.4`: Fix memory leak
- `v2.0.1 → v2.0.2`: Security vulnerability patch

### Pre-release Versions

Pre-release identifiers follow this hierarchy:

```
alpha < beta < rc (release candidate)
```

**Format:**
```
1.2.0-alpha.1    # Early testing
1.2.0-beta.1     # Feature-complete, testing
1.2.0-rc.1       # Release candidate
1.2.0            # Stable release
```

**Promotion Path:**
```
alpha.1 → alpha.2 → ... → beta.1 → beta.2 → ... → rc.1 → rc.2 → stable
```

### Build Metadata

Build metadata provides additional context without affecting version precedence:

```
1.2.0+20250110       # Build date
1.2.0+cuda12.3       # CUDA version
1.2.0+linux.arm64    # Platform info
```

## Version Synchronization

### Package Version Management

QuDAG napi uses a **hybrid versioning strategy**:

#### Main Package (Independent)

```json
{
  "name": "@qudag/napi",
  "version": "1.2.3"
}
```

**Source of Truth:** `qudag-napi/package.json`

#### Platform Packages (Synchronized)

```json
{
  "name": "@qudag/napi-linux-x64-gnu",
  "version": "1.2.3"
}
```

**Auto-generated:** Version synced from main package during build

#### Rust Crate (Aligned)

```toml
[package]
name = "qudag-napi"
version = "1.2.3"
```

**Source of Truth:** `qudag-napi/Cargo.toml`

### Version Update Workflow

```bash
# 1. Update main package.json
cd qudag-napi
npm version minor  # or major, patch

# 2. Sync to Cargo.toml (automated via script)
node scripts/sync-version.js

# 3. Update CHANGELOG.md
# (automated via conventional-changelog)

# 4. Commit and tag
git add .
git commit -m "chore(release): v1.3.0"
git tag v1.3.0
git push --follow-tags
```

## Release Types

### 1. Stable Release

**Trigger:** Git tag matching `v*` (e.g., `v1.2.3`)

**Process:**
1. Create GitHub Release
2. Build all platforms
3. Publish to npm with `latest` tag
4. Update documentation
5. Create release notes

**Schedule:** As needed, typically bi-weekly

**Example:**
```bash
git tag v1.2.3
git push origin v1.2.3
```

### 2. Pre-release (Beta/RC)

**Trigger:** Git tag matching `v*-beta.*` or `v*-rc.*`

**Process:**
1. Create GitHub Pre-release
2. Build all platforms
3. Publish to npm with `beta` or `rc` tag
4. Notify early adopters

**Schedule:** Weekly during development cycle

**Example:**
```bash
git tag v1.3.0-beta.1
git push origin v1.3.0-beta.1
```

### 3. Nightly Release

**Trigger:** Daily cron schedule (2 AM UTC)

**Process:**
1. Build latest main branch
2. Publish to npm with `nightly` tag
3. No GitHub release created

**Schedule:** Daily at 2 AM UTC

**Version Format:** `1.3.0-nightly.20250110`

### 4. Hotfix Release

**Trigger:** Critical bug or security vulnerability

**Process:**
1. Create hotfix branch from tag
2. Apply fix
3. Fast-track through CI
4. Emergency release (skip some gates)

**Example:**
```bash
git checkout -b hotfix/1.2.4 v1.2.3
# Apply fix
git tag v1.2.4
git push origin v1.2.4
```

## Automated Release Pipeline

### Stage 1: Pre-flight Checks (5 minutes)

**Automated Checks:**

```yaml
- Code formatting (rustfmt, prettier)
- Linting (clippy, eslint)
- Security audit (cargo-audit, npm-audit)
- License compliance
- Version consistency
```

**Gate:** All checks must pass

### Stage 2: Build Matrix (20-30 minutes)

**Parallel Builds:**

```yaml
- Linux x64 (glibc)
- Linux x64 (musl)
- Linux ARM64 (glibc)
- macOS x64
- macOS ARM64
- Windows x64
- Windows ARM64 (optional)
```

**Output:** Binary artifacts for each platform

**Gate:** All Tier 1 platforms must build successfully

### Stage 3: Testing (10-15 minutes)

**Test Suite:**

```yaml
Unit Tests:
  - Rust unit tests (all platforms)
  - TypeScript unit tests

Integration Tests:
  - Node.js integration (Tier 1 platforms)
  - Real-world usage scenarios

Crypto Tests:
  - ML-DSA signature verification
  - ML-KEM key encapsulation
  - Quantum fingerprinting

Performance Tests:
  - Benchmark against baseline
  - Memory usage validation
  - Ensure no >5% regression
```

**Gate:** All tests pass with <5% performance regression

### Stage 4: Packaging (5 minutes)

**Actions:**

```yaml
1. Generate TypeScript definitions
2. Create platform-specific packages
3. Bundle documentation
4. Create checksums (SHA256)
5. Sign binaries (macOS, Windows)
```

**Output:** npm packages for all platforms

### Stage 5: Publishing (5-10 minutes)

**npm Publishing:**

```yaml
1. Publish main package: @qudag/napi
2. Publish platform packages:
   - @qudag/napi-linux-x64-gnu
   - @qudag/napi-linux-arm64-gnu
   - @qudag/napi-darwin-x64
   - @qudag/napi-darwin-arm64
   - @qudag/napi-darwin-universal
   - @qudag/napi-win32-x64-msvc
3. Publish optional packages:
   - @qudag/napi-cuda (Linux, Windows)
   - @qudag/napi-rocm (Linux)
```

**Distribution Tags:**

- `latest`: Stable releases
- `beta`: Beta releases
- `rc`: Release candidates
- `nightly`: Nightly builds
- `next`: Bleeding edge (main branch)

### Stage 6: GitHub Release (2 minutes)

**Actions:**

```yaml
1. Create GitHub Release
2. Upload binary artifacts
3. Generate release notes
4. Link to npm packages
5. Update documentation
```

### Stage 7: Post-release (5 minutes)

**Actions:**

```yaml
1. Update documentation site
2. Send notifications (Slack, Discord)
3. Update shields.io badges
4. Tweet announcement (optional)
5. Create GitHub discussion thread
```

**Total Pipeline Duration:** ~45-60 minutes

## Version Bump Automation

### Conventional Commits

QuDAG uses **Conventional Commits** for automated version bumping:

```
<type>(<scope>): <subject>

feat: Add GPU acceleration support       # → MINOR
fix: Resolve memory leak in crypto      # → PATCH
feat!: Remove deprecated API            # → MAJOR
perf: Optimize signature verification   # → PATCH
```

### Commit Types

| Type | Version Impact | Description |
|------|---------------|-------------|
| `feat` | MINOR | New feature |
| `fix` | PATCH | Bug fix |
| `perf` | PATCH | Performance improvement |
| `docs` | None | Documentation only |
| `style` | None | Code style changes |
| `refactor` | PATCH | Code refactoring |
| `test` | None | Test additions |
| `chore` | None | Build/tooling changes |
| `BREAKING CHANGE` | MAJOR | Breaking change (footer) |

### Auto-versioning Script

**Tool:** `semantic-release` or custom script

```javascript
// scripts/bump-version.js
const { execSync } = require('child_process');
const semver = require('semver');

function analyzeCommits(lastTag) {
  const commits = execSync(
    `git log ${lastTag}..HEAD --format=%s`
  ).toString().split('\n');

  let hasBreaking = false;
  let hasFeature = false;
  let hasFix = false;

  commits.forEach(commit => {
    if (commit.includes('BREAKING CHANGE') || commit.includes('!:')) {
      hasBreaking = true;
    } else if (commit.startsWith('feat')) {
      hasFeature = true;
    } else if (commit.startsWith('fix') || commit.startsWith('perf')) {
      hasFix = true;
    }
  });

  if (hasBreaking) return 'major';
  if (hasFeature) return 'minor';
  if (hasFix) return 'patch';
  return null;
}

// Usage in CI
const lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
const bumpType = analyzeCommits(lastTag);
if (bumpType) {
  execSync(`npm version ${bumpType} --no-git-tag-version`);
}
```

## Changelog Management

### Auto-generated Changelog

**Tool:** `conventional-changelog`

```bash
# Generate changelog for current version
npx conventional-changelog -p angular -i CHANGELOG.md -s

# Preview without writing
npx conventional-changelog -p angular -u
```

### Changelog Format

```markdown
# Changelog

All notable changes to QuDAG NAPI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-01-15

### Added
- GPU acceleration support for quantum cryptography (CUDA, ROCm)
- New `async` API for signature verification
- TypeScript definitions for all exported functions

### Changed
- Improved performance of ML-DSA signatures by 15%
- Updated to Rust 1.75 for better optimization

### Fixed
- Memory leak in key generation (#123)
- Race condition in async operations (#145)

### Security
- Patched timing attack vulnerability in fingerprint verification (CVE-2025-XXXX)

### Deprecated
- `syncSign()` method (use `sign()` instead)

## [1.2.4] - 2025-01-10

### Fixed
- Critical security fix for timing attack

...
```

## Dependency Management

### Rust Dependencies

**Strategy:** Conservative updates with security priority

```toml
[dependencies]
# Core dependencies - pin major versions
qudag-crypto = "0.4"
qudag-dag = "0.4"
napi = "2"

# Security-critical - exact versions
ml-dsa = "=0.5.2"
ml-kem = "=0.2.1"

[dev-dependencies]
# Dev dependencies - allow minor updates
criterion = "0.5"
```

**Update Cadence:**
- Security updates: Immediate
- Minor updates: Monthly
- Major updates: Quarterly (with thorough testing)

### npm Dependencies

**Strategy:** Regular updates with automated testing

```json
{
  "dependencies": {
    "napi": "^2.0.0"
  },
  "devDependencies": {
    "@napi-rs/cli": "^3.0.0",
    "typescript": "^5.3.0"
  }
}
```

**Update Workflow:**

```bash
# Weekly automated check
npm outdated
npx npm-check-updates -u

# Run tests
npm test

# If tests pass, create PR
git checkout -b chore/update-deps
git commit -m "chore: update npm dependencies"
```

## Release Checklist

### Pre-release Checklist

**1 Week Before:**
- [ ] Code freeze for release branch
- [ ] All planned features merged
- [ ] Documentation updated
- [ ] Beta version published
- [ ] Community testing started

**3 Days Before:**
- [ ] All tests passing
- [ ] Performance benchmarks reviewed
- [ ] Security audit completed
- [ ] RC version published
- [ ] Release notes drafted

**1 Day Before:**
- [ ] Smoke testing on all platforms
- [ ] Verify upgrade path from previous version
- [ ] Notify early adopters
- [ ] Prepare social media posts

### Release Day Checklist

**Before Tagging:**
- [ ] Verify version numbers in all files
- [ ] Ensure CHANGELOG.md is updated
- [ ] All CI checks green on main branch
- [ ] No open P0/P1 bugs

**Tagging:**
- [ ] Create git tag with correct version
- [ ] Push tag to trigger CI

**During CI:**
- [ ] Monitor CI progress
- [ ] Watch for any failures
- [ ] Be ready to rollback if needed

**After Publishing:**
- [ ] Verify packages on npm
- [ ] Test installation: `npm install @qudag/napi`
- [ ] Verify GitHub release created
- [ ] Check documentation updated

**Post-release:**
- [ ] Send release announcement
- [ ] Update project website
- [ ] Close milestone in GitHub
- [ ] Create next milestone

### Rollback Procedure

If critical issues are discovered post-release:

**Step 1: Assess Impact**
```bash
# Check how many downloads
npm view @qudag/napi@1.3.0 --json | jq .downloads
```

**Step 2: Deprecate Broken Version**
```bash
npm deprecate @qudag/napi@1.3.0 "Critical bug, use 1.2.4 instead"
```

**Step 3: Re-tag Latest**
```bash
npm dist-tag add @qudag/napi@1.2.4 latest
```

**Step 4: Hotfix Release**
```bash
git checkout -b hotfix/1.3.1 v1.3.0
# Apply fix
git tag v1.3.1
git push origin v1.3.1
```

## Version Compatibility Matrix

### Node.js Compatibility

| NAPI Version | Node.js Versions | Support Status |
|-------------|------------------|----------------|
| **1.x** | 14.x, 16.x, 18.x | Maintenance |
| **2.x** | 16.x, 18.x, 20.x | Active |
| **3.x** | 18.x, 20.x, 22.x | Planning |

### QuDAG Core Compatibility

| NAPI Version | QuDAG Core | Notes |
|-------------|-----------|-------|
| **1.x** | 0.4.x | Initial release |
| **2.x** | 0.4.x, 0.5.x | Compatible |
| **3.x** | 0.5.x+ | Breaking changes |

### Platform Compatibility

| Platform | Minimum Version | Notes |
|----------|----------------|-------|
| **Linux (glibc)** | 2.17+ | Ubuntu 14.04+ |
| **Linux (musl)** | 1.2.0+ | Alpine 3.12+ |
| **macOS** | 10.13+ | High Sierra |
| **Windows** | 10+ | Server 2016+ |

## Release Metrics

### Key Performance Indicators (KPIs)

**Release Velocity:**
- Target: 1 stable release every 2 weeks
- Current: TBD

**Release Reliability:**
- Target: <5% rollback rate
- Target: Zero security regressions

**Build Success Rate:**
- Target: >95% on first attempt
- Target: <10 minute recovery time

**Time to Release:**
- Target: <60 minutes from tag to npm
- Target: <2 hours from detection to hotfix

### Monitoring

**Automated Alerts:**
```yaml
- Release pipeline failure
- npm publish failure
- Download count anomalies
- Security vulnerabilities
- Breaking API changes detected
```

**Weekly Review:**
- Number of releases
- Issues found post-release
- Average time to release
- Platform success rates

## Documentation Requirements

### Version-Specific Documentation

Each release must include:

1. **CHANGELOG.md** - Detailed change log
2. **UPGRADING.md** - Migration guide for breaking changes
3. **API.md** - Complete API reference
4. **COMPATIBILITY.md** - Platform/version compatibility
5. **SECURITY.md** - Security disclosures and CVEs

### Documentation Versioning

Documentation is versioned alongside code:

```
docs/
├── v1.0/
│   ├── api.md
│   ├── guide.md
│   └── examples/
├── v2.0/
│   ├── api.md
│   ├── guide.md
│   └── examples/
└── latest/ → symlink to latest version
```

## Emergency Release Process

### Security Vulnerability

**Timeline: 0-24 hours**

```
Hour 0: Vulnerability reported
Hour 1: Severity assessment
Hour 2: Patch development started
Hour 4: Patch completed, PR opened
Hour 6: Expedited review
Hour 8: Patch merged
Hour 9: Hotfix release v1.2.5
Hour 10: Security advisory published
Hour 12: Notify users
Hour 24: Follow-up communication
```

**Notification Channels:**
- GitHub Security Advisory
- npm security advisory
- Project mailing list
- Social media
- Direct email to known affected users

### Critical Bug

**Timeline: 0-48 hours**

```
Hour 0: Bug reported
Hour 2: Bug confirmed and reproduced
Hour 6: Fix developed
Hour 12: Testing completed
Hour 24: Hotfix released
Hour 48: Post-mortem published
```

## References

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [npm Distribution Tags](https://docs.npmjs.com/cli/v10/commands/npm-dist-tag)
- [napi-rs Release Guide](https://napi.rs/docs/deep-dive/release)
