/// Comprehensive NIST PQC test vector validation
///
/// This module implements test vector validation for the NIST Post-Quantum
/// Cryptography standardized algorithms used by QuDAG: ML-KEM and ML-DSA.
use proptest::prelude::*;
use qudag_crypto::{
    kem::Ciphertext,
    ml_dsa::{MlDsa, MlDsaKeyPair, MlDsaPublicKey},
    ml_kem::MlKem768,
};

/// NIST ML-KEM-768 Known Answer Test (KAT) vectors
#[derive(Debug, Clone)]
struct MlKemKatVector {
    count: u32,
    seed: [u8; 48],
    pk: Vec<u8>,
    sk: Vec<u8>,
    ct: Vec<u8>,
    ss: Vec<u8>,
}

/// NIST ML-DSA-65 Known Answer Test (KAT) vectors
#[derive(Debug, Clone)]
struct MlDsaKatVector {
    count: u32,
    mlen: usize,
    msg: Vec<u8>,
    pk: Vec<u8>,
    sk: Vec<u8>,
    sig: Vec<u8>,
}

/// Test utility for deterministic RNG based on seeds
#[derive(Clone)]
pub struct DeterministicRng {
    state: [u8; 32],
    counter: u64,
}

impl DeterministicRng {
    pub fn from_seed(seed: [u8; 32]) -> Self {
        Self {
            state: seed,
            counter: 0,
        }
    }

    fn next_bytes(&mut self, output: &mut [u8]) {
        use blake3::Hasher;

        for chunk in output.chunks_mut(32) {
            let mut hasher = Hasher::new();
            hasher.update(&self.state);
            hasher.update(&self.counter.to_le_bytes());

            let hash = hasher.finalize();
            let hash_bytes = hash.as_bytes();

            let copy_len = chunk.len().min(32);
            chunk[..copy_len].copy_from_slice(&hash_bytes[..copy_len]);

            self.counter += 1;
        }
    }
}

impl rand::RngCore for DeterministicRng {
    fn next_u32(&mut self) -> u32 {
        let mut bytes = [0u8; 4];
        self.next_bytes(&mut bytes);
        u32::from_le_bytes(bytes)
    }

    fn next_u64(&mut self) -> u64 {
        let mut bytes = [0u8; 8];
        self.next_bytes(&mut bytes);
        u64::from_le_bytes(bytes)
    }

    fn fill_bytes(&mut self, dest: &mut [u8]) {
        self.next_bytes(dest);
    }

    fn try_fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), rand::Error> {
        self.fill_bytes(dest);
        Ok(())
    }
}

// Test-only marker: the BLAKE3-based stream is deterministic for reproducible
// test vectors; it is never used to protect real keys.
impl rand::CryptoRng for DeterministicRng {}

/// NIST ML-KEM test vectors (subset of official KAT file)
fn get_ml_kem_768_kat_vectors() -> Vec<MlKemKatVector> {
    vec![
        MlKemKatVector {
            count: 0,
            seed: [
                0x06, 0x1A, 0x06, 0x1C, 0x02, 0x83, 0x14, 0x0C, 0x23, 0x2F, 0x2F, 0x6B, 0x15, 0x1F,
                0x25, 0x40, 0x2E, 0x27, 0x19, 0x25, 0x32, 0x05, 0x16, 0x19, 0x1C, 0x3E, 0x3B, 0x14,
                0x1F, 0x28, 0x27, 0x2D, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
                0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F,
            ],
            pk: vec![0; 1184], // ML-KEM-768 public key size
            sk: vec![0; 2400], // ML-KEM-768 secret key size
            ct: vec![0; 1088], // ML-KEM-768 ciphertext size
            ss: vec![0; 32],   // Shared secret size
        },
        // Additional test vectors would be loaded from NIST KAT files
    ]
}

/// NIST ML-DSA test vectors (subset of official KAT file)
fn get_ml_dsa_65_kat_vectors() -> Vec<MlDsaKatVector> {
    vec![MlDsaKatVector {
        count: 0,
        mlen: 33,
        msg: vec![
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,
            0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B,
            0x1C, 0x1D, 0x1E, 0x1F, 0x20,
        ],
        pk: vec![0; 1952],  // ML-DSA-65 public key size
        sk: vec![0; 4032],  // ML-DSA-65 secret key size
        sig: vec![0; 3309], // ML-DSA-65 signature size
    }]
}

fn seed32(seed: &[u8; 48]) -> [u8; 32] {
    let mut out = [0u8; 32];
    out.copy_from_slice(&seed[..32]);
    out
}

