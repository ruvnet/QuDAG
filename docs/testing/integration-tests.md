# QuDAG Integration Testing Strategy

## Overview
This document details the integration testing strategy for N-API bindings, TypeScript/JavaScript layers, MCP server, and cross-component interactions.

## 1. N-API Integration Tests (Rust → JavaScript Boundary)

### 1.1 Binding Integration Test Suite

#### ML-DSA N-API Bindings
```rust
#[cfg(test)]
mod napi_ml_dsa_tests {
    use napi::{Env, JsObject, JsString, JsBuffer};

    #[test]
    fn test_napi_ml_dsa_keypair_generation() {
        // Test: Generate keypair via N-API and verify sizes
        // - Call napi_generate_ml_dsa_keypair()
        // - Verify JS object has public_key and secret_key properties
        // - Verify public_key is 2544 bytes
        // - Verify secret_key is 4880 bytes
    }

    #[test]
    fn test_napi_ml_dsa_sign_export_format() {
        // Test: Sign via N-API and verify export format
        // - Generate keypair
        // - Call napi_ml_dsa_sign(secret_key, message)
        // - Verify returned signature is 2372 bytes for ML-DSA-65
        // - Verify signature can be exported as Buffer
    }

    #[test]
    fn test_napi_ml_dsa_verify_interop() {
        // Test: Cross-platform signature verification
        // - Sign in Rust, verify in JS via N-API
        // - Verify using exported public key
        // - Sign in JS via N-API, verify in Rust
    }

    #[test]
    fn test_napi_ml_dsa_batch_operations() {
        // Test: Multiple concurrent operations
        // - Generate 10 keypairs
        // - Sign 100 messages concurrently
        // - Verify all signatures
    }

    #[test]
    fn test_napi_ml_dsa_error_propagation() {
        // Test: Error handling and propagation
        // - Invalid keypair should throw
        // - Invalid message should throw
        // - Invalid signature should throw with specific error code
    }
}
```

#### ML-KEM N-API Bindings
```rust
#[cfg(test)]
mod napi_ml_kem_tests {
    use napi::{Env, JsObject, JsBuffer};

    #[test]
    fn test_napi_ml_kem_encapsulate_decapsulate() {
        // Test: Round-trip encapsulation/decapsulation
        // - Generate keypair via N-API
        // - Call napi_ml_kem_encapsulate(public_key)
        // - Call napi_ml_kem_decapsulate(secret_key, ciphertext)
        // - Verify shared secrets match
    }

    #[test]
    fn test_napi_ml_kem_ciphertext_format() {
        // Test: Ciphertext format and sizes
        // - Encapsulate message
        // - Verify ciphertext is 768 bytes for ML-KEM-768
        // - Verify shared secret is 32 bytes
    }

    #[test]
    fn test_napi_ml_kem_with_corrupted_ciphertext() {
        // Test: Graceful handling of corrupted ciphertext
        // - Corrupt ciphertext at different positions
        // - Verify decapsulation fails predictably
        // - Verify error messages are informative
    }

    #[test]
    fn test_napi_ml_kem_concurrent_operations() {
        // Test: Thread-safe concurrent operations
        // - Spawn N threads
        // - Each thread generates keypair and encapsulates/decapsulates
        // - Verify no cross-contamination of shared secrets
    }
}
```

### 1.2 Type Conversion Testing

```rust
#[cfg(test)]
mod napi_type_conversion_tests {
    use napi::{Env, JsBuffer, JsString, JsArray, JsObject};

    #[test]
    fn test_buffer_conversion_roundtrip() {
        // Test: Buffer → Vec<u8> → Buffer conversion
        // - Create JS Buffer with random data
        // - Convert to Rust Vec<u8>
        // - Convert back to Buffer
        // - Verify byte-for-byte equality
    }

    #[test]
    fn test_buffer_zero_copy() {
        // Test: Ensure zero-copy for large buffers
        // - Create 100MB buffer
        // - Measure memory usage before/after
        // - Verify no additional allocation beyond buffer size
    }

    #[test]
    fn test_string_encoding_utf8() {
        // Test: UTF-8 string encoding/decoding
        // - Test ASCII strings
        // - Test Unicode strings (emoji, CJK)
        // - Test invalid UTF-8 rejection
    }

    #[test]
    fn test_array_conversion() {
        // Test: Array type conversions
        // - Convert JS Array to Vec
        // - Convert Vec back to JS Array
        // - Verify order and types preserved
    }

    #[test]
    fn test_object_field_access() {
        // Test: N-API object field access
        // - Create object with multiple fields
        // - Access fields from Rust
        // - Modify fields and verify from JS
    }
}
```

