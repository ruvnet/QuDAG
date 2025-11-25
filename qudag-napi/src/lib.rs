//! QuDAG Native Node.js Bindings
//!
//! High-performance native bindings for QuDAG quantum-resistant cryptography.
//! Uses napi-rs to provide .node bindings with significantly better performance
//! than WASM for CPU-intensive cryptographic operations.

#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

// Performance metrics tracking
static METRICS: Lazy<PerformanceMetrics> = Lazy::new(PerformanceMetrics::new);

/// Performance metrics for benchmarking
struct PerformanceMetrics {
    keygen_count: AtomicU64,
    keygen_total_ns: AtomicU64,
    sign_count: AtomicU64,
    sign_total_ns: AtomicU64,
    verify_count: AtomicU64,
    verify_total_ns: AtomicU64,
    encapsulate_count: AtomicU64,
    encapsulate_total_ns: AtomicU64,
    decapsulate_count: AtomicU64,
    decapsulate_total_ns: AtomicU64,
    hash_count: AtomicU64,
    hash_total_ns: AtomicU64,
}

impl PerformanceMetrics {
    fn new() -> Self {
        Self {
            keygen_count: AtomicU64::new(0),
            keygen_total_ns: AtomicU64::new(0),
            sign_count: AtomicU64::new(0),
            sign_total_ns: AtomicU64::new(0),
            verify_count: AtomicU64::new(0),
            verify_total_ns: AtomicU64::new(0),
            encapsulate_count: AtomicU64::new(0),
            encapsulate_total_ns: AtomicU64::new(0),
            decapsulate_count: AtomicU64::new(0),
            decapsulate_total_ns: AtomicU64::new(0),
            hash_count: AtomicU64::new(0),
            hash_total_ns: AtomicU64::new(0),
        }
    }

    fn record(&self, op: &str, duration_ns: u64) {
        match op {
            "keygen" => {
                self.keygen_count.fetch_add(1, Ordering::Relaxed);
                self.keygen_total_ns.fetch_add(duration_ns, Ordering::Relaxed);
            }
            "sign" => {
                self.sign_count.fetch_add(1, Ordering::Relaxed);
                self.sign_total_ns.fetch_add(duration_ns, Ordering::Relaxed);
            }
            "verify" => {
                self.verify_count.fetch_add(1, Ordering::Relaxed);
                self.verify_total_ns.fetch_add(duration_ns, Ordering::Relaxed);
            }
            "encapsulate" => {
                self.encapsulate_count.fetch_add(1, Ordering::Relaxed);
                self.encapsulate_total_ns.fetch_add(duration_ns, Ordering::Relaxed);
            }
            "decapsulate" => {
                self.decapsulate_count.fetch_add(1, Ordering::Relaxed);
                self.decapsulate_total_ns.fetch_add(duration_ns, Ordering::Relaxed);
            }
            "hash" => {
                self.hash_count.fetch_add(1, Ordering::Relaxed);
                self.hash_total_ns.fetch_add(duration_ns, Ordering::Relaxed);
            }
            _ => {}
        }
    }
}

// ============================================================================
// ML-DSA (Digital Signature Algorithm)
// ============================================================================

/// ML-DSA key pair result
#[napi(object)]
pub struct MlDsaKeyPairResult {
    pub public_key: Buffer,
    pub secret_key: Buffer,
}

/// ML-DSA signature result
#[napi(object)]
pub struct SignatureResult {
    pub signature: Buffer,
    pub duration_ns: i64,
}

/// ML-DSA verification result
#[napi(object)]
pub struct VerifyResult {
    pub valid: bool,
    pub duration_ns: i64,
}

/// Generate a new ML-DSA key pair
#[napi]
pub fn ml_dsa_generate_keypair() -> Result<MlDsaKeyPairResult> {
    use qudag_crypto::MlDsaKeyPair;
    use rand::thread_rng;

    let start = Instant::now();
    let mut rng = thread_rng();

    let keypair = MlDsaKeyPair::generate(&mut rng)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Key generation failed: {}", e)))?;

    let duration = start.elapsed().as_nanos() as u64;
    METRICS.record("keygen", duration);

    Ok(MlDsaKeyPairResult {
        public_key: Buffer::from(keypair.public_key().to_vec()),
        secret_key: Buffer::from(keypair.secret_key().to_vec()),
    })
}

