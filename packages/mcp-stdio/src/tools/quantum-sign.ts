import { QuantumSignInput } from '../types/schemas.js';
import { generateId, getCurrentTimestamp, toBase64, sha3_256 } from '../utils/helpers.js';
import { dagManager } from '../utils/dag-manager.js';

export async function quantumSign(input: QuantumSignInput) {
  const signature_id = generateId('sig');
  const key_id = generateId('key');

  // Mock signature sizes (in bytes)
  const signature_sizes = {
    'ml-dsa-44': { signature: 2420, public_key: 1312 },
    'ml-dsa-65': { signature: 3309, public_key: 1952 },
    'ml-dsa-87': { signature: 4627, public_key: 2592 },
  };

  const sizes = signature_sizes[input.algorithm];

  // Calculate data hash
  const data_hash = sha3_256(input.data);

  // Generate mock signature
  let signature_data = `mock_signature_${signature_id}_${input.algorithm}`;
  if (input.options?.include_timestamp) {
    signature_data += `_${Date.now()}`;
  }
  if (input.options?.include_context && input.options.context) {
    signature_data += `_${input.options.context}`;
  }

  const signature = toBase64(signature_data + `_${sizes.signature}`);
  const public_key = toBase64(`mock_public_key_${key_id}_${sizes.public_key}`);

  const result: any = {
    signature,
    metadata: {
      algorithm: input.algorithm,
      key_id,
      timestamp: getCurrentTimestamp(),
      data_hash,
      signature_size_bytes: sizes.signature,
    },
    verification: {
      public_key,
      verification_instructions: `To verify: use ${input.algorithm} with public key and original data`,
    },
  };

  // Store in DAG if requested
  if (input.dag_storage?.store_signature) {
    const vertex_id = input.dag_storage.attach_to_vertex || generateId('vtx');

    dagManager.registerVertex({
      vertex_id,
      created_at: getCurrentTimestamp(),
      timestamp: Date.now(),
      vertex_type: 'cryptographic',
      payload: {
        signature_id,
        algorithm: input.algorithm,
        data_hash,
        signature: signature.substring(0, 100) + '...', // Abbreviated
      },
      parents: [],
      consensus: {
        status: 'accepted',
        confidence_score: 0.99,
        voting_rounds: 1,
      },
    });

    result.dag_info = {
      vertex_id,
      consensus_status: 'accepted',
    };
  }

  return result;
}