### 1.3 Memory and Lifetime Testing

```rust
#[cfg(test)]
mod napi_memory_tests {
    #[test]
    fn test_buffer_lifetime_management() {
        // Test: Buffer ownership and lifecycle
        // - Create buffer in JS
        // - Pass to Rust binding
        // - Verify buffer remains valid after function returns
        // - Verify no double-free or use-after-free
    }

    #[test]
    fn test_external_binding_cleanup() {
        // Test: External data binding cleanup
        // - Bind large data structure as external
        // - Delete binding from JS
        // - Verify finalizer called
        // - Verify memory released
    }

    #[test]
    fn test_gc_integration() {
        // Test: GC integration with N-API
        // - Allocate many buffers
        // - Trigger GC
        // - Verify buffers properly cleaned
        // - Verify no memory leaks
    }

    #[test]
    fn test_panic_cleanup() {
        // Test: Cleanup on panic in binding
        // - Trigger panic in N-API function
        // - Verify JS receives exception
        // - Verify memory cleanup occurs
    }
}
```

## 2. TypeScript/JavaScript Integration Tests (vitest)

### 2.1 Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { napi } from '@napi-rs/cli';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 85,
      functions: 85,
      branches: 80,
      statements: 85,
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@qudag/native': napi.import('./'),
    },
  },
});
```

### 2.2 Cryptography Tests

```typescript
// tests/integration/crypto.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateMlDsaKeypair,
  mlDsaSign,
  mlDsaVerify,
  generateMlKemKeypair,
  mlKemEncapsulate,
  mlKemDecapsulate,
  generateFingerprint,
  verifyFingerprint,
} from '@qudag/native';

describe('ML-DSA Integration Tests', () => {
  it('should generate valid keypair', () => {
    const keypair = generateMlDsaKeypair();
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
    expect(keypair.publicKey.length).toBe(2544);
    expect(keypair.secretKey.length).toBe(4880);
  });

  it('should sign and verify message', () => {
    const keypair = generateMlDsaKeypair();
    const message = new Uint8Array([1, 2, 3, 4, 5]);

    const signature = mlDsaSign(keypair.secretKey, message);
    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(2372);

    const isValid = mlDsaVerify(keypair.publicKey, message, signature);
    expect(isValid).toBe(true);
  });

  it('should reject invalid signature', () => {
    const keypair = generateMlDsaKeypair();
    const message = new Uint8Array([1, 2, 3, 4, 5]);
    const invalidSignature = new Uint8Array(2372).fill(0xFF);

    const isValid = mlDsaVerify(keypair.publicKey, message, invalidSignature);
    expect(isValid).toBe(false);
  });

  it('should reject tampered message', () => {
    const keypair = generateMlDsaKeypair();
    const message = new Uint8Array([1, 2, 3, 4, 5]);
    const signature = mlDsaSign(keypair.secretKey, message);

    message[0] = 0xFF; // Tamper with message
    const isValid = mlDsaVerify(keypair.publicKey, message, signature);
    expect(isValid).toBe(false);
  });

  it('should handle concurrent signing', async () => {
    const keypair = generateMlDsaKeypair();
    const message = new Uint8Array([1, 2, 3, 4, 5]);

    const promises = Array.from({ length: 100 }, () =>
      Promise.resolve(mlDsaSign(keypair.secretKey, message))
    );

    const signatures = await Promise.all(promises);
    expect(signatures.length).toBe(100);

    // Verify all signatures are unique
    const signatureSet = new Set(
      signatures.map(sig => Buffer.from(sig).toString('hex'))
    );
    expect(signatureSet.size).toBe(100);
  });

  it('should handle large messages', () => {
    const keypair = generateMlDsaKeypair();
    const largeMessage = new Uint8Array(1024 * 1024); // 1MB
    crypto.getRandomValues(largeMessage);

    const signature = mlDsaSign(keypair.secretKey, largeMessage);
    const isValid = mlDsaVerify(keypair.publicKey, largeMessage, signature);
    expect(isValid).toBe(true);
  });

  it('should handle empty message', () => {
    const keypair = generateMlDsaKeypair();
    const emptyMessage = new Uint8Array(0);

    const signature = mlDsaSign(keypair.secretKey, emptyMessage);
    const isValid = mlDsaVerify(keypair.publicKey, emptyMessage, signature);
    expect(isValid).toBe(true);
  });
});

