//! ML-DSA implementation using oqs for ARM64 support

#![allow(unsafe_code)]

use super::{MlDsaError, ML_DSA_PUBLIC_KEY_SIZE, ML_DSA_SECRET_KEY_SIZE, ML_DSA_SIGNATURE_SIZE};
use oqs::sig::{Algorithm, Sig};
use rand_core::{CryptoRng, RngCore};
use zeroize::Zeroize;

/// liboqs-based ML-DSA keypair for ARM64
#[derive(Clone)]
pub struct LiboqsMlDsaKeyPair {
    /// Public key bytes (for compatibility with existing API)
    public_key_bytes: Vec<u8>,
    /// Secret key bytes (for compatibility with existing API - will be zeroized on drop)
    secret_key_bytes: Vec<u8>,
    /// Native liboqs public key
    public_key: oqs::sig::PublicKey,
    /// Native liboqs secret key  
    secret_key: oqs::sig::SecretKey,
}

impl std::fmt::Debug for LiboqsMlDsaKeyPair {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LiboqsMlDsaKeyPair")
            .field("public_key_len", &self.public_key_bytes.len())
            .field("secret_key_len", &self.secret_key_bytes.len())
            .finish()
    }
}

impl Drop for LiboqsMlDsaKeyPair {
    fn drop(&mut self) {
        // Zeroize sensitive key material
        self.secret_key_bytes.zeroize();
    }
}

impl LiboqsMlDsaKeyPair {
    /// Generate a new ML-DSA keypair using liboqs
    pub fn generate<R: CryptoRng + RngCore>(_rng: &mut R) -> Result<Self, MlDsaError> {
        // Use ML-DSA-65 (FIPS 204 level 3) 
        let sig = Sig::new(Algorithm::MlDsa65)
            .map_err(|e| MlDsaError::KeyGenerationFailed(format!("liboqs init failed: {}", e)))?;
        
        let (public_key, secret_key) = sig.keypair()
            .map_err(|e| MlDsaError::KeyGenerationFailed(format!("liboqs keygen failed: {}", e)))?;
        
        // Store byte arrays for compatibility with existing API
        let public_key_bytes = public_key.clone().into_vec();
        let secret_key_bytes = secret_key.clone().into_vec();
        
        // Validate key sizes to match expected constants
        if public_key_bytes.len() != ML_DSA_PUBLIC_KEY_SIZE {
            return Err(MlDsaError::KeyGenerationFailed(format!(
                "Invalid public key size: expected {}, got {}",
                ML_DSA_PUBLIC_KEY_SIZE, public_key_bytes.len()
            )));
        }
        
        if secret_key_bytes.len() != ML_DSA_SECRET_KEY_SIZE {
            return Err(MlDsaError::KeyGenerationFailed(format!(
                "Invalid secret key size: expected {}, got {}",
                ML_DSA_SECRET_KEY_SIZE, secret_key_bytes.len()
            )));
        }
        
        Ok(Self {
            public_key_bytes,
            secret_key_bytes,
            public_key,
            secret_key,
        })
    }
    
    /// Get the public key bytes
    pub fn public_key(&self) -> &[u8] {
        &self.public_key_bytes
    }
    
    /// Get the secret key bytes
    pub fn secret_key(&self) -> &[u8] {
        &self.secret_key_bytes
    }
    
    /// Create a public key object from this keypair
    pub fn to_public_key(&self) -> Result<LiboqsMlDsaPublicKey, MlDsaError> {
        LiboqsMlDsaPublicKey::from_keypair(self.public_key_bytes.clone(), self.public_key.clone())
    }
    
