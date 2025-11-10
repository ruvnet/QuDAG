import { randomBytes } from 'crypto';

/**
 * Test helper utilities for QuDAG integration tests
 */

/**
 * Generate random bytes for testing
 */
export function generateRandomBytes(length: number): Uint8Array {
  return new Uint8Array(randomBytes(length));
}

/**
 * Generate random message of varying sizes
 */
export function generateTestMessage(size: number): Uint8Array {
  return generateRandomBytes(size);
}

/**
 * Generate multiple test messages with different sizes
 */
export function generateTestMessages(sizes: number[]): Uint8Array[] {
  return sizes.map(size => generateTestMessage(size));
}

/**
 * Create a large buffer for testing zero-copy behavior
 */
export function createLargeBuffer(sizeInMB: number): Uint8Array {
  return generateRandomBytes(sizeInMB * 1024 * 1024);
}

/**
 * Convert Uint8Array to hex string for comparison
 */
export function toHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Assert arrays are equal
 */
export function assertBufferEqual(
  actual: Uint8Array,
  expected: Uint8Array,
  message?: string
): void {
  if (actual.length !== expected.length) {
    throw new Error(
      message || `Buffer length mismatch: expected ${expected.length}, got ${actual.length}`
    );
  }

  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(
        message || `Buffer mismatch at index ${i}: expected ${expected[i]}, got ${actual[i]}`
      );
    }
  }
}

/**
 * Create test fixtures for crypto operations
 */
export const cryptoFixtures = {
  // ML-DSA sizes (ML-DSA-65)
  mlDsaPublicKeySize: 2544,
  mlDsaSecretKeySize: 4880,
  mlDsaSignatureSize: 2372,

  // ML-KEM sizes (ML-KEM-768)
  mlKemPublicKeySize: 1184,
  mlKemSecretKeySize: 2400,
  mlKemCiphertextSize: 1088,
  mlKemSharedSecretSize: 32,

  // Message sizes for testing
  messageSizes: [32, 256, 1024, 65536, 1048576],

  // Test vectors
  testMessages: {
    short: generateTestMessage(32),
    medium: generateTestMessage(256),
    large: generateTestMessage(65536),
    xl: generateTestMessage(1048576),
  },
};

/**
 * Performance measurement helper
 */
export class PerformanceTimer {
  private startTime: number = 0;
  private measurements: number[] = [];

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    const duration = performance.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getStats() {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const count = this.measurements.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];

    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, index)];
    };

    const median = sorted[Math.floor(count / 2)];
    const p95 = getPercentile(95);
    const p99 = getPercentile(99);

    return {
      count,
      min,
      max,
      avg,
      median,
      p95,
      p99,
    };
  }

  reset(): void {
    this.measurements = [];
  }
}

/**
 * Async test utilities
 */
export async function runConcurrentOperations<T>(
  operation: () => Promise<T>,
  concurrency: number,
  iterations: number
): Promise<T[]> {
  const results: T[] = [];
  const runningPromises: Promise<void>[] = [];

  for (let i = 0; i < iterations; i++) {
    const promise = operation().then(result => {
      results.push(result);
    });

    runningPromises.push(promise);

    if (runningPromises.length >= concurrency) {
      await Promise.race(runningPromises);
      runningPromises.splice(
        runningPromises.findIndex(p => !p),
        1
      );
    }
  }

  await Promise.all(runningPromises);
  return results;
}

/**
 * Memory measurement helper
 */
export class MemoryMonitor {
  private initialMemory: number = 0;

  start(): void {
    if (global.gc) {
      global.gc();
    }
    this.initialMemory = process.memoryUsage().heapUsed;
  }

  getUsed(): number {
    if (global.gc) {
      global.gc();
    }
    return process.memoryUsage().heapUsed - this.initialMemory;
  }

  getStats() {
    if (global.gc) {
      global.gc();
    }
    const usage = process.memoryUsage();
    return {
      rss: usage.rss / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024,
      heapUsed: usage.heapUsed / 1024 / 1024,
      external: usage.external / 1024 / 1024,
      arrayBuffers: usage.arrayBuffers / 1024 / 1024,
    };
  }
}

/**
 * DAG test utilities
 */
export const dagFixtures = {
  // Standard DAG sizes for testing
  smallDagSize: 100,
  mediumDagSize: 1000,
  largeDagSize: 10000,

  // Consensus parameters
  consensusRound: 1000, // ms
  blockTimeout: 5000, // ms

  // Network parameters
  peerCount: 5,
  minPeers: 3,
};

/**
 * CLI test utilities
 */
export const cliFixtures = {
  // Timeout for CLI operations
  cliTimeout: 10000,

  // Test commands
  testCommands: {
    help: ['--help'],
    version: ['--version'],
    keyGenerate: ['key', 'generate', '--algorithm', 'ml-dsa'],
    addressGenerate: ['address', 'generate', '--type', 'quantum'],
  },
};

/**
 * Wait for condition with timeout
 */
export async function waitUntil(
  condition: () => boolean,
  timeoutMs: number = 5000,
  pollIntervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Timeout waiting for condition (waited ${timeoutMs}ms)`
      );
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Batch operation helper
 */
export async function batchOperation<T>(
  items: T[],
  operation: (item: T) => Promise<void>,
  batchSize: number = 10
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(operation));
  }
}
