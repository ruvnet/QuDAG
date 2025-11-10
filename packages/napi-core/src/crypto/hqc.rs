use napi::bindgen_prelude::*;
use napi_derive::napi;
use qudag_crypto::{Hqc128, Hqc192, Hqc256, SecurityParameter};

/// HQC-128 quantum-resistant encryption (security level 1)
///
/// Provides encryption and decryption using the HQC (Hamming Quasi-Cyclic)
/// post-quantum cryptosystem at security level 1 (equivalent to AES-128).
#[napi]
pub struct Hqc128Wrapper;

#[napi]
impl Hqc128Wrapper {
    /// Encrypt a message with HQC-128
    ///
    /// # Arguments
    /// * `message` - The plaintext to encrypt
    /// * `public_key` - The recipient's public key
    ///
    /// # Returns
    /// The ciphertext
    #[napi]
    pub fn encrypt(message: Buffer, public_key: Buffer) -> Result<Uint8Array> {
        let hqc = Hqc128::new(SecurityParameter::Hqc128);
        let ciphertext = hqc
            .encrypt(&message, &public_key)
            .map_err(|e| Error::from_reason(format!("Encryption failed: {}", e)))?;

        Ok(Uint8Array::new(ciphertext))
    }

    /// Decrypt a ciphertext with HQC-128
    ///
    /// # Arguments
    /// * `ciphertext` - The ciphertext to decrypt
    /// * `secret_key` - Your secret key
    ///
    /// # Returns
    /// The decrypted plaintext
    #[napi]
    pub fn decrypt(ciphertext: Buffer, secret_key: Buffer) -> Result<Uint8Array> {
        let hqc = Hqc128::new(SecurityParameter::Hqc128);
        let plaintext = hqc
            .decrypt(&ciphertext, &secret_key)
            .map_err(|e| Error::from_reason(format!("Decryption failed: {}", e)))?;

        Ok(Uint8Array::new(plaintext))
    }

    /// Get algorithm information
    #[napi]
    pub fn get_info() -> HqcInfo {
        HqcInfo {
            security_level: 1,
            algorithm: "HQC-128".to_string(),
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
    /// Encrypt a message with HQC-192
    #[napi]
    pub fn encrypt(message: Buffer, public_key: Buffer) -> Result<Uint8Array> {
        let hqc = Hqc192::new(SecurityParameter::Hqc192);
        let ciphertext = hqc
            .encrypt(&message, &public_key)
            .map_err(|e| Error::from_reason(format!("Encryption failed: {}", e)))?;

        Ok(Uint8Array::new(ciphertext))
    }

    /// Decrypt a ciphertext with HQC-192
    #[napi]
    pub fn decrypt(ciphertext: Buffer, secret_key: Buffer) -> Result<Uint8Array> {
        let hqc = Hqc192::new(SecurityParameter::Hqc192);
        let plaintext = hqc
            .decrypt(&ciphertext, &secret_key)
            .map_err(|e| Error::from_reason(format!("Decryption failed: {}", e)))?;

        Ok(Uint8Array::new(plaintext))
    }

    /// Get algorithm information
    #[napi]
    pub fn get_info() -> HqcInfo {
        HqcInfo {
            security_level: 3,
            algorithm: "HQC-192".to_string(),
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
    /// Encrypt a message with HQC-256
    #[napi]
    pub fn encrypt(message: Buffer, public_key: Buffer) -> Result<Uint8Array> {
        let hqc = Hqc256::new(SecurityParameter::Hqc256);
        let ciphertext = hqc
            .encrypt(&message, &public_key)
            .map_err(|e| Error::from_reason(format!("Encryption failed: {}", e)))?;

        Ok(Uint8Array::new(ciphertext))
    }

    /// Decrypt a ciphertext with HQC-256
    #[napi]
    pub fn decrypt(ciphertext: Buffer, secret_key: Buffer) -> Result<Uint8Array> {
        let hqc = Hqc256::new(SecurityParameter::Hqc256);
        let plaintext = hqc
            .decrypt(&ciphertext, &secret_key)
            .map_err(|e| Error::from_reason(format!("Decryption failed: {}", e)))?;

        Ok(Uint8Array::new(plaintext))
    }

    /// Get algorithm information
    #[napi]
    pub fn get_info() -> HqcInfo {
        HqcInfo {
            security_level: 5,
            algorithm: "HQC-256".to_string(),
        }
    }
}

/// HQC algorithm information
#[napi(object)]
pub struct HqcInfo {
    /// NIST security level
    pub security_level: u8,
    /// Algorithm identifier
    pub algorithm: String,
}
