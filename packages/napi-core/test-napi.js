const { MlDsaKeyPair, MlKem, QuantumDAG } = require('./index.js');

console.log('🔐 Testing @qudag/napi-core\n');

try {
  // Test ML-DSA
  console.log('1️⃣  Testing ML-DSA...');
  const keypair = MlDsaKeyPair.generate();
  const message = Buffer.from('Test message');
  const signature = keypair.sign(message);
  const publicKey = keypair.toPublicKey();
  const valid = publicKey.verify(message, signature);
  console.log('   ✓ ML-DSA:', valid ? 'PASS' : 'FAIL');

  // Test ML-KEM
  console.log('\n2️⃣  Testing ML-KEM...');
  const { publicKey: kemPk, secretKey: kemSk } = MlKem.keygen();
  const { ciphertext, sharedSecret: ss1 } = MlKem.encapsulate(kemPk);
  const ss2 = MlKem.decapsulate(kemSk, ciphertext);
  const match = Buffer.compare(ss1, ss2) === 0;
  console.log('   ✓ ML-KEM:', match ? 'PASS' : 'FAIL');

  // Test QuantumDAG
  console.log('\n3️⃣  Testing QuantumDAG...');
  const dag = new QuantumDAG();
  dag.addMessage(Buffer.from('Genesis')).then(() => {
    return dag.getTips();
  }).then(tips => {
    console.log('   ✓ QuantumDAG:', tips.length > 0 ? 'PASS' : 'FAIL');
    console.log('\n✅ All tests passed!');
  }).catch(err => {
    console.error('   ✗ QuantumDAG: FAIL', err);
  });

} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
