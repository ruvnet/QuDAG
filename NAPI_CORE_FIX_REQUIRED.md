# @qudag/napi-core - Fix Required for API Mismatches

**Status:** ❌ BUILD FAILING - 16 compilation errors
**Priority:** CRITICAL - Blocks all npm functionality
**Created:** 2025-11-10

---

## 🔴 Critical Issue

The N-API bindings in `packages/napi-core` were written for an older version of the core crypto library. The core library API has evolved, but the bindings were not updated, resulting in 16 compilation errors.

**Impact:**
- **@qudag/napi-core cannot be built** ❌
- **@qudag/cli is non-functional** (requires napi-core)
- **@qudag/mcp-stdio is non-functional** (requires napi-core)
- **@qudag/mcp-sse is non-functional** (requires napi-core)
- **All README examples are broken** ❌
- **Cannot publish to npm** ❌

---

## 🐛 Compilation Errors

### Error 1: QuantumFingerprint.generate() Signature Changed

**Files:** `packages/napi-core/src/crypto/fingerprint.rs:32, 111`

**Current N-API Binding:**
```rust
let fingerprint = CoreFingerprint::generate(&data)
```

**Actual Core API:**
```rust
pub fn generate<R: CryptoRng + RngCore>(
    data: &[u8],
    rng: &mut R
) -> Result<(Fingerprint, MlDsaPublicKey), FingerprintError>
```

**Fix Required:**
```rust
use rand::rngs::OsRng;

let mut rng = OsRng;
let (fingerprint, public_key) = CoreFingerprint::generate(&data, &mut rng)
    .map_err(|e| Error::from_reason(format!("Fingerprint generation failed: {}", e)))?;
```

**Impact:** 3 errors across fingerprint.rs

---

### Error 2: QuantumFingerprint Returns Tuple

**Files:** `packages/napi-core/src/crypto/fingerprint.rs:35, 114`

**Current N-API Binding:**
```rust
Ok(Self { inner: fingerprint })
```

**Actual Return Type:**
```rust
(Fingerprint, MlDsaPublicKey)  // Not just Fingerprint
```

**Fix Required:**
```rust
// Store both fingerprint and public key
pub struct QuantumFingerprint {
    inner: CoreFingerprint,
    public_key: CoreMlDsaPublicKey,
}

// Update generation
let (fingerprint, public_key) = CoreFingerprint::generate(&data, &mut rng)?;
Ok(Self { inner: fingerprint, public_key })
```

**Impact:** 2 errors

---

### Error 3: QuantumFingerprint.verify() Signature Changed

**Files:** `packages/napi-core/src/crypto/fingerprint.rs:87`

**Current N-API Binding:**
```rust
self.inner.verify(&data)  // Takes Buffer
```

**Actual Core API:**
```rust
pub fn verify(&self, public_key: &MlDsaPublicKey) -> Result<(), FingerprintError>
```

**Fix Required:**
```rust
// Verify against stored public key
match self.inner.verify(&self.public_key) {
    Ok(()) => Ok(true),
    Err(_) => Ok(false),
}
```

**Impact:** 1 error

---

### Error 4: QuantumFingerprint Missing Methods

**Files:** `packages/napi-core/src/crypto/fingerprint.rs:44, 55, 63, 127`

**Current N-API Binding:**
```rust
CoreFingerprint::from_bytes(&bytes)  // ❌ Doesn't exist
self.inner.as_bytes()                // ❌ Doesn't exist
```

**Actual Core API:**
```rust
// No from_bytes() or as_bytes() methods exist in Fingerprint struct
```

**Fix Required:**
Either:
1. Add serialization methods to `core/crypto/src/fingerprint.rs`:
```rust
impl Fingerprint {
    pub fn to_bytes(&self) -> Vec<u8> {
        // Implement serialization
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, FingerprintError> {
        // Implement deserialization
    }
}
```

Or:
2. Remove from_bytes/to_bytes functionality from N-API bindings

**Impact:** 4 errors

---

### Error 5: HQC Missing Constructor Methods

**Files:** `packages/napi-core/src/crypto/hqc.rs:24, 42, 72, 83, 113, 124`

