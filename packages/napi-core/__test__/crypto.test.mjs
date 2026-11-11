// Round-trip tests against the real native binding (no mocks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const q = createRequire(import.meta.url)('../index.js');
const b = (x) => Buffer.from(x);

test('ML-KEM-768: decapsulation recovers the encapsulated shared secret', () => {
  const kp = q.MlKem.keygen();
  assert.equal(kp.publicKey.length, 1184);
  assert.equal(kp.secretKey.length, 2400);
  const enc = q.MlKem.encapsulate(b(kp.publicKey));
  assert.equal(enc.ciphertext.length, 1088);
  assert.equal(enc.sharedSecret.length, 32);
  const ss = q.MlKem.decapsulate(b(kp.secretKey), b(enc.ciphertext));
  assert.deepEqual(b(ss), b(enc.sharedSecret));
});

test('ML-KEM-768: shared secret depends on the key pair and is not constant', () => {
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    const kp = q.MlKem.keygen();
    const enc = q.MlKem.encapsulate(b(kp.publicKey));
    seen.add(b(q.MlKem.decapsulate(b(kp.secretKey), b(enc.ciphertext))).toString('hex'));
  }
  assert.equal(seen.size, 4);
  const a = q.MlKem.keygen();
  const other = q.MlKem.keygen();
  const enc = q.MlKem.encapsulate(b(a.publicKey));
  const wrong = q.MlKem.decapsulate(b(other.secretKey), b(enc.ciphertext));
  assert.notDeepEqual(b(wrong), b(enc.sharedSecret));
});

test('ML-DSA: sign/verify, and reject a tampered message', () => {
  const kp = q.MlDsaKeyPair.generate();
  const msg = Buffer.from('QuDAG post-quantum test');
  const sig = b(kp.sign(msg));
  const pk = kp.toPublicKey();
  assert.equal(pk.verify(msg, sig), true);
  assert.equal(pk.verify(Buffer.from('QuDAG post-quantum tesT'), sig), false);
  const pk2 = q.MlDsaPublicKey.fromBytes(b(pk.asBytes()));
  assert.equal(pk2.verify(msg, sig), true);
});

test('HQC keygen returns distinct key material', () => {
  const a = q.Hqc128Wrapper.keygen();
  const c = q.Hqc128Wrapper.keygen();
  assert.ok(a.publicKey.length > 0 && a.secretKey.length > 0);
  assert.notDeepEqual(b(a.publicKey), b(c.publicKey));
});

test('QuantumDag stores messages', async () => {
  const dag = new q.QuantumDag();
  const id = await dag.addMessage(Buffer.from('hello'));
  assert.equal(await dag.containsVertex(id), true);
  assert.equal(await dag.vertexCount(), 1);
});

test('version matches package.json', () => {
  const pkg = createRequire(import.meta.url)('../package.json');
  assert.equal(q.getVersion(), pkg.version);
});
