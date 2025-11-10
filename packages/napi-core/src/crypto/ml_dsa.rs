use napi::bindgen_prelude::*;
use napi_derive::napi;
use qudag_crypto::{MlDsaKeyPair as CoreKeyPair, MlDsaPublicKey as CorePublicKey};
use rand::thread_rng;

/// ML-DSA key pair for quantum-resistant digital signatures
///
/// This class provides methods for generating key pairs and signing messages
/// using the ML-DSA (CRYSTALS-Dilithium) post-quantum signature algorithm.
#[napi]
pub struct MlDsaKeyPair {
    inner: CoreKeyPair,
}

#[napi]
impl MlDsaKeyPair {
    /// Generate a new ML-DSA key pair
    ///
    /// Creates a new quantum-resistant key pair using ML-DSA-65 (security level 3).
    /// This uses secure random number generation internally.
    ///
    /// # Example
    /// ```js
    /// const keypair = MlDsaKeyPair.generate();
    /// ```
    #[napi(factory)]
    pub fn generate() -> Result<Self> {
        let mut rng = thread_rng();
        let keypair = CoreKeyPair::generate(&mut rng)
            .map_err(|e| Error::from_reason(format!("Key generation failed: {}", e)))?;

        Ok(Self { inner: keypair })
    }

    /// Get the public key as a Uint8Array
    ///
    /// Returns the raw public key bytes (1952 bytes for ML-DSA-65).
    /// This can be safely shared with others for signature verification.
    #[napi]
    pub fn public_key(&self) -> Uint8Array {
        Uint8Array::new(self.inner.public_key().to_vec())
    }

    /// Get the public key as a hex string
    ///
    /// Convenient method for displaying or transmitting the public key as hexadecimal.
    #[napi]
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.inner.public_key())
    }

    /// Sign a message with this key pair
    ///
    /// Creates a quantum-resistant digital signature for the given message.
    /// The signature size is approximately 3309 bytes for ML-DSA-65.
    ///
    /// # Arguments
    /// * `message` - The message to sign (any length)
    ///
    /// # Returns
    /// A Uint8Array containing the signature
    ///
    /// # Example
    /// ```js
    /// const message = Buffer.from("Hello, quantum world!");
    /// const signature = keypair.sign(message);
    /// ```
    #[napi]
    pub fn sign(&self, message: Buffer) -> Result<Uint8Array> {
        let mut rng = thread_rng();
        let signature = self
            .inner
            .sign(&message, &mut rng)
            .map_err(|e| Error::from_reason(format!("Signing failed: {}", e)))?;

        Ok(Uint8Array::new(signature))
    }

    /// Sign a message deterministically (for testing)
    ///
    /// This creates a deterministic signature without using randomness.
    /// **WARNING**: Only use this for testing! Production code should use `sign()`.
    #[napi]
    pub fn sign_deterministic(&self, message: Buffer) -> Result<Uint8Array> {
        let signature = self
            .inner
            .sign_deterministic(&message)
            .map_err(|e| Error::from_reason(format!("Signing failed: {}", e)))?;

        Ok(Uint8Array::new(signature))
    }

    /// Convert to public key for sharing
    ///
    /// Extracts the public key component for distribution to others.
    #[napi]
    pub fn to_public_key(&self) -> Result<MlDsaPublicKey> {
        let public_key = self
            .inner
            .to_public_key()
            .map_err(|e| Error::from_reason(format!("Public key conversion failed: {}", e)))?;

        Ok(MlDsaPublicKey { inner: public_key })
    }
}

/// ML-DSA public key for signature verification
///
/// This class represents a public key that can verify ML-DSA signatures.
/// Public keys can be freely shared and do not contain any secret material.
#[napi]
pub struct MlDsaPublicKey {
    inner: CorePublicKey,
}

#[napi]
impl MlDsaPublicKey {
    /// Create public key from bytes
    ///
    /// # Arguments
    /// * `bytes` - Raw public key bytes (must be exactly 1952 bytes for ML-DSA-65)
    #[napi(factory)]
    pub fn from_bytes(bytes: Buffer) -> Result<Self> {
        let public_key = CorePublicKey::from_bytes(&bytes)
            .map_err(|e| Error::from_reason(format!("Invalid public key: {}", e)))?;

        Ok(Self { inner: public_key })
    }

