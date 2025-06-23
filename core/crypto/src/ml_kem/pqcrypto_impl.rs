//! ML-KEM implementation using pqcrypto for x86_64 with AVX2
//!
//! This module implements the NIST-standardized ML-KEM key encapsulation mechanism
//! using the pqcrypto library, which provides AVX2 optimizations for x86_64.

#[cfg(target_arch = "x86_64")]
use pqcrypto_kyber::kyber768;

use crate::kem::{Ciphertext, KEMError, PublicKey, SecretKey, SharedSecret};

/// Generate a keypair using pqcrypto Kyber-768
#[cfg(target_arch = "x86_64")]
pub fn keygen() -> Result<(PublicKey, SecretKey), KEMError> {
    let (pk, sk) = kyber768::keypair();
    
    Ok((
        PublicKey::from_bytes(pk.as_bytes()).map_err(|_| KEMError::KeyGenerationError)?,
        SecretKey::from_bytes(sk.as_bytes()).map_err(|_| KEMError::KeyGenerationError)?,
    ))
}

/// Encapsulate using pqcrypto Kyber-768
#[cfg(target_arch = "x86_64")]
pub fn encapsulate(public_key: &PublicKey) -> Result<(Ciphertext, SharedSecret), KEMError> {
    let pk_bytes = public_key.as_bytes();
    let pk = kyber768::PublicKey::from_bytes(pk_bytes)
        .map_err(|_| KEMError::InvalidKey)?;
    
    let (ss, ct) = kyber768::encapsulate(&pk);
    
    Ok((
        Ciphertext::from_bytes(ct.as_bytes()).map_err(|_| KEMError::EncapsulationError)?,
        SharedSecret::from_bytes(ss.as_bytes()).map_err(|_| KEMError::EncapsulationError)?,
    ))
}

/// Decapsulate using pqcrypto Kyber-768
#[cfg(target_arch = "x86_64")]
pub fn decapsulate(
    secret_key: &SecretKey,
    ciphertext: &Ciphertext,
) -> Result<SharedSecret, KEMError> {
    let sk_bytes = secret_key.as_bytes();
    let ct_bytes = ciphertext.as_bytes();
    
    let sk = kyber768::SecretKey::from_bytes(sk_bytes)
        .map_err(|_| KEMError::InvalidKey)?;
    let ct = kyber768::Ciphertext::from_bytes(ct_bytes)
        .map_err(|_| KEMError::InvalidLength)?;
    
    let ss = kyber768::decapsulate(&ct, &sk);
    
    SharedSecret::from_bytes(ss.as_bytes()).map_err(|_| KEMError::DecapsulationError)
}

/// Size constants for Kyber-768 (same as ML-KEM-768)
pub mod sizes {
    pub const PUBLIC_KEY_SIZE: usize = 1184;
    pub const SECRET_KEY_SIZE: usize = 2400;
    pub const CIPHERTEXT_SIZE: usize = 1088;
    pub const SHARED_SECRET_SIZE: usize = 32;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_arch = "x86_64")]
    fn test_pqcrypto_keygen() {
        let (pk, sk) = keygen().unwrap();
        assert_eq!(pk.as_bytes().len(), sizes::PUBLIC_KEY_SIZE);
        assert_eq!(sk.as_bytes().len(), sizes::SECRET_KEY_SIZE);
    }

    #[test]
    #[cfg(target_arch = "x86_64")]
    fn test_pqcrypto_encap_decap() {
        let (pk, sk) = keygen().unwrap();
        let (ct, ss1) = encapsulate(&pk).unwrap();
        let ss2 = decapsulate(&sk, &ct).unwrap();
        
        assert_eq!(ct.as_bytes().len(), sizes::CIPHERTEXT_SIZE);
        assert_eq!(ss1.as_bytes().len(), sizes::SHARED_SECRET_SIZE);
        assert_eq!(ss1.as_bytes(), ss2.as_bytes());
    }
}