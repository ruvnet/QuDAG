/**
 * Type definitions for @qudag/crypto
 */

// ============================================================================
// Result Types
// ============================================================================

export interface MlDsaKeyPairResult {
  publicKey: Buffer;
  secretKey: Buffer;
}

export interface MlKemKeyPairResult {
  publicKey: Buffer;
  secretKey: Buffer;
}

export interface SignatureResult {
  signature: Buffer;
  durationNs: number;
}

export interface VerifyResult {
  valid: boolean;
  durationNs: number;
}

export interface EncapsulateResult {
  ciphertext: Buffer;
  sharedSecret: Buffer;
  durationNs: number;
}

export interface DecapsulateResult {
  sharedSecret: Buffer;
  durationNs: number;
}

export interface HashResult {
  hash: Buffer;
  hex: string;
  durationNs: number;
}

export interface FingerprintResult {
  hash: Buffer;
  signature: Buffer;
  publicKey: Buffer;
  hexHash: string;
}

export interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalNs: number;
  avgNs: number;
  minNs: number;
  maxNs: number;
  opsPerSec: number;
}

export interface MetricsSummary {
  keygenCount: number;
  keygenAvgNs: number;
  signCount: number;
  signAvgNs: number;
  verifyCount: number;
  verifyAvgNs: number;
  encapsulateCount: number;
  encapsulateAvgNs: number;
  decapsulateCount: number;
  decapsulateAvgNs: number;
  hashCount: number;
  hashAvgNs: number;
}

export interface RuntimeInfo {
  isNative: boolean;
  version: string;
  platform: string;
  arch: string;
}

// ============================================================================
// Module Interface
// ============================================================================

export interface CryptoModule {
  // ML-DSA
  mlDsaGenerateKeypair(): MlDsaKeyPairResult;
  mlDsaSign(secretKey: Buffer, message: Buffer): SignatureResult;
  mlDsaVerify(publicKey: Buffer, message: Buffer, signature: Buffer): VerifyResult;
  mlDsaVerifyBatch(publicKey: Buffer, messages: Buffer[], signatures: Buffer[]): boolean[];

  // ML-KEM
  mlKemGenerateKeypair(): MlKemKeyPairResult;
  mlKemEncapsulate(publicKey: Buffer): EncapsulateResult;
  mlKemDecapsulate(secretKey: Buffer, ciphertext: Buffer): DecapsulateResult;

  // BLAKE3
  blake3Hash(data: Buffer): HashResult;
  blake3KeyedHash(key: Buffer, data: Buffer): HashResult;
  blake3DeriveKey(context: string, keyMaterial: Buffer): Buffer;
  blake3HashBatch(inputs: Buffer[]): HashResult[];

  // Fingerprint
  generateFingerprint(data: Buffer): FingerprintResult;
  verifyFingerprint(data: Buffer, signature: Buffer, publicKey: Buffer): boolean;

  // Utilities
  randomBytes(length: number): Buffer;
  getVersion(): string;
  isNative(): boolean;
  getRuntimeInfo(): RuntimeInfo;

  // Metrics
  getMetrics(): MetricsSummary;
  resetMetrics(): void;

  // Benchmarks
  benchmarkMlDsaKeygen(iterations: number): BenchmarkResult;
  benchmarkMlDsaSign(iterations: number, messageSize: number): BenchmarkResult;
  benchmarkBlake3(iterations: number, dataSize: number): BenchmarkResult;
  benchmarkMlKemEncapsulate(iterations: number): BenchmarkResult;
  runBenchmarkSuite(iterations: number): BenchmarkResult[];
}
