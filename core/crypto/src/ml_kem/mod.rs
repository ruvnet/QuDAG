//! ML-KEM implementation
//!
//! This module implements the NIST-standardized ML-KEM key encapsulation mechanism.
//! ML-KEM provides quantum-resistant key exchange capabilities based on the
//! Module-LWE problem.

use crate::kem::{Ciphertext, KEMError, KeyEncapsulation, PublicKey, SecretKey, SharedSecret};
#[allow(deprecated)]
use ml_kem::ExpandedKeyEncoding;
use ml_kem::{Decapsulate, Encapsulate, KeyExport, MlKem768 as Backend};
use rand::RngCore;
use std::sync::atomic::{AtomicU64, Ordering};
use zeroize::{Zeroize, Zeroizing};

static TOTAL_DECAP_TIME: AtomicU64 = AtomicU64::new(0);
static DECAP_COUNT: AtomicU64 = AtomicU64::new(0);

/// ML-KEM 768 implementation
///
/// # Examples
///
/// ```rust
/// use qudag_crypto::ml_kem::MlKem768;
/// use qudag_crypto::kem::KeyEncapsulation;
///
/// // Generate a keypair
/// let (public_key, secret_key) = MlKem768::keygen().unwrap();
///
/// // Encapsulate a shared secret
/// let (ciphertext, shared_secret1) = MlKem768::encapsulate(&public_key).unwrap();
///
/// // Decapsulate the shared secret  
/// let shared_secret2 = MlKem768::decapsulate(&secret_key, &ciphertext).unwrap();
///
/// // Verify shared secrets match
/// assert_eq!(shared_secret1.as_bytes(), shared_secret2.as_bytes());
/// assert_eq!(shared_secret1.as_bytes().len(), 32);
/// assert_eq!(shared_secret2.as_bytes().len(), 32);
/// ```
pub struct MlKem768;

impl MlKem768 {
    /// Size of public keys in bytes (ML-KEM-768)
    pub const PUBLIC_KEY_SIZE: usize = 1184;

    /// Size of secret keys in bytes (ML-KEM-768)
    pub const SECRET_KEY_SIZE: usize = 2400;

    /// Size of ciphertexts in bytes (ML-KEM-768)
    pub const CIPHERTEXT_SIZE: usize = 1088;

    /// Size of shared secrets in bytes (ML-KEM-768)
    pub const SHARED_SECRET_SIZE: usize = 32;

    /// Security level (NIST level 3)
    pub const SECURITY_LEVEL: u8 = 3;

    /// Compatibility constant: secret caching is disabled.
    pub const CACHE_SIZE: usize = 0;

    /// Generate a new keypair using ML-KEM-768
    ///
    /// This function uses lattice-based cryptography to generate a quantum-resistant
    /// key pair. The key generation is based on the Module-LWE problem.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use qudag_crypto::ml_kem::MlKem768;
    ///
    /// let (public_key, secret_key) = MlKem768::keygen().unwrap();
    /// assert_eq!(public_key.as_bytes().len(), MlKem768::PUBLIC_KEY_SIZE);
    /// assert_eq!(secret_key.as_bytes().len(), MlKem768::SECRET_KEY_SIZE);
    /// ```
    pub fn keygen() -> Result<(PublicKey, SecretKey), KEMError> {
        Self::keygen_with_rng(&mut rand::rngs::OsRng)
    }

    /// Generate from 64 fresh bytes supplied by the caller's cryptographic RNG.
    /// Entropy failures return an error. Seed and serialized secret temporaries
    /// are zeroized; backend secret keys enable the zeroize feature.
    #[allow(deprecated)] // Preserve the existing 2400-byte expanded wire format.
    pub fn keygen_with_rng<R: RngCore + rand::CryptoRng>(
        rng: &mut R,
    ) -> Result<(PublicKey, SecretKey), KEMError> {
        let mut seed = Zeroizing::new(ml_kem::Seed::default());
        rng.try_fill_bytes(seed.as_mut_slice())
            .map_err(|_| KEMError::KeyGenerationError)?;
        let secret = ml_kem::DecapsulationKey::<Backend>::from_seed(*seed);
        seed.zeroize();
        let public = secret.encapsulation_key().to_bytes();
        let encoded = Zeroizing::new(secret.to_expanded_bytes());
        Ok((
            PublicKey::from_bytes(public.as_slice())?,
            SecretKey::from_bytes(encoded.as_slice())?,
        ))
    }

    /// Encapsulate using ML-KEM-768. Reject noncanonical public polynomials
    /// before the backend call, as required by FIPS 203 encapsulation checks.
    pub fn encapsulate(pk: &PublicKey) -> Result<(Ciphertext, SharedSecret), KEMError> {
        let bytes = pk.as_bytes();
        if bytes.len() != Self::PUBLIC_KEY_SIZE {
            return Err(KEMError::InvalidKey);
        }
        for packed in bytes[..1152].chunks(3) {
            let a = u16::from(packed[0]) | ((u16::from(packed[1]) & 15) << 8);
            let b = (u16::from(packed[1]) >> 4) | (u16::from(packed[2]) << 4);
            if a >= 3329 || b >= 3329 {
                return Err(KEMError::InvalidKey);
            }
        }
        let encoded = ml_kem::Key::<ml_kem::EncapsulationKey<Backend>>::try_from(bytes)
            .map_err(|_| KEMError::InvalidKey)?;
        let public =
            ml_kem::EncapsulationKey::<Backend>::new(&encoded).map_err(|_| KEMError::InvalidKey)?;
        let (ct, mut ss) = public.encapsulate();
        let result = SharedSecret::from_bytes(ss.as_slice());
        ss.zeroize();
        Ok((Ciphertext::from_bytes(ct.as_slice())?, result?))
    }

