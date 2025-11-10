import { quantumKeyExchange } from '../../src/tools/quantum-key-exchange';

describe('quantumKeyExchange', () => {
  it('should perform key exchange as initiator', async () => {
    const input = {
      algorithm: 'ml-kem-768' as const,
      role: 'initiator' as const,
    };

    const result = await quantumKeyExchange(input);

    expect(result).toHaveProperty('public_key');
    expect(result).toHaveProperty('encapsulated_key');
    expect(result).toHaveProperty('shared_secret');
    expect(result.metadata.algorithm).toBe('ml-kem-768');
    expect(result.metadata.security_level).toBe(3);
  });

  it('should perform key exchange as responder', async () => {
    const input = {
      algorithm: 'ml-kem-768' as const,
      role: 'responder' as const,
      encapsulated_key: 'mock_encapsulated_key',
    };

    const result = await quantumKeyExchange(input);

    expect(result).toHaveProperty('shared_secret');
    expect(result).not.toHaveProperty('public_key');
    expect(result).not.toHaveProperty('encapsulated_key');
    expect(result.metadata.algorithm).toBe('ml-kem-768');
  });

  it('should throw error for responder without encapsulated key', async () => {
    const input = {
      algorithm: 'ml-kem-768' as const,
      role: 'responder' as const,
    };

    await expect(quantumKeyExchange(input)).rejects.toThrow(
      'Encapsulated key required for responder role'
    );
  });

  it('should support different security levels', async () => {
    const algorithms: Array<'ml-kem-512' | 'ml-kem-768' | 'ml-kem-1024'> = [
      'ml-kem-512',
      'ml-kem-768',
      'ml-kem-1024',
    ];
    const securityLevels = [1, 3, 5];

    for (let i = 0; i < algorithms.length; i++) {
      const result = await quantumKeyExchange({
        algorithm: algorithms[i],
        role: 'initiator',
      });

      expect(result.metadata.security_level).toBe(securityLevels[i]);
    }
  });
});