describe('ML-KEM Integration Tests', () => {
  it('should perform encapsulation/decapsulation', () => {
    const keypair = generateMlKemKeypair();
    const { ciphertext, sharedSecret: encapSecret } =
      mlKemEncapsulate(keypair.publicKey);

    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(encapSecret).toBeInstanceOf(Uint8Array);
    expect(ciphertext.length).toBe(768);
    expect(encapSecret.length).toBe(32);

    const decapSecret = mlKemDecapsulate(keypair.secretKey, ciphertext);
    expect(decapSecret).toBeInstanceOf(Uint8Array);
    expect(decapSecret.length).toBe(32);

    expect(Buffer.from(encapSecret)).toEqual(Buffer.from(decapSecret));
  });

  it('should handle corrupted ciphertext', () => {
    const keypair = generateMlKemKeypair();
    const { ciphertext } = mlKemEncapsulate(keypair.publicKey);

    ciphertext[0] ^= 0xFF; // Flip bits

    expect(() => {
      mlKemDecapsulate(keypair.secretKey, ciphertext);
    }).not.toThrow(); // Decapsulation should not throw, just return garbage
  });

  it('should generate unique shared secrets', () => {
    const keypair = generateMlKemKeypair();
    const secrets = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const { sharedSecret } = mlKemEncapsulate(keypair.publicKey);
      secrets.add(Buffer.from(sharedSecret).toString('hex'));
    }

    expect(secrets.size).toBe(100); // All unique
  });
});

describe('Fingerprinting Integration Tests', () => {
  it('should generate consistent fingerprints', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const fp1 = generateFingerprint(data);
    const fp2 = generateFingerprint(data);

    expect(Buffer.from(fp1)).toEqual(Buffer.from(fp2));
  });

  it('should detect data tampering', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const fp = generateFingerprint(data);

    data[0] = 0xFF;
    const isValid = verifyFingerprint(fp, data);
    expect(isValid).toBe(false);
  });
});
```

### 2.3 Error Handling Tests

```typescript
// tests/integration/error-handling.test.ts
import { describe, it, expect } from 'vitest';
import {
  mlDsaSign,
  mlDsaVerify,
  QuDAGError,
} from '@qudag/native';

describe('Error Handling Integration Tests', () => {
  it('should throw on invalid input types', () => {
    expect(() => {
      mlDsaSign(null as any, new Uint8Array());
    }).toThrow(QuDAGError);
  });

  it('should provide meaningful error messages', () => {
    expect(() => {
      mlDsaSign(new Uint8Array(100), new Uint8Array()); // Invalid key size
    }).toThrow('Invalid secret key size');
  });

  it('should handle out-of-memory gracefully', () => {
    expect(() => {
      const hugeArray = new Uint8Array(Number.MAX_SAFE_INTEGER);
      // This should fail gracefully
    }).toThrow();
  });

  it('should maintain error state in concurrent operations', async () => {
    const invalidKey = new Uint8Array(100);
    const promises = Array.from({ length: 10 }, (_, i) =>
      Promise.resolve().then(() => {
        try {
          mlDsaSign(invalidKey, new Uint8Array());
          return 'success';
        } catch (e) {
          return 'error';
        }
      })
    );

    const results = await Promise.all(promises);
    expect(results.every(r => r === 'error')).toBe(true);
  });
});
```

## 3. MCP Server Integration Tests

### 3.1 MCP Server Test Setup

```rust
#[cfg(test)]
mod mcp_integration_tests {
    use qudag_mcp::server::McpServer;
    use qudag_mcp::protocol::{RequestMessage, ResponseMessage};
    use tokio::test;

    #[tokio::test]
    async fn test_mcp_server_initialization() {
        let server = McpServer::new(Default::default())
            .await
            .expect("Failed to initialize MCP server");

        assert!(server.is_running());
    }

    #[tokio::test]
    async fn test_mcp_tool_crypto_operations() {
        let server = McpServer::new(Default::default()).await.unwrap();

        // Test crypto tool execution
        let request = RequestMessage {
            id: 1,
            method: "tools/call".to_string(),
            params: serde_json::json!({
                "name": "quantum_sign",
                "arguments": {
                    "message": "test message",
                    "algorithm": "ml-dsa"
                }
            }),
        };

        let response = server.handle_request(request).await;
        assert!(response.is_ok());
    }

    #[tokio::test]
    async fn test_mcp_tool_dag_operations() {
        let server = McpServer::new(Default::default()).await.unwrap();

        let request = RequestMessage {
            id: 2,
            method: "tools/call".to_string(),
            params: serde_json::json!({
                "name": "dag_validate_block",
                "arguments": {
                    "block": "...",
                }
            }),
        };

        let response = server.handle_request(request).await;
        assert!(response.is_ok());
    }

