import { VaultQuantumRetrieveInput } from '../types/schemas.js';

/**
 * Vault retrieval is not implemented in this server; the tool returns an error.
 */
export async function vaultQuantumRetrieve(input: VaultQuantumRetrieveInput): Promise<never> {
  if (!input.entry.entry_id && !input.entry.label && !input.entry.retrieval_token) {
    throw new Error('Must provide entry_id, label, or retrieval_token');
  }
  throw new Error('vault_quantum_retrieve is not available in this release: no vault entries exist on this server');
}
