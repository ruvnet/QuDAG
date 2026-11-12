use proptest::prelude::*;
use qudag_crypto::{
    fingerprint::Fingerprint,
    hqc::{Hqc, Hqc256, SecurityParameter},
    kem::{Ciphertext, KEMError, KeyEncapsulation, PublicKey, SecretKey},
    ml_dsa::{MlDsa, MlDsaKeyPair, MlDsaPublicKey},
    ml_kem::MlKem768,
};
use rand::rngs::StdRng;
use rand::{thread_rng, SeedableRng};
use std::collections::HashSet;
use subtle::ConstantTimeEq;

// ML-KEM property tests
prop_compose! {
    fn arb_kem_keypair()(seed in any::<[u8; 32]>()) -> Result<(PublicKey, SecretKey), KEMError> {
        let mut rng = StdRng::from_seed(seed);
        MlKem768::keygen_with_rng(&mut rng)
    }
}

/// Encapsulate/decapsulate through the generic `KeyEncapsulation` trait.
fn kem_roundtrip<K: KeyEncapsulation>(pk: &PublicKey, sk: &SecretKey) -> (Vec<u8>, Vec<u8>) {
    let (ciphertext, shared_secret1) = K::encapsulate(pk).unwrap();
    let shared_secret2 = K::decapsulate(sk, &ciphertext).unwrap();
    (
        shared_secret1.as_bytes().to_vec(),
        shared_secret2.as_bytes().to_vec(),
    )
}

proptest! {
    #[test]
    fn test_kem_roundtrip(keypair in arb_kem_keypair()) {
        let (pk, sk) = keypair.unwrap();
        let (shared_secret1, shared_secret2) = kem_roundtrip::<MlKem768>(&pk, &sk);

        prop_assert!(bool::from(shared_secret1.ct_eq(&shared_secret2)));
    }

    #[test]
    fn test_kem_key_uniqueness(
        keypair1 in arb_kem_keypair(),
        keypair2 in arb_kem_keypair()
    ) {
        let (pk1, sk1) = keypair1.unwrap();
        let (pk2, sk2) = keypair2.unwrap();

        // Different keys should be generated
        prop_assert_ne!(&pk1, &pk2);
        prop_assert_ne!(&sk1, &sk2);

        // Cross decapsulation must not recover the encapsulated secret
        // (ML-KEM uses implicit rejection: it yields an unrelated secret).
        let (ct1, ss1) = MlKem768::encapsulate(&pk1).unwrap();
        let (ct2, ss2) = MlKem768::encapsulate(&pk2).unwrap();

        let result1 = MlKem768::decapsulate(&sk2, &ct1);
        let result2 = MlKem768::decapsulate(&sk1, &ct2);

        prop_assert!(result1.map_or(true, |ss| ss != ss1));
        prop_assert!(result2.map_or(true, |ss| ss != ss2));
    }
}

// ML-DSA property tests
prop_compose! {
    fn arb_dsa_keypair()(seed in any::<[u8; 32]>()) -> MlDsaKeyPair {
        let mut rng = StdRng::from_seed(seed);
        MlDsaKeyPair::generate(&mut rng).unwrap()
    }
}

proptest! {
    #[test]
    fn test_signature_roundtrip(
        keypair in arb_dsa_keypair(),
        message in prop::collection::vec(any::<u8>(), 1..1024)
    ) {
        let mut rng = thread_rng();
        let signature = keypair.sign(&message, &mut rng).unwrap();
        let public_key = keypair.to_public_key().unwrap();
        prop_assert!(public_key.verify(&message, &signature).is_ok());
    }

    #[test]
    fn test_signature_tampering(
        keypair in arb_dsa_keypair(),
        message in prop::collection::vec(any::<u8>(), 1..1024),
        tamper_index in 0usize..1024,
        tamper_byte in 1u8..=255
    ) {
        let mut rng = thread_rng();
        let mut signature = keypair.sign(&message, &mut rng).unwrap();

        if tamper_index < signature.len() {
            signature[tamper_index] ^= tamper_byte;
            let public_key = keypair.to_public_key().unwrap();
            prop_assert!(public_key.verify(&message, &signature).is_err());
        }
    }
}