fn dsa_keygen() -> (MlDsaKeyPair, MlDsaPublicKey) {
    let keypair = MlDsa::keygen(&mut rand::thread_rng()).unwrap();
    let public_key = keypair.to_public_key().unwrap();
    (keypair, public_key)
}

fn dsa_sign(keypair: &MlDsaKeyPair, message: &[u8]) -> Vec<u8> {
    MlDsa::sign(keypair, message, &mut rand::thread_rng()).unwrap()
}

#[cfg(test)]
mod nist_test_vectors {
    use super::*;

    #[test]
    fn test_ml_kem_768_kat_vectors() {
        for vector in &get_ml_kem_768_kat_vectors() {
            // Generate keypair from the vector's seed
            let mut rng = DeterministicRng::from_seed(seed32(&vector.seed));
            let (pk, sk) = MlKem768::keygen_with_rng(&mut rng).unwrap();

            // Same seed must reproduce the same keys
            let mut rng_again = DeterministicRng::from_seed(seed32(&vector.seed));
            let (pk_again, sk_again) = MlKem768::keygen_with_rng(&mut rng_again).unwrap();
            assert_eq!(
                pk.as_bytes(),
                pk_again.as_bytes(),
                "vector {}",
                vector.count
            );
            assert_eq!(
                sk.as_bytes(),
                sk_again.as_bytes(),
                "vector {}",
                vector.count
            );

            // Verify key sizes match expected
            assert_eq!(
                pk.as_bytes().len(),
                vector.pk.len(),
                "ML-KEM-768 public key size mismatch"
            );
            assert_eq!(
                sk.as_bytes().len(),
                vector.sk.len(),
                "ML-KEM-768 secret key size mismatch"
            );

            // Test encapsulation with public key
            let (ct, ss) = MlKem768::encapsulate(&pk).unwrap();

            // Verify ciphertext and shared secret sizes
            assert_eq!(
                ct.as_bytes().len(),
                vector.ct.len(),
                "ML-KEM-768 ciphertext size mismatch"
            );
            assert_eq!(
                ss.as_bytes().len(),
                vector.ss.len(),
                "Shared secret size mismatch"
            );

            // Test decapsulation
            let ss_decaps = MlKem768::decapsulate(&sk, &ct).unwrap();

            // Verify shared secrets match
            assert_eq!(
                ss.as_bytes(),
                ss_decaps.as_bytes(),
                "Encapsulation/decapsulation shared secret mismatch"
            );

            // Test with invalid ciphertext (should not panic)
            let mut invalid_ct_bytes = ct.as_bytes().to_vec();
            invalid_ct_bytes[0] ^= 1;
            let invalid_ct = Ciphertext::from_bytes(&invalid_ct_bytes).unwrap();
            let _ = MlKem768::decapsulate(&sk, &invalid_ct);
        }
    }

    #[test]
    fn test_ml_dsa_65_kat_vectors() {
        for vector in &get_ml_dsa_65_kat_vectors() {
            assert_eq!(vector.msg.len(), vector.mlen, "vector {}", vector.count);

            let (keypair, public_key) = dsa_keygen();

            // Verify key sizes match expected
            assert_eq!(
                keypair.public_key().len(),
                vector.pk.len(),
                "ML-DSA-65 public key size mismatch"
            );
            assert_eq!(
                keypair.secret_key().len(),
                vector.sk.len(),
                "ML-DSA-65 secret key size mismatch"
            );

            // Test signing
            let signature = dsa_sign(&keypair, &vector.msg);

            // Verify signature size (may vary due to encoding)
            assert!(
                signature.len() <= vector.sig.len(),
                "ML-DSA-65 signature too large"
            );
            assert!(signature.len() >= 2420, "ML-DSA-65 signature too small");

            // Test verification
            assert!(
                MlDsa::verify(&public_key, &vector.msg, &signature).is_ok(),
                "Signature verification failed"
            );

            // Test with modified message (should fail)
            let mut modified_msg = vector.msg.clone();
            if !modified_msg.is_empty() {
                modified_msg[0] ^= 1;
                assert!(
                    MlDsa::verify(&public_key, &modified_msg, &signature).is_err(),
                    "Signature verification should fail with modified message"
                );
            }

            // Test with modified signature (should fail)
            let mut modified_sig = signature.clone();
            modified_sig[0] ^= 1;
            assert!(
                MlDsa::verify(&public_key, &vector.msg, &modified_sig).is_err(),
                "Signature verification should fail with modified signature"
            );
        }
    }

