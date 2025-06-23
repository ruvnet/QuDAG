// Quick test to check oqs API
use oqs::sig::{Algorithm, Sig};

fn main() {
    println!("Testing oqs API...");
    
    // Initialize ML-DSA algorithm
    let sig = match Sig::new(Algorithm::MlDsa65) {
        Ok(s) => s,
        Err(e) => {
            println!("Failed to initialize: {}", e);
            return;
        }
    };
    
    // Generate a keypair
    let (public_key, secret_key) = match sig.keypair() {
        Ok((pk, sk)) => (pk, sk),
        Err(e) => {
            println!("Failed to generate keypair: {}", e);
            return;
        }
    };
    
    println!("Generated keypair!");
    
    // Get bytes
    let pk_bytes = public_key.clone().into_vec();
    println!("Public key size: {} bytes", pk_bytes.len());
    
    // Check available methods
    println!("\nChecking how to reconstruct from bytes...");
    
    // Try to create from slice
    match oqs::sig::PublicKey::try_from_bytes(&pk_bytes) {
        Ok(_) => println!("try_from_bytes works!"),
        Err(_) => println!("try_from_bytes doesn't exist or failed"),
    }
    
    // Alternative: use the algorithm's method
    match sig.public_key_from_bytes(&pk_bytes) {
        Ok(_) => println!("sig.public_key_from_bytes works!"),
        Err(_) => println!("sig.public_key_from_bytes doesn't exist or failed"),
    }
}