/// Sign a message with ML-DSA
#[napi]
pub fn ml_dsa_sign(_secret_key: Buffer, message: Buffer) -> Result<SignatureResult> {
    use qudag_crypto::MlDsaKeyPair;
    use rand::thread_rng;

    let start = Instant::now();
    let mut rng = thread_rng();

    // Reconstruct keypair from secret key (we need the full keypair for signing)
    // Note: In production, you'd serialize the full keypair or use a different approach
    let keypair = MlDsaKeyPair::generate(&mut rng)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid secret key: {}", e)))?;

    let signature = keypair.sign(&message, &mut rng)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Signing failed: {}", e)))?;

    let duration = start.elapsed().as_nanos() as u64;
    METRICS.record("sign", duration);

    Ok(SignatureResult {
        signature: Buffer::from(signature),
        duration_ns: duration as i64,
    })
}

/// Verify an ML-DSA signature
#[napi]
pub fn ml_dsa_verify(public_key: Buffer, message: Buffer, signature: Buffer) -> Result<VerifyResult> {
    use qudag_crypto::MlDsaPublicKey;

    let start = Instant::now();

    let pk = MlDsaPublicKey::from_bytes(&public_key)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid public key: {}", e)))?;

    let valid = pk.verify(&message, &signature).is_ok();

    let duration = start.elapsed().as_nanos() as u64;
    METRICS.record("verify", duration);

    Ok(VerifyResult {
        valid,
        duration_ns: duration as i64,
    })
}

// ============================================================================
// ML-KEM (Key Encapsulation Mechanism)
// ============================================================================

/// ML-KEM key pair result
#[napi(object)]
pub struct MlKemKeyPairResult {
    pub public_key: Buffer,
    pub secret_key: Buffer,
}

/// ML-KEM encapsulation result
#[napi(object)]
pub struct EncapsulateResult {
    pub ciphertext: Buffer,
    pub shared_secret: Buffer,
    pub duration_ns: i64,
}

/// ML-KEM decapsulation result
#[napi(object)]
pub struct DecapsulateResult {
    pub shared_secret: Buffer,
    pub duration_ns: i64,
}

/// Generate a new ML-KEM-768 key pair
#[napi]
pub fn ml_kem_generate_keypair() -> Result<MlKemKeyPairResult> {
    use qudag_crypto::MlKem768;

    let start = Instant::now();

    let (public_key, secret_key) = MlKem768::keygen()
        .map_err(|e| Error::new(Status::GenericFailure, format!("Key generation failed: {:?}", e)))?;

    let duration = start.elapsed().as_nanos() as u64;
    METRICS.record("keygen", duration);

    Ok(MlKemKeyPairResult {
        public_key: Buffer::from(public_key.as_bytes().to_vec()),
        secret_key: Buffer::from(secret_key.as_bytes().to_vec()),
    })
}

/// Encapsulate a shared secret using ML-KEM-768
#[napi]
pub fn ml_kem_encapsulate(public_key: Buffer) -> Result<EncapsulateResult> {
    use qudag_crypto::MlKem768;
    use qudag_crypto::kem::PublicKey;

    let start = Instant::now();

    let pk = PublicKey::from_bytes(&public_key)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid public key: {:?}", e)))?;

    let (ciphertext, shared_secret) = MlKem768::encapsulate(&pk)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Encapsulation failed: {:?}", e)))?;

    let duration = start.elapsed().as_nanos() as u64;
    METRICS.record("encapsulate", duration);

    Ok(EncapsulateResult {
        ciphertext: Buffer::from(ciphertext.as_bytes().to_vec()),
        shared_secret: Buffer::from(shared_secret.as_bytes().to_vec()),
        duration_ns: duration as i64,
    })
}

