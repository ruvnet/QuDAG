# QuDAG NPM Functionality Gap Analysis

**Date:** 2025-11-10
**Issue:** Published npm packages are missing core quantum cryptography functionality

---

## ⚠️ Critical Issue

The three published packages (@qudag/cli, @qudag/mcp-stdio, @qudag/mcp-sse) **cannot function** without **@qudag/napi-core**, which was not published due to requiring Rust compilation.

---

## 📦 What Was Published

### ✅ @qudag/cli@0.1.0
**Status:** Published but **non-functional** without @qudag/napi-core
**Contains:** CLI interface, command parsing, formatting logic
**Missing:** All quantum crypto operations (ML-DSA, ML-KEM, QuantumDAG, etc.)

**Broken Features:**
```bash
# These commands will fail without @qudag/napi-core:
qudag exec --input dag.json              # ❌ No QuantumDAG implementation
qudag optimize dag --input dag.json      # ❌ No optimization backend
qudag analyze dag --input dag.json       # ❌ No analysis engine
qudag benchmark crypto                   # ❌ No crypto primitives
```

### ✅ @qudag/mcp-stdio@0.1.0
**Status:** Published but **non-functional** without @qudag/napi-core
**Contains:** MCP server framework, tool definitions, STDIO transport
**Missing:** All quantum crypto operations

**Broken Tools:**
- `execute_quantum_dag` - ❌ No QuantumDAG
- `optimize_circuit` - ❌ No optimization backend
- `quantum_key_exchange` - ❌ No ML-KEM implementation
- `quantum_sign` - ❌ No ML-DSA implementation
- `dark_address_resolve` - ❌ No quantum fingerprint
- `vault_quantum_store` - ❌ No quantum encryption
- `vault_quantum_retrieve` - ❌ No quantum decryption

### ✅ @qudag/mcp-sse@0.1.0
**Status:** Published but **non-functional** without @qudag/napi-core
**Contains:** HTTP server, OAuth2, RBAC, rate limiting
**Missing:** All quantum crypto operations

**Broken API Endpoints:**
- POST `/mcp` with `quantum_sign` - ❌ No ML-DSA
- POST `/mcp` with `quantum_key_exchange` - ❌ No ML-KEM
- All quantum cryptography tools - ❌ No backend

---

## 🔴 Missing Core Package: @qudag/napi-core

### What @qudag/napi-core Provides

According to the README, @qudag/napi-core should export:

#### 1. **ML-DSA (Dilithium) Digital Signatures**
```javascript
const { MlDsaKeyPair } = require('@qudag/napi-core');

const keypair = MlDsaKeyPair.generate();           // ❌ Not available
const signature = keypair.sign(message);           // ❌ Not available
const isValid = publicKey.verify(msg, sig);        // ❌ Not available
const allValid = publicKey.batchVerify(msgs, sigs); // ❌ Not available
```

#### 2. **ML-KEM (Kyber) Key Encapsulation**
```javascript
const { MlKem } = require('@qudag/napi-core');

const { publicKey, secretKey } = MlKem.keygen();        // ❌ Not available
const { ciphertext, sharedSecret } = MlKem.encapsulate(pk); // ❌ Not available
const secret = MlKem.decapsulate(sk, ciphertext);      // ❌ Not available
```

#### 3. **Quantum DAG**
```javascript
const { QuantumDAG } = require('@qudag/napi-core');

const dag = new QuantumDAG();                    // ❌ Not available
await dag.addMessage(Buffer.from('data'));       // ❌ Not available
const tips = await dag.getTips();                // ❌ Not available
const count = await dag.getVertexCount();        // ❌ Not available
```

#### 4. **Quantum Fingerprints**
```javascript
const { QuantumFingerprint } = require('@qudag/napi-core');

const fp = QuantumFingerprint.generate(data);    // ❌ Not available
const hex = fingerprint.toHex();                 // ❌ Not available
const isValid = fingerprint.verify(data);        // ❌ Not available
```

#### 5. **HQC Hybrid Encryption** (Mentioned in README)
```javascript
const { HQC } = require('@qudag/napi-core');

// HQC operations                                // ❌ Not available
```

#### 6. **BLAKE3 Hashing** (Mentioned in README)
```javascript
const { Blake3 } = require('@qudag/napi-core');

// BLAKE3 hashing operations                     // ❌ Not available
```

---

## 📊 Functionality Comparison