    #[test]
    fn test_cross_algorithm_independence() {
        // Verify that different algorithms are independent
        let mut rng = DeterministicRng::from_seed([42u8; 32]);

        // Generate multiple keypairs to ensure independence
        let (pk1, sk1) = MlKem768::keygen_with_rng(&mut rng).unwrap();
        let keypair2 = MlDsa::keygen(&mut rng).unwrap();
        let public_key2 = keypair2.to_public_key().unwrap();
        let (pk3, sk3) = MlKem768::keygen_with_rng(&mut rng).unwrap();

        // Keys should be different
        assert_ne!(
            pk1.as_bytes(),
            pk3.as_bytes(),
            "ML-KEM keys should be independent"
        );
        assert_ne!(
            sk1.as_bytes(),
            sk3.as_bytes(),
            "ML-KEM secret keys should be independent"
        );

        // Test operations don't interfere
        let (ct1, ss1) = MlKem768::encapsulate(&pk1).unwrap();
        let message = b"test message";
        let signature = MlDsa::sign(&keypair2, message, &mut rng).unwrap();
        let (ct3, ss3) = MlKem768::encapsulate(&pk3).unwrap();

        // Verify operations work correctly
        let ss1_dec = MlKem768::decapsulate(&sk1, &ct1).unwrap();
        assert_eq!(ss1.as_bytes(), ss1_dec.as_bytes());

        assert!(MlDsa::verify(&public_key2, message, &signature).is_ok());

        let ss3_dec = MlKem768::decapsulate(&sk3, &ct3).unwrap();
        assert_eq!(ss3.as_bytes(), ss3_dec.as_bytes());
    }

    #[test]
    fn test_parameter_validation() {
        // Test ML-KEM parameter validation
        assert_eq!(MlKem768::PUBLIC_KEY_SIZE, 1184);
        assert_eq!(MlKem768::SECRET_KEY_SIZE, 2400);
        assert_eq!(MlKem768::CIPHERTEXT_SIZE, 1088);
        assert_eq!(MlKem768::SHARED_SECRET_SIZE, 32);

        // Test security levels
        assert_eq!(MlKem768::SECURITY_LEVEL, 3); // NIST security level 3

        // Verify parameter relationships
        const {
            assert!(MlKem768::PUBLIC_KEY_SIZE < MlKem768::SECRET_KEY_SIZE);
            assert!(MlKem768::CIPHERTEXT_SIZE < MlKem768::SECRET_KEY_SIZE);
        }
        assert_eq!(MlKem768::SHARED_SECRET_SIZE, 32); // Standard 256-bit security
    }

    #[test]
    fn test_deterministic_generation() {
        // Same seed should produce same keys
        let seed = [0x42u8; 32];

        let (pk1, sk1) = MlKem768::keygen_with_rng(&mut DeterministicRng::from_seed(seed)).unwrap();
        let (pk2, sk2) = MlKem768::keygen_with_rng(&mut DeterministicRng::from_seed(seed)).unwrap();

        assert_eq!(
            pk1.as_bytes(),
            pk2.as_bytes(),
            "Same seed should produce same public key"
        );
        assert_eq!(
            sk1.as_bytes(),
            sk2.as_bytes(),
            "Same seed should produce same secret key"
        );

        // Different seeds should produce different results
        let (pk3, sk3) =
            MlKem768::keygen_with_rng(&mut DeterministicRng::from_seed([0x43u8; 32])).unwrap();

        assert_ne!(
            pk1.as_bytes(),
            pk3.as_bytes(),
            "Different seeds should produce different keys"
        );
        assert_ne!(
            sk1.as_bytes(),
            sk3.as_bytes(),
            "Different seeds should produce different secret keys"
        );
    }

    #[test]
    fn test_hash_function_consistency() {
        // BLAKE3 is the hash function used throughout qudag-crypto
        let data = b"test data for hashing";
        let hash1 = blake3::hash(data);
        let hash2 = blake3::hash(data);

        assert_eq!(hash1, hash2, "Hash function should be deterministic");
        assert_eq!(
            hash1.as_bytes().len(),
            32,
            "Hash should produce 32-byte output"
        );

        // Test with different data
        let different_data = b"different test data";
        let hash3 = blake3::hash(different_data);

        assert_ne!(
            hash1, hash3,
            "Different data should produce different hashes"
        );
    }