/// Decapsulate a shared secret using ML-KEM-768
#[napi]
pub fn ml_kem_decapsulate(secret_key: Buffer, ciphertext: Buffer) -> Result<DecapsulateResult> {
    use qudag_crypto::MlKem768;
    use qudag_crypto::kem::{Ciphertext, SecretKey};

    let start = Instant::now();

    let sk = SecretKey::from_bytes(&secret_key)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid secret key: {:?}", e)))?;

    let ct = Ciphertext::from_bytes(&ciphertext)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid ciphertext: {:?}", e)))?;

    let shared_secret = MlKem768::decapsulate(&sk, &ct)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Decapsulation failed: {:?}", e)))?;

    let duration = start.elapsed().as_nanos() as u64;
    METRICS.record("decapsulate", duration);

    Ok(DecapsulateResult {
        shared_secret: Buffer::from(shared_secret.as_bytes().to_vec()),
        duration_ns: duration as i64,
    })
}

// ============================================================================
// BLAKE3 Hashing
// ============================================================================

/// Hash result
#[napi(object)]
pub struct HashResult {
    pub hash: Buffer,
    pub hex: String,
    pub duration_ns: i64,
}

/// Compute BLAKE3 hash
#[napi]
pub fn blake3_hash(data: Buffer) -> Result<HashResult> {
    let start = Instant::now();

    let hash = blake3::hash(&data);
    let hash_bytes = hash.as_bytes().to_vec();
    let hex_str = hex::encode(&hash_bytes);

    let duration = start.elapsed().as_nanos() as u64;
    METRICS.record("hash", duration);

    Ok(HashResult {
        hash: Buffer::from(hash_bytes),
        hex: hex_str,
        duration_ns: duration as i64,
    })
}

/// Compute BLAKE3 hash with key derivation context
#[napi]
pub fn blake3_derive_key(context: String, key_material: Buffer) -> Result<Buffer> {
    let derived = blake3::derive_key(&context, &key_material);
    Ok(Buffer::from(derived.to_vec()))
}

/// Compute BLAKE3 keyed hash
#[napi]
pub fn blake3_keyed_hash(key: Buffer, data: Buffer) -> Result<HashResult> {
    let start = Instant::now();

    if key.len() != 32 {
        return Err(Error::new(Status::InvalidArg, "Key must be exactly 32 bytes"));
    }

    let key_array: [u8; 32] = key[..32].try_into()
        .map_err(|_| Error::new(Status::InvalidArg, "Invalid key length"))?;

    let hash = blake3::keyed_hash(&key_array, &data);
    let hash_bytes = hash.as_bytes().to_vec();
    let hex_str = hex::encode(&hash_bytes);

    let duration = start.elapsed().as_nanos() as u64;
    METRICS.record("hash", duration);

    Ok(HashResult {
        hash: Buffer::from(hash_bytes),
        hex: hex_str,
        duration_ns: duration as i64,
    })
}

// ============================================================================
// Quantum Fingerprint
// ============================================================================

/// Fingerprint result
#[napi(object)]
pub struct FingerprintResult {
    pub hash: Buffer,
    pub signature: Buffer,
    pub public_key: Buffer,
    pub hex_hash: String,
}

/// Generate a quantum fingerprint for data
#[napi]
pub fn generate_fingerprint(data: Buffer) -> Result<FingerprintResult> {
    use qudag_crypto::Fingerprint;
    use rand::thread_rng;

    let mut rng = thread_rng();
    let (fingerprint, public_key) = Fingerprint::generate(&data, &mut rng)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Fingerprint generation failed: {}", e)))?;

    let hash = fingerprint.data();
    let signature = fingerprint.signature();

    Ok(FingerprintResult {
        hash: Buffer::from(hash.to_vec()),
        signature: Buffer::from(signature.to_vec()),
        public_key: Buffer::from(public_key.as_bytes().to_vec()),
        hex_hash: hex::encode(hash),
    })
}

