# QuDAG NAPI-RS NPM Package Strategy

## Overview

This document defines the NPM package structure, publishing strategy, and distribution architecture for QuDAG's napi-rs native Node.js bindings. The strategy balances ease of use, platform support, and maintainability.

## Package Architecture Decision: Mono-repo vs Multi-repo

### Chosen Strategy: Mono-repo with Multi-package Distribution

**Rationale:**
- Single source of truth for all platforms
- Unified CI/CD pipeline
- Easier version synchronization
- Simplified dependency management
- Better developer experience

**Structure:**
```
qudag/
├── qudag-napi/                    # Main package workspace
│   ├── package.json               # Main package
│   ├── npm/                       # Platform-specific packages
│   │   ├── linux-x64-gnu/
│   │   ├── linux-arm64-gnu/
│   │   ├── darwin-x64/
│   │   ├── darwin-arm64/
│   │   ├── darwin-universal/
│   │   ├── win32-x64-msvc/
│   │   ├── cuda-linux-x64/
│   │   └── rocm-linux-x64/
│   ├── src/
│   ├── Cargo.toml
│   └── build.rs
```

## NPM Package Ecosystem

### Primary Packages

#### 1. Main Package: `@qudag/napi`

**Purpose:** User-facing package with automatic platform detection

**package.json:**
```json
{
  "name": "@qudag/napi",
  "version": "1.2.3",
  "description": "QuDAG native bindings for Node.js - Quantum-resistant cryptography",
  "main": "index.js",
  "types": "index.d.ts",
  "napi": {
    "name": "qudag",
    "triples": {
      "defaults": true,
      "additional": [
        "aarch64-unknown-linux-gnu",
        "aarch64-apple-darwin",
        "x86_64-unknown-linux-musl"
      ]
    }
  },
  "engines": {
    "node": ">= 16.0.0"
  },
  "os": [
    "darwin",
    "linux",
    "win32"
  ],
  "cpu": [
    "x64",
    "arm64"
  ],
  "keywords": [
    "qudag",
    "quantum",
    "cryptography",
    "napi",
    "rust",
    "ml-dsa",
    "ml-kem",
    "post-quantum"
  ],
  "optionalDependencies": {
    "@qudag/napi-linux-x64-gnu": "1.2.3",
    "@qudag/napi-linux-arm64-gnu": "1.2.3",
    "@qudag/napi-linux-x64-musl": "1.2.3",
    "@qudag/napi-darwin-x64": "1.2.3",
    "@qudag/napi-darwin-arm64": "1.2.3",
    "@qudag/napi-darwin-universal": "1.2.3",
    "@qudag/napi-win32-x64-msvc": "1.2.3",
    "@qudag/napi-cuda": "1.2.3",
    "@qudag/napi-rocm": "1.2.3"
  },
  "scripts": {
    "postinstall": "node scripts/post-install.js"
  }
}
```

**Installation:**
```bash
npm install @qudag/napi
```

**Usage:**
```javascript
const qudag = require('@qudag/napi');
// Automatically loads correct platform binary
```

#### 2. Platform-Specific Packages

**Naming Convention:** `@qudag/napi-<platform>-<arch>-<abi>`

**Examples:**
- `@qudag/napi-linux-x64-gnu`
- `@qudag/napi-darwin-arm64`
- `@qudag/napi-win32-x64-msvc`

**package.json Template:**
```json
{
  "name": "@qudag/napi-linux-x64-gnu",
  "version": "1.2.3",
  "description": "QuDAG native bindings for Linux x64 (glibc)",
  "main": "qudag.linux-x64-gnu.node",
  "os": ["linux"],
  "cpu": ["x64"],
  "libc": ["glibc"],
  "engines": {
    "node": ">= 16.0.0"
  },
  "keywords": [
    "qudag",
    "napi",
    "linux",
    "x64"
  ]
}
```

**Contents:**
```
@qudag/napi-linux-x64-gnu/
├── package.json
├── qudag.linux-x64-gnu.node    # Native binary
├── README.md
└── LICENSE
```

