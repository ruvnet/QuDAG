import { bench, describe } from 'vitest';
import {
  generateTestMessage,
  generateTestMessages,
  cryptoFixtures,
  PerformanceTimer,
  createLargeBuffer,
} from '@tests/utils/helpers';
import { mockNapiCore } from '@tests/utils/mocks';

/**
 * Cryptographic operation benchmarks for QuDAG
 *
 * Performance targets (from design documentation):
 * - ML-DSA Keypair: < 50ms ±10%
 * - ML-DSA Sign: < 5ms ±10%
 * - ML-DSA Verify: < 2ms ±10%
 * - ML-KEM Encapsulate: < 1ms ±10%
 * - ML-KEM Decapsulate: < 1.5ms ±10%
 * - Fingerprint Generation: > 500 MB/s ±20%
 */

describe('Cryptographic Operations Benchmarks', () => {
  describe('ML-DSA Performance', () => {
    bench('ML-DSA keypair generation', () => {
      mockNapiCore.generateMlDsaKeypair();
    });

    bench('ML-DSA sign (32 bytes)', () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = generateTestMessage(32);
      mockNapiCore.mlDsaSign(keypair.secretKey, message);
    });

    bench('ML-DSA sign (256 bytes)', () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = generateTestMessage(256);
      mockNapiCore.mlDsaSign(keypair.secretKey, message);
    });

    bench('ML-DSA sign (1KB)', () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = generateTestMessage(1024);
      mockNapiCore.mlDsaSign(keypair.secretKey, message);
    });

    bench('ML-DSA verify', () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = generateTestMessage(256);
      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);
      mockNapiCore.mlDsaVerify(keypair.publicKey, message, signature);
    });
  });

  describe('ML-KEM Performance', () => {
    bench('ML-KEM keypair generation', () => {
      mockNapiCore.generateMlKemKeypair();
    });

    bench('ML-KEM encapsulate', () => {
      const keypair = mockNapiCore.generateMlKemKeypair();
      mockNapiCore.mlKemEncapsulate(keypair.publicKey);
    });

    bench('ML-KEM decapsulate', () => {
      const keypair = mockNapiCore.generateMlKemKeypair();
      const { ciphertext } = mockNapiCore.mlKemEncapsulate(keypair.publicKey);
      mockNapiCore.mlKemDecapsulate(keypair.secretKey, ciphertext);
    });
  });

  describe('HQC Performance', () => {
    bench('HQC keypair generation', () => {
      mockNapiCore.generateHqcKeypair();
    });

    bench('HQC encrypt', () => {
      const keypair = mockNapiCore.generateHqcKeypair();
      mockNapiCore.hqcEncrypt(keypair.publicKey);
    });

    bench('HQC decrypt', () => {
      const keypair = mockNapiCore.generateHqcKeypair();
      const { ciphertext } = mockNapiCore.hqcEncrypt(keypair.publicKey);
      mockNapiCore.hqcDecrypt(keypair.secretKey, ciphertext);
    });
  });

  describe('Fingerprinting Performance', () => {
    bench('Fingerprint generation (1KB)', () => {
      const data = generateTestMessage(1024);
      mockNapiCore.generateFingerprint(data);
    });

    bench('Fingerprint generation (1MB)', () => {
      const data = generateTestMessage(1024 * 1024);
      mockNapiCore.generateFingerprint(data);
    });

    bench('Fingerprint generation (10MB)', () => {
      const data = generateTestMessage(10 * 1024 * 1024);
      mockNapiCore.generateFingerprint(data);
    });

    bench('Fingerprint verification', () => {
      const data = generateTestMessage(256);
      const fingerprint = mockNapiCore.generateFingerprint(data);
      mockNapiCore.verifyFingerprint(fingerprint, data);
    });
  });

  describe('Bulk Operations', () => {
    bench('Sign 100 messages', () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const messages = generateTestMessages([32, 64, 128, 256, 512]);

      for (let i = 0; i < 100; i++) {
        const message = messages[i % messages.length];
        mockNapiCore.mlDsaSign(keypair.secretKey, message);
      }
    });

    bench('Verify 100 signatures', () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = generateTestMessage(256);
      const signatures = Array.from({ length: 100 }, () =>
        mockNapiCore.mlDsaSign(keypair.secretKey, message)
      );

      for (const signature of signatures) {
        mockNapiCore.mlDsaVerify(keypair.publicKey, message, signature);
      }
    });

    bench('Encapsulate 100 times', () => {
      const keypair = mockNapiCore.generateMlKemKeypair();

      for (let i = 0; i < 100; i++) {
        mockNapiCore.mlKemEncapsulate(keypair.publicKey);
      }
    });
  });

  describe('Message Size Impact', () => {
    const sizes = [32, 256, 1024, 65536];

    for (const size of sizes) {
      bench(`ML-DSA sign (${size} bytes)`, () => {
        const keypair = mockNapiCore.generateMlDsaKeypair();
        const message = generateTestMessage(size);
        mockNapiCore.mlDsaSign(keypair.secretKey, message);
      });
    }
  });
});

