//! Crypto compatibility layer for CLI on ARM64

#[cfg(all(target_arch = "x86_64", target_feature = "avx2"))]
pub use qudag_crypto::ml_dsa::MlDsaKeyPair;

#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
pub use qudag_protocol::crypto_compat::MlDsaKeyPair;