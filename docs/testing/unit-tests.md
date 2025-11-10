# QuDAG Unit Testing Strategy

## Overview
This document outlines the comprehensive unit testing strategy for core quantum operations in QuDAG, covering Rust libraries, N-API bindings, and WASM interfaces.

## 1. Rust Unit Test Coverage Requirements

### 1.1 Core Cryptography (core/crypto)

#### ML-DSA (Quantum Signatures)
- **Basic Operations**
  - `test_ml_dsa_keypair_generation`: Valid key generation
  - `test_ml_dsa_keypair_deterministic`: Deterministic generation with seed
  - `test_ml_dsa_keypair_sizes`: Verify key sizes (2544 bytes for PK, 4880 bytes for SK)
  - `test_ml_dsa_serialization`: Key serialization/deserialization

- **Signing Operations**
  - `test_ml_dsa_sign_basic`: Standard message signing
  - `test_ml_dsa_sign_empty_message`: Empty message handling
  - `test_ml_dsa_sign_large_message`: Multi-MB messages
  - `test_ml_dsa_sign_repeated`: Multiple signatures on same message
  - `test_ml_dsa_sign_concurrent`: Thread-safe signing

- **Verification Operations**
  - `test_ml_dsa_verify_valid_signature`: Valid signature verification
  - `test_ml_dsa_verify_invalid_signature`: Invalid signature rejection
  - `test_ml_dsa_verify_wrong_message`: Tampered message detection
  - `test_ml_dsa_verify_wrong_key`: Cross-key verification failure
  - `test_ml_dsa_verify_corrupted_signature`: Corrupted signature handling

- **Security Properties**
  - `test_ml_dsa_signature_non_deterministic`: Randomized signatures (RFC 8949 compliance)
  - `test_ml_dsa_signature_uniqueness`: Each signature is unique
  - `test_ml_dsa_collision_resistance`: No two messages produce same signature

#### ML-KEM (Quantum Key Encapsulation)
- **Key Generation**
  - `test_ml_kem_keypair_generation`: Valid keypair generation
  - `test_ml_kem_keypair_deterministic`: Deterministic generation with seed
  - `test_ml_kem_keypair_sizes`: Verify key sizes (800 bytes PK, 1632 bytes SK)
  - `test_ml_kem_keypair_serialization`: Serialization/deserialization

- **Encapsulation**
  - `test_ml_kem_encapsulate_basic`: Standard encapsulation
  - `test_ml_kem_encapsulate_deterministic`: Deterministic with seed
  - `test_ml_kem_encapsulate_sizes`: Ciphertext and shared secret sizes
  - `test_ml_kem_encapsulate_unique`: Each encapsulation is unique
  - `test_ml_kem_encapsulate_concurrent`: Thread-safe operation

- **Decapsulation**
  - `test_ml_kem_decapsulate_valid`: Valid ciphertext decapsulation
  - `test_ml_kem_decapsulate_invalid`: Invalid ciphertext handling
  - `test_ml_kem_decapsulate_corrupted`: Corrupted ciphertext rejection
  - `test_ml_kem_decapsulate_wrong_key`: Cross-key decapsulation failure
  - `test_ml_kem_decapsulate_shared_secret_match`: Shared secret equality

- **IND-CCA2 Security**
  - `test_ml_kem_ind_cca2_basic`: Basic CCA2 resistance
  - `test_ml_kem_shared_secret_entropy`: High entropy of shared secrets
  - `test_ml_kem_ciphertext_independence`: Encapsulations are independent

#### HQC (Hybrid Encryption)
- **Key Generation**
  - `test_hqc_keypair_generation`: Valid keypair generation
  - `test_hqc_keypair_sizes`: Verify expected key sizes
  - `test_hqc_serialization`: Key serialization/deserialization

- **Encryption/Decryption**
  - `test_hqc_encrypt_decrypt_basic`: Round-trip encryption
  - `test_hqc_encrypt_empty_message`: Empty message handling
  - `test_hqc_encrypt_large_message`: Large message encryption
  - `test_hqc_decrypt_invalid_ciphertext`: Invalid ciphertext handling
  - `test_hqc_ciphertext_independence`: Each encryption produces different ciphertext
  - `test_hqc_ciphertext_sizes`: Expected ciphertext overhead

- **Security**
  - `test_hqc_ind_cpa`: Indistinguishability under chosen plaintext attack
  - `test_hqc_semantic_security`: Semantic security verification

#### Fingerprinting System
- **Generation**
  - `test_fingerprint_generation_basic`: Basic fingerprint generation
  - `test_fingerprint_deterministic`: Same input produces same fingerprint
  - `test_fingerprint_size`: 256-bit (32 bytes) fingerprint size
  - `test_fingerprint_empty_input`: Empty input handling
  - `test_fingerprint_large_input`: Multi-MB input handling

- **Verification**
  - `test_fingerprint_verify_valid`: Valid fingerprint verification
  - `test_fingerprint_verify_invalid`: Invalid fingerprint rejection
  - `test_fingerprint_verify_tampered_data`: Tampered data detection
  - `test_fingerprint_verify_tampered_fingerprint`: Corrupted fingerprint rejection