/**
 * Regression detection benchmarks
 * These benchmarks track performance across different runs
 */
describe('Performance Regression Detection', () => {
  const performanceBaseline: Record<string, number> = {
    mlDsaKeypair: 50, // ms
    mlDsaSign: 5, // ms
    mlDsaVerify: 2, // ms
    mlKemEncapsulate: 1, // ms
    mlKemDecapsulate: 1.5, // ms
    fingerprintGen1MB: 2, // ms
  };

  const maxRegression = 0.1; // 10% regression threshold

  bench('ML-DSA keypair regression check', () => {
    const timer = new PerformanceTimer();
    timer.start();
    mockNapiCore.generateMlDsaKeypair();
    const duration = timer.end();

    const baseline = performanceBaseline.mlDsaKeypair;
    const maxAllowed = baseline * (1 + maxRegression);

    if (duration > maxAllowed) {
      console.warn(`⚠️  ML-DSA keypair regression: ${duration.toFixed(2)}ms (baseline: ${baseline}ms)`);
    }
  });

  bench('ML-DSA sign regression check', () => {
    const timer = new PerformanceTimer();
    const keypair = mockNapiCore.generateMlDsaKeypair();
    const message = generateTestMessage(256);

    timer.start();
    mockNapiCore.mlDsaSign(keypair.secretKey, message);
    const duration = timer.end();

    const baseline = performanceBaseline.mlDsaSign;
    const maxAllowed = baseline * (1 + maxRegression);

    if (duration > maxAllowed) {
      console.warn(`⚠️  ML-DSA sign regression: ${duration.toFixed(2)}ms (baseline: ${baseline}ms)`);
    }
  });

  bench('ML-KEM encapsulate regression check', () => {
    const timer = new PerformanceTimer();
    const keypair = mockNapiCore.generateMlKemKeypair();

    timer.start();
    mockNapiCore.mlKemEncapsulate(keypair.publicKey);
    const duration = timer.end();

    const baseline = performanceBaseline.mlKemEncapsulate;
    const maxAllowed = baseline * (1 + maxRegression);

    if (duration > maxAllowed) {
      console.warn(`⚠️  ML-KEM encapsulate regression: ${duration.toFixed(2)}ms (baseline: ${baseline}ms)`);
    }
  });

  bench('Fingerprint generation regression check', () => {
    const timer = new PerformanceTimer();
    const data = generateTestMessage(1024 * 1024); // 1MB

    timer.start();
    mockNapiCore.generateFingerprint(data);
    const duration = timer.end();

    const baseline = performanceBaseline.fingerprintGen1MB;
    const maxAllowed = baseline * (1 + maxRegression);

    if (duration > maxAllowed) {
      console.warn(`⚠️  Fingerprint generation regression: ${duration.toFixed(2)}ms (baseline: ${baseline}ms)`);
    }
  });
});

/**
 * Scaling benchmarks
 * Measure performance as input size increases
 */
