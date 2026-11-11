/**
 * Post-quantum primitives backed by @qudag/napi-core (Rust, N-API).
 *
 * The native module is loaded lazily so that the non-cryptographic tools keep
 * working on platforms without a prebuilt binary; there the cryptographic
 * tools return an error.
 *
 * Secret keys never leave this process. Callers receive a key_id handle.
 */

import { createHash, randomUUID } from 'node:crypto';

export const SUPPORTED_KEM = 'ml-kem-768';
export const SUPPORTED_DSA = 'ml-dsa-65';
const KEM_PUBLIC_KEY_BYTES = 1184;
const KEM_CIPHERTEXT_BYTES = 1088;

interface NapiCore {
  MlKem: {
    keygen(): { publicKey: Uint8Array; secretKey: Uint8Array };
    encapsulate(publicKey: Buffer): { ciphertext: Uint8Array; sharedSecret: Uint8Array };
    decapsulate(secretKey: Buffer, ciphertext: Buffer): Uint8Array;
  };
  MlDsaKeyPair: {
    generate(): { publicKey(): Uint8Array; sign(message: Buffer): Uint8Array };
  };
  MlDsaPublicKey: {
    fromBytes(bytes: Buffer): { verify(message: Buffer, signature: Buffer): boolean };
  };
}

let cached: NapiCore | undefined;
let loadError: Error | undefined;

export function loadNative(): NapiCore {
  if (cached) return cached;
  if (!loadError) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cached = require('@qudag/napi-core') as NapiCore;
      return cached;
    } catch (e) {
      loadError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(
    `Post-quantum crypto is unavailable: @qudag/napi-core could not be loaded on ${process.platform}-${process.arch} ` +
      `(prebuilt binaries exist for linux-x64-gnu and linux-arm64-gnu). No key material was produced. Cause: ${loadError!.message}`
  );
}

export function nativeAvailable(): boolean {
  try {
    loadNative();
    return true;
  } catch {
    return false;
  }
}

type KemEntry = { kind: 'ml-kem'; algorithm: string; publicKey: Buffer; secretKey: Buffer; created_at: string };
type DsaEntry = {
  kind: 'ml-dsa';
  algorithm: string;
  publicKey: Buffer;
  keyPair: { sign(message: Buffer): Uint8Array };
  created_at: string;
};
export type KeyEntry = KemEntry | DsaEntry;

const MAX_KEYS = 1024;
const keystore = new Map<string, KeyEntry>();

function remember(key_id: string, entry: KeyEntry) {
  if (keystore.size >= MAX_KEYS) {
    const oldest = keystore.keys().next().value;
    if (oldest !== undefined) keystore.delete(oldest);
  }
  keystore.set(key_id, entry);
}

/** Unguessable handle for a server-held key (it acts as a capability). */
export function newKeyId(): string {
  return `key_${randomUUID()}`;
}

export function getKey(key_id: string): KeyEntry | undefined {
  return keystore.get(key_id);
}

export function kemKeygen(key_id: string) {
  const { MlKem } = loadNative();
  const kp = MlKem.keygen();
  const entry: KemEntry = {
    kind: 'ml-kem',
    algorithm: SUPPORTED_KEM,
    publicKey: Buffer.from(kp.publicKey),
    secretKey: Buffer.from(kp.secretKey),
    created_at: new Date().toISOString(),
  };
  remember(key_id, entry);
  return entry.publicKey;
}

export function kemEncapsulate(peerPublicKey: Buffer) {
  if (peerPublicKey.length !== KEM_PUBLIC_KEY_BYTES) {
    throw new Error(`peer_public_key must be ${KEM_PUBLIC_KEY_BYTES} bytes for ${SUPPORTED_KEM}, got ${peerPublicKey.length}`);
  }
  const { MlKem } = loadNative();
  const r = MlKem.encapsulate(peerPublicKey);
  return { ciphertext: Buffer.from(r.ciphertext), sharedSecret: Buffer.from(r.sharedSecret) };
}

export function kemDecapsulate(key_id: string, ciphertext: Buffer) {
  if (ciphertext.length !== KEM_CIPHERTEXT_BYTES) {
    throw new Error(`encapsulated_key must be ${KEM_CIPHERTEXT_BYTES} bytes for ${SUPPORTED_KEM}, got ${ciphertext.length}`);
  }
  const entry = keystore.get(key_id);
  if (!entry || entry.kind !== 'ml-kem') {
    throw new Error(`No ML-KEM secret key with key_id "${key_id}" is held by this server`);
  }
  const { MlKem } = loadNative();
  return Buffer.from(MlKem.decapsulate(entry.secretKey, ciphertext));
}

export function dsaGenerate(key_id: string) {
  const { MlDsaKeyPair } = loadNative();
  const kp = MlDsaKeyPair.generate();
  const entry: DsaEntry = {
    kind: 'ml-dsa',
    algorithm: SUPPORTED_DSA,
    publicKey: Buffer.from(kp.publicKey()),
    keyPair: kp,
    created_at: new Date().toISOString(),
  };
  remember(key_id, entry);
  return entry;
}

export function dsaVerify(publicKey: Buffer, message: Buffer, signature: Buffer): boolean {
  const { MlDsaPublicKey } = loadNative();
  return MlDsaPublicKey.fromBytes(publicKey).verify(message, signature);
}

export function sha3_256Hex(data: Buffer | string): string {
  return createHash('sha3-256').update(data).digest('hex');
}

export function decodeBase64Strict(value: string, field: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error(`${field} must be base64`);
  }
  return Buffer.from(value, 'base64');
}
