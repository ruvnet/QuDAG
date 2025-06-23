//! FFI-based verification for ML-DSA using oqs-sys
//!
//! This module provides direct FFI access to liboqs for signature verification,
//! bypassing the limitations of the oqs Rust wrapper which doesn't expose
//! methods to reconstruct PublicKey/Signature from raw bytes.

#![allow(unsafe_code)]

use super::{MlDsaError, ML_DSA_PUBLIC_KEY_SIZE, ML_DSA_SIGNATURE_SIZE};
use oqs_sys::sig::{OQS_SIG_alg_ml_dsa_65, OQS_SIG_new, OQS_SIG_verify, OQS_SIG_free};
use oqs_sys::sig::OQS_STATUS;
use std::ffi::CStr;

/// Verify an ML-DSA signature using direct FFI calls to liboqs
///
/// This function bypasses the oqs Rust wrapper limitations by directly
/// calling the C library functions.
pub unsafe fn verify_signature_ffi(
    public_key: &[u8],
    message: &[u8],
    signature: &[u8],
) -> Result<(), MlDsaError> {
    // Validate input sizes
    if public_key.len() != ML_DSA_PUBLIC_KEY_SIZE {
        return Err(MlDsaError::InvalidKeyLength {
            expected: ML_DSA_PUBLIC_KEY_SIZE,
            found: public_key.len(),
        });
    }
    
    if signature.len() < 2000 || signature.len() > ML_DSA_SIGNATURE_SIZE {
        return Err(MlDsaError::InvalidSignatureLength {
            expected: ML_DSA_SIGNATURE_SIZE,
            found: signature.len(),
        });
    }
    
    // Get ML-DSA-65 algorithm identifier
    let alg_name = OQS_SIG_alg_ml_dsa_65.as_ptr() as *const libc::c_char;
    
    // Create signature object
    let sig = OQS_SIG_new(alg_name);
    if sig.is_null() {
        return Err(MlDsaError::InternalError("Failed to create OQS_SIG object".to_string()));
    }
    
    // Perform verification
    let result = OQS_SIG_verify(
        sig,
        message.as_ptr(),
        message.len(),
        signature.as_ptr(),
        signature.len(),
        public_key.as_ptr(),
    );
    
    // Clean up
    OQS_SIG_free(sig);
    
    // Check result
    if result == OQS_STATUS::OQS_SUCCESS {
        Ok(())
    } else {
        Err(MlDsaError::VerificationFailed)
    }
}

/// Get the algorithm name for ML-DSA-65
pub fn get_algorithm_name() -> Result<String, MlDsaError> {
    unsafe {
        let alg_name = OQS_SIG_alg_ml_dsa_65.as_ptr() as *const libc::c_char;
        let c_str = CStr::from_ptr(alg_name);
        Ok(c_str.to_string_lossy().into_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_algorithm_available() {
        let name = get_algorithm_name().expect("ML-DSA-65 should be available");
        assert!(name.contains("ML-DSA") || name.contains("Dilithium"));
    }
}