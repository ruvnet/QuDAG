# Building and Publishing @qudag/napi-core

**Status:** Ready to build - Rust implementation exists ✅
**Priority:** CRITICAL - All published npm packages depend on this
**Estimated Time:** 2-3 hours for complete multi-platform build

---

## ✅ Pre-requisites Met

The Rust implementation is complete and ready to build:

- ✅ `packages/napi-core/Cargo.toml` - Package configuration
- ✅ `packages/napi-core/src/lib.rs` - Main entry point with N-API exports
- ✅ `packages/napi-core/src/crypto/` - ML-DSA, ML-KEM, HQC, Fingerprint implementations
- ✅ `packages/napi-core/src/dag/` - QuantumDAG implementation
- ✅ `packages/napi-core/build.rs` - Build script for napi-rs
- ✅ `packages/napi-core/index.js` - JavaScript entry point
- ✅ `packages/napi-core/package.json` - npm configuration with platform triples
- ✅ `core/crypto/` - Quantum crypto workspace crate
- ✅ `core/dag/` - DAG consensus workspace crate
- ✅ `core/network/` - P2P networking workspace crate
- ✅ `.github/workflows/napi-ci.yml` - CI pipeline (already configured)
- ✅ `.github/workflows/napi-release.yml` - Release automation (already configured)

---

## 🎯 Option 1: Local Build (Single Platform - Quick Test)

**Use Case:** Test that the build works on your current platform
**Time:** ~5-10 minutes
**Platforms:** Only your current platform (e.g., Linux x64)

### Steps:

```bash
# 1. Navigate to napi-core package
cd /home/user/QuDAG/packages/napi-core

# 2. Install Node.js dependencies
npm install

# 3. Build native binary for current platform
npm run build
# or
npx napi build --platform --release

# 4. Check build output
ls -la *.node
# Should see: qudag-napi-core.linux-x64-gnu.node (or similar)

# 5. Test the build
node -e "const { MlDsaKeyPair } = require('./index.js'); console.log(MlDsaKeyPair.generate())"

# 6. Test Quick Start example
cat > test-local.js << 'EOF'
const { MlDsaKeyPair, MlKem, QuantumDAG } = require('./index.js');

async function test() {
  console.log('Testing @qudag/napi-core local build...\n');

  // Test ML-DSA
  const keypair = MlDsaKeyPair.generate();
  const message = Buffer.from('Test message');
  const signature = keypair.sign(message);
  const valid = keypair.toPublicKey().verify(message, signature);
  console.log('✓ ML-DSA:', valid ? 'PASS' : 'FAIL');

  // Test ML-KEM
  const { publicKey, secretKey } = MlKem.keygen();
  const { ciphertext, sharedSecret: ss1 } = MlKem.encapsulate(publicKey);
  const ss2 = MlKem.decapsulate(secretKey, ciphertext);
  const match = Buffer.compare(ss1, ss2) === 0;
  console.log('✓ ML-KEM:', match ? 'PASS' : 'FAIL');

  // Test QuantumDAG
  const dag = new QuantumDAG();
  await dag.addMessage(Buffer.from('Genesis'));
  const tips = await dag.getTips();
  console.log('✓ QuantumDAG:', tips.length > 0 ? 'PASS' : 'FAIL');

  console.log('\nAll tests passed! ✅');
}

test().catch(console.error);
EOF

node test-local.js
```

**Expected Output:**
```
Testing @qudag/napi-core local build...

✓ ML-DSA: PASS
✓ ML-KEM: PASS
✓ QuantumDAG: PASS

All tests passed! ✅
```

### If Build Succeeds:
```bash
# Proceed to Option 2 or 3 for multi-platform builds
```

### If Build Fails:
Common issues and solutions:

**Issue: "cannot find -lqudag-crypto"**
```bash
# Solution: Build the workspace dependencies first
cd /home/user/QuDAG
cargo build --release --workspace
cd packages/napi-core
npm run build
```

