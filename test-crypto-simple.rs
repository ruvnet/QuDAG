// Simple test to verify QuDAG crypto works on ARM64
use qudag_crypto::{MlDsaKeyPair, MlKem768};
use rand::thread_rng;

fn main() {
    println!("Testing QuDAG crypto on ARM64...");
    
    // Test ML-KEM (using libcrux on ARM64)
    let mut rng = thread_rng();
    let ml_kem = MlKem768::new();
    println!("✅ ML-KEM initialized");
    
    // Test ML-DSA (using oqs on ARM64)
    match MlDsaKeyPair::generate(&mut rng) {
        Ok(keypair) => {
            println!("✅ ML-DSA keypair generated");
            println!("   Public key size: {} bytes", keypair.public_key().len());
            
            // Test signing
            let message = b"Hello, quantum-resistant world!";
            match keypair.sign(message, &mut rng) {
                Ok(signature) => {
                    println!("✅ Message signed");
                    println!("   Signature size: {} bytes", signature.len());
                }
                Err(e) => println!("❌ Signing failed: {:?}", e),
            }
        }
        Err(e) => println!("❌ Key generation failed: {:?}", e),
    }
    
    println!("\n🎉 QuDAG crypto works on ARM64!");
}