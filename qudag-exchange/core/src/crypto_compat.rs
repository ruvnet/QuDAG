//! Crypto compatibility layer for ARM64 support
//! 
//! This module provides signature abstractions that work on both x86_64 (with ML-DSA)
//! and ARM64 (with Ed25519 fallback).

use serde::{Serialize, Deserialize};
use thiserror::Error;
#[cfg(not(target_arch = "x86_64"))]
use ed25519_dalek;

#[derive(Debug, Error)]
pub enum SignatureError {
    #[error("Signature generation failed")]
    SigningFailed,
    #[error("Signature verification failed")]
    VerificationFailed,
    #[error("Invalid key")]
    InvalidKey,
    #[error("Crypto error: {0}")]
    CryptoError(String),
}

/// Unified signature wrapper that works on all architectures
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UnifiedSignature {
    #[cfg(target_arch = "x86_64")]
    inner: Vec<u8>,  // ML-DSA signature
    
    #[cfg(not(target_arch = "x86_64"))]
    inner: ed25519_dalek::Signature,  // Ed25519 signature
}

/// Unified keypair that works on all architectures
pub struct UnifiedKeyPair {
    #[cfg(target_arch = "x86_64")]
    inner: qudag_crypto::MlDsaKeyPair,
    
    #[cfg(not(target_arch = "x86_64"))]
    inner: ed25519_dalek::SigningKey,
}

impl UnifiedKeyPair {
    /// Generate a new keypair
    pub fn generate() -> Result<Self, SignatureError> {
        #[cfg(target_arch = "x86_64")]
        {
            let mut rng = rand::thread_rng();
            let inner = qudag_crypto::MlDsaKeyPair::generate(&mut rng)
                .map_err(|e| SignatureError::CryptoError(e.to_string()))?;
            Ok(Self { inner })
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            use rand::rngs::OsRng;
            use rand::RngCore;
            let mut secret_key_bytes = [0u8; 32];
            OsRng.fill_bytes(&mut secret_key_bytes);
            let inner = ed25519_dalek::SigningKey::from_bytes(&secret_key_bytes);
            Ok(Self { inner })
        }
    }
    
    /// Sign a message
    pub fn sign(&self, message: &[u8]) -> Result<UnifiedSignature, SignatureError> {
        #[cfg(target_arch = "x86_64")]
        {
            let mut rng = rand::thread_rng();
            let signature = self.inner.sign(message, &mut rng)
                .map_err(|e| SignatureError::CryptoError(e.to_string()))?;
            Ok(UnifiedSignature { inner: signature })
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            use ed25519_dalek::Signer;
            let signature = self.inner.sign(message);
            Ok(UnifiedSignature { inner: signature })
        }
    }
    
    /// Get public key bytes
    pub fn public_key_bytes(&self) -> Vec<u8> {
        #[cfg(target_arch = "x86_64")]
        {
            self.inner.public_key().to_vec()
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            self.inner.verifying_key().to_bytes().to_vec()
        }
    }
}

/// Verify a signature from raw bytes
pub fn verify_signature_bytes(
    public_key: &[u8],
    message: &[u8],
    signature_bytes: &[u8],
) -> Result<(), SignatureError> {
    #[cfg(target_arch = "x86_64")]
    {
        let pk = qudag_crypto::MlDsaPublicKey::from_bytes(public_key)
            .map_err(|_| SignatureError::InvalidKey)?;
        pk.verify(message, signature_bytes)
            .map_err(|_| SignatureError::VerificationFailed)
    }
    
    #[cfg(not(target_arch = "x86_64"))]
    {
        use ed25519_dalek::{Verifier, VerifyingKey, Signature};
        let pk = VerifyingKey::from_bytes(public_key.try_into().map_err(|_| SignatureError::InvalidKey)?)
            .map_err(|_| SignatureError::InvalidKey)?;
        let sig = Signature::from_bytes(signature_bytes.try_into().map_err(|_| SignatureError::VerificationFailed)?);
        pk.verify(message, &sig)
            .map_err(|_| SignatureError::VerificationFailed)
    }
}

/// Verify a signature
pub fn verify_signature(
    public_key: &[u8],
    message: &[u8],
    signature: &UnifiedSignature,
) -> Result<(), SignatureError> {
    #[cfg(target_arch = "x86_64")]
    {
        let pk = qudag_crypto::MlDsaPublicKey::from_bytes(public_key)
            .map_err(|_| SignatureError::InvalidKey)?;
        pk.verify(message, &signature.inner)
            .map_err(|_| SignatureError::VerificationFailed)
    }
    
    #[cfg(not(target_arch = "x86_64"))]
    {
        use ed25519_dalek::{Verifier, VerifyingKey};
        let pk = VerifyingKey::from_bytes(public_key.try_into().map_err(|_| SignatureError::InvalidKey)?)
            .map_err(|_| SignatureError::InvalidKey)?;
        pk.verify(message, &signature.inner)
            .map_err(|_| SignatureError::VerificationFailed)
    }
}

impl UnifiedSignature {
    /// Get signature as bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        #[cfg(target_arch = "x86_64")]
        {
            self.inner.clone()
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            self.inner.to_bytes().to_vec()
        }
    }
}

/// Re-export the appropriate types based on architecture
#[cfg(target_arch = "x86_64")]
pub use qudag_crypto::{MlDsaKeyPair, MlDsaPublicKey, MlDsaError};

#[cfg(not(target_arch = "x86_64"))]
pub mod ml_dsa_compat {
    use super::*;
    
    /// Compatibility type for MlDsaKeyPair on ARM64
    pub type MlDsaKeyPair = UnifiedKeyPair;
    
    /// Compatibility error type
    pub type MlDsaError = SignatureError;
}

#[cfg(not(target_arch = "x86_64"))]
pub use ml_dsa_compat::*;