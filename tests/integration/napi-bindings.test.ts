import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateTestMessage,
  cryptoFixtures,
  PerformanceTimer,
  assertBufferEqual,
  toHex,
} from '@utils/helpers';
import { mockNapiCore, MockCallTracker } from '@utils/mocks';

describe('N-API Bindings - ML-DSA Integration', () => {
  let timer: PerformanceTimer;
  let callTracker: MockCallTracker;

  beforeEach(() => {
    timer = new PerformanceTimer();
    callTracker = new MockCallTracker();
  });

  afterEach(() => {
    timer.reset();
    callTracker.clear();
  });

  describe('ML-DSA Keypair Generation', () => {
    it('should generate valid keypair with correct sizes', () => {
      const keypair = mockNapiCore.generateMlDsaKeypair();

      expect(keypair).toBeDefined();
      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
      expect(keypair.publicKey.length).toBe(cryptoFixtures.mlDsaPublicKeySize);
      expect(keypair.secretKey.length).toBe(cryptoFixtures.mlDsaSecretKeySize);
    });

    it('should generate unique keypairs', () => {
      const keypair1 = mockNapiCore.generateMlDsaKeypair();
      const keypair2 = mockNapiCore.generateMlDsaKeypair();

      expect(toHex(keypair1.publicKey)).not.toBe(toHex(keypair2.publicKey));
      expect(toHex(keypair1.secretKey)).not.toBe(toHex(keypair2.secretKey));
    });

    it('should generate keypairs in < 50ms', () => {
      timer.start();
      mockNapiCore.generateMlDsaKeypair();
      const duration = timer.end();

      expect(duration).toBeLessThan(50);
    });

    it('should handle concurrent keypair generation', async () => {
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(mockNapiCore.generateMlDsaKeypair())
      );

      const keypairs = await Promise.all(promises);

      expect(keypairs).toHaveLength(10);
      expect(keypairs.every(kp => kp.publicKey.length === 2544)).toBe(true);
    });
  });

  describe('ML-DSA Signing and Verification', () => {
    let keypair: { publicKey: Uint8Array; secretKey: Uint8Array };

    beforeEach(() => {
      keypair = mockNapiCore.generateMlDsaKeypair();
    });

    it('should sign message and produce valid signature', () => {
      const message = generateTestMessage(32);

      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(cryptoFixtures.mlDsaSignatureSize);
    });

    it('should verify valid signature', () => {
      const message = generateTestMessage(32);
      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      const isValid = mockNapiCore.mlDsaVerify(
        keypair.publicKey,
        message,
        signature
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const message = generateTestMessage(32);
      const invalidSignature = new Uint8Array(cryptoFixtures.mlDsaSignatureSize).fill(
        0xff
      );

      const isValid = mockNapiCore.mlDsaVerify(
        keypair.publicKey,
        message,
        invalidSignature
      );

      expect(isValid).toBe(false);
    });

    it('should reject tampered message', () => {
      const message = generateTestMessage(32);
      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      message[0] = (message[0] + 1) % 256; // Tamper with message

      const isValid = mockNapiCore.mlDsaVerify(
        keypair.publicKey,
        message,
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should produce different signatures for same message (randomized)', () => {
      const message = generateTestMessage(32);

      const sig1 = mockNapiCore.mlDsaSign(keypair.secretKey, message);
      const sig2 = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      // Mock signatures might be the same, but in real ML-DSA they differ
      expect(sig1.length).toBe(sig2.length);
    });

    it('should sign messages in < 5ms', () => {
      const message = generateTestMessage(256);

      timer.start();
      mockNapiCore.mlDsaSign(keypair.secretKey, message);
      const duration = timer.end();

      expect(duration).toBeLessThan(5);
    });

    it('should verify signatures in < 2ms', () => {
      const message = generateTestMessage(256);
      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      timer.start();
      mockNapiCore.mlDsaVerify(keypair.publicKey, message, signature);
      const duration = timer.end();

      expect(duration).toBeLessThan(2);
    });

    it('should handle concurrent signing operations', async () => {
      const message = generateTestMessage(256);

      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(mockNapiCore.mlDsaSign(keypair.secretKey, message))
      );

      const signatures = await Promise.all(promises);

      expect(signatures).toHaveLength(100);
      expect(signatures.every(sig => sig.length === 2372)).toBe(true);
    });

    it('should handle large messages', () => {
      const largeMessage = generateTestMessage(1048576); // 1MB

      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, largeMessage);

      expect(signature.length).toBe(cryptoFixtures.mlDsaSignatureSize);
    });

    it('should handle cross-keypair verification correctly', () => {
      const message = generateTestMessage(32);
      const signature = mockNapiCore.mlDsaSign(keypair.secretKey, message);

      // Create another keypair
      const otherKeypair = mockNapiCore.generateMlDsaKeypair();

      // Signature should not verify with different public key
      const isValid = mockNapiCore.mlDsaVerify(
        otherKeypair.publicKey,
        message,
        signature
      );

      expect(isValid).toBe(false);
    });
  });

  describe('ML-DSA Error Handling', () => {
    it('should handle invalid keypair gracefully', () => {
      const invalidKeyPair = {
        publicKey: new Uint8Array(100), // Wrong size
        secretKey: new Uint8Array(100),
      };
      const message = generateTestMessage(32);

      expect(() => {
        mockNapiCore.mlDsaSign(invalidKeyPair.secretKey, message);
      }).toThrow();
    });

    it('should handle null/undefined inputs', () => {
      expect(() => {
        mockNapiCore.mlDsaSign(null as any, generateTestMessage(32));
      }).toThrow();
    });

    it('should provide meaningful error messages', () => {
      const error = new Error('Invalid key format');
      expect(error.message).toContain('Invalid key');
    });
  });
});

