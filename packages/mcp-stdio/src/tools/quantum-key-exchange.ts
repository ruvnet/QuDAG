import { QuantumKeyExchangeInput } from '../types/schemas.js';
import { generateId, getCurrentTimestamp, toBase64 } from '../utils/helpers.js';
import { dagManager } from '../utils/dag-manager.js';

export async function quantumKeyExchange(input: QuantumKeyExchangeInput) {
  const key_id = generateId('key');

  // Determine security level based on algorithm
  const security_level_map: Record<string, 1 | 3 | 5> = {
    'ml-kem-512': 1,
    'ml-kem-768': 3,
    'ml-kem-1024': 5,
  };
  const security_level = security_level_map[input.algorithm];

  // Mock key sizes (in bytes)
  const key_sizes = {
    'ml-kem-512': { public: 800, ciphertext: 768, shared: 32 },
    'ml-kem-768': { public: 1184, ciphertext: 1088, shared: 32 },
    'ml-kem-1024': { public: 1568, ciphertext: 1568, shared: 32 },
  };

  const sizes = key_sizes[input.algorithm];

  if (input.role === 'initiator') {
    // Generate public key and encapsulated shared secret
    const public_key = toBase64(`mock_public_key_${key_id}_${sizes.public}`);
    const encapsulated_key = toBase64(`mock_encapsulated_${key_id}_${sizes.ciphertext}`);
    const shared_secret = toBase64(`mock_shared_secret_${key_id}_${sizes.shared}`);

    const result: any = {
      public_key,
      encapsulated_key,
      shared_secret,
      metadata: {
        algorithm: input.algorithm,
        security_level,
        key_id,
        timestamp: getCurrentTimestamp(),
      },
    };

    // Store in DAG if requested
    if (input.dag_storage?.store_public_key) {
      const vertex_id = generateId('vtx');
      dagManager.registerVertex({
        vertex_id,
        created_at: getCurrentTimestamp(),
        timestamp: Date.now(),
        vertex_type: 'cryptographic',
        payload: {
          key_id,
          algorithm: input.algorithm,
          public_key: public_key.substring(0, 100) + '...', // Abbreviated
        },
        parents: [],
        consensus: {
          status: input.dag_storage.require_consensus ? 'accepted' : 'pending',
          confidence_score: 0.99,
          voting_rounds: 1,
        },
      });

      result.dag_info = {
        vertex_id,
        consensus_status: input.dag_storage.require_consensus ? 'accepted' : 'pending',
      };
    }

    // Store in vault if requested
    if (input.options?.store_in_vault) {
      result.vault_info = {
        vault_id: generateId('vault'),
        entry_label: input.options.vault_label || `ml-kem-key-${key_id}`,
      };
    }

    return result;
  } else {
    // Responder: decapsulate shared secret
    if (!input.encapsulated_key) {
      throw new Error('Encapsulated key required for responder role');
    }

    const shared_secret = toBase64(`mock_shared_secret_${key_id}_${sizes.shared}`);

    const result: any = {
      shared_secret,
      metadata: {
        algorithm: input.algorithm,
        security_level,
        key_id,
        timestamp: getCurrentTimestamp(),
      },
    };

    // Store in vault if requested
    if (input.options?.store_in_vault) {
      result.vault_info = {
        vault_id: generateId('vault'),
        entry_label: input.options.vault_label || `ml-kem-secret-${key_id}`,
      };
    }

    return result;
  }
}
