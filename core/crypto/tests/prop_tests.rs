//! Property-based tests for cryptographic primitives
//!
//! This module tests the correctness of ML-KEM, ML-DSA, HQC, and fingerprint
//! operations using property-based testing with proptest.

use proptest::prelude::*;
use qudag_crypto::{
    fingerprint::Fingerprint,
    hqc::Hqc256,
    ml_dsa::{MlDsaKeyPair, MlDsaPublicKey},
    ml_kem::MlKem768,
};
use rand::SeedableRng;
use rand_chacha::ChaCha20Rng;

// ML-KEM property tests
proptest! {
    #![proptest_config(ProptestConfig::with_cases(20))]

    #[test]
    fn test_ml_kem_roundtrip(_seed in any::<[u8; 32]>()) {
        let (pk, sk) = MlKem768::keygen().unwrap();
        let (ct, ss1) = MlKem768::encapsulate(&pk).unwrap();
        let ss2 = MlKem768::decapsulate(&sk, &ct).unwrap();

        prop_assert_eq!(ss1.as_bytes(), ss2.as_bytes());
    }

    #[test]
    fn test_ml_kem_key_sizes(_seed in any::<[u8; 32]>()) {
        let (pk, sk) = MlKem768::keygen().unwrap();

        // Verify key sizes match ML-KEM-768 specification
        prop_assert_eq!(pk.as_bytes().len(), MlKem768::PUBLIC_KEY_SIZE);
        prop_assert_eq!(sk.as_bytes().len(), MlKem768::SECRET_KEY_SIZE);
    }

    #[test]
    fn test_ml_kem_shared_secret_size(_seed in any::<[u8; 32]>()) {
        let (pk, _sk) = MlKem768::keygen().unwrap();
        let (ct, ss) = MlKem768::encapsulate(&pk).unwrap();

        prop_assert_eq!(ss.as_bytes().len(), MlKem768::SHARED_SECRET_SIZE);
        prop_assert_eq!(ct.as_bytes().len(), MlKem768::CIPHERTEXT_SIZE);
    }

    #[test]
    fn test_ml_kem_key_uniqueness(
        _seed1 in any::<[u8; 32]>(),
        _seed2 in any::<[u8; 32]>()
    ) {
        let (pk1, _sk1) = MlKem768::keygen().unwrap();
        let (pk2, _sk2) = MlKem768::keygen().unwrap();

        // Different key generations should produce different keys
        // (with overwhelming probability)
        prop_assert_ne!(pk1.as_bytes(), pk2.as_bytes());
    }
}

// ML-DSA property tests
proptest! {
    #![proptest_config(ProptestConfig::with_cases(10))]

    #[test]
    fn test_ml_dsa_sign_verify(
        seed in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 1..256)
    ) {
        let mut rng = ChaCha20Rng::from_seed(seed);
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let signature = keypair.sign(&message, &mut rng).unwrap();

        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();
        prop_assert!(public_key.verify(&message, &signature).is_ok());
    }

    #[test]
    fn test_ml_dsa_signature_tampering(
        seed in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 1..256),
        tamper_byte in any::<u8>()
    ) {
        let mut rng = ChaCha20Rng::from_seed(seed);
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let mut signature = keypair.sign(&message, &mut rng).unwrap();

        // Tamper with signature
        if !signature.is_empty() && tamper_byte != 0 {
            signature[0] ^= tamper_byte;
            let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();
            // Tampered signature should fail verification
            prop_assert!(public_key.verify(&message, &signature).is_err());
        }
    }

    #[test]
    fn test_ml_dsa_message_tampering(
        seed in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 2..256)
    ) {
        let mut rng = ChaCha20Rng::from_seed(seed);
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let signature = keypair.sign(&message, &mut rng).unwrap();

        // Tamper with message
        let mut tampered_message = message.clone();
        tampered_message[0] ^= 0xFF;

        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();
        // Signature should not verify for tampered message
        prop_assert!(public_key.verify(&tampered_message, &signature).is_err());
    }

    #[test]
    fn test_ml_dsa_wrong_key_verification(
        seed1 in any::<[u8; 32]>(),
        seed2 in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 1..256)
    ) {
        if seed1 == seed2 {
            return Ok(());
        }

        let mut rng1 = ChaCha20Rng::from_seed(seed1);
        let mut rng2 = ChaCha20Rng::from_seed(seed2);

        let keypair1 = MlDsaKeyPair::generate(&mut rng1).unwrap();
        let keypair2 = MlDsaKeyPair::generate(&mut rng2).unwrap();

        let signature = keypair1.sign(&message, &mut rng1).unwrap();

        // Signature should not verify with wrong public key
        let wrong_public_key = MlDsaPublicKey::from_bytes(keypair2.public_key()).unwrap();
        prop_assert!(wrong_public_key.verify(&message, &signature).is_err());
    }
}