describe('Scaling Benchmarks', () => {
  bench('Sign message scaling - exponential sizes', () => {
    const keypair = mockNapiCore.generateMlDsaKeypair();
    const sizes = [32, 256, 1024, 65536, 1048576]; // 1B to 1MB

    for (const size of sizes) {
      const message = generateTestMessage(size);
      mockNapiCore.mlDsaSign(keypair.secretKey, message);
    }
  });

  bench('Fingerprint generation scaling', () => {
    const sizes = [1024, 10240, 102400, 1024000, 10240000]; // 1KB to 10MB

    for (const size of sizes) {
      const data = generateTestMessage(size);
      mockNapiCore.generateFingerprint(data);
    }
  });
});

/**
 * Concurrency benchmarks
 * Measure performance with parallel operations
 */
describe('Concurrency Benchmarks', () => {
  bench('Parallel signing (10 operations)', () => {
    const keypair = mockNapiCore.generateMlDsaKeypair();
    const message = generateTestMessage(256);

    const promises = Array.from({ length: 10 }, () =>
      Promise.resolve(mockNapiCore.mlDsaSign(keypair.secretKey, message))
    );

    Promise.all(promises);
  });

  bench('Parallel encapsulation (20 operations)', () => {
    const keypair = mockNapiCore.generateMlKemKeypair();

    const promises = Array.from({ length: 20 }, () =>
      Promise.resolve(mockNapiCore.mlKemEncapsulate(keypair.publicKey))
    );

    Promise.all(promises);
  });

  bench('Mixed operations (signing + encapsulation)', () => {
    const dsaKeypair = mockNapiCore.generateMlDsaKeypair();
    const kemKeypair = mockNapiCore.generateMlKemKeypair();
    const message = generateTestMessage(256);

    const operations = [
      ...Array.from({ length: 5 }, () =>
        Promise.resolve(mockNapiCore.mlDsaSign(dsaKeypair.secretKey, message))
      ),
      ...Array.from({ length: 5 }, () =>
        Promise.resolve(mockNapiCore.mlKemEncapsulate(kemKeypair.publicKey))
      ),
    ];

    Promise.all(operations);
  });
});

/**
 * Memory efficiency benchmarks
 * Measure memory impact of crypto operations
 */
describe('Memory Efficiency', () => {
  bench('Large buffer handling (10MB)', () => {
    const buffer = createLargeBuffer(10);
    mockNapiCore.generateFingerprint(buffer);
  });

  bench('Bulk keypair generation', () => {
    for (let i = 0; i < 10; i++) {
      mockNapiCore.generateMlDsaKeypair();
      mockNapiCore.generateMlKemKeypair();
    }
  });
});

/**
 * Algorithm comparison benchmarks
 */
describe('Algorithm Comparisons', () => {
  bench('ML-DSA vs ML-KEM keypair generation', () => {
    mockNapiCore.generateMlDsaKeypair();
    mockNapiCore.generateMlKemKeypair();
  });

  bench('ML-DSA sign vs ML-KEM encapsulate', () => {
    const dsaKeypair = mockNapiCore.generateMlDsaKeypair();
    const kemKeypair = mockNapiCore.generateMlKemKeypair();
    const message = generateTestMessage(256);

    mockNapiCore.mlDsaSign(dsaKeypair.secretKey, message);
    mockNapiCore.mlKemEncapsulate(kemKeypair.publicKey);
  });

  bench('ML-DSA verify vs ML-KEM decapsulate', () => {
    const dsaKeypair = mockNapiCore.generateMlDsaKeypair();
    const kemKeypair = mockNapiCore.generateMlKemKeypair();
    const message = generateTestMessage(256);

    const signature = mockNapiCore.mlDsaSign(dsaKeypair.secretKey, message);
    const { ciphertext } = mockNapiCore.mlKemEncapsulate(kemKeypair.publicKey);

    mockNapiCore.mlDsaVerify(dsaKeypair.publicKey, message, signature);
    mockNapiCore.mlKemDecapsulate(kemKeypair.secretKey, ciphertext);
  });

  bench('ML-KEM vs HQC operations', () => {
    const kemKeypair = mockNapiCore.generateMlKemKeypair();
    const hqcKeypair = mockNapiCore.generateHqcKeypair();

    mockNapiCore.mlKemEncapsulate(kemKeypair.publicKey);
    mockNapiCore.hqcEncrypt(hqcKeypair.publicKey);
  });
});