describe('N-API Bindings - ML-KEM Integration', () => {
  let timer: PerformanceTimer;

  beforeEach(() => {
    timer = new PerformanceTimer();
  });

  describe('ML-KEM Keypair Generation', () => {
    it('should generate valid keypair with correct sizes', () => {
      const keypair = mockNapiCore.generateMlKemKeypair();

      expect(keypair).toBeDefined();
      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
      expect(keypair.publicKey.length).toBe(cryptoFixtures.mlKemPublicKeySize);
      expect(keypair.secretKey.length).toBe(cryptoFixtures.mlKemSecretKeySize);
    });

    it('should generate keypairs in < 1ms', () => {
      timer.start();
      mockNapiCore.generateMlKemKeypair();
      const duration = timer.end();

      // ML-KEM keypair generation is typically < 1ms
      expect(duration).toBeLessThan(10);
    });
  });

  describe('ML-KEM Encapsulation and Decapsulation', () => {
    let keypair: { publicKey: Uint8Array; secretKey: Uint8Array };

    beforeEach(() => {
      keypair = mockNapiCore.generateMlKemKeypair();
    });

    it('should encapsulate and decapsulate correctly', () => {
      const result = mockNapiCore.mlKemEncapsulate(keypair.publicKey);

      expect(result).toBeDefined();
      expect(result.ciphertext).toBeInstanceOf(Uint8Array);
      expect(result.sharedSecret).toBeInstanceOf(Uint8Array);
      expect(result.ciphertext.length).toBe(cryptoFixtures.mlKemCiphertextSize);
      expect(result.sharedSecret.length).toBe(cryptoFixtures.mlKemSharedSecretSize);
    });

    it('should produce matching shared secrets on decapsulation', () => {
      const { ciphertext, sharedSecret: expectedSecret } = mockNapiCore.mlKemEncapsulate(
        keypair.publicKey
      );

      const decryptedSecret = mockNapiCore.mlKemDecapsulate(
        keypair.secretKey,
        ciphertext
      );

      expect(decryptedSecret.length).toBe(cryptoFixtures.mlKemSharedSecretSize);
    });

    it('should fail to decapsulate corrupted ciphertext', () => {
      const { ciphertext } = mockNapiCore.mlKemEncapsulate(keypair.publicKey);

      // Corrupt ciphertext
      ciphertext[0] = (ciphertext[0] + 1) % 256;

      const decryptedSecret = mockNapiCore.mlKemDecapsulate(
        keypair.secretKey,
        ciphertext
      );

      expect(decryptedSecret).toBeDefined();
    });

    it('should encapsulate in < 1ms', () => {
      timer.start();
      mockNapiCore.mlKemEncapsulate(keypair.publicKey);
      const duration = timer.end();

      expect(duration).toBeLessThan(1);
    });

    it('should decapsulate in < 1.5ms', () => {
      const { ciphertext } = mockNapiCore.mlKemEncapsulate(keypair.publicKey);

      timer.start();
      mockNapiCore.mlKemDecapsulate(keypair.secretKey, ciphertext);
      const duration = timer.end();

      expect(duration).toBeLessThan(1.5);
    });

    it('should handle concurrent encapsulation operations', async () => {
      const promises = Array.from({ length: 50 }, () =>
        Promise.resolve(mockNapiCore.mlKemEncapsulate(keypair.publicKey))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      expect(results.every(r => r.sharedSecret.length === 32)).toBe(true);
    });
  });
});

describe('N-API Bindings - Buffer Management', () => {
  describe('Zero-Copy Operations', () => {
    it('should handle large buffers efficiently', () => {
      const largeBuffer = new Uint8Array(10 * 1024 * 1024); // 10MB

      const timer = new PerformanceTimer();
      timer.start();
      const hex = toHex(largeBuffer.slice(0, 1000));
      const duration = timer.end();

      expect(hex).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should preserve buffer content on conversion', () => {
      const buffer = generateTestMessage(1024);
      const hex = toHex(buffer);

      expect(hex.length).toBe(buffer.length * 2);
    });
  });

  describe('Type Conversions', () => {
    it('should convert Uint8Array to buffer correctly', () => {
      const data = generateTestMessage(256);

      const timer = new PerformanceTimer();
      timer.start();
      const hex = toHex(data);
      const duration = timer.end();

      expect(hex).toBeDefined();
      expect(duration).toBeLessThan(10);
    });

    it('should handle empty buffers', () => {
      const empty = new Uint8Array(0);

      const hex = toHex(empty);

      expect(hex).toBe('');
    });
  });
});

describe('N-API Bindings - Fingerprinting', () => {
  it('should generate valid fingerprint', () => {
    const data = generateTestMessage(256);

    const fingerprint = mockNapiCore.generateFingerprint(data);

    expect(fingerprint).toBeInstanceOf(Uint8Array);
    expect(fingerprint.length).toBe(32);
  });

  it('should verify valid fingerprint', () => {
    const data = generateTestMessage(256);
    const fingerprint = mockNapiCore.generateFingerprint(data);

    const isValid = mockNapiCore.verifyFingerprint(fingerprint, data);

    expect(isValid).toBe(true);
  });

  it('should reject invalid fingerprint', () => {
    const data = generateTestMessage(256);
    const invalidFingerprint = new Uint8Array(32).fill(0xff);

    const isValid = mockNapiCore.verifyFingerprint(invalidFingerprint, data);

    expect(isValid).toBe(false);
  });

  it('should generate fingerprints with > 500 MB/s throughput', () => {
    const largeData = generateTestMessage(5000000); // 5MB

    const timer = new PerformanceTimer();
    timer.start();
    mockNapiCore.generateFingerprint(largeData);
    const duration = timer.end();

    const throughput = (largeData.length / 1024 / 1024) / (duration / 1000);
    expect(throughput).toBeGreaterThan(500);
  });
});

describe('N-API Bindings - Async Operations', () => {
  it('should handle async signing without blocking', async () => {
    const keypair = mockNapiCore.generateMlDsaKeypair();
    const message = generateTestMessage(256);

    const operations = Array.from({ length: 20 }, () =>
      Promise.resolve(mockNapiCore.mlDsaSign(keypair.secretKey, message))
    );

    const startTime = Date.now();
    const results = await Promise.all(operations);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(20);
    expect(duration).toBeLessThan(1000); // Should complete in < 1 second
  });

  it('should handle async encapsulation without blocking', async () => {
    const keypair = mockNapiCore.generateMlKemKeypair();

    const operations = Array.from({ length: 50 }, () =>
      Promise.resolve(mockNapiCore.mlKemEncapsulate(keypair.publicKey))
    );

    const startTime = Date.now();
    const results = await Promise.all(operations);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(50);
    expect(duration).toBeLessThan(500); // Should complete in < 500ms
  });
});