// HQC encryption property tests
proptest! {
    #[test]
    fn test_encryption_roundtrip(
        seed in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 1..32)
    ) {
        let hqc = Hqc::new(SecurityParameter::Hqc256);
        let mut rng = StdRng::from_seed(seed);
        let (pk, sk) = hqc.generate_keypair(&mut rng).unwrap();

        let ciphertext = hqc.encrypt(&message, &pk, &mut rng).unwrap();
        let decrypted = hqc.decrypt(&ciphertext, &sk).unwrap();

        prop_assert_eq!(message, decrypted);
    }

    #[test]
    fn test_encryption_tampering(
        message in prop::collection::vec(any::<u8>(), 1..32),
        tamper_index in 0usize..1024,
        tamper_byte in 1u8..=255
    ) {
        let (pk, sk) = Hqc256::keygen().unwrap();
        let mut ciphertext = Hqc256::encrypt(&pk, &message).unwrap();

        if tamper_index < ciphertext.len() {
            ciphertext[tamper_index] ^= tamper_byte;

            // Either an error or a plaintext different from the original
            if let Ok(decrypted) = Hqc256::decrypt(&sk, &ciphertext) {
                prop_assert_ne!(message, decrypted);
            }
        }
    }
}

// Fingerprint property tests
proptest! {
    #[test]
    fn test_fingerprint_properties(
        data in prop::collection::vec(any::<u8>(), 0..1024)
    ) {
        let mut rng = thread_rng();

        // Property: Can generate and verify fingerprint for any data
        let (fingerprint, public_key) = Fingerprint::generate(&data, &mut rng).unwrap();
        prop_assert!(fingerprint.verify(&public_key).is_ok());

        // Property: The fingerprint digest is a deterministic function of the data,
        // while each run signs it under a fresh key, so the signatures differ.
        let (fingerprint2, public_key2) = Fingerprint::generate(&data, &mut rng).unwrap();
        prop_assert_eq!(fingerprint.data(), fingerprint2.data());
        prop_assert_ne!(fingerprint.signature(), fingerprint2.signature());
        prop_assert_ne!(public_key.as_bytes(), public_key2.as_bytes());

        // Property: Fingerprint data length is consistent
        prop_assert_eq!(fingerprint.data().len(), 64);
    }

    #[test]
    fn test_fingerprint_verification_properties(
        data1 in prop::collection::vec(any::<u8>(), 0..1024),
        data2 in prop::collection::vec(any::<u8>(), 0..1024)
    ) {
        let mut rng = thread_rng();

        // Generate two fingerprints
        let (fp1, key1) = Fingerprint::generate(&data1, &mut rng).unwrap();
        let (fp2, key2) = Fingerprint::generate(&data2, &mut rng).unwrap();

        // Property: Cannot verify fingerprint with wrong key
        if data1 != data2 {
            prop_assert!(fp1.verify(&key2).is_err());
            prop_assert!(fp2.verify(&key1).is_err());
        }
    }
}