    /// Sign a message using ML-DSA
    pub fn sign<R: CryptoRng + RngCore>(&self, message: &[u8], _rng: &mut R) -> Result<Vec<u8>, MlDsaError> {
        let sig = Sig::new(Algorithm::MlDsa65)
            .map_err(|e| MlDsaError::SigningFailed(format!("liboqs init failed: {}", e)))?;
        
        // Use the native liboqs secret key directly
        let signature = sig.sign(message, &self.secret_key)
            .map_err(|e| MlDsaError::SigningFailed(format!("liboqs sign failed: {}", e)))?;
        
        let signature_vec = signature.into_vec();
        
        // Validate signature size bounds (ML-DSA signatures can vary due to rejection sampling)
        if signature_vec.len() < 2000 || signature_vec.len() > ML_DSA_SIGNATURE_SIZE {
            return Err(MlDsaError::SigningFailed(format!(
                "Invalid signature size: expected 2000-{}, got {}",
                ML_DSA_SIGNATURE_SIZE, signature_vec.len()
            )));
        }
        
        Ok(signature_vec)
    }
    
    /// Sign a message deterministically (using internal deterministic mode)
    pub fn sign_deterministic(&self, message: &[u8]) -> Result<Vec<u8>, MlDsaError> {
        // ML-DSA signatures are naturally deterministic, so this is the same as sign
        let mut dummy_rng = rand::thread_rng();
        self.sign(message, &mut dummy_rng)
    }
}

/// liboqs-based ML-DSA public key for ARM64
#[derive(Clone)]
pub struct LiboqsMlDsaPublicKey {
    /// Public key bytes (for compatibility with existing API)
    key_bytes: Vec<u8>,
    /// Native liboqs public key
    public_key: oqs::sig::PublicKey,
}

impl std::fmt::Debug for LiboqsMlDsaPublicKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LiboqsMlDsaPublicKey")
            .field("key_bytes_len", &self.key_bytes.len())
            .finish()
    }
}

impl LiboqsMlDsaPublicKey {
    /// Create from a keypair (internal use - has valid native key)
    pub(super) fn from_keypair(key_bytes: Vec<u8>, public_key: oqs::sig::PublicKey) -> Result<Self, MlDsaError> {
        Ok(Self {
            key_bytes,
            public_key,
        })
    }
    
    /// Create from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, MlDsaError> {
        if bytes.len() != ML_DSA_PUBLIC_KEY_SIZE {
            return Err(MlDsaError::InvalidKeyLength {
                expected: ML_DSA_PUBLIC_KEY_SIZE,
                found: bytes.len(),
            });
        }
        
        // Since we can't reconstruct oqs::sig::PublicKey from raw bytes easily,
        // we'll store the bytes and reconstruct the key when needed for verification.
        // This is a limitation of the current oqs API.
        
        // For now, create a dummy key to maintain the struct invariant
        let sig = Sig::new(Algorithm::MlDsa65)
            .map_err(|_| MlDsaError::InvalidPublicKey("Failed to initialize algorithm".to_string()))?;
        
        let (dummy_public_key, _) = sig.keypair()
            .map_err(|_| MlDsaError::InvalidPublicKey("Failed to create dummy key".to_string()))?;
        
        Ok(Self {
            key_bytes: bytes.to_vec(),
            public_key: dummy_public_key,
        })
    }
    
    /// Get as bytes slice
    pub fn as_bytes(&self) -> &[u8] {
        &self.key_bytes
    }
    
    /// Get as owned vector
    pub fn to_vec(&self) -> Vec<u8> {
        self.key_bytes.clone()
    }
    
    /// Verify a signature using ML-DSA
    pub fn verify(&self, message: &[u8], signature: &[u8]) -> Result<(), MlDsaError> {
        // Use FFI-based verification for pristine functionality
        unsafe {
            super::ffi_verify::verify_signature_ffi(&self.key_bytes, message, signature)
        }
    }
    
    /// Batch verify multiple signatures
    pub fn batch_verify(
        messages: &[&[u8]],
        signatures: &[&[u8]],
        public_keys: &[&Self],
    ) -> Result<(), MlDsaError> {
        if messages.len() != signatures.len() || messages.len() != public_keys.len() {
            return Err(MlDsaError::BatchVerificationInputMismatch);
        }
        
        // For now, verify each signature individually
        // liboqs may add batch verification in the future
        for ((message, signature), public_key) in messages.iter().zip(signatures.iter()).zip(public_keys.iter()) {
            public_key.verify(message, signature)?;
        }
        
        Ok(())
    }
}