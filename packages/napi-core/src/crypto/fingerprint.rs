use napi::bindgen_prelude::*;
use napi_derive::napi;
use qudag_crypto::Fingerprint as CoreFingerprint;

/// Quantum fingerprint for data verification
///
/// Quantum fingerprints provide a compact, quantum-resistant way to verify
/// data integrity using ML-DSA signatures.
#[napi]
pub struct QuantumFingerprint {
    inner: CoreFingerprint,
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
        let fingerprint = CoreFingerprint::generate(&data)
            .map_err(|e| Error::from_reason(format!("Fingerprint generation failed: {}", e)))?;

        Ok(Self { inner: fingerprint })
    }

    /// Create fingerprint from existing bytes
    ///
    /// # Arguments
    /// * `bytes` - Previously generated fingerprint bytes
    #[napi(factory)]
    pub fn from_bytes(bytes: Buffer) -> Result<Self> {
        let fingerprint = CoreFingerprint::from_bytes(&bytes)
            .map_err(|e| Error::from_reason(format!("Invalid fingerprint: {}", e)))?;

        Ok(Self { inner: fingerprint })
    }

    /// Get the fingerprint as bytes
    ///
    /// Returns the raw fingerprint bytes (typically 32-64 bytes).
    #[napi]
    pub fn as_bytes(&self) -> Uint8Array {
        Uint8Array::new(self.inner.as_bytes().to_vec())
    }

    /// Get the fingerprint as a hex string
    ///
    /// Convenient for displaying or transmitting the fingerprint.
    #[napi]
    pub fn as_hex(&self) -> String {
        hex::encode(self.inner.as_bytes())
    }

    /// Verify data against this fingerprint
    ///
    /// Checks if the provided data matches this fingerprint.
    ///
    /// # Arguments
    /// * `data` - The data to verify
    ///
    /// # Returns
    /// `true` if the data matches, `false` otherwise
    ///
    /// # Example
    /// ```js
    /// const data = Buffer.from("Important data");
    /// const fingerprint = QuantumFingerprint.generate(data);
    ///
    /// // Later, verify the data
    /// const isValid = fingerprint.verify(data);
    /// console.log(`Data is ${isValid ? "valid" : "corrupted"}`);
    /// ```
    #[napi]
    pub fn verify(&self, data: Buffer) -> Result<bool> {
        match self.inner.verify(&data) {
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
/// The fingerprint bytes
///
/// # Example
/// ```js
/// const data = Buffer.from("Important data");
/// const fingerprintBytes = generateQuantumFingerprint(data);
/// ```
#[napi]
pub fn generate_quantum_fingerprint(data: Buffer) -> Result<Uint8Array> {
    let fingerprint = CoreFingerprint::generate(&data)
        .map_err(|e| Error::from_reason(format!("Fingerprint generation failed: {}", e)))?;

    Ok(Uint8Array::new(fingerprint.as_bytes().to_vec()))
}

/// Verify data against a fingerprint (convenience function)
///
/// # Arguments
/// * `data` - The data to verify
/// * `fingerprint_bytes` - The fingerprint bytes
///
/// # Returns
/// `true` if the data matches the fingerprint, `false` otherwise
#[napi]
pub fn verify_quantum_fingerprint(data: Buffer, fingerprint_bytes: Buffer) -> Result<bool> {
    let fingerprint = CoreFingerprint::from_bytes(&fingerprint_bytes)
        .map_err(|e| Error::from_reason(format!("Invalid fingerprint: {}", e)))?;

    match fingerprint.verify(&data) {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}