// Enhanced ML-KEM property tests with mathematical properties
proptest! {
    #[test]
    fn test_ml_kem_mathematical_properties(
        seed1 in any::<[u8; 32]>(),
        seed2 in any::<[u8; 32]>()
    ) {
        let mut rng1 = StdRng::from_seed(seed1);
        let mut rng2 = StdRng::from_seed(seed2);

        // Property: Key generation is deterministic with same seed
        let mut rng1_copy = StdRng::from_seed(seed1);
        let (pk1a, sk1a) = MlKem768::keygen_with_rng(&mut rng1).unwrap();
        let (pk1b, sk1b) = MlKem768::keygen_with_rng(&mut rng1_copy).unwrap();

        prop_assert_eq!(pk1a.as_bytes(), pk1b.as_bytes());
        prop_assert_eq!(sk1a.as_bytes(), sk1b.as_bytes());

        // Property: Different seeds produce different keys
        let (pk2, _) = MlKem768::keygen_with_rng(&mut rng2).unwrap();
        if seed1 != seed2 {
            prop_assert_ne!(pk1a.as_bytes(), pk2.as_bytes());
        }

        // Property: Encapsulation is probabilistic (different outputs for same input)
        let (ct1, ss1) = MlKem768::encapsulate(&pk1a).unwrap();
        let (ct2, ss2) = MlKem768::encapsulate(&pk1a).unwrap();
        prop_assert_ne!(ct1.as_bytes(), ct2.as_bytes());

        // Property: Decapsulation recovers the correct shared secret
        let recovered_ss1 = MlKem768::decapsulate(&sk1a, &ct1).unwrap();
        let recovered_ss2 = MlKem768::decapsulate(&sk1a, &ct2).unwrap();

        prop_assert_eq!(ss1.as_bytes(), recovered_ss1.as_bytes());
        prop_assert_eq!(ss2.as_bytes(), recovered_ss2.as_bytes());
    }

    #[test]
    fn test_ml_kem_key_size_invariants(
        seed in any::<[u8; 32]>()
    ) {
        let mut rng = StdRng::from_seed(seed);
        let (pk, sk) = MlKem768::keygen_with_rng(&mut rng).unwrap();

        // Property: Key sizes are as expected for ML-KEM-768
        prop_assert_eq!(pk.as_bytes().len(), 1184); // ML-KEM-768 public key size
        prop_assert_eq!(sk.as_bytes().len(), 2400); // ML-KEM-768 secret key size

        // Property: Shared secret and ciphertext sizes are consistent
        let (ciphertext, shared_secret) = MlKem768::encapsulate(&pk).unwrap();
        prop_assert_eq!(shared_secret.as_bytes().len(), 32); // 256-bit shared secret
        prop_assert_eq!(ciphertext.as_bytes().len(), 1088);
    }

    #[test]
    fn test_ml_kem_error_conditions(
        seed in any::<[u8; 32]>(),
        tamper_byte in 1u8..=255,
        tamper_pos in 0usize..2400
    ) {
        let mut rng = StdRng::from_seed(seed);
        let (pk, sk) = MlKem768::keygen_with_rng(&mut rng).unwrap();
        let (ciphertext, _) = MlKem768::encapsulate(&pk).unwrap();

        // Property: Tampering with ciphertext causes decapsulation failure or different result
        let mut ct_bytes = ciphertext.as_bytes().to_vec();
        if tamper_pos < ct_bytes.len() {
            ct_bytes[tamper_pos] ^= tamper_byte;
            let tampered_ct = Ciphertext::from_bytes(&ct_bytes).unwrap();

            let result = MlKem768::decapsulate(&sk, &tampered_ct);
            // Either fails or produces different shared secret
            let original_ss = MlKem768::decapsulate(&sk, &ciphertext).unwrap();
            prop_assert!(result.map_or(true, |ss| ss.as_bytes() != original_ss.as_bytes()));
        }
    }
}