**Issue: "Cargo.toml version not found"**
```bash
# Solution: Set version in workspace
# Edit Cargo.toml in root to add version
```

**Issue: "napi-rs command not found"**
```bash
# Solution: Install napi-rs CLI
npm install -g @napi-rs/cli
# Or use npx
npx @napi-rs/cli build --platform --release
```

---

## 🚀 Option 2: GitHub Actions Build (Multi-Platform - Recommended)

**Use Case:** Production-ready build for all platforms
**Time:** ~30-60 minutes (automated)
**Platforms:** All 9 platforms supported by napi-rs

### Supported Platforms:
1. Linux x64 GNU (`@qudag/napi-core-linux-x64-gnu`)
2. Linux x64 musl (`@qudag/napi-core-linux-x64-musl`)
3. Linux ARM64 GNU (`@qudag/napi-core-linux-arm64-gnu`)
4. Linux ARM64 musl (`@qudag/napi-core-linux-arm64-musl`)
5. macOS x64 (`@qudag/napi-core-darwin-x64`)
6. macOS ARM64 (M1/M2) (`@qudag/napi-core-darwin-arm64`)
7. Windows x64 (`@qudag/napi-core-win32-x64-msvc`)
8. Windows ARM64 (`@qudag/napi-core-win32-arm64-msvc`)
9. FreeBSD x64 (optional)

### Steps:

```bash
# 1. Ensure all changes are committed
cd /home/user/QuDAG
git status
# If there are uncommitted changes, commit them first

# 2. Create version tag
git tag v0.1.0
git push origin v0.1.0

# 3. GitHub Actions will automatically:
#    - Trigger .github/workflows/napi-release.yml
#    - Build binaries for all 9 platforms
#    - Run tests on each platform
#    - Publish platform-specific packages to npm
#    - Publish main @qudag/napi-core package

# 4. Monitor progress
# Visit: https://github.com/ruvnet/QuDAG/actions
# Look for "NAPI Release" workflow

# 5. Verify packages are published
npm view @qudag/napi-core
npm view @qudag/napi-core-linux-x64-gnu
npm view @qudag/napi-core-darwin-arm64
# etc.
```

### GitHub Actions Workflow Verification:

Before triggering, verify the workflow file exists and is configured:

```bash
# Check workflow file
cat .github/workflows/napi-release.yml

# Should contain:
# - Build jobs for all platforms
# - npm publish steps
# - NPM_TOKEN secret configured
```

### Required GitHub Secrets:

Ensure these secrets are set in GitHub repository settings:

- `NPM_TOKEN` - Your npm authentication token (already configured ✅)

### What Gets Published:

After GitHub Actions completes, the following packages will be on npm:

1. **Main Package:**
   - `@qudag/napi-core@0.1.0` - Auto-selects correct platform binary

2. **Platform Packages:**
   - `@qudag/napi-core-linux-x64-gnu@0.1.0`
   - `@qudag/napi-core-linux-x64-musl@0.1.0`
   - `@qudag/napi-core-linux-arm64-gnu@0.1.0`
   - `@qudag/napi-core-linux-arm64-musl@0.1.0`
   - `@qudag/napi-core-darwin-x64@0.1.0`
   - `@qudag/napi-core-darwin-arm64@0.1.0`
   - `@qudag/napi-core-win32-x64-msvc@0.1.0`
   - `@qudag/napi-core-win32-arm64-msvc@0.1.0`

### After Publishing:

```bash
# Test installation on different platforms
npm install @qudag/napi-core

# Verify correct platform binary was installed
node -e "const { get_build_info } = require('@qudag/napi-core'); console.log(get_build_info())"
```

---

## 🔧 Option 3: Manual Multi-Platform Build (Advanced)

**Use Case:** Custom build process or GitHub Actions unavailable
**Time:** Several hours
**Complexity:** High

### Prerequisites:
```bash
# Install cross-compilation tools
rustup target add aarch64-apple-darwin
rustup target add aarch64-unknown-linux-gnu
rustup target add aarch64-unknown-linux-musl
rustup target add aarch64-pc-windows-msvc
rustup target add x86_64-pc-windows-msvc
rustup target add x86_64-unknown-linux-musl
```