    #[tokio::test]
    async fn test_mcp_concurrent_requests() {
        let server = std::sync::Arc::new(
            McpServer::new(Default::default()).await.unwrap()
        );

        let handles: Vec<_> = (0..100)
            .map(|i| {
                let server = server.clone();
                tokio::spawn(async move {
                    let request = RequestMessage {
                        id: i,
                        method: "tools/call".to_string(),
                        params: serde_json::json!({
                            "name": "fingerprint",
                            "arguments": {
                                "data": format!("data-{}", i)
                            }
                        }),
                    };

                    server.handle_request(request).await
                })
            })
            .collect();

        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }
    }

    #[tokio::test]
    async fn test_mcp_error_handling() {
        let server = McpServer::new(Default::default()).await.unwrap();

        let request = RequestMessage {
            id: 1,
            method: "tools/call".to_string(),
            params: serde_json::json!({
                "name": "nonexistent_tool",
                "arguments": {}
            }),
        };

        let response = server.handle_request(request).await;
        assert!(response.is_err());
    }
}
```

## 4. Cross-Component Integration Tests

### 4.1 Crypto → DAG Integration

```rust
#[cfg(test)]
mod crypto_dag_integration_tests {
    use qudag_crypto::*;
    use qudag_dag::*;

    #[test]
    fn test_dag_block_with_quantum_signatures() {
        // Generate quantum signature
        let mut rng = rand::thread_rng();
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let message = b"test block";
        let signature = keypair.sign(message, &mut rng).unwrap();

        // Create DAG block with signature
        let block = Block::new()
            .with_signature(signature)
            .with_message(message)
            .finalize();

        // Verify block signature using quantum crypto
        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();
        assert!(public_key.verify(message, block.signature()).is_ok());
    }

    #[test]
    fn test_dag_consensus_with_quantum_keys() {
        // Test QR-Avalanche consensus with quantum signatures
        let mut rng = rand::thread_rng();
        let validators = vec![
            MlDsaKeyPair::generate(&mut rng).unwrap(),
            MlDsaKeyPair::generate(&mut rng).unwrap(),
            MlDsaKeyPair::generate(&mut rng).unwrap(),
        ];

        let block = create_test_block();
        let signatures: Vec<_> = validators
            .iter()
            .map(|kp| kp.sign(block.hash().as_bytes(), &mut rng).unwrap())
            .collect();

        let consensus = Consensus::verify_signatures(
            block.hash().as_bytes(),
            signatures.iter().map(|s| s.as_bytes()),
            validators.iter().map(|kp| kp.public_key()),
        );

        assert!(consensus.is_valid());
    }
}
```

### 4.2 Crypto → Network Integration

```rust
#[cfg(test)]
mod crypto_network_integration_tests {
    use qudag_crypto::*;
    use qudag_network::*;

    #[tokio::test]
    async fn test_quantum_encrypted_messages() {
        let mut rng = rand::thread_rng();

        // Generate encryption keys
        let sender_kp = MlKemKeyPair::generate(&mut rng).unwrap();
        let receiver_kp = MlKemKeyPair::generate(&mut rng).unwrap();

        // Encrypt message using quantum KEM
        let message = b"secret message";
        let (ciphertext, shared_secret) =
            MlKem::encapsulate(receiver_kp.public_key(), &mut rng).unwrap();

        // Simulate sending encrypted message
        let encrypted_msg = encrypt_symmetric(message, &shared_secret).unwrap();

        // Receiver decapsulates and decrypts
        let decap_secret = MlKem::decapsulate(receiver_kp.secret_key(), &ciphertext).unwrap();
        let decrypted = decrypt_symmetric(&encrypted_msg, &decap_secret).unwrap();

        assert_eq!(message, decrypted.as_slice());
    }

    #[tokio::test]
    async fn test_dark_domain_with_quantum_fingerprint() {
        // Generate quantum fingerprint for domain
        let domain = "test.dark";
        let fingerprint = Fingerprint::generate(domain.as_bytes()).unwrap();

        // Register dark domain with quantum fingerprint
        let dark_domain = DarkDomain::register(
            domain,
            fingerprint.as_bytes(),
        ).await.unwrap();

        // Resolve domain back to fingerprint
        let resolved = DarkDomain::resolve(domain).await.unwrap();
        assert_eq!(fingerprint, resolved);
    }
}
```

## 5. End-to-End Integration Tests

### 5.1 E2E Test Scenarios

```typescript
// tests/e2e/crypto-workflow.test.ts
import { describe, it, expect } from 'vitest';
import {
  generateMlDsaKeypair,
  mlDsaSign,
  mlDsaVerify,
  generateMlKemKeypair,
  mlKemEncapsulate,
  mlKemDecapsulate,
} from '@qudag/native';

