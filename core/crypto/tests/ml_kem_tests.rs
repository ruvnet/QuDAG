use proptest::prelude::*;
use qudag_crypto::kem::{Ciphertext, PublicKey, SecretKey};
use qudag_crypto::ml_kem::MlKem768;
use rand::RngCore;

// Historical files contain all-zero placeholders, not official NIST vectors.
// Independent implementation interoperability is covered in ml_kem_v2.rs.
const INVALID_SK: [u8; MlKem768::SECRET_KEY_SIZE] = include!(".test_vectors/mlkem768_sk.txt");
const INVALID_CT: [u8; MlKem768::CIPHERTEXT_SIZE] = include!(".test_vectors/mlkem768_ct.txt");

#[test]
fn test_mlkem_key_generation() {
    let (pk, sk) = MlKem768::keygen().expect("Key generation should succeed");

    // Verify key sizes
    assert_eq!(pk.as_bytes().len(), MlKem768::PUBLIC_KEY_SIZE);
    assert_eq!(sk.as_bytes().len(), MlKem768::SECRET_KEY_SIZE);

    // Verify keys are not all zeros
    assert_ne!(pk.as_bytes(), &[0u8; MlKem768::PUBLIC_KEY_SIZE]);
    assert_ne!(sk.as_bytes(), &[0u8; MlKem768::SECRET_KEY_SIZE]);
}

#[test]
fn test_mlkem_encapsulation_decapsulation() {
    let (pk, sk) = MlKem768::keygen().expect("Key generation should succeed");
    let (ciphertext, shared_secret_1) =
        MlKem768::encapsulate(&pk).expect("Encapsulation should succeed");
    let shared_secret_2 =
        MlKem768::decapsulate(&sk, &ciphertext).expect("Decapsulation should succeed");

    // Verify sizes
    assert_eq!(ciphertext.as_bytes().len(), MlKem768::CIPHERTEXT_SIZE);
    assert_eq!(
        shared_secret_1.as_bytes().len(),
        MlKem768::SHARED_SECRET_SIZE
    );
    assert_eq!(
        shared_secret_2.as_bytes().len(),
        MlKem768::SHARED_SECRET_SIZE
    );

    // Verify shared secrets match
    assert_eq!(shared_secret_1.as_bytes(), shared_secret_2.as_bytes());

    // Verify ciphertext and shared secret are not all zeros
    assert_ne!(ciphertext.as_bytes(), &[0u8; MlKem768::CIPHERTEXT_SIZE]);
    assert_ne!(
        shared_secret_1.as_bytes(),
        &[0u8; MlKem768::SHARED_SECRET_SIZE]
    );
}

#[test]
fn test_mlkem_rejects_historical_placeholder_vectors() {
    let sk = SecretKey::from_bytes(&INVALID_SK).unwrap();
    let ct = Ciphertext::from_bytes(&INVALID_CT).unwrap();
    assert!(MlKem768::decapsulate(&sk, &ct).is_err());
}

#[test]
fn test_mlkem_invalid_inputs() {
    let (_, sk) = MlKem768::keygen().expect("Key generation should succeed");

    // Test with invalid ciphertext length
    let short_ct = vec![0u8; MlKem768::CIPHERTEXT_SIZE - 1];
    let ct = Ciphertext::from_bytes(&short_ct).expect("Valid ciphertext creation");
    let result = MlKem768::decapsulate(&sk, &ct);
    assert!(result.is_err());

    // Test with random invalid ciphertext
    let mut invalid_ct = vec![0u8; MlKem768::CIPHERTEXT_SIZE];
    rand::thread_rng().fill_bytes(&mut invalid_ct);
    let ct = Ciphertext::from_bytes(&invalid_ct).expect("Valid ciphertext creation");
    let result = MlKem768::decapsulate(&sk, &ct);
    // Same-length invalid ciphertext uses implicit rejection, not an error oracle.
    assert!(result.is_ok());
}

proptest! {
    #[test]
    fn test_mlkem_random_keys_do_not_panic(
        pk_bytes in prop::collection::vec(any::<u8>(), MlKem768::PUBLIC_KEY_SIZE)
    ) {
        let pk = PublicKey::from_bytes(&pk_bytes).unwrap();
        // Public input validation may reject noncanonical coefficients.
        // Wall-clock sampling cannot establish constant-time behavior.
        if let Ok((ct, ss)) = MlKem768::encapsulate(&pk) {
            prop_assert_eq!(ct.as_bytes().len(), MlKem768::CIPHERTEXT_SIZE);
            prop_assert_eq!(ss.as_bytes().len(), MlKem768::SHARED_SECRET_SIZE);
        }
    }
}

#[test]
fn test_key_and_shared_secret_equality() {
    let (pk1, sk1) = MlKem768::keygen().expect("Key generation should succeed");
    let (pk2, sk2) = MlKem768::keygen().expect("Key generation should succeed");

    // Test constant-time equality comparisons
    assert!(pk1 != pk2);
    assert!(sk1 != sk2);

    let (ct1, ss1) = MlKem768::encapsulate(&pk1).expect("Encapsulation should succeed");
    let ss2 = MlKem768::decapsulate(&sk1, &ct1).expect("Decapsulation should succeed");

    // Test shared secret constant-time comparison
    assert!(ss1 == ss2);
}

#[test]
fn test_repeated_decapsulation_without_secret_cache() {
    let (pk, sk) = MlKem768::keygen().unwrap();
    let (ct, ss) = MlKem768::encapsulate(&pk).unwrap();
    for _ in 0..100 {
        assert_eq!(ss, MlKem768::decapsulate(&sk, &ct).unwrap());
    }
    let metrics = MlKem768::get_metrics();
    assert_eq!(metrics.key_cache_hits, 0);
    assert_eq!(metrics.key_cache_misses, 0);
}