    /// Create public key from hex string
    ///
    /// # Arguments
    /// * `hex_string` - Hexadecimal representation of the public key
    #[napi(factory)]
    pub fn from_hex(hex_string: String) -> Result<Self> {
        let bytes = hex::decode(hex_string)
            .map_err(|e| Error::from_reason(format!("Invalid hex string: {}", e)))?;

        Self::from_bytes(Buffer::from(bytes))
    }

    /// Get public key bytes as Uint8Array
    #[napi]
    pub fn as_bytes(&self) -> Uint8Array {
        Uint8Array::new(self.inner.as_bytes().to_vec())
    }

    /// Get public key as hex string
    #[napi]
    pub fn as_hex(&self) -> String {
        hex::encode(self.inner.as_bytes())
    }

    /// Verify a signature
    ///
    /// Verifies that a signature was created by the private key corresponding to this public key.
    ///
    /// # Arguments
    /// * `message` - The original message that was signed
    /// * `signature` - The signature to verify
    ///
    /// # Returns
    /// `true` if the signature is valid, `false` otherwise
    ///
    /// # Example
    /// ```js
    /// const isValid = publicKey.verify(message, signature);
    /// if (isValid) {
    ///   console.log("Signature is valid!");
    /// }
    /// ```
    #[napi]
    pub fn verify(&self, message: Buffer, signature: Buffer) -> Result<bool> {
        match self.inner.verify(&message, &signature) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Batch verify multiple signatures
    ///
    /// Efficiently verifies multiple signatures at once.
    /// This is faster than verifying each signature individually.
    ///
    /// # Arguments
    /// * `messages` - Array of messages
    /// * `signatures` - Array of signatures (must match messages length)
    /// * `public_keys` - Array of public keys (must match messages length)
    ///
    /// # Returns
    /// `true` if all signatures are valid, `false` if any are invalid
    #[napi]
    pub fn batch_verify(
        messages: Vec<Buffer>,
        signatures: Vec<Buffer>,
        public_keys: Vec<&MlDsaPublicKey>,
    ) -> Result<bool> {
        if messages.len() != signatures.len() || messages.len() != public_keys.len() {
            return Err(Error::from_reason(
                "Input arrays must have the same length",
            ));
        }

        let messages_refs: Vec<&[u8]> = messages.iter().map(|b| b.as_ref()).collect();
        let signatures_refs: Vec<&[u8]> = signatures.iter().map(|b| b.as_ref()).collect();
        let pk_refs: Vec<&CorePublicKey> = public_keys.iter().map(|pk| &pk.inner).collect();

        match CorePublicKey::batch_verify(&messages_refs, &signatures_refs, &pk_refs) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

/// ML-DSA algorithm information
#[napi(object)]
pub struct MlDsaInfo {
    /// Size of public keys in bytes
    pub public_key_size: u32,
    /// Size of secret keys in bytes
    pub secret_key_size: u32,
    /// Size of signatures in bytes
    pub signature_size: u32,
    /// NIST security level (1-5, where 3 corresponds to AES-192)
    pub security_level: u8,
    /// Algorithm identifier
    pub algorithm: String,
}

/// Get ML-DSA algorithm information
///
/// Returns detailed information about the ML-DSA-65 parameter set.
///
/// # Example
/// ```js
/// const info = getMlDsaInfo();
/// console.log(`Public key size: ${info.publicKeySize} bytes`);
/// console.log(`Security level: ${info.securityLevel}`);
/// ```
#[napi]
pub fn get_ml_dsa_info() -> MlDsaInfo {
    MlDsaInfo {
        public_key_size: qudag_crypto::ml_dsa::ML_DSA_PUBLIC_KEY_SIZE as u32,
        secret_key_size: qudag_crypto::ml_dsa::ML_DSA_SECRET_KEY_SIZE as u32,
        signature_size: qudag_crypto::ml_dsa::ML_DSA_SIGNATURE_SIZE as u32,
        security_level: 3,
        algorithm: "ML-DSA-65".to_string(),
    }
}