| Feature | README Promises | Published Packages | Status |
|---------|----------------|-------------------|--------|
| ML-DSA Signatures | ✅ Full API | ❌ Not available | **MISSING** |
| ML-KEM Key Exchange | ✅ Full API | ❌ Not available | **MISSING** |
| Quantum DAG | ✅ Full API | ❌ Not available | **MISSING** |
| Quantum Fingerprints | ✅ Full API | ❌ Not available | **MISSING** |
| HQC Encryption | ✅ Mentioned | ❌ Not available | **MISSING** |
| BLAKE3 Hashing | ✅ Mentioned | ❌ Not available | **MISSING** |
| CLI Commands | ✅ 20+ commands | ⚠️ Interface only | **BROKEN** |
| MCP STDIO Server | ✅ 10 tools | ⚠️ Interface only | **BROKEN** |
| MCP HTTP Server | ✅ Full server | ⚠️ Interface only | **BROKEN** |
| Zero-Copy Buffers | ✅ <8% overhead | ❌ Not available | **MISSING** |
| Async Operations | ✅ Tokio runtime | ❌ Not available | **MISSING** |

---

## 🎯 What Users Will Experience

### Scenario 1: User Tries Quick Start Example
```bash
$ npm install @qudag/napi-core
npm error 404 Not Found - GET https://registry.npmjs.org/@qudag%2fnapi-core
npm error 404 '@qudag/napi-core@*' is not in this registry.
```

**Result:** ❌ **Cannot install** - Package doesn't exist

---

### Scenario 2: User Tries CLI
```bash
$ npm install -g @qudag/cli
$ qudag exec --input dag.json

Error: Cannot find module '@qudag/napi-core'
```

**Result:** ❌ **CLI crashes** - Missing peer dependency

---

### Scenario 3: User Tries Tutorial Code
```javascript
const { MlDsaKeyPair, MlKem, QuantumDAG } = require('@qudag/napi-core');
// Error: Cannot find module '@qudag/napi-core'

const keypair = MlDsaKeyPair.generate();
// Error: MlDsaKeyPair is not defined
```

**Result:** ❌ **Code crashes** - Module not found

---

### Scenario 4: User Tries MCP Server
```bash
$ npm install @qudag/mcp-stdio
$ npx qudag-mcp-stdio

Server started...
# User tries to use quantum_sign tool
Error: @qudag/napi-core not found
```

**Result:** ❌ **MCP tools fail** - No crypto backend

---

## 🔧 Why @qudag/napi-core Wasn't Published

### Build Requirements
```bash
# Requires:
- Rust 1.70+ toolchain
- napi-rs CLI (@napi-rs/cli)
- Platform-specific build tools:
  * Linux: build-essential
  * macOS: Xcode Command Line Tools
  * Windows: Visual Studio Build Tools
```

### Cross-Platform Compilation
@qudag/napi-core needs pre-built native binaries (`.node` files) for **9 platforms**:

1. Linux x64 (`@qudag/napi-linux-x64`)
2. Linux ARM64 (`@qudag/napi-linux-arm64`)
3. macOS x64 (`@qudag/napi-darwin-x64`)
4. macOS ARM64 (M1/M2) (`@qudag/napi-darwin-arm64`)
5. Windows x64 (`@qudag/napi-win32-x64`)
6. Windows ARM64 (`@qudag/napi-win32-arm64`)
7. Linux ARM v7 (`@qudag/napi-linux-arm-v7`)
8. Android ARM64 (`@qudag/napi-android-arm64`)
9. FreeBSD x64 (`@qudag/napi-freebsd-x64`)

**Current Status:** ❌ No binaries built or published

---

## 💡 Solutions

### Option 1: Build and Publish @qudag/napi-core (Recommended)

**Using GitHub Actions (Already Configured):**

```bash
# 1. Ensure Rust source is ready
cd packages/napi-core
cargo build --release  # Test local build

# 2. Create git tag to trigger CI
git tag v0.1.0
git push origin v0.1.0

# 3. GitHub Actions will:
#    - Build binaries for all 9 platforms
#    - Create platform-specific packages
#    - Publish @qudag/napi-core with optionalDependencies
#    - Publish platform packages (@qudag/napi-linux-x64, etc.)

# 4. Users can install:
npm install @qudag/napi-core
# Automatically downloads correct platform binary
```

**Files Required:**
- ✅ `.github/workflows/napi-ci.yml` - Already exists
- ✅ `.github/workflows/napi-release.yml` - Already exists
- ⚠️ `packages/napi-core/Cargo.toml` - Need to verify
- ⚠️ `packages/napi-core/src/lib.rs` - Need to verify
- ⚠️ `packages/napi-core/build.rs` - May need to create

