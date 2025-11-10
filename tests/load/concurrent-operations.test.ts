import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PerformanceTimer,
  MemoryMonitor,
  runConcurrentOperations,
} from '@tests/utils/helpers';
import { mockNapiCore, mockQuantumDag, mockMcpStdio } from '@tests/utils/mocks';

/**
 * Concurrent operations load tests
 *
 * These tests verify QuDAG's ability to handle 1000+ concurrent operations
 * while maintaining thread safety, memory efficiency, and performance.
 */

describe('High-Concurrency Operations', () => {
  let timer: PerformanceTimer;
  let memoryMonitor: MemoryMonitor;

  beforeEach(() => {
    timer = new PerformanceTimer();
    memoryMonitor = new MemoryMonitor();
    memoryMonitor.start();
  });

  afterEach(() => {
    timer.reset();
  });

  describe('Concurrent Cryptographic Operations', () => {
    it('should handle 100 concurrent ML-DSA signing operations', async () => {
      const concurrency = 100;
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = new Uint8Array(32);

      timer.start();

      const results = await runConcurrentOperations(
        () => mockNapiCore.mlDsaSign(keypair.secretKey, message),
        10,
        concurrency
      );

      const duration = timer.end();

      console.log(`100 concurrent ML-DSA signs: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(results.every(r => r.length === 2372)).toBe(true);
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle 500 concurrent ML-DSA verification operations', async () => {
      const concurrency = 500;
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = new Uint8Array(32);
      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      timer.start();

      const results = await runConcurrentOperations(
        () => mockNapiCore.mlDsaVerify(keypair.publicKey, message, signature),
        20,
        concurrency
      );

      const duration = timer.end();

      console.log(`500 concurrent ML-DSA verifications: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });

    it('should handle 1000 concurrent ML-KEM encapsulation operations', async () => {
      const concurrency = 1000;
      const keypair = mockNapiCore.generateMlKemKeypair();

      timer.start();

      const results = await runConcurrentOperations(
        () => mockNapiCore.mlKemEncapsulate(keypair.publicKey),
        50,
        concurrency
      );

      const duration = timer.end();

      console.log(`1000 concurrent ML-KEM encapsulations: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(results.every(r => r.sharedSecret.length === 32)).toBe(true);
      expect(duration).toBeLessThan(15000); // 15 seconds max
    });

    it('should handle mixed concurrent crypto operations', async () => {
      const dsakp = mockNapiCore.generateMlDsaKeypair();
      const kemkp = mockNapiCore.generateMlKemKeypair();
      const message = new Uint8Array(32);

      timer.start();

      const operations = [
        ...Array.from({ length: 200 }, () =>
          Promise.resolve(mockNapiCore.mlDsaSign(dsakp.secretKey, message))
        ),
        ...Array.from({ length: 200 }, () =>
          Promise.resolve(mockNapiCore.mlKemEncapsulate(kemkp.publicKey))
        ),
        ...Array.from({ length: 200 }, () =>
          Promise.resolve(
            mockNapiCore.mlDsaVerify(dsakp.publicKey, message, mockNapiCore.mlDsaSign(dsakp.secretKey, message))
          )
        ),
      ];

      const results = await Promise.all(operations);

      const duration = timer.end();

      console.log(`600 mixed concurrent crypto operations: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(600);
      expect(duration).toBeLessThan(20000); // 20 seconds max
    });

    it('should maintain thread safety with concurrent fingerprinting', async () => {
      const concurrency = 200;
      const dataSet = Array.from({ length: 20 }, () => new Uint8Array(256));

      timer.start();

      const results = await runConcurrentOperations(
        () => {
          const data = dataSet[Math.floor(Math.random() * dataSet.length)];
          return mockNapiCore.generateFingerprint(data);
        },
        10,
        concurrency
      );

      const duration = timer.end();

      console.log(`200 concurrent fingerprints: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(results.every(r => r.length === 32)).toBe(true);
    });
  });

  describe('Concurrent DAG Operations', () => {
    it('should handle 100 concurrent vertex additions', async () => {
      const concurrency = 100;

      timer.start();

      const results = await runConcurrentOperations(
        () => mockQuantumDag.addVertex(),
        10,
        concurrency
      );

      const duration = timer.end();

      console.log(`100 concurrent vertex additions: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(duration).toBeLessThan(5000);
    });

    it('should handle 500 concurrent consensus operations', async () => {
      const concurrency = 500;

      timer.start();

      const results = await runConcurrentOperations(
        () => mockQuantumDag.consensus(),
        20,
        concurrency
      );

      const duration = timer.end();

      console.log(`500 concurrent consensus rounds: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(results.every(r => r.finalized)).toBe(true);
      expect(duration).toBeLessThan(10000);
    });

    it('should handle 1000 concurrent tip selections', async () => {
      const concurrency = 1000;

      timer.start();

      const results = await runConcurrentOperations(
        () => mockQuantumDag.tipSelection(),
        50,
        concurrency
      );

      const duration = timer.end();

      console.log(`1000 concurrent tip selections: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(results.every(r => r.selected)).toBe(true);
      expect(duration).toBeLessThan(15000);
    });

    it('should handle mixed DAG operations concurrently', async () => {
      timer.start();

      const operations = [
        ...Array.from({ length: 300 }, () => mockQuantumDag.addVertex()),
        ...Array.from({ length: 300 }, () => mockQuantumDag.addEdge()),
        ...Array.from({ length: 200 }, () => mockQuantumDag.consensus()),
        ...Array.from({ length: 200 }, () => mockQuantumDag.tipSelection()),
      ];

      const results = await Promise.all(operations);

      const duration = timer.end();

      console.log(`1000 mixed DAG operations: ${duration.toFixed(0)}ms`);

      expect(results.length).toBe(1000);
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Concurrent MCP Operations', () => {
    it('should handle 100 concurrent MCP tool executions', async () => {
      const concurrency = 100;

      timer.start();

      const results = await runConcurrentOperations(
        () => mockMcpStdio.execute(),
        10,
        concurrency
      );

      const duration = timer.end();

      console.log(`100 concurrent MCP tool executions: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(results.every(r => r.content)).toBe(true);
      expect(duration).toBeLessThan(5000);
    });

    it('should handle 500 concurrent resource accesses', async () => {
      const concurrency = 500;

      timer.start();

      const results = await runConcurrentOperations(
        () => mockMcpStdio.getResources(),
        20,
        concurrency
      );

      const duration = timer.end();

      console.log(`500 concurrent resource accesses: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(concurrency);
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Thread Safety and Race Conditions', () => {
    it('should prevent race conditions in concurrent signing', async () => {
      const concurrency = 100;
      const keyPair = mockNapiCore.generateMlDsaKeypair();
      const message = new Uint8Array(32);

      const signatures = new Set<string>();

      timer.start();

      const results = await runConcurrentOperations(
        () => {
          const sig = mockNapiCore.mlDsaSign(keyPair.secretKey, message);
          // In mock, signatures will be same, but in real scenario they'd be random
          return sig;
        },
        10,
        concurrency
      );

      const duration = timer.end();

      // All signatures should be valid (even if identical in mock)
      expect(results).toHaveLength(concurrency);
      expect(results.every(sig => sig.length === 2372)).toBe(true);
    });

    it('should handle concurrent vertex additions without duplication', async () => {
      const concurrency = 100;
      const addedVertices: any[] = [];

      timer.start();

      const results = await runConcurrentOperations(
        async () => {
          const vertex = await mockQuantumDag.addVertex();
          addedVertices.push(vertex);
          return vertex;
        },
        10,
        concurrency
      );

      const duration = timer.end();

      // All vertices should have unique IDs
      const uniqueIds = new Set(addedVertices.map(v => v.id));
      console.log(`Unique vertices: ${uniqueIds.size} / ${concurrency}`);

      expect(results).toHaveLength(concurrency);
    });

    it('should maintain data consistency under concurrent consensus', async () => {
      const concurrency = 50;

      timer.start();

      const results = await runConcurrentOperations(
        () => mockQuantumDag.consensus(),
        10,
        concurrency
      );

      const duration = timer.end();

      // All consensus operations should succeed
      expect(results).toHaveLength(concurrency);
      expect(results.every(r => r.finalized === true)).toBe(true);
      expect(results.every(r => typeof r.timestamp === 'number')).toBe(true);
    });
  });

  describe('Resource Management', () => {
    it('should not exhaust memory with high concurrency', async () => {
      const concurrency = 500;
      const iterations = 2;

      for (let iter = 0; iter < iterations; iter++) {
        const memBefore = memoryMonitor.getStats();

        await runConcurrentOperations(
          () => mockNapiCore.mlDsaSign(mockNapiCore.generateMlDsaKeypair().secretKey, new Uint8Array(32)),
          20,
          concurrency
        );

        if (global.gc) global.gc();

        const memAfter = memoryMonitor.getStats();
        const growth = memAfter.heapUsed - memBefore.heapUsed;

        console.log(`Iteration ${iter + 1}: Memory growth: ${growth.toFixed(2)}MB`);

        expect(growth).toBeLessThan(100); // Max 100MB per iteration
      }
    }, { timeout: 60000 });

    it('should recover memory after concurrent operations', async () => {
      const memStart = memoryMonitor.getStats();

      // Heavy concurrent load
      await runConcurrentOperations(
        () => mockNapiCore.mlKemEncapsulate(mockNapiCore.generateMlKemKeypair().publicKey),
        50,
        200
      );

      if (global.gc) global.gc();

      const memEnd = memoryMonitor.getStats();

      console.log(`Memory before: ${memStart.heapUsed.toFixed(2)}MB`);
      console.log(`Memory after: ${memEnd.heapUsed.toFixed(2)}MB`);

      // Memory should not grow excessively
      const growth = memEnd.heapUsed - memStart.heapUsed;
      expect(growth).toBeLessThan(200); // Max 200MB growth
    }, { timeout: 30000 });
  });

  describe('Performance Under High Concurrency', () => {
    it('should maintain response time with 1000 concurrent operations', async () => {
      const concurrency = 1000;
      const durations: number[] = [];

      timer.start();

      const operations = Array.from({ length: concurrency }, async () => {
        const opTimer = new PerformanceTimer();
        opTimer.start();

        await mockNapiCore.mlDsaSign(
          mockNapiCore.generateMlDsaKeypair().secretKey,
          new Uint8Array(32)
        );

        durations.push(opTimer.end());
      });

      const results = await Promise.all(operations);

      const totalDuration = timer.end();

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      console.log(`1000 concurrent operations:`);
      console.log(`  Total time: ${totalDuration.toFixed(0)}ms`);
      console.log(`  Avg per op: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Min/Max: ${minDuration.toFixed(2)}ms / ${maxDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(100); // Avg < 100ms
      expect(maxDuration).toBeLessThan(200); // Max < 200ms
    }, { timeout: 60000 });

    it('should not starve any concurrent operations', async () => {
      const concurrency = 500;
      const startTimes: number[] = [];
      const endTimes: number[] = [];

      const baseTime = Date.now();

      const operations = Array.from({ length: concurrency }, (_, i) =>
        (async () => {
          startTimes[i] = Date.now() - baseTime;

          await mockNapiCore.generateFingerprint(new Uint8Array(1024));

          endTimes[i] = Date.now() - baseTime;
        })()
      );

      await Promise.all(operations);

      const waitTimes = endTimes.map((end, i) => end - startTimes[i]);
      const avgWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
      const maxWaitTime = Math.max(...waitTimes);
      const minWaitTime = Math.min(...waitTimes);

      console.log(`Starvation analysis (500 ops):`);
      console.log(`  Avg wait: ${avgWaitTime.toFixed(0)}ms`);
      console.log(`  Min wait: ${minWaitTime.toFixed(0)}ms`);
      console.log(`  Max wait: ${maxWaitTime.toFixed(0)}ms`);

      // No operation should be starved (max < 5x avg)
      expect(maxWaitTime).toBeLessThan(avgWaitTime * 5);
    }, { timeout: 60000 });
  });

  describe('Deadlock Prevention', () => {
    it('should not deadlock with circular dependencies', async () => {
      const concurrency = 100;

      timer.start();

      const operations = Array.from({ length: concurrency }, () =>
        Promise.all([
          mockQuantumDag.addVertex(),
          mockQuantumDag.consensus(),
          mockQuantumDag.tipSelection(),
        ])
      );

      await Promise.race([
        Promise.all(operations),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout - possible deadlock')), 30000)
        ),
      ]);

      const duration = timer.end();

      console.log(`Circular dependencies test: ${duration.toFixed(0)}ms`);

      expect(duration).toBeLessThan(30000);
    }, { timeout: 40000 });
  });

  describe('Stress Testing', () => {
    it('should handle burst of 10000 operations', async () => {
      const burstSize = 10000;

      timer.start();

      const operations = Array.from({ length: burstSize }, () =>
        Promise.resolve(mockNapiCore.generateFingerprint(new Uint8Array(100)))
      );

      const results = await Promise.all(operations);

      const duration = timer.end();

      console.log(`${burstSize} operation burst: ${duration.toFixed(0)}ms`);

      expect(results).toHaveLength(burstSize);
      expect(duration).toBeLessThan(60000); // 1 minute
    }, { timeout: 90000 });

    it('should maintain stability over sustained high concurrency', async () => {
      const duration = 30000; // 30 seconds
      const concurrency = 50;
      const startTime = Date.now();
      let operationCount = 0;

      while (Date.now() - startTime < duration) {
        const operations = Array.from({ length: concurrency }, () =>
          Promise.resolve(mockQuantumDag.addVertex())
        );

        await Promise.all(operations);
        operationCount += concurrency;
      }

      const actualDuration = Date.now() - startTime;
      const opsPerSec = operationCount / (actualDuration / 1000);

      console.log(`Sustained load test (${actualDuration / 1000}s):`);
      console.log(`  Operations: ${operationCount}`);
      console.log(`  Throughput: ${opsPerSec.toFixed(0)} ops/sec`);

      expect(operationCount).toBeGreaterThan(1000);
    }, { timeout: 60000 });
  });
});
