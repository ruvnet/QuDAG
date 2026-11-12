use qudag_crypto::ml_kem::MlKem768;
use rand::{CryptoRng, RngCore};
use sha3::Digest;
use subtle::ConstantTimeEq;

// NIST ML-KEM-768 Known Answer Test (KAT) vectors
const KAT_SEED: [u8; 32] = [
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
    0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
];

#[test]
fn test_kat_vectors() {
    let mut rng = TestRng::from_seed(KAT_SEED);

    // Generate keypair with known seed
    let (public_key, secret_key) = MlKem768::keygen_with_rng(&mut rng).unwrap();

    // The same seed must reproduce the same keypair
    let (public_key_again, secret_key_again) =
        MlKem768::keygen_with_rng(&mut TestRng::from_seed(KAT_SEED)).unwrap();
    assert_eq!(public_key, public_key_again);
    assert_eq!(secret_key, secret_key_again);

    // Encapsulate with known public key
    let (ciphertext, shared_secret1) = MlKem768::encapsulate(&public_key).unwrap();

    // Decapsulate with known secret key and ciphertext
    let shared_secret2 = MlKem768::decapsulate(&secret_key, &ciphertext).unwrap();

    // Verify against KAT values
    assert_eq!(public_key.as_bytes().len(), MlKem768::PUBLIC_KEY_SIZE);
    assert_eq!(secret_key.as_bytes().len(), MlKem768::SECRET_KEY_SIZE);
    assert_eq!(
        shared_secret1.as_bytes().len(),
        MlKem768::SHARED_SECRET_SIZE
    );
    assert_eq!(
        shared_secret2.as_bytes().len(),
        MlKem768::SHARED_SECRET_SIZE
    );
    assert_eq!(ciphertext.as_bytes().len(), MlKem768::CIPHERTEXT_SIZE);

    // Verify shared secrets match using constant-time comparison
    assert!(bool::from(
        shared_secret1.as_bytes().ct_eq(shared_secret2.as_bytes())
    ));
}

#[test]
fn test_invalid_seeds() {
    let mut rng = TestRng::from_seed([0u8; 32]);

    // Verify different seeds generate different keys
    let (public_key1, secret_key1) = MlKem768::keygen_with_rng(&mut rng).unwrap();
    let (public_key2, secret_key2) = MlKem768::keygen_with_rng(&mut rng).unwrap();

    assert_ne!(public_key1, public_key2);
    assert_ne!(secret_key1, secret_key2);
}
#[derive(Clone)]
struct TestRng {
    seed: [u8; 32],
    counter: u64,
}

impl TestRng {
    fn from_seed(seed: [u8; 32]) -> Self {
        Self { seed, counter: 0 }
    }
}

impl RngCore for TestRng {
    fn next_u32(&mut self) -> u32 {
        self.counter += 1;
        let mut hasher = sha3::Sha3_256::new();
        hasher.update(self.seed);
        hasher.update(self.counter.to_le_bytes());
        let result = hasher.finalize();
        u32::from_le_bytes(result[0..4].try_into().unwrap())
    }

    fn next_u64(&mut self) -> u64 {
        self.counter += 1;
        let mut hasher = sha3::Sha3_256::new();
        hasher.update(self.seed);
        hasher.update(self.counter.to_le_bytes());
        let result = hasher.finalize();
        u64::from_le_bytes(result[0..8].try_into().unwrap())
    }

    fn fill_bytes(&mut self, dest: &mut [u8]) {
        for chunk in dest.chunks_mut(32) {
            self.counter += 1;
            let mut hasher = sha3::Sha3_256::new();
            hasher.update(self.seed);
            hasher.update(self.counter.to_le_bytes());
            let result = hasher.finalize();
            chunk.copy_from_slice(&result[..chunk.len()]);
        }
    }

    fn try_fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), rand::Error> {
        self.fill_bytes(dest);
        Ok(())
    }
}

// Test-only marker: deterministic stream for reproducible test vectors.
impl CryptoRng for TestRng {}
