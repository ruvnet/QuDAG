import { getCurrentTimestamp, toBase64 } from '../utils/helpers.js';

// Mock key storage
const mockKeys = new Map<string, any>();

export function getCryptoKeyResource(uri: string): any {
  // Parse URI: crypto://keys/{key_id}?format=pem
  const match = uri.match(/crypto:\/\/keys\/([^?]+)/);
  if (!match) {
    throw new Error(`Invalid crypto key URI: ${uri}`);
  }

  const key_id = match[1];
  const url = new URL(uri.replace('crypto://', 'http://'));
  const format = url.searchParams.get('format') || 'pem';

  // Check if key exists in storage, otherwise create mock
  let key = mockKeys.get(key_id);
  if (!key) {
    key = {
      key_id,
      algorithm: 'ml-dsa-65',
      key_type: 'public',
      created_at: getCurrentTimestamp(),
      status: 'active',
    };
    mockKeys.set(key_id, key);
  }

  const public_key_data = `-----BEGIN PUBLIC KEY-----\n${toBase64(`mock_public_key_${key_id}`)}\n-----END PUBLIC KEY-----`;

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify({
      key: {
        key_id: key.key_id,
        algorithm: key.algorithm,
        key_type: key.key_type,
        created_at: key.created_at,
        expires_at: undefined,
        status: key.status,
      },
      public_key: {
        format,
        data: format === 'pem' ? public_key_data : toBase64(`mock_key_${key_id}`),
        fingerprint: toBase64(`fp_${key_id}`).substring(0, 64),
        size_bits: 2048,
      },
      quantum_resistance: {
        algorithm_family: 'ml-dsa',
        security_level: 3,
        nist_approved: true,
        quantum_safe: true,
      },
      usage: {
        purpose: ['signing'],
        usage_count: Math.floor(Math.random() * 100),
        last_used: getCurrentTimestamp(),
        associated_vault_entries: Math.floor(Math.random() * 10),
      },
    }, null, 2),
  };
}

export function getCryptoAlgorithmsResource(uri: string): any {
  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify({
      signing: [
        {
          name: 'ml-dsa-44',
          family: 'ML-DSA',
          security_level: 2,
          signature_size_bytes: 2420,
          public_key_size_bytes: 1312,
          nist_approved: true,
          performance_tier: 'fast',
        },
        {
          name: 'ml-dsa-65',
          family: 'ML-DSA',
          security_level: 3,
          signature_size_bytes: 3309,
          public_key_size_bytes: 1952,
          nist_approved: true,
          performance_tier: 'medium',
        },
        {
          name: 'ml-dsa-87',
          family: 'ML-DSA',
          security_level: 5,
          signature_size_bytes: 4627,
          public_key_size_bytes: 2592,
          nist_approved: true,
          performance_tier: 'slow',
        },
      ],
      encryption: [
        {
          name: 'ml-kem-512',
          family: 'ML-KEM',
          security_level: 1,
          ciphertext_overhead_bytes: 768,
          public_key_size_bytes: 800,
          nist_approved: true,
          performance_tier: 'fast',
        },
        {
          name: 'ml-kem-768',
          family: 'ML-KEM',
          security_level: 3,
          ciphertext_overhead_bytes: 1088,
          public_key_size_bytes: 1184,
          nist_approved: true,
          performance_tier: 'medium',
        },
        {
          name: 'ml-kem-1024',
          family: 'ML-KEM',
          security_level: 5,
          ciphertext_overhead_bytes: 1568,
          public_key_size_bytes: 1568,
          nist_approved: true,
          performance_tier: 'slow',
        },
      ],
      hashing: [
        {
          name: 'sha3-256',
          output_size_bits: 256,
          collision_resistant: true,
          quantum_safe: true,
        },
        {
          name: 'sha3-512',
          output_size_bits: 512,
          collision_resistant: true,
          quantum_safe: true,
        },
      ],
      recommendations: {
        general_purpose_signing: 'ml-dsa-65',
        high_security_encryption: 'ml-kem-1024',
        fast_hashing: 'sha3-256',
      },
    }, null, 2),
  };
}
