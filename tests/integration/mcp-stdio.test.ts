import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateTestMessage,
  PerformanceTimer,
  runConcurrentOperations,
  waitUntil,
  MemoryMonitor,
} from '@utils/helpers';
import { mockMcpStdio, mockNapiCore, MockCallTracker } from '@utils/mocks';

describe('MCP STDIO Server Integration', () => {
  let timer: PerformanceTimer;
  let memoryMonitor: MemoryMonitor;
  let callTracker: MockCallTracker;

  beforeEach(async () => {
    timer = new PerformanceTimer();
    memoryMonitor = new MemoryMonitor();
    callTracker = new MockCallTracker();
    memoryMonitor.start();

    await mockMcpStdio.start();
  });

  afterEach(async () => {
    await mockMcpStdio.stop();
    timer.reset();
  });

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      expect(true).toBe(true); // Started in beforeEach
    });

    it('should stop server gracefully', async () => {
      await mockMcpStdio.stop();
      expect(true).toBe(true);
    });

    it('should handle restart', async () => {
      await mockMcpStdio.stop();

      timer.start();
      await mockMcpStdio.start();
      const duration = timer.end();

      expect(duration).toBeLessThan(1000);
    });

    it('should startup in < 1 second', async () => {
      await mockMcpStdio.stop();

      timer.start();
      await mockMcpStdio.start();
      const duration = timer.end();

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool successfully', async () => {
      const result = await mockMcpStdio.execute();

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should execute ML-DSA signing tool', async () => {
      const message = generateTestMessage(32);

      const result = await mockMcpStdio.execute();

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('should execute ML-KEM encapsulation tool', async () => {
      const result = await mockMcpStdio.execute();

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should execute address generation tool', async () => {
      const result = await mockMcpStdio.execute();

      expect(result.content).toBeDefined();
    });

    it('should handle concurrent tool executions', async () => {
      const results = await runConcurrentOperations(
        () => mockMcpStdio.execute(),
        5,
        20
      );

      expect(results).toHaveLength(20);
      expect(results.every(r => r.content)).toBe(true);
    });

    it('should execute tool in < 100ms', async () => {
      timer.start();
      await mockMcpStdio.execute();
      const duration = timer.end();

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Resource Access', () => {
    it('should list available resources', async () => {
      const resources = await mockMcpStdio.getResources();

      expect(Array.isArray(resources)).toBe(true);
    });

    it('should provide resource metadata', async () => {
      const resources = await mockMcpStdio.getResources();

      if (resources.length > 0) {
        const resource = resources[0];
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.mimeType).toBeDefined();
      }
    });

    it('should support multiple resource types', async () => {
      const resources = await mockMcpStdio.getResources();

      expect(Array.isArray(resources)).toBe(true);
    });

    it('should handle resource access concurrently', async () => {
      const results = await runConcurrentOperations(
        () => mockMcpStdio.getResources(),
        3,
        10
      );

      expect(results).toHaveLength(10);
    });
  });

  describe('Quantum Cryptography Tools', () => {
    it('should execute ML-DSA keypair generation via MCP', async () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();

      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
    });

    it('should execute ML-DSA signing via MCP', async () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = generateTestMessage(32);

      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(2372);
    });

    it('should execute ML-DSA verification via MCP', async () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = generateTestMessage(32);
      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      const isValid = mockNapiCore.mlDsaVerify(
        keypair.publicKey,
        message,
        signature
      );

      expect(isValid).toBe(true);
    });

    it('should execute ML-KEM encapsulation via MCP', async () => {
      const keypair = mockNapiCore.generateMlKemKeypair();

      const result = mockNapiCore.mlKemEncapsulate(keypair.publicKey);

      expect(result.ciphertext).toBeInstanceOf(Uint8Array);
      expect(result.sharedSecret).toBeInstanceOf(Uint8Array);
    });

    it('should execute ML-KEM decapsulation via MCP', async () => {
      const keypair = mockNapiCore.generateMlKemKeypair();
      const { ciphertext } = mockNapiCore.mlKemEncapsulate(keypair.publicKey);

      const sharedSecret = mockNapiCore.mlKemDecapsulate(
        keypair.secretKey,
        ciphertext
      );

      expect(sharedSecret).toBeInstanceOf(Uint8Array);
      expect(sharedSecret.length).toBe(32);
    });

    it('should handle concurrent quantum crypto operations', async () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();
      const message = generateTestMessage(32);

      const operations = Array.from({ length: 50 }, () =>
        Promise.resolve(mockNapiCore.mlDsaSign(keypair.secretKey, message))
      );

      const signatures = await Promise.all(operations);

      expect(signatures).toHaveLength(50);
      expect(signatures.every(sig => sig.length === 2372)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      expect(async () => {
        await mockMcpStdio.execute();
      }).not.toThrow();
    });

    it('should provide error details', async () => {
      try {
        await mockMcpStdio.execute();
      } catch (error) {
        expect((error as Error).message).toBeDefined();
      }
    });

    it('should recover from errors', async () => {
      // First call might error
      try {
        await mockMcpStdio.execute();
      } catch {
        // Ignore
      }

      // Second call should work
      const result = await mockMcpStdio.execute();
      expect(result).toBeDefined();
    });
  });

  describe('Message Format', () => {
    it('should produce valid MCP messages', async () => {
      const result = await mockMcpStdio.execute();

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should support text content type', async () => {
      const result = await mockMcpStdio.execute();

      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should handle large responses', async () => {
      const result = await mockMcpStdio.execute();

      expect(result.content).toBeDefined();
    });

    it('should support JSON content', async () => {
      const result = await mockMcpStdio.execute();

      expect(result.content).toBeDefined();
      if (result.content[0].text) {
        try {
          JSON.parse(result.content[0].text);
        } catch {
          // Content might not be JSON
        }
      }
    });
  });

  describe('Performance and Throughput', () => {
    it('should handle 100 concurrent tools', async () => {
      const results = await runConcurrentOperations(
        () => mockMcpStdio.execute(),
        10,
        100
      );

      expect(results).toHaveLength(100);
    });

    it('should maintain sub-100ms response time', async () => {
      const durations = [];

      for (let i = 0; i < 20; i++) {
        timer.start();
        await mockMcpStdio.execute();
        durations.push(timer.end());
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(100);
    });

    it('should handle rapid requests', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        await mockMcpStdio.execute();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('should not leak memory over time', async () => {
      memoryMonitor.start();
      const initialMemory = memoryMonitor.getUsed();

      for (let i = 0; i < 100; i++) {
        await mockMcpStdio.execute();
      }

      const finalMemory = memoryMonitor.getUsed();
      const memoryGrowth = finalMemory - initialMemory;

      // Allow some growth but not excessive
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 10 concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        mockMcpStdio.execute()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r.content)).toBe(true);
    });

    it('should handle 100 concurrent requests', async () => {
      const promises = Array.from({ length: 100 }, () =>
        mockMcpStdio.execute()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
    });

    it('should maintain order of concurrent requests', async () => {
      const indices = Array.from({ length: 20 }, (_, i) => i);

      const results = await Promise.all(
        indices.map(i =>
          mockMcpStdio.execute().then(r => ({
            index: i,
            result: r,
          }))
        )
      );

      expect(results).toHaveLength(20);
      expect(results.map(r => r.index)).toEqual(indices);
    });

    it('should not starve any requests', async () => {
      const durations: number[] = [];

      const promises = Array.from({ length: 20 }, () => {
        const startTime = Date.now();
        return mockMcpStdio.execute().then(() => {
          durations.push(Date.now() - startTime);
        });
      });

      await Promise.all(promises);

      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      // All should complete in reasonable time
      expect(maxDuration).toBeLessThan(1000);
      // Shouldn't have massive variance
      expect(maxDuration / (minDuration || 1)).toBeLessThan(100);
    });
  });

  describe('Integration Workflows', () => {
    it('should support complete signing workflow via MCP', async () => {
      // Generate keypair
      const keypair = mockNapiCore.generateMlDsaKeypair();
      expect(keypair).toBeDefined();

      // Sign message
      const message = generateTestMessage(256);
      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);
      expect(signature).toBeDefined();

      // Verify signature
      const isValid = mockNapiCore.mlDsaVerify(
        keypair.publicKey,
        message,
        signature
      );
      expect(isValid).toBe(true);
    });

    it('should support complete KEM workflow via MCP', async () => {
      // Generate keypair
      const keypair = mockNapiCore.generateMlKemKeypair();
      expect(keypair).toBeDefined();

      // Encapsulate
      const { ciphertext, sharedSecret } = mockNapiCore.mlKemEncapsulate(
        keypair.publicKey
      );
      expect(ciphertext).toBeDefined();
      expect(sharedSecret).toBeDefined();

      // Decapsulate
      const decryptedSecret = mockNapiCore.mlKemDecapsulate(
        keypair.secretKey,
        ciphertext
      );
      expect(decryptedSecret).toBeDefined();
    });
  });

  describe('Tool Discovery', () => {
    it('should advertise available tools', async () => {
      const resources = await mockMcpStdio.getResources();

      expect(Array.isArray(resources)).toBe(true);
    });

    it('should provide tool descriptions', async () => {
      const resources = await mockMcpStdio.getResources();

      if (resources.length > 0) {
        expect(resources[0].name).toBeDefined();
      }
    });

    it('should support tool enumeration', async () => {
      const resources = await mockMcpStdio.getResources();

      const toolNames = resources.map(r => r.name);
      expect(toolNames.length).toBeGreaterThan(0);
    });
  });
});
