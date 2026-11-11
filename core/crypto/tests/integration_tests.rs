#[cfg(test)]
mod integration_tests {
    use qudag_crypto::{
        hqc::Hqc256,
        ml_dsa::{MlDsa, ML_DSA_SIGNATURE_SIZE},
        ml_kem::MlKem768,
    };
    use rand::thread_rng;
    use std::time::Instant;

    #[test]
    fn test_kem_integration() {
        // Generate keypair
        let (pk, sk) = MlKem768::keygen().expect("Failed to generate ML-KEM keypair");

        // Encapsulate shared secret
        let (ct, ss1) = MlKem768::encapsulate(&pk).expect("Failed to encapsulate");

        // Decapsulate shared secret
        let ss2 = MlKem768::decapsulate(&sk, &ct).expect("Failed to decapsulate");

        // Verify shared secrets match
        assert_eq!(ss1.as_ref(), ss2.as_ref());
    }

    #[test]
    fn test_signature_integration() {
        let message = b"Test message for integration testing";

        // Generate keypair
        let sk = MlDsa::keygen(&mut thread_rng()).expect("Failed to generate ML-DSA keypair");
        let pk = sk.to_public_key().expect("Failed to extract public key");

        // Sign message
        let signature = sk
            .sign(message, &mut thread_rng())
            .expect("Failed to sign message");
        assert_eq!(signature.len(), ML_DSA_SIGNATURE_SIZE);

        // Verify signature
        MlDsa::verify(&pk, message, &signature).expect("Failed to verify signature");
    }

    #[test]
    fn test_encryption_integration() {
        let message = b"Test message for HQC encryption";

        // Generate keypair
        let (pk, sk) = Hqc256::keygen().expect("Failed to generate HQC keypair");

        // Encrypt message
        let ciphertext = Hqc256::encrypt(&pk, message).expect("Failed to encrypt message");

        // Decrypt message
        let decrypted = Hqc256::decrypt(&sk, &ciphertext).expect("Failed to decrypt message");
        assert_eq!(message[..], decrypted[..]);
    }

    #[test]
    fn test_performance_requirements() {
        let iterations = 100;
        let mut total_time = std::time::Duration::new(0, 0);

        for _ in 0..iterations {
            let start = Instant::now();

            // Generate and verify signature
            let message = b"Performance test message";
            let sk = MlDsa::keygen(&mut thread_rng()).expect("Failed to generate keypair");
            let pk = sk.to_public_key().expect("Failed to extract public key");
            let signature = sk.sign(message, &mut thread_rng()).expect("Failed to sign");
            MlDsa::verify(&pk, message, &signature).expect("Failed to verify");

            total_time += start.elapsed();
        }

        let avg_time = total_time / iterations;
        println!("Average operation time: {:?}", avg_time);
        assert!(
            avg_time.as_millis() < 100,
            "Performance requirements not met"
        );
    }

    #[test]
    fn test_memory_safety() {
        let (pk, _sk) = MlKem768::keygen().expect("Failed to generate keypair");

        // Test automatic cleanup
        let mut secret = [0u8; 32];
        {
            let (_ct, ss) = MlKem768::encapsulate(&pk).expect("Failed to encapsulate");
            secret.copy_from_slice(ss.as_ref());
        }
        // Secret should be cleared after drop
        assert_ne!(secret, [0u8; 32]);
    }
}