#### 3. GPU Acceleration Packages (Optional)

**Purpose:** GPU-accelerated versions for specific platforms

**Packages:**
- `@qudag/napi-cuda` - NVIDIA CUDA support (Linux, Windows)
- `@qudag/napi-rocm` - AMD ROCm support (Linux)

**package.json:**
```json
{
  "name": "@qudag/napi-cuda",
  "version": "1.2.3",
  "description": "QuDAG with NVIDIA CUDA acceleration",
  "main": "index.js",
  "engines": {
    "node": ">= 16.0.0"
  },
  "peerDependencies": {
    "@qudag/napi": "^1.2.0"
  },
  "optionalDependencies": {
    "@qudag/napi-cuda-linux-x64": "1.2.3",
    "@qudag/napi-cuda-win32-x64": "1.2.3"
  }
}
```

## Platform Detection & Loading

### Load Strategy

**Priority Order:**
1. GPU acceleration (if available and requested)
2. Universal binary (macOS only)
3. Platform-specific binary
4. Fallback to WASM (future)

### Loading Implementation

**index.js:**
```javascript
const { platform, arch } = process;

// Platform mapping
const platformMap = {
  'darwin-x64': '@qudag/napi-darwin-x64',
  'darwin-arm64': '@qudag/napi-darwin-arm64',
  'linux-x64': '@qudag/napi-linux-x64-gnu',
  'linux-arm64': '@qudag/napi-linux-arm64-gnu',
  'win32-x64': '@qudag/napi-win32-x64-msvc'
};

// Detect musl vs glibc on Linux
function detectLinuxLibc() {
  try {
    const ldd = require('child_process')
      .execSync('ldd --version')
      .toString();
    return ldd.includes('musl') ? 'musl' : 'glibc';
  } catch {
    return 'glibc'; // Default to glibc
  }
}

// GPU detection
async function detectGPU() {
  try {
    // Try loading CUDA version
    const cuda = require('@qudag/napi-cuda');
    if (await cuda.detectDevice()) {
      return cuda;
    }
  } catch {}

  try {
    // Try loading ROCm version
    const rocm = require('@qudag/napi-rocm');
    if (await rocm.detectDevice()) {
      return rocm;
    }
  } catch {}

  return null;
}

// Main loader
async function loadNativeBinding() {
  // Try GPU first if requested
  if (process.env.QUDAG_USE_GPU === '1') {
    const gpu = await detectGPU();
    if (gpu) return gpu;
  }

  // Determine platform key
  let platformKey = `${platform}-${arch}`;

  // Special handling for Linux
  if (platform === 'linux') {
    const libc = detectLinuxLibc();
    platformKey = `${platform}-${arch}-${libc === 'musl' ? 'musl' : 'gnu'}`;
  }

  // Try universal binary on macOS
  if (platform === 'darwin') {
    try {
      return require('@qudag/napi-darwin-universal');
    } catch {}
  }

  // Load platform-specific package
  const packageName = platformMap[platformKey];
  if (!packageName) {
    throw new Error(
      `Unsupported platform: ${platform}-${arch}. ` +
      `Please report this issue at https://github.com/ruvnet/QuDAG/issues`
    );
  }

  try {
    return require(packageName);
  } catch (err) {
    throw new Error(
      `Failed to load native binding for ${platformKey}. ` +
      `Error: ${err.message}\n` +
      `This likely means the package is not installed correctly. ` +
      `Try: npm install ${packageName}`
    );
  }
}

// Export as promise
module.exports = loadNativeBinding();

