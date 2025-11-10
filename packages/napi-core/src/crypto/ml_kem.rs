use napi::bindgen_prelude::*;
use napi_derive::napi;
use qudag_crypto::{
    kem::{Ciphertext as CoreCiphertext, PublicKey as CorePublicKey, SecretKey as CoreSecretKey, SharedSecret as CoreSharedSecret},
    MlKem768,
};

/// ML-KEM-768 key encapsulation mechanism
///
/// This class provides static methods for quantum-resistant key exchange
/// using the ML-KEM (Kyber) algorithm at security level 3.
#[napi]
pub struct MlKem;

#[napi]
impl MlKem {
    /// Generate a new ML-KEM-768 key pair
    ///
    /// Creates a new key pair for key encapsulation. The public key can be shared
    /// with others to allow them to encapsulate shared secrets.
    ///
    /// # Returns
    /// An object containing both the public key and secret key
    ///
    /// # Example
    /// ```js
    /// const { publicKey, secretKey } = MlKem.keygen();
    /// ```
    #[napi(factory)]
    pub fn keygen() -> Result<MlKemKeyPair> {
        let (pk, sk) = MlKem768::keygen()
            .map_err(|e| Error::from_reason(format!("Key generation failed: {}", e)))?;

        Ok(MlKemKeyPair {
            public_key: Uint8Array::new(pk.as_bytes().to_vec()),
            secret_key: Uint8Array::new(sk.as_bytes().to_vec()),
        })
    }

    /// Encapsulate a shared secret
    ///
    /// Uses a public key to encapsulate a random shared secret. The recipient
    /// can use their secret key to decapsulate and recover the same shared secret.
    ///
    /// # Arguments
    /// * `public_key` - The recipient's public key (1184 bytes)
    ///
    /// # Returns
    /// An object containing the ciphertext and shared secret
    ///
    /// # Example
    /// ```js
    /// const { ciphertext, sharedSecret } = MlKem.encapsulate(publicKey);
    /// // Send ciphertext to recipient
    /// // Use sharedSecret for encryption
    /// ```
    #[napi]
    pub fn encapsulate(public_key: Buffer) -> Result<MlKemEncapsulation> {
        let pk = CorePublicKey::from_bytes(&public_key)
            .map_err(|e| Error::from_reason(format!("Invalid public key: {}", e)))?;

        let (ct, ss) = MlKem768::encapsulate(&pk)
            .map_err(|e| Error::from_reason(format!("Encapsulation failed: {}", e)))?;

        Ok(MlKemEncapsulation {
            ciphertext: Uint8Array::new(ct.as_bytes().to_vec()),
            shared_secret: Uint8Array::new(ss.as_bytes().to_vec()),
        })
    }

    /// Decapsulate a shared secret
    ///
    /// Uses a secret key to recover the shared secret from a ciphertext.
    /// This should produce the same shared secret that was generated during encapsulation.
    ///
    /// # Arguments
    /// * `secret_key` - Your secret key (2400 bytes)
    /// * `ciphertext` - The ciphertext received from the sender (1088 bytes)
    ///
    /// # Returns
    /// The shared secret (32 bytes)
    ///
    /// # Example
    /// ```js
    /// const sharedSecret = MlKem.decapsulate(secretKey, ciphertext);
    /// // Use sharedSecret for decryption
    /// ```
    #[napi]
    pub fn decapsulate(secret_key: Buffer, ciphertext: Buffer) -> Result<Uint8Array> {
        let sk = CoreSecretKey::from_bytes(&secret_key)
            .map_err(|e| Error::from_reason(format!("Invalid secret key: {}", e)))?;

        let ct = CoreCiphertext::from_bytes(&ciphertext)
            .map_err(|e| Error::from_reason(format!("Invalid ciphertext: {}", e)))?;

        let ss = MlKem768::decapsulate(&sk, &ct)
            .map_err(|e| Error::from_reason(format!("Decapsulation failed: {}", e)))?;

        Ok(Uint8Array::new(ss.as_bytes().to_vec()))
    }

    /// Get ML-KEM-768 parameters
    ///
    /// Returns information about the ML-KEM-768 algorithm parameters.
    ///
    /// # Example
    /// ```js
    /// const info = MlKem.getInfo();
    /// console.log(`Shared secret size: ${info.sharedSecretSize} bytes`);
    /// ```
    #[napi]
    pub fn get_info() -> MlKemInfo {
        MlKemInfo {
            public_key_size: MlKem768::PUBLIC_KEY_SIZE as u32,
            secret_key_size: MlKem768::SECRET_KEY_SIZE as u32,
            ciphertext_size: MlKem768::CIPHERTEXT_SIZE as u32,
            shared_secret_size: MlKem768::SHARED_SECRET_SIZE as u32,
            security_level: MlKem768::SECURITY_LEVEL,
            algorithm: "ML-KEM-768".to_string(),
        }
    }
}

/// ML-KEM key pair
///
/// Contains both the public key (for encapsulation) and secret key (for decapsulation).
#[napi(object)]
pub struct MlKemKeyPair {
    /// Public key (1184 bytes) - can be shared with others
    pub public_key: Uint8Array,
    /// Secret key (2400 bytes) - must be kept secret
    pub secret_key: Uint8Array,
}

/// ML-KEM encapsulation result
///
/// Contains the ciphertext (to send to recipient) and shared secret (for encryption).
#[napi(object)]
pub struct MlKemEncapsulation {
    /// Ciphertext (1088 bytes) - send this to the recipient
    pub ciphertext: Uint8Array,
    /// Shared secret (32 bytes) - use this for symmetric encryption
    pub shared_secret: Uint8Array,
}

/// ML-KEM algorithm information
#[napi(object)]
pub struct MlKemInfo {
    /// Size of public keys in bytes
    pub public_key_size: u32,
    /// Size of secret keys in bytes
    pub secret_key_size: u32,
    /// Size of ciphertexts in bytes
    pub ciphertext_size: u32,
    /// Size of shared secrets in bytes
    pub shared_secret_size: u32,
    /// NIST security level (3 = AES-192 equivalent)
    pub security_level: u8,
    /// Algorithm identifier
    pub algorithm: String,
}
