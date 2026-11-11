import { QuantumKeyExchangeInput } from '../types/schemas.js';
import { generateId, getCurrentTimestamp } from '../utils/helpers.js';
import { dagManager } from '../utils/dag-manager.js';
import {
  SUPPORTED_KEM,
  decodeBase64Strict,
  kemDecapsulate,
  kemEncapsulate,
  kemKeygen,
  sha3_256Hex,
  newKeyId,
} from '../crypto/native.js';

/**
 * ML-KEM-768 key exchange (FIPS 203) via @qudag/napi-core.
 *
 * Flow between party A and party B:
 *   1. A: role "initiator", no peer_public_key   -> { public_key, key_id }   (secret key stays in A's server)
 *   2. B: role "initiator", peer_public_key=A.pk -> { encapsulated_key, shared_secret }
 *   3. A: role "responder", key_id, encapsulated_key -> { shared_secret }  (equal to B's)
 */
export async function quantumKeyExchange(input: QuantumKeyExchangeInput) {
  if (input.algorithm !== SUPPORTED_KEM) {
    throw new Error(`Unsupported algorithm ${input.algorithm}: this server implements ${SUPPORTED_KEM} only`);
  }
  const security_level = 3;

  if (input.role === 'initiator') {
    const result: any = {
      metadata: {
        algorithm: input.algorithm,
        security_level,
        timestamp: getCurrentTimestamp(),
      },
    };

    let publicKeyForDag: Buffer;
    if (input.peer_public_key) {
      const peer = decodeBase64Strict(input.peer_public_key, 'peer_public_key');
      const { ciphertext, sharedSecret } = kemEncapsulate(peer);
      result.encapsulated_key = ciphertext.toString('base64');
      result.shared_secret = sharedSecret.toString('base64');
      result.metadata.peer_public_key_sha3_256 = sha3_256Hex(peer);
      publicKeyForDag = peer;
    } else {
      const key_id = newKeyId();
      const publicKey = kemKeygen(key_id);
      result.public_key = publicKey.toString('base64');
      result.metadata.key_id = key_id;
      result.next_step =
        'Send public_key to the peer. The peer calls this tool with role "initiator" and peer_public_key; ' +
        'you then call it with role "responder", this key_id and the peer\'s encapsulated_key.';
      publicKeyForDag = publicKey;
    }

    if (input.dag_storage?.store_public_key) {
      const vertex_id = generateId('vtx');
      dagManager.registerVertex({
        vertex_id,
        created_at: getCurrentTimestamp(),
        timestamp: Date.now(),
        vertex_type: 'cryptographic',
        payload: {
          key_id: result.metadata.key_id,
          algorithm: input.algorithm,
          public_key_sha3_256: sha3_256Hex(publicKeyForDag),
        },
        parents: [],
        consensus: {
          status: 'pending',
          confidence_score: 0,
          voting_rounds: 0,
        },
      });
      result.dag_info = { vertex_id, consensus_status: 'pending' };
    }

    if (input.options?.store_in_vault) {
      result.vault_info = { stored: false, reason: 'vault storage is not available in this release' };
    }

    return result;
  }

  // Responder: decapsulate with a secret key held by this server.
  if (!input.encapsulated_key) {
    throw new Error('Encapsulated key required for responder role');
  }
  if (!input.key_id) {
    throw new Error('key_id required for responder role (returned by the initiator call that generated your key pair)');
  }
  const ciphertext = decodeBase64Strict(input.encapsulated_key, 'encapsulated_key');
  const shared = kemDecapsulate(input.key_id, ciphertext);

  const result: any = {
    shared_secret: shared.toString('base64'),
    metadata: {
      algorithm: input.algorithm,
      security_level,
      key_id: input.key_id,
      timestamp: getCurrentTimestamp(),
    },
  };
  if (input.options?.store_in_vault) {
    result.vault_info = { stored: false, reason: 'vault storage is not available in this release' };
  }
  return result;
}