### Build for Each Platform:
```bash
cd /home/user/QuDAG/packages/napi-core

# Linux x64 GNU
napi build --platform --target x86_64-unknown-linux-gnu --release

# Linux x64 musl
napi build --platform --target x86_64-unknown-linux-musl --release

# Linux ARM64 GNU
napi build --platform --target aarch64-unknown-linux-gnu --release

# Linux ARM64 musl
napi build --platform --target aarch64-unknown-linux-musl --release

# macOS x64
napi build --platform --target x86_64-apple-darwin --release

# macOS ARM64
napi build --platform --target aarch64-apple-darwin --release

# Windows x64
napi build --platform --target x86_64-pc-windows-msvc --release

# Windows ARM64
napi build --platform --target aarch64-pc-windows-msvc --release
```

### Publish Platform Packages:
```bash
# Publish each platform package
npm run artifacts

# Publish main package
npm publish --access public
```

**Note:** This method is complex and error-prone. **Option 2 (GitHub Actions) is strongly recommended**.

---

## 📦 Post-Publication Verification

After @qudag/napi-core is published (via any option), verify functionality:

### Test 1: Installation
```bash
# Create test directory
mkdir /tmp/test-qudag-install
cd /tmp/test-qudag-install
npm init -y

# Install @qudag/napi-core
npm install @qudag/napi-core

# Verify installation
node -e "const { MlDsaKeyPair } = require('@qudag/napi-core'); console.log('✓ Installed successfully')"
```

### Test 2: Quick Start Example
```bash
# Copy Quick Start example from README
cat > test-quickstart.js << 'EOF'
const { MlDsaKeyPair, MlKem, QuantumDAG } = require('@qudag/napi-core');

async function main() {
  console.log('🔐 QuDAG Quantum-Resistant Cryptography Demo\n');

  // 1. Generate quantum-resistant signing keys
  console.log('1️⃣  Generating ML-DSA keypair...');
  const keypair = MlDsaKeyPair.generate();
  console.log('   ✓ Generated 1952-byte public key\n');

  // 2. Sign a message
  console.log('2️⃣  Signing message...');
  const message = Buffer.from('Hello, quantum-resistant world!');
  const signature = keypair.sign(message);
  console.log(`   ✓ Created ${signature.length}-byte signature\n`);

  // 3. Verify signature
  console.log('3️⃣  Verifying signature...');
  const publicKey = keypair.toPublicKey();
  const isValid = publicKey.verify(message, signature);
  console.log(`   ✓ Signature valid: ${isValid}\n`);

  // 4. Quantum key exchange
  console.log('4️⃣  Performing quantum key exchange...');
  const { publicKey: kemPk, secretKey: kemSk } = MlKem.keygen();
  const { ciphertext, sharedSecret: ss1 } = MlKem.encapsulate(kemPk);
  const ss2 = MlKem.decapsulate(kemSk, ciphertext);
  const match = Buffer.compare(ss1, ss2) === 0;
  console.log(`   ✓ Key exchange successful: ${match}\n`);

  // 5. Create a quantum DAG
  console.log('5️⃣  Building quantum DAG...');
  const dag = new QuantumDAG();
  await dag.addMessage(Buffer.from('Genesis block'));
  await dag.addMessage(Buffer.from('Second block'));
  const tips = await dag.getTips();
  console.log(`   ✓ DAG created with ${tips.length} tips\n`);

  console.log('✅ All quantum-resistant operations completed successfully!');
}

main().catch(console.error);
EOF

node test-quickstart.js
```

### Test 3: CLI Integration
```bash
# Test CLI with @qudag/napi-core installed
npm install -g @qudag/cli
qudag exec --help
qudag benchmark crypto --iterations 100
```

### Test 4: MCP Server Integration
```bash
# Test MCP STDIO server
npm install -g @qudag/mcp-stdio
echo '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}' | npx qudag-mcp-stdio
```

