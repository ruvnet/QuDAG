# QuDAG MCP Real Crypto Implementation

This module provides real quantum-resistant cryptographic operations for the QuDAG MCP server using the actual QuDAG crypto libraries.

## Components

### 1. `mod.rs` - Main Module
- Defines `CryptoState` struct that manages all crypto subsystems
- Provides initialization and access to crypto operations
- Exports public types and interfaces

### 2. `operations.rs` - Crypto Operations
Real implementations of quantum-resistant cryptographic operations:
- **ML-DSA (Module-Lattice Digital Signature Algorithm)**: Quantum-resistant signatures
- **ML-KEM (Module-Lattice Key Encapsulation Mechanism)**: Quantum-resistant encryption
- **HQC (Hamming Quasi-Cyclic)**: Hybrid quantum cryptography
- **Quantum Fingerprinting**: Collision-resistant fingerprinting

Key features:
- `generate_keys()`: Generate real ML-DSA/ML-KEM/HQC key pairs
- `sign_data()`: Create quantum-resistant signatures using ML-DSA
- `verify_signature()`: Verify ML-DSA signatures
- `encrypt_data()`: Encrypt using ML-KEM key encapsulation
- `decrypt_data()`: Decrypt ML-KEM encrypted data
- `create_fingerprint()`: Generate quantum fingerprints
- `export_key()`: Export keys in PEM or JWK format
- `import_key()`: Import public keys

### 3. `vault.rs` - Secure Key Storage
Integration with `qudag-vault-core` for secure key management:
- Quantum-resistant vault encryption (ML-KEM-768/1024)
- Argon2id key derivation for password protection
- Hierarchical vault structure
- Secure key storage and retrieval
- Vault creation and unlocking
- Entry management and indexing

### 4. `handler.rs` - MCP Tool Handler
Implements MCP protocol tool handlers for crypto operations:
- `qudag_key_generate`: Generate quantum-resistant keys
- `qudag_sign`: Sign data with ML-DSA
- `qudag_verify`: Verify signatures
- `qudag_encrypt`: Encrypt with ML-KEM
- `qudag_decrypt`: Decrypt data
- `qudag_fingerprint_create`: Create quantum fingerprints
- `qudag_fingerprint_verify`: Verify fingerprints
- `qudag_key_list`: List all keys
- `qudag_key_export`: Export public keys
- `qudag_key_import`: Import keys
- `qudag_vault_create`: Create new vaults
- `qudag_vault_unlock`: Unlock vaults
- `qudag_vault_list`: List vault entries

## Usage Example

```rust
use qudag_mcp_real::crypto::{CryptoState, handle_crypto_tool};

// Initialize crypto subsystem
let mut crypto_state = CryptoState::new()?;
crypto_state.initialize().await?;

// Generate ML-DSA key pair via MCP tool
let args = serde_json::json!({
    "algorithm": "ml-dsa"
});
let result = handle_crypto_tool(&crypto_state, "qudag_key_generate", args).await?;

// Sign data
let sign_args = serde_json::json!({
    "message": "Hello, QuDAG!",
    "key_id": result["key_id"]
});
let signature = handle_crypto_tool(&crypto_state, "qudag_sign", sign_args).await?;

// Create quantum fingerprint
let fp_args = serde_json::json!({
    "data": "Important data to fingerprint"
});
let fingerprint = handle_crypto_tool(&crypto_state, "qudag_fingerprint_create", fp_args).await?;
```

## Security Features

1. **Quantum Resistance**: All algorithms (ML-DSA, ML-KEM, HQC) are NIST post-quantum standards
2. **Secure Storage**: Private keys stored in encrypted vault with Argon2id KDF
3. **Key Isolation**: Each key has unique ID and metadata
4. **Fingerprint Verification**: Quantum fingerprints for data integrity
5. **Multiple Formats**: Support for PEM and JWK key formats

## Environment Variables

- `QUDAG_VAULT_PASSWORD`: Master password for vault (defaults to test password in development)

## Testing

Run the test suite with:
```bash
cargo test --package qudag-mcp-real crypto::tests
```

Tests cover:
- ML-DSA key generation and signing
- ML-KEM encryption/decryption
- Quantum fingerprinting
- Vault operations
- Key export/import
- MCP tool handlers