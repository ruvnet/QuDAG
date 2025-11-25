/**
 * @qudag/crypto - Quantum-Resistant Cryptography
 *
 * High-performance cryptographic library with native bindings and WASM fallback.
 * Automatically detects the best available implementation for your platform.
 */

import { detectPlatform, loadNativeModule, loadWasmModule, PlatformInfo } from './loader';
import type {
  CryptoModule,
  MlDsaKeyPairResult,
  MlKemKeyPairResult,
  HashResult,
  FingerprintResult,
  SignatureResult,
  VerifyResult,
  EncapsulateResult,
  DecapsulateResult,
  BenchmarkResult,
  MetricsSummary,
  RuntimeInfo,
} from './types';

// Re-export types
export type {
  CryptoModule,
  MlDsaKeyPairResult,
  MlKemKeyPairResult,
  HashResult,
  FingerprintResult,
  SignatureResult,
  VerifyResult,
  EncapsulateResult,
  DecapsulateResult,
  BenchmarkResult,
  MetricsSummary,
  RuntimeInfo,
};

// Module state
let cryptoModule: CryptoModule | null = null;
let initPromise: Promise<CryptoModule> | null = null;
let platformInfo: PlatformInfo | null = null;

/**
 * Initialize the crypto module with the best available implementation.
 * Automatically tries native bindings first, then falls back to WASM.
 */
export async function init(options?: { preferWasm?: boolean; forceNative?: boolean }): Promise<CryptoModule> {
  if (cryptoModule) {
    return cryptoModule;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    platformInfo = detectPlatform();

    if (options?.forceNative) {
      cryptoModule = await loadNativeModule(platformInfo);
      return cryptoModule;
    }

    if (options?.preferWasm) {
      try {
        cryptoModule = await loadWasmModule();
        return cryptoModule;
      } catch (wasmError) {
        console.warn('WASM loading failed, trying native:', wasmError);
        cryptoModule = await loadNativeModule(platformInfo);
        return cryptoModule;
      }
    }

    // Default: try native first, fall back to WASM
    try {
      cryptoModule = await loadNativeModule(platformInfo);
      return cryptoModule;
    } catch (nativeError) {
      console.warn('Native module loading failed, falling back to WASM:', nativeError);
      try {
        cryptoModule = await loadWasmModule();
        return cryptoModule;
      } catch (wasmError) {
        throw new Error(
          `Failed to load any crypto implementation.\n` +
          `Native error: ${nativeError}\n` +
          `WASM error: ${wasmError}`
        );
      }
    }
  })();

  return initPromise;
}

/**
 * Get the initialized crypto module.
 * Throws if not initialized - call init() first.
 */
export function getModule(): CryptoModule {
  if (!cryptoModule) {
    throw new Error('Crypto module not initialized. Call init() first.');
  }
  return cryptoModule;
}

/**
 * Check if the module is initialized.
 */
export function isInitialized(): boolean {
  return cryptoModule !== null;
}

/**
 * Get platform information.
 */
export function getPlatformInfo(): PlatformInfo | null {
  return platformInfo;
}

// ============================================================================
// ML-DSA (Digital Signature Algorithm)
// ============================================================================

/**
 * Generate a new ML-DSA key pair.
 */
export async function mlDsaGenerateKeypair(): Promise<MlDsaKeyPairResult> {
  const mod = await init();
  return mod.mlDsaGenerateKeypair();
}

/**
 * Sign a message with ML-DSA.
 */
export async function mlDsaSign(secretKey: Buffer, message: Buffer): Promise<SignatureResult> {
  const mod = await init();
  return mod.mlDsaSign(secretKey, message);
}

/**
 * Verify an ML-DSA signature.
 */
export async function mlDsaVerify(
  publicKey: Buffer,
  message: Buffer,
  signature: Buffer
): Promise<VerifyResult> {
  const mod = await init();
  return mod.mlDsaVerify(publicKey, message, signature);
}

/**
 * Batch verify ML-DSA signatures.
 */
export async function mlDsaVerifyBatch(
  publicKey: Buffer,
  messages: Buffer[],
  signatures: Buffer[]
): Promise<boolean[]> {
  const mod = await init();
  return mod.mlDsaVerifyBatch(publicKey, messages, signatures);
}

// ============================================================================
// ML-KEM (Key Encapsulation Mechanism)
// ============================================================================

/**
 * Generate a new ML-KEM-768 key pair.
 */
export async function mlKemGenerateKeypair(): Promise<MlKemKeyPairResult> {
  const mod = await init();
  return mod.mlKemGenerateKeypair();
}

/**
 * Encapsulate a shared secret using ML-KEM-768.
 */
export async function mlKemEncapsulate(publicKey: Buffer): Promise<EncapsulateResult> {
  const mod = await init();
  return mod.mlKemEncapsulate(publicKey);
}

/**
 * Decapsulate a shared secret using ML-KEM-768.
 */
