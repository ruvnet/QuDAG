//! ML-KEM implementation using libcrux for ARM64
//!
//! This module implements the NIST-standardized ML-KEM key encapsulation mechanism
//! using the libcrux library, which provides ARM64 NEON optimization and formal verification.

#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
use libcrux_ml_kem::{
    mlkem768::{self, MlKem768Ciphertext, MlKem768PublicKey, MlKem768PrivateKey},
    KEY_GENERATION_SEED_SIZE,
};

use rand::RngCore;
use crate::kem::{Ciphertext, KEMError, PublicKey, SecretKey, SharedSecret};

/// Generate a keypair using libcrux ML-KEM-768
#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
pub fn keygen() -> Result<(PublicKey, SecretKey), KEMError> {
    let mut rng = rand::thread_rng();
    let mut seed = [0u8; KEY_GENERATION_SEED_SIZE];
    rng.fill_bytes(&mut seed);
    
    let keypair = mlkem768::generate_key_pair(seed);
    
    Ok((
        PublicKey::from_bytes(keypair.pk().as_ref()).map_err(|_| KEMError::KeyGenerationError)?,
        SecretKey::from_bytes(keypair.sk().as_ref()).map_err(|_| KEMError::KeyGenerationError)?,
    ))
}

/// Encapsulate using libcrux ML-KEM-768
#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
pub fn encapsulate(public_key: &PublicKey) -> Result<(Ciphertext, SharedSecret), KEMError> {
    let pk_bytes = public_key.as_bytes();
    
    // Convert bytes to fixed-size array
    let mut pk_array = [0u8; 1184];
    if pk_bytes.len() != 1184 {
        return Err(KEMError::InvalidKey);
    }
    pk_array.copy_from_slice(pk_bytes);
    
    let pk = MlKem768PublicKey::from(pk_array);
    
    let mut rng = rand::thread_rng();
    let mut randomness = [0u8; 32];
    rng.fill_bytes(&mut randomness);
    
    let (ct, ss) = mlkem768::encapsulate(&pk, randomness);
    
    Ok((
        Ciphertext::from_bytes(ct.as_ref()).map_err(|_| KEMError::EncapsulationError)?,
        SharedSecret::from_bytes(ss.as_ref()).map_err(|_| KEMError::EncapsulationError)?,
    ))
}

/// Decapsulate using libcrux ML-KEM-768
#[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
pub fn decapsulate(
    secret_key: &SecretKey,
    ciphertext: &Ciphertext,
) -> Result<SharedSecret, KEMError> {
    let sk_bytes = secret_key.as_bytes();
    let ct_bytes = ciphertext.as_bytes();
    
    // Convert bytes to fixed-size arrays
    let mut sk_array = [0u8; 2400];
    if sk_bytes.len() != 2400 {
        return Err(KEMError::InvalidKey);
    }
    sk_array.copy_from_slice(sk_bytes);
    
    let mut ct_array = [0u8; 1088];
    if ct_bytes.len() != 1088 {
        return Err(KEMError::InvalidLength);
    }
    ct_array.copy_from_slice(ct_bytes);
    
    let sk = MlKem768PrivateKey::from(sk_array);
    let ct = MlKem768Ciphertext::from(ct_array);
    
    let ss = mlkem768::decapsulate(&sk, &ct);
    
    SharedSecret::from_bytes(ss.as_ref()).map_err(|_| KEMError::DecapsulationError)
}

/// Size constants for ML-KEM-768
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
    #[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
    fn test_libcrux_keygen() {
        let (pk, sk) = keygen().unwrap();
        assert_eq!(pk.as_bytes().len(), sizes::PUBLIC_KEY_SIZE);
        assert_eq!(sk.as_bytes().len(), sizes::SECRET_KEY_SIZE);
    }

    #[test]
    #[cfg(not(all(target_arch = "x86_64", target_feature = "avx2")))]
    fn test_libcrux_encap_decap() {
        let (pk, sk) = keygen().unwrap();
        let (ct, ss1) = encapsulate(&pk).unwrap();
        let ss2 = decapsulate(&sk, &ct).unwrap();
        
        assert_eq!(ct.as_bytes().len(), sizes::CIPHERTEXT_SIZE);
        assert_eq!(ss1.as_bytes().len(), sizes::SHARED_SECRET_SIZE);
        assert_eq!(ss1.as_bytes(), ss2.as_bytes());
    }
}