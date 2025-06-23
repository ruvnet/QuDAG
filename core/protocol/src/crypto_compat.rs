//! Crypto compatibility layer for protocol module
//! 
//! This module provides abstractions that work on both x86_64 (with ML-DSA)
//! and ARM64 (with Ed25519 fallback).

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

/// Unified keypair that works on all architectures
#[derive(Debug)]
pub struct UnifiedKeyPair {
    #[cfg(target_arch = "x86_64")]
    inner: qudag_crypto::MlDsaKeyPair,
    
    #[cfg(not(target_arch = "x86_64"))]
    inner: ed25519_dalek::SigningKey,
}

/// Unified public key that works on all architectures
#[derive(Clone, Debug)]
pub struct UnifiedPublicKey {
    #[cfg(target_arch = "x86_64")]
    inner: qudag_crypto::MlDsaPublicKey,
    
    #[cfg(not(target_arch = "x86_64"))]
    inner: ed25519_dalek::VerifyingKey,
}

impl UnifiedKeyPair {
    /// Generate a new keypair (with optional RNG parameter for compatibility)
    pub fn generate(_rng: &mut impl rand::RngCore) -> Result<Self, SignatureError> {
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
    
    /// Sign a message (with optional RNG parameter for compatibility)
    pub fn sign(&self, message: &[u8], _rng: &mut impl rand::RngCore) -> Result<Vec<u8>, SignatureError> {
        #[cfg(target_arch = "x86_64")]
        {
            let mut rng = rand::thread_rng();
            self.inner.sign(message, &mut rng)
                .map_err(|e| SignatureError::CryptoError(e.to_string()))
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            use ed25519_dalek::Signer;
            let signature = self.inner.sign(message);
            Ok(signature.to_bytes().to_vec())
        }
    }
    
    /// Get public key
    pub fn public_key(&self) -> UnifiedPublicKey {
        #[cfg(target_arch = "x86_64")]
        {
            UnifiedPublicKey {
                inner: self.inner.public_key().clone()
            }
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            UnifiedPublicKey {
                inner: self.inner.verifying_key()
            }
        }
    }
}

impl UnifiedPublicKey {
    /// Create from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, SignatureError> {
        #[cfg(target_arch = "x86_64")]
        {
            let inner = qudag_crypto::MlDsaPublicKey::from_bytes(bytes)
                .map_err(|_| SignatureError::InvalidKey)?;
            Ok(Self { inner })
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            let key_bytes: [u8; 32] = bytes.try_into()
                .map_err(|_| SignatureError::InvalidKey)?;
            let inner = ed25519_dalek::VerifyingKey::from_bytes(&key_bytes)
                .map_err(|_| SignatureError::InvalidKey)?;
            Ok(Self { inner })
        }
    }
    
    /// Get as bytes
    pub fn to_vec(&self) -> Vec<u8> {
        #[cfg(target_arch = "x86_64")]
        {
            self.inner.to_vec()
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            self.inner.to_bytes().to_vec()
        }
    }
    
    /// Get as bytes (alias for compatibility)
    pub fn as_bytes(&self) -> Vec<u8> {
        self.to_vec()
    }
    
    /// Verify a signature
    pub fn verify(&self, message: &[u8], signature: &[u8]) -> Result<(), SignatureError> {
        #[cfg(target_arch = "x86_64")]
        {
            self.inner.verify(message, signature)
                .map_err(|_| SignatureError::VerificationFailed)
        }
        
        #[cfg(not(target_arch = "x86_64"))]
        {
            use ed25519_dalek::{Verifier, Signature};
            let sig_bytes: [u8; 64] = signature.try_into()
                .map_err(|_| SignatureError::VerificationFailed)?;
            let sig = Signature::from_bytes(&sig_bytes);
            self.inner.verify(message, &sig)
                .map_err(|_| SignatureError::VerificationFailed)
        }
    }
}

// Re-export types based on architecture
#[cfg(target_arch = "x86_64")]
pub use qudag_crypto::{MlDsaKeyPair, MlDsaPublicKey};

#[cfg(not(target_arch = "x86_64"))]
pub use UnifiedKeyPair as MlDsaKeyPair;

#[cfg(not(target_arch = "x86_64"))]
pub use UnifiedPublicKey as MlDsaPublicKey;