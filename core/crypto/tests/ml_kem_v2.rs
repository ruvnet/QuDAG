//! Serialization interoperability with PQClean and an independent RustCrypto implementation.
//! Includes adversarial behavior; these tests do not establish NIST certification.
use pqcrypto_mlkem::mlkem768 as pq;
use pqcrypto_traits::kem::{Ciphertext as _, PublicKey as _, SecretKey as _, SharedSecret as _};
use qudag_crypto::{Ciphertext, KeyPair, MlKem768, PublicKey, SecretKey};

#[test]
fn wrapper_keys_work_with_direct_backend() {
    let (pk, sk) = MlKem768::keygen().unwrap();
    let external = pq::PublicKey::from_bytes(pk.as_bytes()).unwrap();
    let (ss, ct) = pq::encapsulate(&external);
    let ct = Ciphertext::from_bytes(ct.as_bytes()).unwrap();
    assert_eq!(
        ss.as_bytes(),
        MlKem768::decapsulate(&sk, &ct).unwrap().as_bytes()
    );
}

#[test]
fn backend_keys_work_with_wrapper() {
    let (pk, sk) = pq::keypair();
    let (ct, ss) = MlKem768::encapsulate(&PublicKey::from_bytes(pk.as_bytes()).unwrap()).unwrap();
    let external = pq::Ciphertext::from_bytes(ct.as_bytes()).unwrap();
    assert_eq!(ss.as_bytes(), pq::decapsulate(&external, &sk).as_bytes());
    let wrapper_sk = SecretKey::from_bytes(sk.as_bytes()).unwrap();
    assert_eq!(ss, MlKem768::decapsulate(&wrapper_sk, &ct).unwrap());
}

#[test]
fn altered_ciphertext_and_wrong_key_implicitly_reject() {
    let (pk, sk) = MlKem768::keygen().unwrap();
    let (_, wrong_sk) = MlKem768::keygen().unwrap();
    let (ct, ss) = MlKem768::encapsulate(&pk).unwrap();
    assert_ne!(ss, MlKem768::decapsulate(&wrong_sk, &ct).unwrap());
    for position in [0, 31, 511, 1087] {
        let mut bytes = ct.as_bytes().to_vec();
        bytes[position] ^= 1;
        let altered = Ciphertext::from_bytes(&bytes).unwrap();
        let rejected = MlKem768::decapsulate(&sk, &altered).unwrap();
        assert_ne!(ss, rejected);
        assert_eq!(rejected, MlKem768::decapsulate(&sk, &altered).unwrap());
    }
}

#[test]
fn malformed_inputs_are_rejected() {
    let (pk, sk) = MlKem768::keygen().unwrap();
    let (ct, _) = MlKem768::encapsulate(&pk).unwrap();
    for size in [0, 1, 1087, 1089] {
        assert!(
            MlKem768::decapsulate(&sk, &Ciphertext::from_bytes(&vec![0; size]).unwrap()).is_err()
        );
    }
    assert!(MlKem768::encapsulate(&PublicKey::from_bytes(&[255; 1184]).unwrap()).is_err());
    assert!(MlKem768::decapsulate(&SecretKey::from_bytes(&[0; 2400]).unwrap(), &ct).is_err());
    assert!(MlKem768::decapsulate(&SecretKey::from_bytes(&[0; 32]).unwrap(), &ct).is_err());
}

#[test]
fn constructors_are_real_and_debug_is_redacted() {
    let pair = KeyPair::new();
    assert_eq!(pair.public_key().len(), 1184);
    assert_eq!(pair.secret_key().len(), 2400);
    let (ct, ss) =
        MlKem768::encapsulate(&PublicKey::from_bytes(pair.public_key()).unwrap()).unwrap();
    let sk = SecretKey::from_bytes(pair.secret_key()).unwrap();
    assert_eq!(ss, MlKem768::decapsulate(&sk, &ct).unwrap());
    assert_eq!(format!("{:?}", sk), "SecretKey([REDACTED])");
    assert_eq!(format!("{:?}", ss), "SharedSecret([REDACTED])");
    assert!(format!("{:?}", pair).contains("[REDACTED]"));
    assert_eq!(MlKem768::get_metrics().key_cache_hits, 0);
}

#[test]
fn custom_rng_is_consumed_and_reproducible() {
    use rand::SeedableRng;
    let mut a = rand_chacha::ChaCha20Rng::from_seed([7; 32]);
    let mut b = rand_chacha::ChaCha20Rng::from_seed([7; 32]);
    let first = MlKem768::keygen_with_rng(&mut a).unwrap();
    assert_eq!(first, MlKem768::keygen_with_rng(&mut b).unwrap());
    assert_ne!(first, MlKem768::keygen_with_rng(&mut a).unwrap());
}

#[test]
fn independent_pqclean_interoperability_many_pairs() {
    for _ in 0..16 {
        wrapper_keys_work_with_direct_backend();
        backend_keys_work_with_wrapper();
    }
}

#[test]
fn custom_rng_failure_is_propagated() {
    struct FailedRng;
    impl rand::CryptoRng for FailedRng {}
    impl rand::RngCore for FailedRng {
        fn next_u32(&mut self) -> u32 {
            panic!("unexpected infallible RNG call")
        }
        fn next_u64(&mut self) -> u64 {
            panic!("unexpected infallible RNG call")
        }
        fn fill_bytes(&mut self, _: &mut [u8]) {
            panic!("unexpected infallible RNG call")
        }
        fn try_fill_bytes(&mut self, _: &mut [u8]) -> Result<(), rand::Error> {
            Err(rand::Error::new(std::io::Error::other(
                "entropy unavailable",
            )))
        }
    }
    assert!(matches!(
        MlKem768::keygen_with_rng(&mut FailedRng),
        Err(qudag_crypto::KEMError::KeyGenerationError)
    ));
}

#[test]
fn backend_secret_type_zeroizes_on_drop() {
    fn assert_zeroize_on_drop<T: zeroize::ZeroizeOnDrop>() {}
    assert_zeroize_on_drop::<ml_kem::DecapsulationKey<ml_kem::MlKem768>>();
}
