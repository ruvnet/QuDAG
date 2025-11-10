// Crypto module - quantum-resistant cryptographic primitives

pub mod fingerprint;
pub mod hqc;
pub mod ml_dsa;
pub mod ml_kem;

// Re-export main types
pub use fingerprint::{generate_quantum_fingerprint, verify_quantum_fingerprint, QuantumFingerprint};
pub use hqc::{Hqc128Wrapper, Hqc192Wrapper, Hqc256Wrapper, HqcInfo};
pub use ml_dsa::{get_ml_dsa_info, MlDsaInfo, MlDsaKeyPair, MlDsaPublicKey};
pub use ml_kem::{MlKem, MlKemEncapsulation, MlKemInfo, MlKemKeyPair};
