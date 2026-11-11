#![deny(clippy::all)]
#![warn(clippy::pedantic)]
#![allow(clippy::missing_errors_doc)]
#![allow(clippy::missing_panics_doc)]

//! @qudag/napi-core - N-API bindings for QuDAG
//!
//! This package provides high-performance Node.js bindings for QuDAG's
//! quantum-resistant cryptography and DAG consensus primitives.
//!
//! ## Features
//!
//! - **ML-DSA (CRYSTALS-Dilithium)**: Quantum-resistant digital signatures
//! - **ML-KEM (CRYSTALS-Kyber)**: Quantum-resistant key encapsulation
//! - **HQC**: Hamming Quasi-Cyclic encryption
//! - **Quantum Fingerprints**: Data integrity verification
//! - **QuantumDAG**: Simplified DAG with vertex management
//!
//! ## Example
//!
//! ```javascript
//! const { MlDsaKeyPair, MlKem, QuantumDAG } = require('@qudag/napi-core');
//!
//! // Generate ML-DSA key pair and sign
//! const keypair = MlDsaKeyPair.generate();
//! const message = Buffer.from('Hello, quantum world!');
//! const signature = keypair.sign(message);
//!
//! // Verify signature
//! const publicKey = keypair.toPublicKey();
//! const isValid = publicKey.verify(message, signature);
//! console.log('Signature valid:', isValid);
//!
//! // ML-KEM key exchange
//! const { publicKey: kemPk, secretKey: kemSk } = MlKem.keygen();
//! const { ciphertext, sharedSecret: ss1 } = MlKem.encapsulate(kemPk);
//! const ss2 = MlKem.decapsulate(kemSk, ciphertext);
//! console.log('Secrets match:', Buffer.compare(ss1, ss2) === 0);
//!
//! // DAG operations
//! const dag = new QuantumDAG();
//! await dag.addMessage(Buffer.from('First message'));
//! const tips = await dag.getTips();
//! console.log('DAG tips:', tips);
//! ```

use napi_derive::napi;

// Module declarations
pub mod crypto;
pub mod dag;
pub mod error;
pub mod runtime;

// Re-export main types for convenience
pub use crypto::{
    generate_quantum_fingerprint, get_ml_dsa_info, verify_quantum_fingerprint, Hqc128Wrapper,
    Hqc192Wrapper, Hqc256Wrapper, HqcInfo, MlDsaInfo, MlDsaKeyPair, MlDsaPublicKey, MlKem,
    MlKemEncapsulation, MlKemInfo, MlKemKeyPair, QuantumFingerprint,
};
pub use dag::{ConsensusStatus, QuantumDAG, Vertex};

/// Get the version of the @qudag/napi-core package
#[napi]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Get build information
#[napi]
pub fn get_build_info() -> BuildInfo {
    BuildInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        rustc_version: "unknown".to_string(),
        target: std::env::consts::ARCH.to_string(),
        os: std::env::consts::OS.to_string(),
    }
}

/// Build information
#[napi(object)]
pub struct BuildInfo {
    /// Package version
    pub version: String,
    /// Rust compiler version used for building
    pub rustc_version: String,
    /// Target architecture
    pub target: String,
    /// Operating system
    pub os: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        let version = get_version();
        assert!(!version.is_empty());
        assert!(version.starts_with("0."));
    }

    #[test]
    fn test_build_info() {
        let info = get_build_info();
        assert!(!info.version.is_empty());
        assert!(!info.target.is_empty());
        assert!(!info.os.is_empty());
    }
}