**Current N-API Binding:**
```rust
let hqc = Hqc128::new(SecurityParameter::Hqc128);  // ❌ Doesn't exist
let hqc = Hqc192::new(SecurityParameter::Hqc192);  // ❌ Doesn't exist
let hqc = Hqc256::new(SecurityParameter::Hqc256);  // ❌ Doesn't exist
```

**Actual Core API:**
```rust
// No new() method exists in Hqc128/192/256 structs
// They use Default trait instead
```

**Fix Required:**
```rust
// Use Default trait
let hqc = Hqc128::default();
let hqc = Hqc192::default();
let hqc = Hqc256::default();
```

**Impact:** 6 errors

---

### Error 6: MlKemKeyPair Missing ObjectFinalize Trait

**Files:** `packages/napi-core/src/crypto/ml_kem.rs:15`

**Current N-API Binding:**
```rust
#[napi]
pub struct MlKemKeyPair {
    inner: CoreMlKemKeyPair,
}
```

**Error:**
```
error[E0277]: the trait bound `MlKemKeyPair: ObjectFinalize` is not satisfied
```

**Fix Required:**
```rust
#[napi]
impl ObjectFinalize for MlKemKeyPair {}

// Or remove #[napi] from struct and only use methods
```

**Impact:** 1 error

---

## 📊 Error Summary

| Component | Errors | Severity | Fix Complexity |
|-----------|--------|----------|----------------|
| QuantumFingerprint | 10 | High | Medium |
| HQC (128/192/256) | 6 | Medium | Low |
| MlKemKeyPair | 1 | Low | Low |
| **Total** | **17** | **Critical** | **Medium** |

---

## 🛠️ Fix Strategy

### Option 1: Update N-API Bindings (Recommended)

**Approach:** Modify `packages/napi-core/src/` to match current core API

**Steps:**
1. Fix QuantumFingerprint bindings:
   - Update generate() to use RNG
   - Handle tuple return value (Fingerprint, PublicKey)
   - Fix verify() to use public key
   - Remove or implement as_bytes()/from_bytes()

2. Fix HQC bindings:
   - Replace `new()` with `default()`

3. Fix MlKemKeyPair:
   - Implement ObjectFinalize trait

**Time Estimate:** 2-4 hours
**Risk:** Low (just fixing bindings)

---

### Option 2: Update Core Crypto API

**Approach:** Modify `core/crypto/src/` to add missing methods

**Steps:**
1. Add Fingerprint serialization methods
2. Add HQC constructor methods
3. Keep backward compatibility

**Time Estimate:** 4-6 hours
**Risk:** Medium (changes core library)

---

### Option 3: Hybrid Approach (Best)

**Approach:** Update bindings + add minimal core methods

**Steps:**
1. Update QuantumFingerprint bindings (use RNG, handle tuple)
2. Add Fingerprint serialization to core (for to_hex())
3. Fix HQC bindings (use default())
4. Fix MlKemKeyPair trait

**Time Estimate:** 2-3 hours
**Risk:** Low

---

## 🔧 Detailed Fixes

### Fix 1: QuantumFingerprint (fingerprint.rs)

```rust
// packages/napi-core/src/crypto/fingerprint.rs

use qudag_crypto::fingerprint::{Fingerprint as CoreFingerprint};
use qudag_crypto::signature::MlDsaPublicKey as CoreMlDsaPublicKey;
use rand::rngs::OsRng;

#[napi]
pub struct QuantumFingerprint {
    inner: CoreFingerprint,
    public_key: CoreMlDsaPublicKey,
}

#[napi]
impl QuantumFingerprint {
    /// Generate a quantum fingerprint from data
    #[napi]
    pub fn generate(data: Buffer) -> Result<Self> {
        let mut rng = OsRng;
        let (fingerprint, public_key) = CoreFingerprint::generate(&data, &mut rng)
            .map_err(|e| Error::from_reason(format!("Generation failed: {}", e)))?;

        Ok(Self { inner: fingerprint, public_key })
    }

    /// Verify the fingerprint
    #[napi]
    pub fn verify(&self, _data: Buffer) -> Result<bool> {
        // Verify against stored public key
        match self.inner.verify(&self.public_key) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Get hex representation (if core supports it)
    #[napi]
    pub fn to_hex(&self) -> String {
        // If core has as_bytes():
        // hex::encode(self.inner.as_bytes())

        // Otherwise, use a placeholder or remove this method
        "not_implemented".to_string()
    }
}

/// Generate quantum fingerprint (standalone function)
#[napi]
pub fn generate_quantum_fingerprint(data: Buffer) -> Result<Uint8Array> {
    let mut rng = OsRng;
    let (fingerprint, _public_key) = CoreFingerprint::generate(&data, &mut rng)
        .map_err(|e| Error::from_reason(format!("Generation failed: {}", e)))?;

    // Return fingerprint bytes (if serialization is implemented in core)
    Ok(Uint8Array::new(vec![]))  // Placeholder
}
```

