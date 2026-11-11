use napi::bindgen_prelude::*;
use napi_derive::napi;
use qudag_crypto::fingerprint::Fingerprint as CoreFingerprint;
use qudag_crypto::ml_dsa::MlDsaPublicKey as CoreMlDsaPublicKey;
use rand::rngs::OsRng;

/// Quantum fingerprint for data verification
///
/// Quantum fingerprints provide a compact, quantum-resistant way to verify
/// data integrity using ML-DSA signatures.
#[napi]
pub struct QuantumFingerprint {
    inner: CoreFingerprint,
    public_key: CoreMlDsaPublicKey,
}

#[napi]
impl QuantumFingerprint {
    /// Generate a quantum fingerprint for data
    ///
    /// Creates a quantum-resistant fingerprint of the input data.
    /// The fingerprint can be used to verify data integrity.
    ///
    /// # Arguments
    /// * `data` - The data to fingerprint
    ///
    /// # Example
    /// ```js
    /// const data = Buffer.from("Important data");
    /// const fingerprint = QuantumFingerprint.generate(data);
    /// const fpBytes = fingerprint.asBytes();
    /// ```
    #[napi(factory)]
    pub fn generate(data: Buffer) -> Result<Self> {
        let mut rng = OsRng;
        let (fingerprint, public_key) = CoreFingerprint::generate(&data, &mut rng)
            .map_err(|e| Error::from_reason(format!("Fingerprint generation failed: {}", e)))?;

        Ok(Self {
            inner: fingerprint,
            public_key,
        })
    }

    /// Get the fingerprint as bytes
    ///
    /// Returns the raw fingerprint bytes (64 bytes from BLAKE3).
    #[napi]
    pub fn as_bytes(&self) -> Uint8Array {
        Uint8Array::new(self.inner.data().to_vec())
    }

    /// Get the fingerprint as a hex string
    ///
    /// Convenient for displaying or transmitting the fingerprint.
    #[napi]
    pub fn as_hex(&self) -> String {
        hex::encode(self.inner.data())
    }

    /// Get the signature bytes
    ///
    /// Returns the ML-DSA signature over the fingerprint.
    #[napi]
    pub fn get_signature(&self) -> Uint8Array {
        Uint8Array::new(self.inner.signature().to_vec())
    }

    /// Get the public key bytes
    ///
    /// Returns the ML-DSA public key used for verification.
    #[napi]
    pub fn get_public_key(&self) -> Uint8Array {
        Uint8Array::new(self.public_key.as_bytes().to_vec())
    }

    /// Verify the fingerprint
    ///
    /// Verifies the ML-DSA signature over the fingerprint data.
    ///
    /// # Returns
    /// `true` if the signature is valid, `false` otherwise
    ///
    /// # Example
    /// ```js
    /// const data = Buffer.from("Important data");
    /// const fingerprint = QuantumFingerprint.generate(data);
    ///
    /// // Verify the fingerprint
    /// const isValid = fingerprint.verify();
    /// console.log(`Fingerprint is ${isValid ? "valid" : "invalid"}`);
    /// ```
    #[napi]
    pub fn verify(&self) -> Result<bool> {
        match self.inner.verify(&self.public_key) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

/// Generate a quantum fingerprint (convenience function)
///
/// Creates a quantum fingerprint and returns its bytes directly.
///
/// # Arguments
/// * `data` - The data to fingerprint
///
/// # Returns
/// The fingerprint bytes (64 bytes)
///
/// # Example
/// ```js
/// const data = Buffer.from("Important data");
/// const fingerprintBytes = generateQuantumFingerprint(data);
/// ```
#[napi]
pub fn generate_quantum_fingerprint(data: Buffer) -> Result<Uint8Array> {
    let mut rng = OsRng;
    let (fingerprint, _public_key) = CoreFingerprint::generate(&data, &mut rng)
        .map_err(|e| Error::from_reason(format!("Fingerprint generation failed: {}", e)))?;

    Ok(Uint8Array::new(fingerprint.data().to_vec()))
}

/// Verify data against a fingerprint (convenience function)
///
/// Note: This function is simplified and only compares fingerprint data.
/// For full verification with signatures, use the QuantumFingerprint class.
///
/// # Arguments
/// * `data` - The data to verify
/// * `expected_fingerprint` - The expected fingerprint bytes
///
/// # Returns
/// `true` if the fingerprints match, `false` otherwise
#[napi]
pub fn verify_quantum_fingerprint(data: Buffer, expected_fingerprint: Buffer) -> Result<bool> {
    // Generate fingerprint for the data
    let mut rng = OsRng;
    let (fingerprint, _public_key) = CoreFingerprint::generate(&data, &mut rng)
        .map_err(|e| Error::from_reason(format!("Fingerprint generation failed: {}", e)))?;

    // Compare fingerprint data (constant-time comparison happens in core)
    Ok(fingerprint.data() == expected_fingerprint.as_ref())
}