// Fingerprint property tests
proptest! {
    #![proptest_config(ProptestConfig::with_cases(20))]

    #[test]
    fn test_fingerprint_generation_verification(
        seed in any::<[u8; 32]>(),
        data in prop::collection::vec(any::<u8>(), 0..512)
    ) {
        let mut rng = ChaCha20Rng::from_seed(seed);
        let (fingerprint, public_key) = Fingerprint::generate(&data, &mut rng).unwrap();

        // Fingerprint should verify successfully
        prop_assert!(fingerprint.verify(&public_key).is_ok());

        // Fingerprint data should have consistent size
        prop_assert_eq!(fingerprint.data().len(), 64);
    }

    #[test]
    fn test_fingerprint_uniqueness(
        seed1 in any::<[u8; 32]>(),
        seed2 in any::<[u8; 32]>(),
        data in prop::collection::vec(any::<u8>(), 1..256)
    ) {
        let mut rng1 = ChaCha20Rng::from_seed(seed1);
        let mut rng2 = ChaCha20Rng::from_seed(seed2);

        let (fp1, _) = Fingerprint::generate(&data, &mut rng1).unwrap();
        let (fp2, _) = Fingerprint::generate(&data, &mut rng2).unwrap();

        // Different random seeds should produce different fingerprints
        if seed1 != seed2 {
            prop_assert_ne!(fp1.data(), fp2.data());
        }
    }

    #[test]
    fn test_fingerprint_wrong_key_verification(
        seed1 in any::<[u8; 32]>(),
        seed2 in any::<[u8; 32]>(),
        data in prop::collection::vec(any::<u8>(), 1..256)
    ) {
        if seed1 == seed2 {
            return Ok(());
        }

        let mut rng1 = ChaCha20Rng::from_seed(seed1);
        let mut rng2 = ChaCha20Rng::from_seed(seed2);

        let (fp1, _key1) = Fingerprint::generate(&data, &mut rng1).unwrap();
        let (_fp2, key2) = Fingerprint::generate(&data, &mut rng2).unwrap();

        // Fingerprint should not verify with wrong key
        prop_assert!(fp1.verify(&key2).is_err());
    }
}

// HQC property tests
proptest! {
    #![proptest_config(ProptestConfig::with_cases(10))]

    #[test]
    fn test_hqc_encryption_roundtrip(
        _seed in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 1..32)
    ) {
        let (pk, sk) = Hqc256::keygen().unwrap();
        let ciphertext = Hqc256::encrypt(&pk, &message).unwrap();
        let decrypted = Hqc256::decrypt(&sk, &ciphertext);

        // Decryption should succeed and match original message
        prop_assert!(decrypted.is_ok());
        prop_assert_eq!(decrypted.unwrap(), message);
    }

    #[test]
    fn test_hqc_key_sizes(_seed in any::<[u8; 32]>()) {
        let (pk, sk) = Hqc256::keygen().unwrap();

        // Verify key sizes are non-zero
        prop_assert!(pk.as_bytes().len() > 0);
        prop_assert!(sk.as_bytes().len() > 0);
    }
}

// Cross-primitive property tests
proptest! {
    #![proptest_config(ProptestConfig::with_cases(5))]

    #[test]
    fn test_sign_then_encrypt_roundtrip(
        seed in any::<[u8; 32]>(),
        message in prop::collection::vec(any::<u8>(), 1..100)
    ) {
        let mut rng = ChaCha20Rng::from_seed(seed);

        // Generate keys
        let dsa_keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let (kem_pk, kem_sk) = MlKem768::keygen().unwrap();

        // Sign the message
        let signature = dsa_keypair.sign(&message, &mut rng).unwrap();

        // Encrypt (key encapsulation)
        let (ct, ss1) = MlKem768::encapsulate(&kem_pk).unwrap();

        // Decrypt (key decapsulation)
        let ss2 = MlKem768::decapsulate(&kem_sk, &ct).unwrap();

        // Verify signature
        let public_key = MlDsaPublicKey::from_bytes(dsa_keypair.public_key()).unwrap();

        // All operations should succeed and produce consistent results
        prop_assert_eq!(ss1.as_bytes(), ss2.as_bytes());
        prop_assert!(public_key.verify(&message, &signature).is_ok());
    }
}