export async function mlKemDecapsulate(secretKey: Buffer, ciphertext: Buffer): Promise<DecapsulateResult> {
  const mod = await init();
  return mod.mlKemDecapsulate(secretKey, ciphertext);
}

// ============================================================================
// BLAKE3 Hashing
// ============================================================================

/**
 * Compute BLAKE3 hash.
 */
export async function blake3Hash(data: Buffer): Promise<HashResult> {
  const mod = await init();
  return mod.blake3Hash(data);
}

/**
 * Compute BLAKE3 keyed hash.
 */
export async function blake3KeyedHash(key: Buffer, data: Buffer): Promise<HashResult> {
  const mod = await init();
  return mod.blake3KeyedHash(key, data);
}

/**
 * Derive a key using BLAKE3.
 */
export async function blake3DeriveKey(context: string, keyMaterial: Buffer): Promise<Buffer> {
  const mod = await init();
  return mod.blake3DeriveKey(context, keyMaterial);
}

/**
 * Batch hash multiple inputs.
 */
export async function blake3HashBatch(inputs: Buffer[]): Promise<HashResult[]> {
  const mod = await init();
  return mod.blake3HashBatch(inputs);
}

// ============================================================================
// Quantum Fingerprint
// ============================================================================

/**
 * Generate a quantum fingerprint for data.
 */
export async function generateFingerprint(data: Buffer): Promise<FingerprintResult> {
  const mod = await init();
  return mod.generateFingerprint(data);
}

/**
 * Verify a quantum fingerprint.
 */
export async function verifyFingerprint(
  data: Buffer,
  signature: Buffer,
  publicKey: Buffer
): Promise<boolean> {
  const mod = await init();
  return mod.verifyFingerprint(data, signature, publicKey);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate cryptographically secure random bytes.
 */
export async function randomBytes(length: number): Promise<Buffer> {
  const mod = await init();
  return mod.randomBytes(length);
}

/**
 * Get library version.
 */
export async function getVersion(): Promise<string> {
  const mod = await init();
  return mod.getVersion();
}

/**
 * Check if running in native mode.
 */
export async function isNative(): Promise<boolean> {
  const mod = await init();
  return mod.isNative();
}

/**
 * Get runtime info.
 */
export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  const mod = await init();
  return mod.getRuntimeInfo();
}

// ============================================================================
// Performance Metrics
// ============================================================================

/**
 * Get performance metrics.
 */
export async function getMetrics(): Promise<MetricsSummary> {
  const mod = await init();
  return mod.getMetrics();
}

/**
 * Reset performance metrics.
 */
export async function resetMetrics(): Promise<void> {
  const mod = await init();
  return mod.resetMetrics();
}

// ============================================================================
// Benchmarks
// ============================================================================

/**
 * Run benchmark for ML-DSA key generation.
 */
export async function benchmarkMlDsaKeygen(iterations: number): Promise<BenchmarkResult> {
  const mod = await init();
  return mod.benchmarkMlDsaKeygen(iterations);
}

/**
 * Run benchmark for ML-DSA signing.
 */
export async function benchmarkMlDsaSign(iterations: number, messageSize: number): Promise<BenchmarkResult> {
  const mod = await init();
  return mod.benchmarkMlDsaSign(iterations, messageSize);
}

/**
 * Run benchmark for BLAKE3 hashing.
 */
export async function benchmarkBlake3(iterations: number, dataSize: number): Promise<BenchmarkResult> {
  const mod = await init();
  return mod.benchmarkBlake3(iterations, dataSize);
}

/**
 * Run benchmark for ML-KEM encapsulation.
 */
export async function benchmarkMlKemEncapsulate(iterations: number): Promise<BenchmarkResult> {
  const mod = await init();
  return mod.benchmarkMlKemEncapsulate(iterations);
}

/**
 * Run comprehensive benchmark suite.
 */
export async function runBenchmarkSuite(iterations: number): Promise<BenchmarkResult[]> {
  const mod = await init();
  return mod.runBenchmarkSuite(iterations);
}

// Default export
export default {
  init,
  getModule,
  isInitialized,
  getPlatformInfo,
  // ML-DSA
  mlDsaGenerateKeypair,
  mlDsaSign,
  mlDsaVerify,
  mlDsaVerifyBatch,
  // ML-KEM
  mlKemGenerateKeypair,
  mlKemEncapsulate,
  mlKemDecapsulate,
  // BLAKE3
  blake3Hash,
  blake3KeyedHash,
  blake3DeriveKey,
  blake3HashBatch,
  // Fingerprint
  generateFingerprint,
  verifyFingerprint,
  // Utilities
  randomBytes,
  getVersion,
  isNative,
  getRuntimeInfo,
  // Metrics
  getMetrics,
  resetMetrics,
  // Benchmarks
  benchmarkMlDsaKeygen,
  benchmarkMlDsaSign,
  benchmarkBlake3,
  benchmarkMlKemEncapsulate,
  runBenchmarkSuite,
};