- **Properties**
  - `test_fingerprint_avalanche_effect`: Small input changes produce different fingerprints
  - `test_fingerprint_collision_resistance`: No collisions detected (statistical)
  - `test_fingerprint_preimage_resistance`: Cannot reverse fingerprint to data
  - `test_fingerprint_second_preimage_resistance`: Cannot find alternative input

### 1.2 DAG Consensus (core/dag)

#### Block Handling
- `test_block_creation`: Valid block creation
- `test_block_serialization`: Block serialization/deserialization
- `test_block_validation`: Block structure validation
- `test_block_with_quantum_signatures`: Blocks with ML-DSA signatures
- `test_block_tampering_detection`: Tampered block detection
- `test_block_merkle_tree`: Merkle tree calculation

#### DAG Structure
- `test_dag_tip_selection`: Valid tip selection algorithm
- `test_dag_linear_ordering`: Topological ordering of blocks
- `test_dag_cycle_detection`: Cycle prevention
- `test_dag_reachability`: Block reachability verification
- `test_dag_transaction_ordering`: Transaction ordering in DAG

#### QR-Avalanche Consensus
- `test_avalanche_basic_round`: Single consensus round
- `test_avalanche_finality`: Block finality after N rounds
- `test_avalanche_byzantine_resilience`: Resilience under Byzantine faults
- `test_avalanche_quantum_resistance`: ML-DSA verification in consensus
- `test_avalanche_fork_detection`: Fork detection and resolution
- `test_avalanche_network_partition`: Partition recovery

### 1.3 Network Layer (core/network)

#### Peer Management
- `test_peer_address_generation`: Valid peer address generation
- `test_peer_address_serialization`: Multiaddr serialization/deserialization
- `test_peer_connection_establishment`: Peer connection creation
- `test_peer_disconnection`: Graceful peer disconnection
- `test_peer_reputation`: Reputation scoring

#### Dark Addressing
- `test_dark_domain_registration`: .dark domain registration
- `test_dark_domain_resolution`: Domain resolution to addresses
- `test_dark_domain_validation`: Domain format validation
- `test_dark_domain_expiration`: Domain expiration handling
- `test_quantum_fingerprint_binding`: Quantum fingerprint to address binding

#### Routing
- `test_onion_routing_basic`: Basic onion routing
- `test_onion_routing_multi_hop`: Multi-hop routing
- `test_onion_routing_quantum_encryption`: Quantum-encrypted layers
- `test_shadow_routing`: Shadow routing path selection
- `test_route_discovery`: Route discovery and caching

#### NAT Traversal
- `test_nat_traversal_upnp`: UPnP port mapping
- `test_nat_traversal_pmp`: PMP port mapping
- `test_nat_traversal_punch_through`: Hole punching
- `test_nat_external_address_detection`: External address discovery

### 1.4 Vault System (core/vault)

#### Key Storage
- `test_vault_creation`: Vault creation and initialization
- `test_vault_key_storage`: Secure key storage
- `test_vault_key_retrieval`: Key retrieval from vault
- `test_vault_key_deletion`: Secure key deletion

#### Encryption
- `test_vault_encryption_ml_kem`: ML-KEM based vault encryption
- `test_vault_decryption_integrity`: Integrity verification on decryption
- `test_vault_encryption_performance`: Encryption performance

#### Authentication
- `test_vault_unlock_correct_password`: Successful unlock
- `test_vault_unlock_wrong_password`: Failed unlock rejection
- `test_vault_unlock_rate_limiting`: Rate limiting on failed attempts
- `test_vault_biometric_integration`: Biometric authentication

## 2. N-API Binding Unit Tests

### 2.1 N-API Function Wrappers
- `test_napi_ml_dsa_keypair_export`: Keypair export to JS
- `test_napi_ml_dsa_sign_export`: Signature export format
- `test_napi_ml_dsa_verify_import`: Signature import and verification
- `test_napi_ml_kem_encapsulate_export`: Ciphertext and secret export
- `test_napi_ml_kem_decapsulate_import`: Ciphertext import and decapsulation
- `test_napi_fingerprint_operations`: Fingerprint operations via N-API

### 2.2 Type Conversions
- `test_napi_buffer_to_vec`: Buffer to Vec<u8> conversion
- `test_napi_vec_to_buffer`: Vec<u8> to Buffer conversion
- `test_napi_string_encoding`: UTF-8 string handling
- `test_napi_bigint_handling`: BigInt conversion
- `test_napi_array_handling`: Array type conversions

### 2.3 Memory Management
- `test_napi_buffer_lifetime`: Buffer ownership and lifetime
- `test_napi_external_binding`: External data binding
- `test_napi_garbage_collection`: GC integration
- `test_napi_memory_cleanup`: Cleanup on error

### 2.4 Error Handling
- `test_napi_error_propagation`: Error message propagation
- `test_napi_rust_panic_handling`: Panic handling
- `test_napi_exception_throwing`: Exception throwing to JS
- `test_napi_error_codes`: Consistent error codes

## 3. Test Implementation Pattern