// Also export sync version
module.exports.sync = function loadNativeBindingSync() {
  // Simplified sync version without GPU detection
  const platformKey = `${platform}-${arch}`;
  const packageName = platformMap[platformKey];
  return require(packageName);
};
```

### Error Handling

**Graceful Degradation:**
```javascript
const qudag = await require('@qudag/napi').catch(err => {
  console.warn('Native QuDAG not available, falling back to WASM');
  return require('@qudag/wasm');
});
```

## NPM Workspace Configuration

### Root package.json

```json
{
  "name": "@qudag/napi-workspace",
  "private": true,
  "workspaces": [
    "qudag-napi",
    "qudag-napi/npm/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "publish": "npm run publish --workspaces --if-present"
  },
  "devDependencies": {
    "@napi-rs/cli": "^3.0.0",
    "typescript": "^5.3.0",
    "prettier": "^3.0.0",
    "eslint": "^8.0.0"
  }
}
```

### Workspace Benefits

**Advantages:**
1. **Unified Dependencies:** Shared devDependencies across all packages
2. **Consistent Tooling:** Same build tools for all platforms
3. **Simplified Scripts:** Run commands across all packages
4. **Hoisting:** npm automatically hoists common dependencies

**Workspace Structure:**
```
node_modules/
├── @qudag/napi/                 # Main package
├── @qudag/napi-linux-x64-gnu/   # Symlinked to workspace
├── @qudag/napi-darwin-x64/      # Symlinked to workspace
└── ...
```

## Publishing Strategy

### Automated Publishing via CI/CD

**Workflow:**
1. Tag pushed to GitHub
2. CI builds all platforms
3. Platform binaries packaged individually
4. Main package published with optionalDependencies
5. Platform packages published

### Publishing Order

**Critical Order:**
```
1. Platform packages first (can be parallel)
2. GPU packages (optional)
3. Main package last (depends on platform packages)
```

**Rationale:** Main package lists platform packages as optionalDependencies, so they must exist first.

### Publishing Script

**scripts/publish-all.js:**
```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function publishPackages() {
  const npmDir = path.join(__dirname, '..', 'npm');
  const platforms = fs.readdirSync(npmDir);

  // Step 1: Publish all platform packages in parallel
  console.log('Publishing platform packages...');
  const platformPromises = platforms.map(platform => {
    const pkgDir = path.join(npmDir, platform);
    return new Promise((resolve, reject) => {
      try {
        execSync('npm publish --access public', {
          cwd: pkgDir,
          stdio: 'inherit'
        });
        resolve(platform);
      } catch (err) {
        reject(err);
      }
    });
  });

  await Promise.allSettled(platformPromises);

  // Step 2: Publish GPU packages if present
  const gpuPackages = ['cuda', 'rocm'];
  for (const gpu of gpuPackages) {
    const gpuDir = path.join(__dirname, '..', gpu);
    if (fs.existsSync(gpuDir)) {
      console.log(`Publishing ${gpu} package...`);
      execSync('npm publish --access public', {
        cwd: gpuDir,
        stdio: 'inherit'
      });
    }
  }

  // Step 3: Publish main package
  console.log('Publishing main package...');
  execSync('npm publish --access public', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  console.log('✅ All packages published successfully!');
}

publishPackages().catch(err => {
  console.error('❌ Publishing failed:', err);
  process.exit(1);
});
```

### NPM Distribution Tags

**Tags:**
- `latest` - Current stable release (default)
- `beta` - Beta releases for testing
- `rc` - Release candidates
- `nightly` - Nightly builds
- `next` - Bleeding edge (main branch)
- `legacy-v1` - Old major version for LTS

**Tag Management:**
```bash
# Publish with tag
npm publish --tag beta

# Move tag
npm dist-tag add @qudag/napi@1.2.3 latest

# List tags
npm dist-tag ls @qudag/napi
```

## Pre-built Binary Distribution

### GitHub Releases

**Artifacts:**
```
Release v1.2.3
├── qudag-linux-x64-gnu.tar.gz       (12 MB)
├── qudag-linux-arm64-gnu.tar.gz     (12 MB)
├── qudag-darwin-x64.tar.gz          (10 MB)
├── qudag-darwin-arm64.tar.gz        (10 MB)
├── qudag-darwin-universal.tar.gz    (20 MB)
├── qudag-win32-x64-msvc.zip         (15 MB)
├── qudag-cuda-linux-x64.tar.gz      (25 MB)
├── qudag-rocm-linux-x64.tar.gz      (28 MB)
└── checksums.txt                     (1 KB)
```

**Checksums:**
```
sha256sum *.tar.gz *.zip > checksums.txt
```

### CDN Distribution (Future)

**Strategy:** Host pre-built binaries on CDN for faster installation

**Benefits:**
- Faster downloads (CDN edge servers)
- Reduced npm registry load
- Better for CI/CD pipelines

**Implementation:**
```javascript
// Fallback to CDN download if npm install fails
const version = require('./package.json').version;
const cdnUrl = `https://cdn.qudag.io/napi/${version}/${platform}-${arch}.node`;

async function downloadFromCDN() {
  const response = await fetch(cdnUrl);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync('qudag.node', Buffer.from(buffer));
}
```

## Package Size Optimization

### Size Targets

| Package Type | Uncompressed | Compressed (.tar.gz) |
|-------------|-------------|---------------------|
| Platform binary | 15-20 MB | 5-8 MB |
| GPU binary | 30-35 MB | 10-15 MB |
| Main package | 1 MB | 300 KB |

### Optimization Techniques

#### 1. Binary Stripping

```bash
# Remove debug symbols
strip --strip-debug qudag.node
strip --strip-unneeded qudag.node

# Further optimization
strip -s qudag.node  # Strip all symbols
```

**Size reduction:** ~40-50%

#### 2. Compression

```bash
# Use xz for maximum compression
tar -cJf qudag-linux-x64.tar.xz qudag.linux-x64.node

# Use zstd for fast compression
tar --zstd -cf qudag-linux-x64.tar.zst qudag.linux-x64.node
```

**Comparison:**
- `.tar.gz`: Standard, ~60% compression
- `.tar.xz`: Best compression, ~65% compression, slower
- `.tar.zst`: Fast compression, ~62% compression

#### 3. Link-Time Optimization (LTO)

**Cargo.toml:**
```toml
[profile.release]
lto = "fat"
codegen-units = 1
opt-level = "z"  # Optimize for size
strip = true
```

**Size reduction:** ~20-30%

#### 4. Dead Code Elimination

```toml
[profile.release]
panic = "abort"  # Remove unwinding code
```

### Binary Analysis

**Tools:**
```bash
# Check binary size
ls -lh qudag.node

# Analyze symbols
nm -S qudag.node | head -20

# Check dependencies
ldd qudag.node

# Detailed analysis
cargo bloat --release --target x86_64-unknown-linux-gnu
```

## Version Management Across Packages

### Challenge

Keeping versions synchronized across 10+ packages in mono-repo.

### Solution: Automated Version Sync

**scripts/sync-versions.js:**
```javascript
const fs = require('fs');
const path = require('path');

function syncVersions() {
  // Read main package version
  const mainPkg = require('../package.json');
  const version = mainPkg.version;

  console.log(`Syncing version ${version} across all packages...`);

  // Update Cargo.toml
  const cargoPath = path.join(__dirname, '..', 'Cargo.toml');
  let cargoContent = fs.readFileSync(cargoPath, 'utf8');
  cargoContent = cargoContent.replace(
    /version = ".*"/,
    `version = "${version}"`
  );
  fs.writeFileSync(cargoPath, cargoContent);

  // Update platform packages
  const npmDir = path.join(__dirname, '..', 'npm');
  const platforms = fs.readdirSync(npmDir);

  platforms.forEach(platform => {
    const pkgPath = path.join(npmDir, platform, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = require(pkgPath);
      pkg.version = version;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  ✓ ${platform}`);
    }
  });

  console.log('✅ Version sync complete!');
}

syncVersions();
```

**Usage:**
```bash
npm version minor
npm run sync-versions
git commit -am "chore: bump version to $(node -p "require('./package.json').version")"
```

## Installation Scenarios

### Scenario 1: Standard Installation

```bash
npm install @qudag/napi
```

**What happens:**
1. npm installs main package
2. npm tries to install all optionalDependencies
3. npm installs only the package matching current platform
4. Post-install script verifies installation

**Result:** Only 1 platform binary installed (~5-8 MB)

### Scenario 2: Manual Platform Selection

```bash
npm install @qudag/napi-linux-x64-gnu
```

**What happens:**
1. npm installs only the specific platform package
2. No automatic detection

**Use case:** Docker multi-stage builds, CI/CD

### Scenario 3: GPU Acceleration

```bash
npm install @qudag/napi @qudag/napi-cuda
```

**What happens:**
1. Main package installed
2. CUDA package installed as additional optional dependency
3. Runtime detection chooses CUDA if available

### Scenario 4: Multiple Platforms (Docker Multi-arch)

```bash
npm install @qudag/napi \
  @qudag/napi-linux-x64-gnu \
  @qudag/napi-linux-arm64-gnu
```

**What happens:**
1. All specified platforms installed
2. Runtime detection chooses correct one

**Use case:** Multi-arch Docker images

## Package Security

### Security Features

#### 1. Package Provenance

**npm Provenance:**
```bash
npm publish --provenance
```

**Benefits:**
- Verifiable build attestation
- Links to GitHub Actions build
- Transparency log

#### 2. Package Signing

**GPG Signature:**
```bash
# Sign package
npm pack
gpg --detach-sign qudag-napi-1.2.3.tgz

# Verify
gpg --verify qudag-napi-1.2.3.tgz.sig qudag-napi-1.2.3.tgz
```

#### 3. Checksums

**SHA256 checksums in README:**
```markdown
## Checksums

Linux x64: sha256:a1b2c3...
macOS ARM64: sha256:d4e5f6...
```

**Verification:**
```bash
echo "a1b2c3... qudag.linux-x64-gnu.node" | sha256sum -c
```

#### 4. License Compliance

**Embedded License:**
```
qudag.linux-x64-gnu.node
└── .license
    ├── LICENSE-MIT
    ├── LICENSE-APACHE
    └── THIRD-PARTY-LICENSES
```

### Vulnerability Scanning

**Automated Scanning:**
```yaml
# .github/workflows/security.yml
- name: npm audit
  run: npm audit --audit-level=moderate

- name: Snyk scan
  uses: snyk/actions/node@master
  with:
    command: test
```

## Distribution Metrics

### Package Analytics

**Track:**
- Downloads per platform
- Installation success rate
- Platform distribution
- GPU adoption rate

**Tools:**
```bash
# Check download stats
npm view @qudag/napi --json | jq .downloads

# Platform breakdown
npm view @qudag/napi-linux-x64-gnu --json | jq .downloads
npm view @qudag/napi-darwin-arm64 --json | jq .downloads
```

### Performance Metrics

**Track:**
- Package install time
- Binary load time
- First-run performance
- Memory usage

## Package Maintenance

### Deprecation Policy

**Deprecated Version:**
```bash
npm deprecate @qudag/napi@1.0.0 "Upgrade to 1.2.3 for security fix"
```

**Communication:**
- Deprecation notice in README
- Console warning on install
- GitHub announcement

### EOL (End of Life) Policy

**Version Support:**
- **Current:** 1 year of security updates
- **Previous:** 6 months of security updates
- **Older:** Best-effort community support

**EOL Announcement:**
```markdown
## End of Life Notice

Version 1.0.x will reach end of life on 2025-12-31.

- Security updates until 2025-12-31
- No new features
- Recommend upgrading to 2.x
```

## Future Enhancements

### Short-term (3-6 months)

1. **WASM Fallback:** Compile to WASM for unsupported platforms
2. **CDN Hosting:** Host binaries on CDN for faster installs
3. **Binary Cache:** Local cache for repeated installs

### Long-term (6-12 months)

1. **Deno Support:** Publish to deno.land/x
2. **Bun Support:** Optimize for Bun runtime
3. **Edge Runtime:** Compile for Cloudflare Workers, Vercel Edge

## References

- [npm optionalDependencies](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#optionaldependencies)
- [napi-rs Package Management](https://napi.rs/docs/deep-dive/package)
- [npm Workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements)
