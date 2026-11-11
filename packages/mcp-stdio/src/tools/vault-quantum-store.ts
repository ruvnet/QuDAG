import { VaultQuantumStoreInput } from '../types/schemas.js';

/**
 * Vault storage is not implemented in this server; the tool returns an error.
 */
export async function vaultQuantumStore(_input: VaultQuantumStoreInput): Promise<never> {
  throw new Error(
    'vault_quantum_store is not available in this release: no encryption backend is wired, so nothing was stored'
  );
}
