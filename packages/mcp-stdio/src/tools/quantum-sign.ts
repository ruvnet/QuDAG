import { QuantumSignInput } from '../types/schemas.js';
import { generateId, getCurrentTimestamp } from '../utils/helpers.js';
import { dagManager } from '../utils/dag-manager.js';
import { SUPPORTED_DSA, dsaGenerate, getKey, sha3_256Hex, newKeyId } from '../crypto/native.js';

/**
 * ML-DSA-65 signing (FIPS 204) via @qudag/napi-core.
 *
 * `private_key` is a handle, not key bytes: pass "generate" to create a new
 * signing key held by this server, or a key_id returned by an earlier call to
 * sign with that key again. Raw secret keys are never accepted or returned.
 */
export async function quantumSign(input: QuantumSignInput) {
  if (input.algorithm !== SUPPORTED_DSA) {
    throw new Error(`Unsupported algorithm ${input.algorithm}: this server implements ${SUPPORTED_DSA} only`);
  }

  let key_id: string;
  let entry = getKey(input.private_key);
  if (input.private_key === 'generate') {
    key_id = newKeyId();
    entry = dsaGenerate(key_id);
  } else if (entry && entry.kind === 'ml-dsa') {
    key_id = input.private_key;
  } else {
    throw new Error(
      'private_key must be "generate" or the key_id of an ML-DSA key held by this server; ' +
        'importing caller-supplied secret keys is not supported'
    );
  }
  if (entry.kind !== 'ml-dsa') throw new Error('internal: key kind mismatch');

  let context: string | undefined;
  if (input.options?.include_context && input.options.context) context = input.options.context;
  const signed_at = input.options?.include_timestamp ? getCurrentTimestamp() : undefined;

  // The signed message binds the optional context and timestamp, so a verifier
  // must rebuild it exactly as described in `verification.signed_message`.
  const parts = [input.data];
  if (context !== undefined) parts.push(`context:${context}`);
  if (signed_at !== undefined) parts.push(`timestamp:${signed_at}`);
  const message = Buffer.from(parts.join('\n'), 'utf8');
  const signature = Buffer.from(entry.keyPair.sign(message));

  const result: any = {
    signature: signature.toString('base64'),
    metadata: {
      algorithm: input.algorithm,
      key_id,
      timestamp: getCurrentTimestamp(),
      data_hash: sha3_256Hex(input.data),
      signature_size_bytes: signature.length,
    },
    verification: {
      public_key: entry.publicKey.toString('base64'),
      signed_message:
        'UTF-8 of [data, "context:<context>" if included, "timestamp:<signed_at>" if included] joined by "\\n"',
      signed_at,
      verification_instructions: `Verify with ${input.algorithm} (FIPS 204) using public_key over signed_message`,
    },
  };

  if (input.dag_storage?.store_signature) {
    const vertex_id = input.dag_storage.attach_to_vertex || generateId('vtx');
    dagManager.registerVertex({
      vertex_id,
      created_at: getCurrentTimestamp(),
      timestamp: Date.now(),
      vertex_type: 'cryptographic',
      payload: {
        key_id,
        algorithm: input.algorithm,
        data_hash: result.metadata.data_hash,
        signature_sha3_256: sha3_256Hex(signature),
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

  return result;
}