    /// ML-KEM implicit rejection returns a different secret for altered ciphertexts.
    /// Callers must authenticate their protocol. No secrets are globally cached.
    #[allow(deprecated)] // Compatibility with existing expanded secret keys.
    pub fn decapsulate(sk: &SecretKey, ct: &Ciphertext) -> Result<SharedSecret, KEMError> {
        let start = std::time::Instant::now();
        if sk.as_bytes().len() != Self::SECRET_KEY_SIZE {
            return Err(KEMError::InvalidKey);
        }
        let ciphertext = ml_kem::Ciphertext::<Backend>::try_from(ct.as_bytes())
            .map_err(|_| KEMError::InvalidLength)?;
        use sha3::{Digest, Sha3_256};
        use subtle::ConstantTimeEq;
        let digest = Sha3_256::digest(&sk.as_bytes()[1152..2336]);
        if !bool::from(digest.as_slice().ct_eq(&sk.as_bytes()[2336..2368])) {
            return Err(KEMError::InvalidKey);
        }
        let encoded = Zeroizing::new(
            ml_kem::ExpandedDecapsulationKey::<Backend>::try_from(sk.as_bytes())
                .map_err(|_| KEMError::InvalidKey)?,
        );
        let secret = ml_kem::DecapsulationKey::<Backend>::from_expanded(&encoded)
            .map_err(|_| KEMError::InvalidKey)?;
        let mut ss = secret.decapsulate(&ciphertext);
        let result = SharedSecret::from_bytes(ss.as_slice());
        ss.zeroize();
        TOTAL_DECAP_TIME.fetch_add(start.elapsed().as_nanos() as u64, Ordering::Relaxed);
        DECAP_COUNT.fetch_add(1, Ordering::Relaxed);
        result
    }

    /// Get performance metrics
    pub fn get_metrics() -> Metrics {
        let cache_hits = 0;
        let cache_misses = 0;
        let total_time = TOTAL_DECAP_TIME.load(Ordering::Relaxed);
        let decap_count = DECAP_COUNT.load(Ordering::Relaxed);

        let avg_decap_time_ns = total_time.checked_div(decap_count).unwrap_or(0);

        Metrics {
            key_cache_misses: cache_misses,
            key_cache_hits: cache_hits,
            avg_decap_time_ns,
        }
    }
}

impl KeyEncapsulation for MlKem768 {
    fn keygen() -> Result<(PublicKey, SecretKey), KEMError> {
        Self::keygen()
    }

    fn encapsulate(public_key: &PublicKey) -> Result<(Ciphertext, SharedSecret), KEMError> {
        Self::encapsulate(public_key)
    }

    fn decapsulate(
        secret_key: &SecretKey,
        ciphertext: &Ciphertext,
    ) -> Result<SharedSecret, KEMError> {
        Self::decapsulate(secret_key, ciphertext)
    }
}

/// ML-KEM performance metrics
#[derive(Clone, Debug, Default)]
pub struct Metrics {
    /// Number of key cache misses
    pub key_cache_misses: u64,
    /// Number of key cache hits
    pub key_cache_hits: u64,
    /// Average decapsulation time in nanoseconds
    pub avg_decap_time_ns: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ml_kem_768() {
        let (pk, sk) = MlKem768::keygen().unwrap();

        // Test key sizes
        assert_eq!(pk.as_bytes().len(), MlKem768::PUBLIC_KEY_SIZE);
        assert_eq!(sk.as_bytes().len(), MlKem768::SECRET_KEY_SIZE);

        // Test encapsulation/decapsulation
        let (ct, ss1) = MlKem768::encapsulate(&pk).unwrap();
        assert_eq!(ct.as_bytes().len(), MlKem768::CIPHERTEXT_SIZE);
        assert_eq!(ss1.as_bytes().len(), MlKem768::SHARED_SECRET_SIZE);

        let ss2 = MlKem768::decapsulate(&sk, &ct).unwrap();
        assert_eq!(ss1.as_bytes(), ss2.as_bytes());
    }

    #[test]
    fn test_key_sizes() {
        assert_eq!(MlKem768::PUBLIC_KEY_SIZE, 1184);
        assert_eq!(MlKem768::SECRET_KEY_SIZE, 2400);
        assert_eq!(MlKem768::CIPHERTEXT_SIZE, 1088);
        assert_eq!(MlKem768::SHARED_SECRET_SIZE, 32);
        assert_eq!(MlKem768::SECURITY_LEVEL, 3);
    }

    #[test]
    fn test_ciphertext_size() {
        let (pk, _sk) = MlKem768::keygen().unwrap();
        let (ct, _ss) = MlKem768::encapsulate(&pk).unwrap();
        assert_eq!(ct.as_bytes().len(), MlKem768::CIPHERTEXT_SIZE);
    }

    #[test]
    fn test_shared_secret_size() {
        let (pk, _sk) = MlKem768::keygen().unwrap();
        let (_ct, ss) = MlKem768::encapsulate(&pk).unwrap();
        assert_eq!(ss.as_bytes().len(), MlKem768::SHARED_SECRET_SIZE);
    }
}