// Enhanced ML-DSA (ML-DSA-65) signature property tests
proptest! {
    #[test]
    fn test_ml_dsa_mathematical_properties(
        seed in any::<[u8; 32]>(),
        messages in prop::collection::vec(
            prop::collection::vec(any::<u8>(), 0..1024),
            1..10
        )
    ) {
        let mut rng = StdRng::from_seed(seed);
        let keypair = MlDsa::keygen(&mut rng).unwrap();
        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();

        let mut signatures = Vec::new();

        for message in &messages {
            let signature = MlDsa::sign(&keypair, message, &mut rng).unwrap();

            // Property: Signature verification always succeeds for valid signatures
            prop_assert!(MlDsa::verify(&public_key, message, &signature).is_ok());

            signatures.push(signature);
        }

        // Property: Different messages produce different signatures (high probability)
        let signature_set: HashSet<Vec<u8>> = signatures.iter().cloned().collect();

        // With different messages, we should get different signatures
        let unique_messages: HashSet<_> = messages.iter().collect();
        if unique_messages.len() > 1 {
            prop_assert!(signature_set.len() > 1, "All signatures are identical for different messages");
        }
    }

    #[test]
    fn test_ml_dsa_signature_properties(
        seed in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 1..1024)
    ) {
        let mut rng = StdRng::from_seed(seed);
        let keypair = MlDsa::keygen(&mut rng).unwrap();
        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();

        // Property: Multiple signatures of same message are different (hedged signing)
        let sig1 = MlDsa::sign(&keypair, &message, &mut rng).unwrap();
        let sig2 = MlDsa::sign(&keypair, &message, &mut rng).unwrap();

        // Both should verify correctly
        prop_assert!(MlDsa::verify(&public_key, &message, &sig1).is_ok());
        prop_assert!(MlDsa::verify(&public_key, &message, &sig2).is_ok());

        // Signatures should be different due to randomization
        prop_assert_ne!(sig1, sig2);
    }

    #[test]
    fn test_ml_dsa_key_size_invariants(
        seed in any::<[u8; 32]>()
    ) {
        let mut rng = StdRng::from_seed(seed);
        let keypair = MlDsa::keygen(&mut rng).unwrap();
        let params = MlDsa::parameters();

        // Property: Key sizes are as expected for ML-DSA-65
        prop_assert_eq!(keypair.public_key().len(), 1952);
        prop_assert_eq!(keypair.secret_key().len(), 4032);
        prop_assert_eq!(keypair.public_key().len(), params.public_key_size);
        prop_assert_eq!(keypair.secret_key().len(), params.secret_key_size);

        // Property: Signature size is fixed for ML-DSA-65
        let message = vec![1, 2, 3, 4];
        let signature = MlDsa::sign(&keypair, &message, &mut rng).unwrap();
        prop_assert_eq!(signature.len(), 3309);
        prop_assert!(MlDsa::validate_signature_format(&signature));
    }
}

// Enhanced HQC encryption property tests
proptest! {
    #[test]
    fn test_hqc_mathematical_properties(
        plaintexts in prop::collection::vec(
            prop::collection::vec(any::<u8>(), 1..64),
            1..5
        )
    ) {
        let (pk, sk) = Hqc256::keygen().unwrap();

        for plaintext in &plaintexts {
            // Property: Encryption followed by decryption is identity
            let ciphertext = Hqc256::encrypt(&pk, plaintext).unwrap();
            let decrypted = Hqc256::decrypt(&sk, &ciphertext).unwrap();

            prop_assert_eq!(plaintext, &decrypted);

            // Property: Encryption is probabilistic
            let ciphertext2 = Hqc256::encrypt(&pk, plaintext).unwrap();
            prop_assert_ne!(ciphertext, ciphertext2);
        }
    }

    #[test]
    fn test_hqc_error_propagation(
        plaintext in prop::collection::vec(any::<u8>(), 1..32),
        error_positions in prop::collection::vec(0usize..1024, 1..10)
    ) {
        let (pk, sk) = Hqc256::keygen().unwrap();

        let ciphertext = Hqc256::encrypt(&pk, &plaintext).unwrap();

        // Property: Small errors in ciphertext must never panic; decryption
        // either fails or returns some plaintext of the original length.
        let mut corrupted_ct = ciphertext.clone();
        for &pos in &error_positions {
            if pos < corrupted_ct.len() {
                corrupted_ct[pos] ^= 1; // Single bit flip
            }
        }

        if let Ok(decrypted) = Hqc256::decrypt(&sk, &corrupted_ct) {
            prop_assert_eq!(decrypted.len(), plaintext.len());
        }
    }
}

