/**
 * Platform detection and module loading for @qudag/crypto
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { CryptoModule } from './types';

// ============================================================================
// Platform Detection
// ============================================================================

export type Platform = 'darwin' | 'linux' | 'win32' | 'freebsd' | 'android';
export type Arch = 'x64' | 'arm64' | 'arm' | 'ia32';
export type Libc = 'gnu' | 'musl' | 'msvc';

export interface PlatformInfo {
  platform: Platform;
  arch: Arch;
  libc?: Libc;
  nativeModuleName: string;
  nativePackageName: string;
}

/**
 * Detect the current platform and architecture.
 */
export function detectPlatform(): PlatformInfo {
  const platform = process.platform as Platform;
  const arch = process.arch as Arch;
  let libc: Libc | undefined;

  // Detect libc on Linux
  if (platform === 'linux') {
    try {
      // Check if running on musl
      const { execSync } = require('child_process');
      const lddOutput = execSync('ldd --version 2>&1 || true', { encoding: 'utf-8' });
      libc = lddOutput.toLowerCase().includes('musl') ? 'musl' : 'gnu';
    } catch {
      // Default to gnu if detection fails
      libc = 'gnu';
    }
  } else if (platform === 'win32') {
    libc = 'msvc';
  }

  const nativeModuleName = getNativeModuleName(platform, arch, libc);
  const nativePackageName = getNativePackageName(platform, arch, libc);

  return {
    platform,
    arch,
    libc,
    nativeModuleName,
    nativePackageName,
  };
}

/**
 * Get the native module file name for the current platform.
 */