describe('E2E Workflow Tests', () => {
  it('should perform complete signing workflow', () => {
    // Generate keypair
    const signingKeypair = generateMlDsaKeypair();

    // Create message
    const message = new Uint8Array([
      0x48, 0x65, 0x6c, 0x6c, 0x6f, // "Hello"
    ]);

    // Sign message
    const signature = mlDsaSign(signingKeypair.secretKey, message);

    // Verify with public key
    const isValid = mlDsaVerify(signingKeypair.publicKey, message, signature);
    expect(isValid).toBe(true);

    // Simulate sending signed message over network
    const signedMessage = {
      message: Buffer.from(message).toString('hex'),
      signature: Buffer.from(signature).toString('hex'),
      publicKey: Buffer.from(signingKeypair.publicKey).toString('hex'),
    };

    // Simulate receiving and verifying
    const receivedMessage = new Uint8Array(
      Buffer.from(signedMessage.message, 'hex')
    );
    const receivedSignature = new Uint8Array(
      Buffer.from(signedMessage.signature, 'hex')
    );
    const receivedPublicKey = new Uint8Array(
      Buffer.from(signedMessage.publicKey, 'hex')
    );

    const finalVerification = mlDsaVerify(
      receivedPublicKey,
      receivedMessage,
      receivedSignature
    );
    expect(finalVerification).toBe(true);
  });

  it('should perform complete encapsulation workflow', () => {
    // Generate keypair for recipient
    const recipientKeypair = generateMlKemKeypair();

    // Sender encapsulates shared secret
    const { ciphertext, sharedSecret: senderSecret } =
      mlKemEncapsulate(recipientKeypair.publicKey);

    // Simulate sending ciphertext
    const networkMessage = {
      ciphertext: Buffer.from(ciphertext).toString('hex'),
    };

    // Recipient receives and decapsulates
    const receivedCiphertext = new Uint8Array(
      Buffer.from(networkMessage.ciphertext, 'hex')
    );
    const recipientSecret = mlKemDecapsulate(
      recipientKeypair.secretKey,
      receivedCiphertext
    );

    // Verify shared secrets match
    expect(Buffer.from(senderSecret)).toEqual(Buffer.from(recipientSecret));
  });
});
```

## 6. Platform-Specific Integration Tests

### 6.1 Node.js Integration

```typescript
// tests/platforms/nodejs.test.ts
import { describe, it, expect } from 'vitest';
import * as binding from '@qudag/native';

describe('Node.js Platform Integration', () => {
  it('should work with Node.js buffers', () => {
    const keypair = binding.generateMlDsaKeypair();
    const message = Buffer.from('test message');

    const signature = binding.mlDsaSign(keypair.secretKey, message);
    expect(Buffer.isBuffer(signature)).toBe(true);

    const isValid = binding.mlDsaVerify(keypair.publicKey, message, signature);
    expect(isValid).toBe(true);
  });

  it('should work with streams', async () => {
    const { Readable } = await import('stream');
    const keypair = binding.generateMlDsaKeypair();

    const stream = Readable.from([Buffer.from('test')]);
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const message = Buffer.concat(chunks);
    const signature = binding.mlDsaSign(keypair.secretKey, message);
    expect(binding.mlDsaVerify(keypair.publicKey, message, signature)).toBe(true);
  });

  it('should work with worker threads', async () => {
    const { Worker } = await import('worker_threads');
    const path = await import('path');

    const worker = new Worker(
      path.join(__dirname, 'worker.js')
    );

    const result = await new Promise((resolve) => {
      worker.on('message', resolve);
      worker.postMessage({ type: 'sign' });
    });

    expect(result.success).toBe(true);
  });
});
```

## 7. Integration Test Execution

### Test Configuration
```bash
# Run all integration tests
npm run test:integration

# Run specific component integration tests
npm run test:integration -- crypto
npm run test:integration -- napi
npm run test:integration -- mcp

# Run with coverage
npm run test:integration -- --coverage

# Run with specific timeout
npm run test:integration -- --testTimeout=60000
```

### CI Pipeline Integration
- Run on every commit
- Run against Node.js 18, 20, 22 LTS versions
- Run on Linux, macOS, and Windows
- Timeout: 10 minutes for integration tests
- Fail on test failure or coverage drop

## 8. Integration Test Monitoring

### Metrics to Track
- Average execution time
- Success/failure rate by component
- Cross-platform compatibility matrix
- Memory usage during tests
- CPU usage during tests

### Continuous Monitoring
- Alert on test failures
- Track performance trends
- Monitor platform-specific failures
- Generate weekly integration test reports
