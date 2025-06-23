#!/usr/bin/env -S cargo +nightly -Zscript
//! ```cargo
//! [dependencies]
//! oqs = "0.10.1"
//! ```

use oqs::sig::{Algorithm, Sig, PublicKey, Signature};

fn main() {
    println!("Testing oqs API for reconstruction methods...");
    
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
    let sk_bytes = secret_key.clone().into_vec();
    println!("Public key size: {} bytes", pk_bytes.len());
    println!("Secret key size: {} bytes", sk_bytes.len());
    
    // Check available methods on PublicKey type
    println!("\nChecking PublicKey reconstruction methods...");
    
    // Method 1: Check if there's a from_bytes method on the type
    // (This doesn't exist in oqs 0.10.1)
    
    // Method 2: Check if Sig has a method to create from bytes
    // Let's inspect what methods are available
    
    // Sign a test message
    let message = b"Test message";
    let signature = sig.sign(message, &secret_key).unwrap();
    let sig_bytes = signature.clone().into_vec();
    println!("Signature size: {} bytes", sig_bytes.len());
    
    // Try to verify with original objects
    match sig.verify(message, &signature, &public_key) {
        Ok(_) => println!("Original verification succeeded"),
        Err(e) => println!("Original verification failed: {}", e),
    }
    
    // Now let's see if we can verify from bytes
    println!("\nExploring FFI approach...");
    
    // The oqs crate uses oqs_sys under the hood
    // We need to check if we can access the raw FFI functions
    
    println!("\nConclusion: oqs 0.10.1 doesn't provide methods to reconstruct");
    println!("PublicKey or Signature from raw bytes. We need to:");
    println!("1. Use oqs_sys directly for verification, or");
    println!("2. Keep the native objects and avoid serialization, or");
    println!("3. Fork/patch the oqs crate to add these methods");
}