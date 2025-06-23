//! Crypto compatibility layer for CLI on ARM64

#[cfg(target_arch = "x86_64")]
pub use qudag_crypto::ml_dsa::MlDsaKeyPair;

#[cfg(not(target_arch = "x86_64"))]
pub use qudag_protocol::crypto_compat::MlDsaKeyPair;