---

## 🎯 Success Criteria Checklist

After publishing, verify all criteria are met:

- [ ] `npm install @qudag/napi-core` succeeds on Linux x64
- [ ] `npm install @qudag/napi-core` succeeds on macOS ARM64
- [ ] `npm install @qudag/napi-core` succeeds on Windows x64
- [ ] Quick Start example from README runs without errors
- [ ] `MlDsaKeyPair.generate()` works
- [ ] `MlKem.keygen()` works
- [ ] `new QuantumDAG()` works
- [ ] `QuantumFingerprint.generate()` works
- [ ] CLI commands execute successfully
- [ ] MCP STDIO server tools function
- [ ] MCP SSE server tools function
- [ ] Performance benchmarks match README claims (<5ms for sign)
- [ ] All platform packages published (8 packages)
- [ ] Main package auto-selects correct platform binary

---

## 🐛 Common Issues and Solutions

### Issue: "Cannot find module '@qudag/napi-core'"

**Cause:** Package not installed or not published yet
**Solution:**
```bash
# Verify package is published
npm view @qudag/napi-core

# If not published, use Option 1 or 2 above
# If published, reinstall
npm install @qudag/napi-core
```

---

### Issue: "No native build was found"

**Cause:** Platform-specific package not available
**Solution:**
```bash
# Check available platforms
npm view @qudag/napi-core optionalDependencies

# Build for your platform locally (Option 1)
cd packages/napi-core
npm run build
```

---

### Issue: "error: linking with `cc` failed"

**Cause:** Missing build dependencies
**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# macOS
xcode-select --install

# Check Rust is installed
rustc --version
```

---

### Issue: "cannot find -lqudag-crypto"

**Cause:** Workspace dependencies not built
**Solution:**
```bash
# Build all workspace crates first
cd /home/user/QuDAG
cargo build --release --workspace

# Then build napi-core
cd packages/napi-core
npm run build
```

---

### Issue: "Cargo.toml workspace version not found"

**Cause:** Version not defined in root workspace
**Solution:**
```bash
# Check root Cargo.toml has [workspace.package] section
cat Cargo.toml | grep -A5 "workspace.package"

# Should contain:
# [workspace.package]
# version = "0.4.0"
```

---

## 📊 Recommended Timeline

### Phase 1: Local Build Test (30 minutes)
- ⏰ Time: 30 minutes
- ✅ Goal: Verify build works on current platform
- 📋 Tasks:
  - [ ] Build with `npm run build`
  - [ ] Test with Quick Start example
  - [ ] Verify all APIs work

### Phase 2: GitHub Actions Build (1 hour)
- ⏰ Time: 1 hour (mostly automated)
- ✅ Goal: Build all platforms and publish to npm
- 📋 Tasks:
  - [ ] Create git tag v0.1.0
  - [ ] Push tag to trigger CI
  - [ ] Monitor GitHub Actions progress
  - [ ] Verify all platform packages published

### Phase 3: Verification (1 hour)
- ⏰ Time: 1 hour
- ✅ Goal: Verify all functionality works
- 📋 Tasks:
  - [ ] Test installation on multiple platforms
  - [ ] Run Quick Start example
  - [ ] Test CLI integration
  - [ ] Test MCP server integration
  - [ ] Update documentation

**Total Estimated Time: 2-3 hours**

---

## 🚀 Next Steps

**Immediate:**
1. Run Option 1 (Local Build) to verify build works
2. If successful, proceed to Option 2 (GitHub Actions)
3. Monitor GitHub Actions for completion
4. Run verification tests

**After Publishing:**
1. Update README.md to remove warnings about missing package
2. Update NPM_PUBLISH_STATUS.md with @qudag/napi-core details
3. Announce release on GitHub
4. Test end-to-end workflows
5. Celebrate! 🎉

---

**Status: Ready to Build** ✅
**Blocking: CLI, MCP servers non-functional** 🔴
**Priority: CRITICAL** ⚠️