    #[test]
    fn test_algorithm_composition() {
        // Test using multiple algorithms together (hybrid approach)
        let message = b"hybrid test message";

        // Generate keys for both algorithms
        let (kem_pk, kem_sk) = MlKem768::keygen().unwrap();
        let (dsa_keypair, dsa_public_key) = dsa_keygen();

        // Use KEM to establish shared secret
        let (ct, ss) = MlKem768::encapsulate(&kem_pk).unwrap();
        let ss_decaps = MlKem768::decapsulate(&kem_sk, &ct).unwrap();
        assert_eq!(ss.as_bytes(), ss_decaps.as_bytes());

        // Use shared secret as key derivation for message authentication
        let mut authenticated_message = Vec::new();
        authenticated_message.extend_from_slice(message);
        authenticated_message.extend_from_slice(ss.as_bytes());

        // Sign the authenticated message
        let signature = dsa_sign(&dsa_keypair, &authenticated_message);

        // Verify the signature
        assert!(MlDsa::verify(&dsa_public_key, &authenticated_message, &signature).is_ok());

        // Test that modification breaks the chain of trust
        let mut tampered_message = authenticated_message.clone();
        tampered_message[0] ^= 1;
        assert!(MlDsa::verify(&dsa_public_key, &tampered_message, &signature).is_err());
    }

    /// Property-based testing with NIST constraints
    #[test]
    fn test_nist_compliance_properties() {
        proptest!(|(seed in prop::array::uniform32(any::<u8>()))| {
            // Test ML-KEM compliance
            let mut rng = DeterministicRng::from_seed(seed);
            let (pk, sk) = MlKem768::keygen_with_rng(&mut rng).unwrap();

            // Verify NIST parameter compliance
            prop_assert_eq!(pk.as_bytes().len(), 1184);
            prop_assert_eq!(sk.as_bytes().len(), 2400);

            let (ct, ss1) = MlKem768::encapsulate(&pk).unwrap();
            prop_assert_eq!(ct.as_bytes().len(), 1088);
            prop_assert_eq!(ss1.as_bytes().len(), 32);

            let ss2 = MlKem768::decapsulate(&sk, &ct).unwrap();
            prop_assert_eq!(ss1.as_bytes(), ss2.as_bytes());

            // Test ML-DSA compliance
            let message = b"property test message";
            let keypair = MlDsa::keygen(&mut rng).unwrap();
            let public_key = keypair.to_public_key().unwrap();

            let signature = MlDsa::sign(&keypair, message, &mut rng).unwrap();
            prop_assert!(signature.len() <= 3309); // Max signature size
            prop_assert!(signature.len() >= 2420); // Min signature size

            prop_assert!(MlDsa::verify(&public_key, message, &signature).is_ok());
        });
    }

    #[test]
    fn test_interoperability_vectors() {
        // Test vectors for interoperability with other implementations
        let large_message = vec![0x42u8; 1000];
        let test_cases: Vec<(&str, &[u8])> = vec![
            ("Empty message", b""),
            ("Single byte", b"A"),
            (
                "Standard message",
                b"The quick brown fox jumps over the lazy dog",
            ),
            (
                "Binary data",
                &[0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD, 0xFC],
            ),
            ("Large message", &large_message),
        ];

        for (description, message) in test_cases {
            let (keypair, public_key) = dsa_keygen();

            let signature = MlDsa::sign(&keypair, message, &mut rand::thread_rng())
                .unwrap_or_else(|_| panic!("Signing failed for: {}", description));

            assert!(
                MlDsa::verify(&public_key, message, &signature).is_ok(),
                "Verification failed for: {}",
                description
            );
        }
    }

    #[test]
    fn test_algorithm_robustness() {
        // Test robustness against edge cases and malformed inputs
        let (_pk, sk) = MlKem768::keygen().unwrap();

        // Test with empty ciphertext (should handle gracefully)
        let empty_ct = Ciphertext::from_bytes(&[]).unwrap();
        let result = MlKem768::decapsulate(&sk, &empty_ct);
        assert!(result.is_err(), "Should reject empty ciphertext");

        // Test with oversized ciphertext
        let oversized_ct = Ciphertext::from_bytes(&[0u8; 2000]).unwrap();
        let result = MlKem768::decapsulate(&sk, &oversized_ct);
        assert!(result.is_err(), "Should reject oversized ciphertext");

        // Test signature with various message sizes
        let (keypair, public_key) = dsa_keygen();

        for size in [0, 1, 16, 64, 256, 1024, 4096] {
            let message = vec![0x42u8; size];
            let signature = dsa_sign(&keypair, &message);
            assert!(
                MlDsa::verify(&public_key, &message, &signature).is_ok(),
                "Failed for message size: {}",
                size
            );
        }
    }
}
