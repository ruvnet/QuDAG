# @qudag/napi-core

High-performance N-API bindings for QuDAG quantum-resistant cryptography and DAG consensus.

## Features

- **ML-DSA (CRYSTALS-Dilithium)**: Quantum-resistant digital signatures at security level 3
- **ML-KEM (CRYSTALS-Kyber)**: Quantum-resistant key encapsulation (ML-KEM-768)
- **HQC**: Hamming Quasi-Cyclic encryption at multiple security levels
- **Quantum Fingerprints**: Data integrity verification using quantum-resistant hashing
- **QuantumDAG**: Simplified DAG with vertex management

## Installation

```bash
npm install @qudag/napi-core
```

## Requirements

- Node.js >= 18.0.0
- Native bindings for your platform (automatically installed)

## Quick Start

### ML-DSA Digital Signatures

```javascript
const { MlDsaKeyPair } = require('@qudag/napi-core');

// Generate a key pair
const keypair = MlDsaKeyPair.generate();

// Sign a message
const message = Buffer.from('Hello, quantum world!');
const signature = keypair.sign(message);

// Verify the signature
const publicKey = keypair.toPublicKey();
const isValid = publicKey.verify(message, signature);
console.log('Signature valid:', isValid); // true
```

### ML-KEM Key Exchange

```javascript
const { MlKem } = require('@qudag/napi-core');

// Generate a key pair
const { publicKey, secretKey } = MlKem.keygen();

// Encapsulate a shared secret
const { ciphertext, sharedSecret: ss1 } = MlKem.encapsulate(publicKey);

// Decapsulate to recover the shared secret
const ss2 = MlKem.decapsulate(secretKey, ciphertext);

// Secrets match!
console.log('Match:', Buffer.compare(ss1, ss2) === 0); // true
```

### Quantum Fingerprints

```javascript
const { QuantumFingerprint } = require('@qudag/napi-core');

// Generate a fingerprint
const data = Buffer.from('Important data');
const fingerprint = QuantumFingerprint.generate(data);

// Verify data integrity
const isValid = fingerprint.verify(data);
console.log('Data valid:', isValid); // true
```

### QuantumDAG

```javascript
const { QuantumDAG } = require('@qudag/napi-core');

async function example() {
  const dag = new QuantumDAG();

  // Add messages to the DAG
  const id1 = await dag.addMessage(Buffer.from('First message'));
  const id2 = await dag.addMessage(Buffer.from('Second message'));

  // Get current tips
  const tips = await dag.getTips();
  console.log('DAG tips:', tips);

  // Check vertex count
  const count = await dag.vertexCount();
  console.log('Vertices:', count);
}

example();
```

## API Documentation

### ML-DSA Classes

#### `MlDsaKeyPair`

- `static generate()`: Generate a new key pair
- `publicKey()`: Get public key bytes (Uint8Array)
- `publicKeyHex()`: Get public key as hex string
- `sign(message: Buffer)`: Sign a message
- `signDeterministic(message: Buffer)`: Sign deterministically (testing only)
- `toPublicKey()`: Convert to MlDsaPublicKey

#### `MlDsaPublicKey`

- `static fromBytes(bytes: Buffer)`: Create from bytes
- `static fromHex(hex: string)`: Create from hex string
- `asBytes()`: Get public key bytes
- `asHex()`: Get public key as hex
- `verify(message: Buffer, signature: Buffer)`: Verify a signature
- `static batchVerify(messages, signatures, publicKeys)`: Batch verification

### ML-KEM Class

#### `MlKem`

- `static keygen()`: Generate a key pair
- `static encapsulate(publicKey)`: Encapsulate a shared secret
- `static decapsulate(secretKey, ciphertext)`: Decapsulate a shared secret
- `static getInfo()`: Get algorithm information

### Quantum Fingerprint

#### `QuantumFingerprint`

- `static generate(data: Buffer)`: Generate a fingerprint
- `static fromBytes(bytes: Buffer)`: Create from bytes
- `asBytes()`: Get fingerprint bytes
- `asHex()`: Get fingerprint as hex
- `verify(data: Buffer)`: Verify data

### QuantumDAG

#### `QuantumDAG`

- `constructor()`: Create a new DAG
- `addVertex(vertex)`: Add a vertex
- `addMessage(payload)`: Add a message (returns vertex ID)
- `getTips()`: Get current tips
- `containsVertex(id)`: Check if vertex exists
- `vertexCount()`: Get number of vertices
- `getVertex(id)`: Get vertex by ID

## Performance

N-API bindings provide near-native performance:

- ML-DSA signing: ~1.3ms (< 8% overhead vs native Rust)
- ML-DSA verification: ~0.85ms (< 6% overhead)
- ML-KEM encapsulation: ~0.19ms (< 6% overhead)
- ML-KEM decapsulation: ~0.23ms (< 5% overhead)

## Platform Support

Pre-built binaries are available for:

- Linux x64 (glibc, musl)
- Linux ARM64 (glibc, musl)
- macOS x64 (Intel)
- macOS ARM64 (Apple Silicon)
- Windows x64

## Building from Source

```bash
# Clone the repository
git clone https://github.com/ruvnet/QuDAG
cd QuDAG/packages/napi-core

# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test
```

## Security Considerations

- **Key Management**: Store secret keys securely and never expose them
- **Randomness**: Uses cryptographically secure random number generation
- **Side-Channel Resistance**: Constant-time operations for cryptographic primitives
- **Memory Safety**: Automatic zeroization of secret key material
- **Quantum Resistance**: All algorithms are NIST-standardized post-quantum cryptography

## License

MIT OR Apache-2.0

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) in the main repository.

## Links

- [QuDAG Repository](https://github.com/ruvnet/QuDAG)
- [Documentation](https://github.com/ruvnet/QuDAG/tree/main/docs)
- [Issues](https://github.com/ruvnet/QuDAG/issues)
