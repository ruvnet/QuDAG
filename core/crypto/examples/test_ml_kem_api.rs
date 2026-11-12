// Test file to understand ml-kem API
use qudag_crypto::ml_kem::MlKem768;

fn main() {
    // Generate key pair
    let (pk, sk) = MlKem768::keygen().expect("key generation failed");

    println!("Public key generated");
    println!("Secret key generated");

    // Encapsulate
    let (ciphertext, shared_secret1) = MlKem768::encapsulate(&pk).expect("encapsulation failed");

    println!("Ciphertext generated");
    println!("Shared secret 1 generated");

    // Decapsulate
    let shared_secret2 = MlKem768::decapsulate(&sk, &ciphertext).expect("decapsulation failed");

    println!("Shared secret 2 generated");
    println!("Shared secrets match: {}", shared_secret1 == shared_secret2);
}