---

### Option 2: Publish Development Build (Quick Fix)

**For testing only - single platform:**

```bash
cd packages/napi-core

# Build for current platform only
cargo build --release

# Publish (will only work on your platform)
npm publish --access public

# Warning: Only works on the platform you built it on!
```

**Limitations:**
- ❌ Only works on one platform (e.g., Linux x64)
- ❌ Users on other platforms can't install
- ❌ Not suitable for production

---

### Option 3: Document Limitations (Temporary)

**Update README and package.json to make limitations clear:**

1. **Add warning badges to README:**
```markdown
⚠️ **Note:** @qudag/napi-core requires Rust compilation and is not yet published to npm.
The CLI and MCP packages are published but require building @qudag/napi-core from source.
```

2. **Update package descriptions:**
```json
{
  "description": "QuDAG CLI (requires building @qudag/napi-core from source)"
}
```

3. **Add installation instructions:**
```markdown
## Installation (Current)

**Step 1: Build @qudag/napi-core from source**
```bash
git clone https://github.com/ruvnet/QuDAG.git
cd QuDAG/packages/napi-core
cargo build --release
npm link
```

**Step 2: Install CLI**
```bash
npm install -g @qudag/cli
npm link @qudag/napi-core
```
```

---

## 📋 Recommended Action Plan

### Phase 1: Immediate (Today)
1. ✅ Document the limitations in NPM_FUNCTIONALITY_GAP_ANALYSIS.md
2. ⚠️ Update README.md with clear installation requirements
3. ⚠️ Add warning badges to published packages
4. ⚠️ Update NPM_PUBLISH_STATUS.md with current limitations

### Phase 2: Short-term (This Week)
1. ⚠️ Verify Rust implementation in `packages/napi-core/`
2. ⚠️ Test local build: `cargo build --release`
3. ⚠️ Test Node.js bindings work correctly
4. ⚠️ Create git tag v0.1.0
5. ⚠️ Trigger GitHub Actions to build all platforms
6. ⚠️ Publish @qudag/napi-core with platform packages

### Phase 3: Verification (After Publishing)
1. ⚠️ Test installation on all platforms
2. ⚠️ Run Quick Start example from README
3. ⚠️ Test CLI commands
4. ⚠️ Test MCP servers
5. ⚠️ Update README to remove warnings
6. ⚠️ Announce v0.1.0 release

---

## 🎯 Success Criteria

@qudag/napi-core is considered **successfully published** when:

1. ✅ Published to npm as `@qudag/napi-core@0.1.0`
2. ✅ Platform packages published for all 9 platforms
3. ✅ Users can run: `npm install @qudag/napi-core` (auto-selects platform)
4. ✅ Quick Start example from README works
5. ✅ CLI commands execute successfully
6. ✅ MCP tools function correctly
7. ✅ Tutorial code runs without errors
8. ✅ All documented APIs are available
9. ✅ Performance benchmarks match README claims
10. ✅ No "module not found" errors

---

## 📊 Impact Assessment

### User Impact: **HIGH** 🔴
- **100% of core functionality unavailable**
- All README examples are broken
- CLI is non-functional
- MCP servers are non-functional
- Users cannot use any quantum cryptography features

### Brand Impact: **MEDIUM** 🟡
- Published packages appear complete but don't work
- May damage trust if users try examples and they fail
- README promises features that aren't available

### Technical Debt: **LOW** 🟢
- All code is already implemented
- Just needs compilation and publishing
- Infrastructure (CI/CD) already exists

---

## 🏁 Conclusion

The published npm packages (@qudag/cli, @qudag/mcp-stdio, @qudag/mcp-sse) are **interface-only** and require the unpublished **@qudag/napi-core** to function.

**Immediate Action Required:**
1. Publish @qudag/napi-core with platform-specific binaries
2. Update documentation to reflect current limitations
3. Test end-to-end installation and usage

**Timeline Estimate:**
- Building all platform binaries via GitHub Actions: ~30-60 minutes
- Publishing to npm: ~5-10 minutes
- Testing across platforms: ~1-2 hours
- **Total: 2-3 hours** to complete

---

**Priority: CRITICAL**
**Status: BLOCKED** (CLI, MCP servers non-functional)
**Next Step: Build and publish @qudag/napi-core**