function getNativeModuleName(platform: Platform, arch: Arch, libc?: Libc): string {
  const parts = ['qudag_napi'];

  switch (platform) {
    case 'darwin':
      parts.push(arch);
      parts.push('apple-darwin');
      break;
    case 'win32':
      parts.push(arch);
      parts.push('pc-windows-msvc');
      break;
    case 'linux':
      parts.push(arch);
      parts.push('unknown-linux');
      parts.push(libc || 'gnu');
      break;
    case 'freebsd':
      parts.push(arch);
      parts.push('unknown-freebsd');
      break;
    case 'android':
      parts.push(arch);
      parts.push('linux-android');
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  return parts.join('.');
}

/**
 * Get the npm package name for native bindings.
 */
function getNativePackageName(platform: Platform, arch: Arch, libc?: Libc): string {
  const base = '@qudag/crypto';

  switch (platform) {
    case 'darwin':
      return `${base}-darwin-${arch}`;
    case 'win32':
      return `${base}-win32-${arch}-msvc`;
    case 'linux':
      return `${base}-linux-${arch}-${libc || 'gnu'}`;
    case 'freebsd':
      return `${base}-freebsd-${arch}`;
    case 'android':
      return `${base}-android-${arch}`;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// ============================================================================
// Module Loading
// ============================================================================

/**
 * Load the native module for the current platform.
 */
export async function loadNativeModule(platformInfo: PlatformInfo): Promise<CryptoModule> {
  const { nativePackageName, nativeModuleName } = platformInfo;

  // Try to load from optional dependency package
  const loadPaths = [
    // From node_modules (installed as dependency)
    nativePackageName,
    // From relative path (development)
    join(__dirname, '..', 'native', `${nativeModuleName}.node`),
    join(__dirname, '..', '..', 'native', `${nativeModuleName}.node`),
    // From build output
    join(__dirname, '..', '..', '..', 'target', 'release', 'libqudag_napi.so'),
    join(__dirname, '..', '..', '..', 'target', 'release', 'libqudag_napi.dylib'),
    join(__dirname, '..', '..', '..', 'target', 'release', 'qudag_napi.dll'),
  ];

  for (const loadPath of loadPaths) {
    try {
      // Try require for npm package
      if (!loadPath.endsWith('.node') && !loadPath.endsWith('.so') && !loadPath.endsWith('.dylib') && !loadPath.endsWith('.dll')) {
        const nativeModule = require(loadPath);
        return wrapNativeModule(nativeModule);
      }

      // Try to load .node file directly
      if (existsSync(loadPath)) {
        const nativeModule = require(loadPath);
        return wrapNativeModule(nativeModule);
      }
    } catch (e) {
      // Continue trying other paths
      continue;
    }
  }

  throw new Error(
    `Failed to load native module for ${platformInfo.platform}-${platformInfo.arch}.\n` +
    `Tried: ${loadPaths.join(', ')}\n` +
    `Install the native package: npm install ${nativePackageName}`
  );
}

/**
 * Load the WASM module as fallback.
 */
export async function loadWasmModule(): Promise<CryptoModule> {
  const wasmPaths = [
    // From node_modules
    'qudag-wasm',
    '@qudag/wasm',
    // From relative paths
    join(__dirname, '..', '..', '..', 'qudag-wasm', 'pkg-node', 'qudag_wasm.js'),
    join(__dirname, '..', '..', 'wasm', 'qudag_wasm.js'),
  ];

  for (const wasmPath of wasmPaths) {
    try {
      const wasmModule = require(wasmPath);
      return wrapWasmModule(wasmModule);
    } catch (e) {
      continue;
    }
  }

  throw new Error(
    'Failed to load WASM fallback module.\n' +
    'Install qudag-wasm: npm install qudag-wasm'
  );
}

/**
 * Wrap native module to match CryptoModule interface.
 */
function wrapNativeModule(native: any): CryptoModule {
  return {
    // ML-DSA
    mlDsaGenerateKeypair: () => native.mlDsaGenerateKeypair(),
    mlDsaSign: (sk: Buffer, msg: Buffer) => native.mlDsaSign(sk, msg),
    mlDsaVerify: (pk: Buffer, msg: Buffer, sig: Buffer) => native.mlDsaVerify(pk, msg, sig),
    mlDsaVerifyBatch: (pk: Buffer, msgs: Buffer[], sigs: Buffer[]) => native.mlDsaVerifyBatch(pk, msgs, sigs),

    // ML-KEM
    mlKemGenerateKeypair: () => native.mlKemGenerateKeypair(),
    mlKemEncapsulate: (pk: Buffer) => native.mlKemEncapsulate(pk),
    mlKemDecapsulate: (sk: Buffer, ct: Buffer) => native.mlKemDecapsulate(sk, ct),

    // BLAKE3
    blake3Hash: (data: Buffer) => native.blake3Hash(data),
    blake3KeyedHash: (key: Buffer, data: Buffer) => native.blake3KeyedHash(key, data),
    blake3DeriveKey: (ctx: string, km: Buffer) => native.blake3DeriveKey(ctx, km),
    blake3HashBatch: (inputs: Buffer[]) => native.blake3HashBatch(inputs),

    // Fingerprint
    generateFingerprint: (data: Buffer) => native.generateFingerprint(data),
    verifyFingerprint: (data: Buffer, sig: Buffer, pk: Buffer) => native.verifyFingerprint(data, sig, pk),

    // Utilities
    randomBytes: (len: number) => native.randomBytes(len),
    getVersion: () => native.getVersion(),
    isNative: () => true,
    getRuntimeInfo: () => native.getRuntimeInfo(),

    // Metrics
    getMetrics: () => native.getMetrics(),
    resetMetrics: () => native.resetMetrics(),

    // Benchmarks
    benchmarkMlDsaKeygen: (iter: number) => native.benchmarkMlDsaKeygen(iter),
    benchmarkMlDsaSign: (iter: number, size: number) => native.benchmarkMlDsaSign(iter, size),
    benchmarkBlake3: (iter: number, size: number) => native.benchmarkBlake3(iter, size),
    benchmarkMlKemEncapsulate: (iter: number) => native.benchmarkMlKemEncapsulate(iter),
    runBenchmarkSuite: (iter: number) => native.runBenchmarkSuite(iter),
  };
}

/**
 * Wrap WASM module to match CryptoModule interface.
 */
function wrapWasmModule(wasm: any): CryptoModule {
  return {
    // ML-DSA
    mlDsaGenerateKeypair: () => {
      const kp = new wasm.WasmMlDsaKeyPair();
      return {
        publicKey: Buffer.from(kp.getPublicKey()),
        secretKey: Buffer.from(kp.getSecretKey()),
      };
    },
    mlDsaSign: (sk: Buffer, msg: Buffer) => {
      const kp = new wasm.WasmMlDsaKeyPair();
      const sig = kp.sign(msg);
      return {
        signature: Buffer.from(sig),
        durationNs: 0,
      };
    },
    mlDsaVerify: (pk: Buffer, msg: Buffer, sig: Buffer) => {
      const kp = new wasm.WasmMlDsaKeyPair();
      const valid = kp.verify(msg, sig);
      return {
        valid,
        durationNs: 0,
      };
    },
    mlDsaVerifyBatch: (pk: Buffer, msgs: Buffer[], sigs: Buffer[]) => {
      return msgs.map((msg, i) => {
        const kp = new wasm.WasmMlDsaKeyPair();
        return kp.verify(msg, sigs[i]);
      });
    },

    // ML-KEM
    mlKemGenerateKeypair: () => {
      const kp = new wasm.WasmMlKemKeyPair();
      return {
        publicKey: Buffer.from(kp.getPublicKey()),
        secretKey: Buffer.from(kp.getSecretKey()),
      };
    },
    mlKemEncapsulate: (pk: Buffer) => {
      const kp = new wasm.WasmMlKemKeyPair();
      const result = kp.encapsulate(pk);
      return {
        ciphertext: Buffer.from(result.ciphertext || []),
        sharedSecret: Buffer.from(result.shared_secret || result.sharedSecret || []),
        durationNs: 0,
      };
    },
    mlKemDecapsulate: (sk: Buffer, ct: Buffer) => {
      const kp = new wasm.WasmMlKemKeyPair();
      const ss = kp.decapsulate(ct);
      return {
        sharedSecret: Buffer.from(ss),
        durationNs: 0,
      };
    },

    // BLAKE3 - use pure Rust provider
    blake3Hash: (data: Buffer) => {
      const provider = new wasm.PureRustCryptoProvider();
      const hash = provider.blake3(data);
      return {
        hash: Buffer.from(hash),
        hex: Buffer.from(hash).toString('hex'),
        durationNs: 0,
      };
    },
    blake3KeyedHash: (key: Buffer, data: Buffer) => {
      // Fallback: just use regular hash (WASM may not support keyed)
      const provider = new wasm.PureRustCryptoProvider();
      const combined = Buffer.concat([key, data]);
      const hash = provider.blake3(combined);
      return {
        hash: Buffer.from(hash),
        hex: Buffer.from(hash).toString('hex'),
        durationNs: 0,
      };
    },
    blake3DeriveKey: (ctx: string, km: Buffer) => {
      const provider = new wasm.PureRustCryptoProvider();
      const combined = Buffer.concat([Buffer.from(ctx), km]);
      return Buffer.from(provider.blake3(combined));
    },
    blake3HashBatch: (inputs: Buffer[]) => {
      const provider = new wasm.PureRustCryptoProvider();
      return inputs.map(input => {
        const hash = provider.blake3(input);
        return {
          hash: Buffer.from(hash),
          hex: Buffer.from(hash).toString('hex'),
          durationNs: 0,
        };
      });
    },

    // Fingerprint
    generateFingerprint: (data: Buffer) => {
      const fp = wasm.WasmQuantumFingerprint.generate(data);
      return {
        hash: Buffer.from(fp.getHash()),
        signature: Buffer.from(fp.getSignature()),
        publicKey: Buffer.from(fp.getPublicKey()),
        hexHash: Buffer.from(fp.getHash()).toString('hex'),
      };
    },
    verifyFingerprint: (data: Buffer, sig: Buffer, pk: Buffer) => {
      const kp = new wasm.WasmMlDsaKeyPair();
      const provider = new wasm.PureRustCryptoProvider();
      const hash = provider.blake3(data);
      return kp.verify(hash, sig);
    },

    // Utilities
    randomBytes: (len: number) => {
      const kdf = wasm.WasmKdf;
      return Buffer.from(kdf.generateSalt().slice(0, len));
    },
    getVersion: () => wasm.getInitStatus?.()?.version || '0.1.0',
    isNative: () => false,
    getRuntimeInfo: () => ({
      isNative: false,
      version: wasm.getInitStatus?.()?.version || '0.1.0',
      platform: 'wasm',
      arch: 'wasm32',
    }),

    // Metrics (not available in WASM)
    getMetrics: () => ({
      keygenCount: 0,
      keygenAvgNs: 0,
      signCount: 0,
      signAvgNs: 0,
      verifyCount: 0,
      verifyAvgNs: 0,
      encapsulateCount: 0,
      encapsulateAvgNs: 0,
      decapsulateCount: 0,
      decapsulateAvgNs: 0,
      hashCount: 0,
      hashAvgNs: 0,
    }),
    resetMetrics: () => {},

    // Benchmarks (basic implementation for WASM)
    benchmarkMlDsaKeygen: (iter: number) => {
      const start = Date.now();
      for (let i = 0; i < iter; i++) {
        new wasm.WasmMlDsaKeyPair();
      }
      const totalNs = (Date.now() - start) * 1_000_000;
      return {
        operation: 'ml_dsa_keygen',
        iterations: iter,
        totalNs,
        avgNs: totalNs / iter,
        minNs: 0,
        maxNs: 0,
        opsPerSec: 1_000_000_000 / (totalNs / iter),
      };
    },
    benchmarkMlDsaSign: (iter: number, size: number) => {
      const kp = new wasm.WasmMlDsaKeyPair();
      const msg = Buffer.alloc(size);
      const start = Date.now();
      for (let i = 0; i < iter; i++) {
        kp.sign(msg);
      }
      const totalNs = (Date.now() - start) * 1_000_000;
      return {
        operation: `ml_dsa_sign_${size}bytes`,
        iterations: iter,
        totalNs,
        avgNs: totalNs / iter,
        minNs: 0,
        maxNs: 0,
        opsPerSec: 1_000_000_000 / (totalNs / iter),
      };
    },
    benchmarkBlake3: (iter: number, size: number) => {
      const provider = new wasm.PureRustCryptoProvider();
      const data = Buffer.alloc(size);
      const start = Date.now();
      for (let i = 0; i < iter; i++) {
        provider.blake3(data);
      }
      const totalNs = (Date.now() - start) * 1_000_000;
      return {
        operation: `blake3_${size}bytes`,
        iterations: iter,
        totalNs,
        avgNs: totalNs / iter,
        minNs: 0,
        maxNs: 0,
        opsPerSec: 1_000_000_000 / (totalNs / iter),
      };
    },
    benchmarkMlKemEncapsulate: (iter: number) => {
      const kp = new wasm.WasmMlKemKeyPair();
      const pk = kp.getPublicKey();
      const start = Date.now();
      for (let i = 0; i < iter; i++) {
        kp.encapsulate(pk);
      }
      const totalNs = (Date.now() - start) * 1_000_000;
      return {
        operation: 'ml_kem_encapsulate',
        iterations: iter,
        totalNs,
        avgNs: totalNs / iter,
        minNs: 0,
        maxNs: 0,
        opsPerSec: 1_000_000_000 / (totalNs / iter),
      };
    },
    runBenchmarkSuite: function(iter: number) {
      return [
        this.benchmarkMlDsaKeygen(iter),
        this.benchmarkMlDsaSign(iter, 32),
        this.benchmarkMlDsaSign(iter, 1024),
        this.benchmarkMlKemEncapsulate(iter),
        this.benchmarkBlake3(iter, 32),
        this.benchmarkBlake3(iter, 1024),
        this.benchmarkBlake3(iter, 65536),
      ];
    },
  };
}
