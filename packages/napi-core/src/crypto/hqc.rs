use napi::bindgen_prelude::*;
use napi_derive::napi;
use qudag_crypto::hqc::{Hqc128, Hqc192, Hqc256};

/// HQC-128 quantum-resistant encryption (security level 1)
///
/// Provides encryption and decryption using the HQC (Hamming Quasi-Cyclic)
/// post-quantum cryptosystem at security level 1 (equivalent to AES-128).
#[napi]
pub struct Hqc128Wrapper;

#[napi]
impl Hqc128Wrapper {
    /// Generate a keypair for HQC-128
    ///
    /// # Returns
    /// A tuple of (public_key, secret_key)
    #[napi]
    pub fn keygen() -> Result<HqcKeyPair> {
        let (public_key, secret_key) = Hqc128::keygen()
            .map_err(|e| Error::from_reason(format!("Key generation failed: {}", e)))?;

        Ok(HqcKeyPair {
            public_key: Uint8Array::new(public_key.as_bytes().to_vec()),
            secret_key: Uint8Array::new(secret_key.as_bytes().to_vec()),
        })
    }

    /// Get algorithm information
    #[napi]
    pub fn get_info() -> HqcInfo {
        HqcInfo {
            security_level: 1,
            algorithm: "HQC-128".to_string(),
            public_key_size: Hqc128::PUBLIC_KEY_SIZE as u32,
            secret_key_size: Hqc128::SECRET_KEY_SIZE as u32,
            ciphertext_size: Hqc128::CIPHERTEXT_SIZE as u32,
        }
    }
}

/// HQC-192 quantum-resistant encryption (security level 3)
///
/// Provides encryption and decryption using HQC at security level 3
/// (equivalent to AES-192).
#[napi]
pub struct Hqc192Wrapper;

#[napi]
impl Hqc192Wrapper {
    /// Generate a keypair for HQC-192
    ///
    /// # Returns
    /// A tuple of (public_key, secret_key)
    #[napi]
    pub fn keygen() -> Result<HqcKeyPair> {
        let (public_key, secret_key) = Hqc192::keygen()
            .map_err(|e| Error::from_reason(format!("Key generation failed: {}", e)))?;

        Ok(HqcKeyPair {
            public_key: Uint8Array::new(public_key.as_bytes().to_vec()),
            secret_key: Uint8Array::new(secret_key.as_bytes().to_vec()),
        })
    }

    /// Get algorithm information
    #[napi]
    pub fn get_info() -> HqcInfo {
        HqcInfo {
            security_level: 3,
            algorithm: "HQC-192".to_string(),
            public_key_size: Hqc192::PUBLIC_KEY_SIZE as u32,
            secret_key_size: Hqc192::SECRET_KEY_SIZE as u32,
            ciphertext_size: Hqc192::CIPHERTEXT_SIZE as u32,
        }
    }
}

/// HQC-256 quantum-resistant encryption (security level 5)
///
/// Provides encryption and decryption using HQC at security level 5
/// (equivalent to AES-256).
#[napi]
pub struct Hqc256Wrapper;

#[napi]
impl Hqc256Wrapper {
    /// Generate a keypair for HQC-256
    ///
    /// # Returns
    /// A tuple of (public_key, secret_key)
    #[napi]
    pub fn keygen() -> Result<HqcKeyPair> {
        let (public_key, secret_key) = Hqc256::keygen()
            .map_err(|e| Error::from_reason(format!("Key generation failed: {}", e)))?;

        Ok(HqcKeyPair {
            public_key: Uint8Array::new(public_key.as_bytes().to_vec()),
            secret_key: Uint8Array::new(secret_key.as_bytes().to_vec()),
        })
    }

    /// Get algorithm information
    #[napi]
    pub fn get_info() -> HqcInfo {
        HqcInfo {
            security_level: 5,
            algorithm: "HQC-256".to_string(),
            public_key_size: Hqc256::PUBLIC_KEY_SIZE as u32,
            secret_key_size: Hqc256::SECRET_KEY_SIZE as u32,
            ciphertext_size: Hqc256::CIPHERTEXT_SIZE as u32,
        }
    }
}

/// HQC keypair
#[napi(object)]
pub struct HqcKeyPair {
    /// Public key bytes
    pub public_key: Uint8Array,
    /// Secret key bytes
    pub secret_key: Uint8Array,
}

/// HQC algorithm information
#[napi(object)]
pub struct HqcInfo {
    /// NIST security level
    pub security_level: u8,
    /// Algorithm identifier
    pub algorithm: String,
    /// Public key size in bytes
    pub public_key_size: u32,
    /// Secret key size in bytes
    pub secret_key_size: u32,
    /// Ciphertext size in bytes
    pub ciphertext_size: u32,
}