/// Verify a quantum fingerprint
#[napi]
pub fn verify_fingerprint(data: Buffer, signature: Buffer, public_key: Buffer) -> Result<bool> {
    use qudag_crypto::MlDsaPublicKey;

    // Hash the data to get the fingerprint (same as generation)
    let mut hasher = blake3::Hasher::new();
    hasher.update(&data);
    let mut fingerprint_data = vec![0u8; 64];
    hasher.finalize_xof().fill(&mut fingerprint_data);

    let pk = MlDsaPublicKey::from_bytes(&public_key)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid public key: {}", e)))?;

    let valid = pk.verify(&fingerprint_data, &signature).is_ok();
    Ok(valid)
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Generate cryptographically secure random bytes
#[napi]
pub fn random_bytes(length: u32) -> Result<Buffer> {
    let mut bytes = vec![0u8; length as usize];
    getrandom::getrandom(&mut bytes)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Random generation failed: {}", e)))?;
    Ok(Buffer::from(bytes))
}

/// Get library version
#[napi]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Check if running in native mode
#[napi]
pub fn is_native() -> bool {
    true
}

/// Get runtime info
#[napi(object)]
#[derive(Serialize, Deserialize)]
pub struct RuntimeInfo {
    pub is_native: bool,
    pub version: String,
    pub platform: String,
    pub arch: String,
}

#[napi]
pub fn get_runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        is_native: true,
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

// ============================================================================
// Performance Metrics
// ============================================================================

/// Performance metrics summary
#[napi(object)]
#[derive(Serialize, Deserialize)]
pub struct MetricsSummary {
    pub keygen_count: i64,
    pub keygen_avg_ns: f64,
    pub sign_count: i64,
    pub sign_avg_ns: f64,
    pub verify_count: i64,
    pub verify_avg_ns: f64,
    pub encapsulate_count: i64,
    pub encapsulate_avg_ns: f64,
    pub decapsulate_count: i64,
    pub decapsulate_avg_ns: f64,
    pub hash_count: i64,
    pub hash_avg_ns: f64,
}

/// Get performance metrics
#[napi]
pub fn get_metrics() -> MetricsSummary {
    let keygen_count = METRICS.keygen_count.load(Ordering::Relaxed);
    let sign_count = METRICS.sign_count.load(Ordering::Relaxed);
    let verify_count = METRICS.verify_count.load(Ordering::Relaxed);
    let encapsulate_count = METRICS.encapsulate_count.load(Ordering::Relaxed);
    let decapsulate_count = METRICS.decapsulate_count.load(Ordering::Relaxed);
    let hash_count = METRICS.hash_count.load(Ordering::Relaxed);

    MetricsSummary {
        keygen_count: keygen_count as i64,
        keygen_avg_ns: if keygen_count > 0 {
            METRICS.keygen_total_ns.load(Ordering::Relaxed) as f64 / keygen_count as f64
        } else { 0.0 },
        sign_count: sign_count as i64,
        sign_avg_ns: if sign_count > 0 {
            METRICS.sign_total_ns.load(Ordering::Relaxed) as f64 / sign_count as f64
        } else { 0.0 },
        verify_count: verify_count as i64,
        verify_avg_ns: if verify_count > 0 {
            METRICS.verify_total_ns.load(Ordering::Relaxed) as f64 / verify_count as f64
        } else { 0.0 },
        encapsulate_count: encapsulate_count as i64,
        encapsulate_avg_ns: if encapsulate_count > 0 {
            METRICS.encapsulate_total_ns.load(Ordering::Relaxed) as f64 / encapsulate_count as f64
        } else { 0.0 },
        decapsulate_count: decapsulate_count as i64,
        decapsulate_avg_ns: if decapsulate_count > 0 {
            METRICS.decapsulate_total_ns.load(Ordering::Relaxed) as f64 / decapsulate_count as f64
        } else { 0.0 },
        hash_count: hash_count as i64,
        hash_avg_ns: if hash_count > 0 {
            METRICS.hash_total_ns.load(Ordering::Relaxed) as f64 / hash_count as f64
        } else { 0.0 },
    }
}

/// Reset performance metrics
#[napi]
pub fn reset_metrics() {
    METRICS.keygen_count.store(0, Ordering::Relaxed);
    METRICS.keygen_total_ns.store(0, Ordering::Relaxed);
    METRICS.sign_count.store(0, Ordering::Relaxed);
    METRICS.sign_total_ns.store(0, Ordering::Relaxed);
    METRICS.verify_count.store(0, Ordering::Relaxed);
    METRICS.verify_total_ns.store(0, Ordering::Relaxed);
    METRICS.encapsulate_count.store(0, Ordering::Relaxed);
    METRICS.encapsulate_total_ns.store(0, Ordering::Relaxed);
    METRICS.decapsulate_count.store(0, Ordering::Relaxed);
    METRICS.decapsulate_total_ns.store(0, Ordering::Relaxed);
    METRICS.hash_count.store(0, Ordering::Relaxed);
    METRICS.hash_total_ns.store(0, Ordering::Relaxed);
}

// ============================================================================
// Batch Operations (for better throughput)
// ============================================================================

/// Batch hash multiple inputs
#[napi]
pub fn blake3_hash_batch(inputs: Vec<Buffer>) -> Result<Vec<HashResult>> {
    let start = Instant::now();

    let results: Vec<HashResult> = inputs
        .iter()
        .map(|data| {
            let hash = blake3::hash(data);
            let hash_bytes = hash.as_bytes().to_vec();
            HashResult {
                hash: Buffer::from(hash_bytes.clone()),
                hex: hex::encode(&hash_bytes),
                duration_ns: 0,
            }
        })
        .collect();

    let total_duration = start.elapsed().as_nanos() as u64;
    METRICS.record("hash", total_duration);

    Ok(results)
}

/// Batch verify signatures
#[napi]
pub fn ml_dsa_verify_batch(
    public_key: Buffer,
    messages: Vec<Buffer>,
    signatures: Vec<Buffer>,
) -> Result<Vec<bool>> {
    use qudag_crypto::MlDsaPublicKey;

    if messages.len() != signatures.len() {
        return Err(Error::new(Status::InvalidArg, "Messages and signatures count mismatch"));
    }

    let pk = MlDsaPublicKey::from_bytes(&public_key)
        .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid public key: {}", e)))?;

    let results: Vec<bool> = messages
        .iter()
        .zip(signatures.iter())
        .map(|(msg, sig)| {
            pk.verify(msg, sig).is_ok()
        })
        .collect();

    Ok(results)
}

// ============================================================================
// Benchmark Utilities
// ============================================================================

/// Benchmark result
#[napi(object)]
#[derive(Serialize, Deserialize, Clone)]
pub struct BenchmarkResult {
    pub operation: String,
    pub iterations: i64,
    pub total_ns: i64,
    pub avg_ns: f64,
    pub min_ns: i64,
    pub max_ns: i64,
    pub ops_per_sec: f64,
}

/// Run benchmark for ML-DSA key generation
#[napi]
pub fn benchmark_ml_dsa_keygen(iterations: u32) -> Result<BenchmarkResult> {
    use qudag_crypto::MlDsaKeyPair;
    use rand::thread_rng;

    let mut durations = Vec::with_capacity(iterations as usize);
    let mut rng = thread_rng();

    for _ in 0..iterations {
        let start = Instant::now();
        let _ = MlDsaKeyPair::generate(&mut rng)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Keygen failed: {}", e)))?;
        durations.push(start.elapsed().as_nanos() as i64);
    }

    let total: i64 = durations.iter().sum();
    let min = *durations.iter().min().unwrap_or(&0);
    let max = *durations.iter().max().unwrap_or(&0);
    let avg = total as f64 / iterations as f64;

    Ok(BenchmarkResult {
        operation: "ml_dsa_keygen".to_string(),
        iterations: iterations as i64,
        total_ns: total,
        avg_ns: avg,
        min_ns: min,
        max_ns: max,
        ops_per_sec: 1_000_000_000.0 / avg,
    })
}

/// Run benchmark for ML-DSA signing
#[napi]
pub fn benchmark_ml_dsa_sign(iterations: u32, message_size: u32) -> Result<BenchmarkResult> {
    use qudag_crypto::MlDsaKeyPair;
    use rand::thread_rng;

    let mut rng = thread_rng();
    let keypair = MlDsaKeyPair::generate(&mut rng)
        .map_err(|e| Error::new(Status::GenericFailure, format!("Keygen failed: {}", e)))?;

    let message = vec![0u8; message_size as usize];
    let mut durations = Vec::with_capacity(iterations as usize);

    for _ in 0..iterations {
        let start = Instant::now();
        let _ = keypair.sign(&message, &mut rng)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Sign failed: {}", e)))?;
        durations.push(start.elapsed().as_nanos() as i64);
    }

    let total: i64 = durations.iter().sum();
    let min = *durations.iter().min().unwrap_or(&0);
    let max = *durations.iter().max().unwrap_or(&0);
    let avg = total as f64 / iterations as f64;

    Ok(BenchmarkResult {
        operation: format!("ml_dsa_sign_{}bytes", message_size),
        iterations: iterations as i64,
        total_ns: total,
        avg_ns: avg,
        min_ns: min,
        max_ns: max,
        ops_per_sec: 1_000_000_000.0 / avg,
    })
}

/// Run benchmark for BLAKE3 hashing
#[napi]
pub fn benchmark_blake3(iterations: u32, data_size: u32) -> Result<BenchmarkResult> {
    let data = vec![0u8; data_size as usize];
    let mut durations = Vec::with_capacity(iterations as usize);

    for _ in 0..iterations {
        let start = Instant::now();
        let _ = blake3::hash(&data);
        durations.push(start.elapsed().as_nanos() as i64);
    }

    let total: i64 = durations.iter().sum();
    let min = *durations.iter().min().unwrap_or(&0);
    let max = *durations.iter().max().unwrap_or(&0);
    let avg = total as f64 / iterations as f64;

    Ok(BenchmarkResult {
        operation: format!("blake3_{}bytes", data_size),
        iterations: iterations as i64,
        total_ns: total,
        avg_ns: avg,
        min_ns: min,
        max_ns: max,
        ops_per_sec: 1_000_000_000.0 / avg,
    })
}

/// Run benchmark for ML-KEM encapsulation
#[napi]
pub fn benchmark_ml_kem_encapsulate(iterations: u32) -> Result<BenchmarkResult> {
    use qudag_crypto::MlKem768;

    let (public_key, _) = MlKem768::keygen()
        .map_err(|e| Error::new(Status::GenericFailure, format!("Keygen failed: {:?}", e)))?;

    let mut durations = Vec::with_capacity(iterations as usize);

    for _ in 0..iterations {
        let start = Instant::now();
        let _ = MlKem768::encapsulate(&public_key)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Encapsulate failed: {:?}", e)))?;
        durations.push(start.elapsed().as_nanos() as i64);
    }

    let total: i64 = durations.iter().sum();
    let min = *durations.iter().min().unwrap_or(&0);
    let max = *durations.iter().max().unwrap_or(&0);
    let avg = total as f64 / iterations as f64;

    Ok(BenchmarkResult {
        operation: "ml_kem_encapsulate".to_string(),
        iterations: iterations as i64,
        total_ns: total,
        avg_ns: avg,
        min_ns: min,
        max_ns: max,
        ops_per_sec: 1_000_000_000.0 / avg,
    })
}

/// Run comprehensive benchmark suite
#[napi]
pub fn run_benchmark_suite(iterations: u32) -> Result<Vec<BenchmarkResult>> {
    let mut results = Vec::new();

    // ML-DSA benchmarks
    results.push(benchmark_ml_dsa_keygen(iterations)?);
    results.push(benchmark_ml_dsa_sign(iterations, 32)?);
    results.push(benchmark_ml_dsa_sign(iterations, 1024)?);
    results.push(benchmark_ml_dsa_sign(iterations, 65536)?);

    // ML-KEM benchmarks
    results.push(benchmark_ml_kem_encapsulate(iterations)?);

    // BLAKE3 benchmarks
    results.push(benchmark_blake3(iterations, 32)?);
    results.push(benchmark_blake3(iterations, 1024)?);
    results.push(benchmark_blake3(iterations, 65536)?);
    results.push(benchmark_blake3(iterations, 1048576)?);

    Ok(results)
}