---

### Fix 2: HQC (hqc.rs)

```rust
// packages/napi-core/src/crypto/hqc.rs

#[napi]
impl Hqc128Wrapper {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        // Use Default trait instead of new()
        let hqc = Hqc128::default();
        Ok(Self { inner: hqc })
    }
}

#[napi]
impl Hqc192Wrapper {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        let hqc = Hqc192::default();
        Ok(Self { inner: hqc })
    }
}

#[napi]
impl Hqc256Wrapper {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        let hqc = Hqc256::default();
        Ok(Self { inner: hqc })
    }
}
```

---

### Fix 3: MlKemKeyPair (ml_kem.rs)

```rust
// packages/napi-core/src/crypto/ml_kem.rs

#[napi]
pub struct MlKemKeyPair {
    inner: CoreMlKemKeyPair,
}

// Add ObjectFinalize implementation
impl napi::bindgen_prelude::ObjectFinalize for MlKemKeyPair {}

// Or simply remove #[napi] from the struct and only expose methods
```

---

## ✅ Verification After Fixes

After applying fixes, verify:

```bash
# 1. Build succeeds
cd /home/user/QuDAG/packages/napi-core
npm run build
# Should complete without errors

# 2. Test build output
ls -la *.node
# Should see: qudag-napi-core.linux-x64-gnu.node

# 3. Test APIs
node -e "const { MlDsaKeyPair, MlKem, QuantumDAG } = require('./index.js'); console.log('✓ Loaded')"

# 4. Run Quick Start example
node test-quickstart.js
# Should complete all 5 steps successfully

# 5. Test CLI integration
npm install -g @qudag/cli
qudag --version
qudag exec --help
```

---

## 📋 Action Items

### High Priority (Immediate)
- [ ] Fix QuantumFingerprint bindings (10 errors)
- [ ] Fix HQC bindings (6 errors)
- [ ] Fix MlKemKeyPair trait (1 error)
- [ ] Test local build succeeds
- [ ] Run Quick Start example

### Medium Priority (This Week)
- [ ] Add Fingerprint serialization to core (if needed)
- [ ] Update all error handling
- [ ] Add comprehensive tests
- [ ] Document API changes
- [ ] Update README examples

### Low Priority (Next Week)
- [ ] Optimize performance
- [ ] Add benchmarks
- [ ] Cross-platform testing
- [ ] Documentation improvements

---

## 📞 Next Steps

1. **Apply Fixes** - Update N-API bindings to match core API
2. **Test Build** - Verify local build succeeds
3. **Run Tests** - Execute Quick Start and all examples
4. **Publish** - Use GitHub Actions for multi-platform build
5. **Verify** - Test installation across platforms

**Estimated Time to Fix:** 2-3 hours
**Estimated Time to Publish:** 1 hour (automated via CI)
**Total Time:** 3-4 hours

---

## 📄 Related Documents

- `NPM_FUNCTIONALITY_GAP_ANALYSIS.md` - Complete gap analysis
- `BUILDING_NAPI_CORE.md` - Build instructions
- `NPM_PUBLISH_STATUS.md` - Publication status

---

**Status:** Documented - Awaiting fixes
**Blocking:** All npm functionality
**Priority:** CRITICAL ⚠️