// BLAKE3 hash property tests, exercised through the fingerprint digest
// (64-byte BLAKE3 XOF output of the data).
fn fingerprint_digest(data: &[u8]) -> Vec<u8> {
    let mut rng = thread_rng();
    let (fingerprint, _) = Fingerprint::generate(data, &mut rng).unwrap();
    fingerprint.data().to_vec()
}

proptest! {
    #[test]
    fn test_hash_function_properties(
        inputs in prop::collection::vec(
            prop::collection::vec(any::<u8>(), 0..1024),
            1..20
        )
    ) {
        let mut hashes = HashSet::new();

        for input in &inputs {
            let hash = fingerprint_digest(input);

            // Property: Hash has consistent size
            prop_assert_eq!(hash.len(), 64);

            // Property: Same input produces same hash
            let hash2 = fingerprint_digest(input);
            prop_assert_eq!(&hash, &hash2);

            hashes.insert(hash);
        }

        // Property: Different inputs produce different hashes (collision resistance)
        let unique_inputs: HashSet<_> = inputs.iter().collect();
        prop_assert_eq!(hashes.len(), unique_inputs.len());
    }

    #[test]
    fn test_hash_avalanche_effect(
        base_input in prop::collection::vec(any::<u8>(), 1..100),
        bit_position in 0usize..800
    ) {
        if bit_position / 8 < base_input.len() {
            let mut modified_input = base_input.clone();
            modified_input[bit_position / 8] ^= 1 << (bit_position % 8);

            let hash1 = fingerprint_digest(&base_input);
            let hash2 = fingerprint_digest(&modified_input);

            // Property: Single bit change should flip about half of the 512 output
            // bits. 192 is > 5 standard deviations below the expected 256.
            let diff_bits: u32 = hash1
                .iter()
                .zip(hash2.iter())
                .map(|(a, b)| (a ^ b).count_ones())
                .sum();

            prop_assert!(diff_bits >= 192, "Insufficient avalanche effect: {} bits changed", diff_bits);
        }
    }
}

// Cross-primitive property tests
proptest! {
    #[test]
    fn test_hybrid_crypto_properties(
        seed in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 1..100)
    ) {
        let mut rng = StdRng::from_seed(seed);

        // Generate keys for all primitives
        let (kem_pk, kem_sk) = MlKem768::keygen_with_rng(&mut rng).unwrap();
        let dsa_keypair = MlDsa::keygen(&mut rng).unwrap();
        let dsa_public = dsa_keypair.to_public_key().unwrap();
        let (hqc_pk, hqc_sk) = Hqc256::keygen().unwrap();

        // Property: KEM establishes a shared secret
        let (kem_ct, shared_secret) = MlKem768::encapsulate(&kem_pk).unwrap();

        // Hash-then-sign the message
        let message_hash = fingerprint_digest(&message);
        let signature = MlDsa::sign(&dsa_keypair, &message_hash, &mut rng).unwrap();

        // Verify the signature
        prop_assert!(MlDsa::verify(&dsa_public, &message_hash, &signature).is_ok());

        // Recover shared secret
        let recovered_secret = MlKem768::decapsulate(&kem_sk, &kem_ct).unwrap();
        prop_assert_eq!(shared_secret.as_bytes(), recovered_secret.as_bytes());

        // Property: HQC transports the KEM shared secret intact
        let wrapped = Hqc256::encrypt(&hqc_pk, shared_secret.as_bytes()).unwrap();
        let unwrapped = Hqc256::decrypt(&hqc_sk, &wrapped).unwrap();
        prop_assert_eq!(unwrapped.as_slice(), recovered_secret.as_bytes());

        // Property: Hash-then-sign preserves message authenticity
        let mut modified_message = message.clone();
        modified_message[0] ^= 1;

        let modified_hash = fingerprint_digest(&modified_message);
        prop_assert!(MlDsa::verify(&dsa_public, &modified_hash, &signature).is_err());
    }
}