### Unit Test Structure
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use rand::thread_rng;

    // Standard unit test
    #[test]
    fn test_operation_basic() {
        // Arrange
        let input = prepare_test_input();

        // Act
        let result = perform_operation(&input);

        // Assert
        assert!(verify_result(&result));
    }

    // Property-based test
    proptest! {
        #[test]
        fn test_operation_properties(input in prop_input_strategy()) {
            let result = perform_operation(&input);
            prop_assert!(verify_properties(&result));
        }
    }

    // Concurrent test
    #[test]
    fn test_operation_concurrent() {
        let handles: Vec<_> = (0..10)
            .map(|_| {
                std::thread::spawn(|| {
                    let result = perform_operation(&test_input());
                    assert!(verify_result(&result));
                })
            })
            .collect();

        for handle in handles {
            handle.join().unwrap();
        }
    }
}
```

## 4. Coverage Requirements

### Target Coverage by Component
- **Cryptography**: 90%+ line coverage, 100% branch coverage for security-critical paths
- **DAG Consensus**: 85%+ line coverage, 95%+ branch coverage
- **Network**: 80%+ line coverage, 90%+ branch coverage
- **Vault**: 95%+ line coverage, 100%+ branch coverage (security-critical)

### Critical Paths (100% Coverage Required)
- All cryptographic operations (generation, signing, verification, encryption)
- All security checks (bounds validation, signature verification, access control)
- All error handling in security-critical sections
- All vault operations

### Coverage Tools
- `cargo tarpaulin` for line and branch coverage
- `cargo llvm-cov` for detailed coverage reports
- Coverage threshold: 85% minimum across the project

## 5. Test Execution Strategy

### Local Development
```bash
# Run unit tests only
cargo test --lib

# Run with coverage
cargo tarpaulin --lib --exclude-files tests --timeout 300 --out Html

# Run specific test module
cargo test --lib crypto:: -- --nocapture
```

### CI/CD Pipeline
- Run on every commit
- Run against stable, beta, and nightly Rust versions
- Timeout: 5 minutes per test module
- Fail on test failure or coverage drop below 85%

## 6. Test Dependencies and Tools

### Required Crates
```toml
[dev-dependencies]
proptest = "1.0"              # Property-based testing
tokio-test = "0.4"           # Async testing utilities
tempfile = "3.8"             # Temporary files
criterion = "0.5"            # Benchmarking
quickcheck = "1.0"           # Quickcheck property testing
```

### Testing Tools
- `cargo test`: Built-in test runner
- `cargo tarpaulin`: Coverage analysis
- `cargo-llvm-cov`: LLVM coverage
- `proptest`: Property-based testing
- `Quickcheck`: Random testing

## 7. Security-Focused Tests

### Constant-Time Operations
- `test_constant_time_comparison`: Timing-attack resistance
- `test_constant_time_decryption`: No timing side-channels
- `test_zeroization`: Memory zeroization verification

### Randomness Quality
- `test_rng_entropy`: RNG entropy verification
- `test_rng_uniqueness`: No repeated values
- `test_rng_statistical_properties`: Statistical randomness tests

### Boundary Conditions
- `test_empty_input_handling`: Empty data handling
- `test_maximum_size_handling`: Maximum size inputs
- `test_invalid_utf8_handling`: Invalid UTF-8 rejection
- `test_null_pointer_rejection`: Null pointer handling

## 8. Performance Expectations

### Target Execution Times
- Quantum crypto operations: < 100ms per suite
- DAG operations: < 50ms per suite
- Network operations: < 50ms per suite
- Vault operations: < 100ms per suite

### Total Suite Time
- Unit tests should complete in < 60 seconds locally
- CI unit tests should complete in < 120 seconds

## 9. Regression Testing

### Regression Test Suite
- All previously fixed bugs should have corresponding tests
- Regression tests isolated in `tests/regression/` directory
- Run before every release
- Maintain regression test coverage >= 95% of fixes

### Test Vector Validation
- Use NIST test vectors for FIPS algorithms
- Validate against reference implementations
- Annual review of test vector coverage

## 10. Test Organization

### Directory Structure
```
core/crypto/tests/
├── lib.rs                    # Test module root
├── unit/
│   ├── ml_dsa_tests.rs      # ML-DSA tests
│   ├── ml_kem_tests.rs      # ML-KEM tests
│   ├── hqc_tests.rs         # HQC tests
│   └── fingerprint_tests.rs # Fingerprinting
├── integration/
│   ├── crypto_integration_tests.rs
│   └── multi_algorithm_tests.rs
├── security/
│   ├── constant_time_tests.rs
│   ├── side_channel_tests.rs
│   └── randomness_tests.rs
├── vectors/
│   └── nist_test_vectors.rs
└── benchmarks/
    └── criterion_benchmarks.rs
```

## 11. Continuous Test Infrastructure

### Test Monitoring
- Track test pass/fail rates over time
- Monitor test execution times for regression
- Alert on flaky tests (pass rate < 99%)
- Generate weekly test metrics reports

### Test Maintenance
- Review and update tests quarterly
- Remove obsolete tests
- Update test vectors annually
- Refactor tests for maintainability
