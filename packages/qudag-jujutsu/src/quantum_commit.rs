//! Quantum-signed commits with ML-DSA signatures and BLAKE3 fingerprints

use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

use qudag_crypto::ml_dsa::{MlDsaPublicKey, MlDsaError};
use qudag_crypto::fingerprint::{Fingerprint, FingerprintError};
use qudag_crypto::CryptoError;

/// Errors specific to quantum commit operations
#[derive(Error, Debug)]
pub enum QuantumCommitError {
    /// Signature verification failed
    #[error("Signature verification failed")]
    SignatureVerificationFailed,

    /// Fingerprint verification failed
    #[error("Fingerprint verification failed")]
    FingerprintVerificationFailed,

    /// ML-DSA error
    #[error("ML-DSA error: {0}")]
    MlDsaError(#[from] MlDsaError),

    /// Fingerprint error
    #[error("Fingerprint error: {0}")]
    FingerprintError(#[from] FingerprintError),

    /// Cryptographic operation failed
    #[error("Crypto error: {0}")]
    CryptoError(#[from] CryptoError),
}

/// A quantum-signed commit combining Jujutsu commit with ML-DSA signature
#[derive(Clone, Debug)]
pub struct QuantumCommit {
    /// Commit message
    message: String,

    /// Jujutsu commit hash
    jj_hash: String,

    /// ML-DSA signature
    signature: Vec<u8>,

    /// Quantum fingerprint (BLAKE3 + ML-DSA)
    fingerprint: Fingerprint,

    /// Public key for fingerprint verification
    fingerprint_public_key: MlDsaPublicKey,

    /// Agent ID that created the commit
    agent_id: String,

    /// ML-DSA public key for signature verification
    public_key: MlDsaPublicKey,

    /// Timestamp (Unix epoch seconds)
    timestamp: u64,
}

impl QuantumCommit {
    /// Create a new quantum commit
    ///
    /// # Arguments
    ///
    /// * `message` - Commit message
    /// * `jj_hash` - Jujutsu commit hash
    /// * `signature` - ML-DSA signature
    /// * `fingerprint` - Quantum fingerprint
    /// * `fingerprint_public_key` - Public key for fingerprint verification
    /// * `agent_id` - Agent ID that created commit
    /// * `public_key` - ML-DSA public key for signature verification
    pub fn new(
        message: String,
        jj_hash: String,
        signature: Vec<u8>,
        fingerprint: Fingerprint,
        fingerprint_public_key: MlDsaPublicKey,
        agent_id: String,
        public_key: MlDsaPublicKey,
    ) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            message,
            jj_hash,
            signature,
            fingerprint,
            fingerprint_public_key,
            agent_id,
            public_key,
            timestamp,
        }
    }

    /// Get commit message
    pub fn message(&self) -> &str {
        &self.message
    }

    /// Get Jujutsu commit hash
    pub fn jj_hash(&self) -> &str {
        &self.jj_hash
    }

    /// Get ML-DSA signature
    pub fn signature(&self) -> &[u8] {
        &self.signature
    }

    /// Get quantum fingerprint
    pub fn fingerprint(&self) -> &Fingerprint {
        &self.fingerprint
    }

    /// Get agent ID
    pub fn agent_id(&self) -> &str {
        &self.agent_id
    }

    /// Get public key
    pub fn public_key(&self) -> &MlDsaPublicKey {
        &self.public_key
    }

    /// Get timestamp
    pub fn timestamp(&self) -> u64 {
        self.timestamp
    }

    /// Verify the quantum signature
    ///
    /// Verifies both the ML-DSA signature and the quantum fingerprint
    ///
    /// # Returns
    ///
    /// `true` if both signature and fingerprint are valid
    pub async fn verify(&self) -> Result<bool, QuantumCommitError> {
        // Verify ML-DSA signature
        let signature_data = format!("{}:{}", self.jj_hash, self.fingerprint.as_hex());
        let sig_valid = match self.public_key.verify(signature_data.as_bytes(), &self.signature) {
            Ok(()) => true,
            Err(e) => return Err(QuantumCommitError::MlDsaError(e)),
        };

        // Verify quantum fingerprint
        let fp_valid = self.fingerprint
            .verify(&self.fingerprint_public_key)
            .is_ok();

        Ok(sig_valid && fp_valid)
    }

    /// Verify only the ML-DSA signature (faster than full verification)
    pub fn verify_signature(&self) -> Result<bool, QuantumCommitError> {
        let signature_data = format!("{}:{}", self.jj_hash, self.fingerprint.as_hex());
        match self.public_key.verify(signature_data.as_bytes(), &self.signature) {
            Ok(()) => Ok(true),
            Err(e) => Err(QuantumCommitError::MlDsaError(e)),
        }
    }

    /// Verify only the quantum fingerprint
    pub fn verify_fingerprint(&self) -> Result<bool, QuantumCommitError> {
        match self.fingerprint.verify(&self.fingerprint_public_key) {
            Ok(()) => Ok(true),
            Err(e) => Err(QuantumCommitError::FingerprintError(e)),
        }
    }

    /// Get commit age in seconds
    pub fn age(&self) -> u64 {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        now.saturating_sub(self.timestamp)
    }

    /// Check if commit is from a specific agent
    pub fn is_by_agent(&self, agent_id: &str) -> bool {
        self.agent_id == agent_id
    }

    /// Get commit summary (first line of message)
    pub fn summary(&self) -> &str {
        self.message.lines().next().unwrap_or(&self.message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use qudag_crypto::ml_dsa::MlDsaKeyPair;

    #[tokio::test]
    async fn test_quantum_commit_creation() {
        let mut rng = rand::rngs::OsRng;
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let commit_data = b"test:hash:message";

        let (fingerprint, fp_public_key) =
            Fingerprint::generate(commit_data, &mut rng).unwrap();

        let signature_data = format!("hash:{}", fingerprint.as_hex());
        let signature = keypair.sign(signature_data.as_bytes(), &mut rng).unwrap();

        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();

        let commit = QuantumCommit::new(
            "test: Initial commit".to_string(),
            "hash".to_string(),
            signature,
            fingerprint,
            fp_public_key,
            "agent-test".to_string(),
            public_key,
        );

        assert_eq!(commit.message(), "test: Initial commit");
        assert_eq!(commit.jj_hash(), "hash");
        assert_eq!(commit.agent_id(), "agent-test");
    }

    #[tokio::test]
    async fn test_quantum_commit_verification() {
        let mut rng = rand::rngs::OsRng;
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let commit_data = b"test:hash:message";

        let (fingerprint, fp_public_key) =
            Fingerprint::generate(commit_data, &mut rng).unwrap();

        let signature_data = format!("hash:{}", fingerprint.as_hex());
        let signature = keypair.sign(signature_data.as_bytes(), &mut rng).unwrap();

        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();

        let commit = QuantumCommit::new(
            "test: Verify this".to_string(),
            "hash".to_string(),
            signature,
            fingerprint,
            fp_public_key,
            "agent-test".to_string(),
            public_key,
        );

        let verified = commit.verify().await.unwrap();
        assert!(verified);
    }

    #[test]
    fn test_commit_helpers() {
        let mut rng = rand::rngs::OsRng;
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let commit_data = b"test:hash:message";

        let (fingerprint, fp_public_key) =
            Fingerprint::generate(commit_data, &mut rng).unwrap();

        let signature_data = format!("hash:{}", fingerprint.as_hex());
        let signature = keypair.sign(signature_data.as_bytes(), &mut rng).unwrap();

        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();

        let commit = QuantumCommit::new(
            "feat: Add feature\n\nDetailed description".to_string(),
            "hash".to_string(),
            signature,
            fingerprint,
            fp_public_key,
            "agent-001".to_string(),
            public_key,
        );

        assert_eq!(commit.summary(), "feat: Add feature");
        assert!(commit.is_by_agent("agent-001"));
        assert!(!commit.is_by_agent("agent-002"));
        assert!(commit.age() >= 0);
    }
}
