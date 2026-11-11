// End-to-end tests: start the built server over stdio and drive it with the MCP client.
// Run with `npm test` (builds first). Imports @qudag/napi-core to verify outputs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const napi = require('@qudag/napi-core');

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, '..', 'dist', 'index.js');
let client;

async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  return { isError: !!r.isError, body: JSON.parse(r.content[0].text) };
}

before(async () => {
  client = new Client({ name: 'e2e', version: '1' }, { capabilities: {} });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], stderr: 'ignore' }));
});
after(async () => client && client.close());

test('lists the ten tools and the resource templates', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    'analyze_complexity', 'benchmark_performance', 'dark_address_resolve', 'execute_quantum_dag',
    'optimize_circuit', 'quantum_key_exchange', 'quantum_sign', 'system_health_check',
    'vault_quantum_retrieve', 'vault_quantum_store',
  ]);
  const { resourceTemplates } = await client.listResourceTemplates();
  assert.ok(resourceTemplates.some((t) => t.uriTemplate === 'crypto://keys/{key_id}'));
  assert.deepEqual((await client.listResources()).resources, []);
});

test('ML-KEM-768 exchange: both parties derive the same 32-byte secret', async () => {
  const a = await call('quantum_key_exchange', { algorithm: 'ml-kem-768', role: 'initiator' });
  assert.equal(a.isError, false);
  assert.equal(Buffer.from(a.body.public_key, 'base64').length, 1184);
  assert.equal(a.body.shared_secret, undefined);

  const b = await call('quantum_key_exchange', { algorithm: 'ml-kem-768', role: 'initiator', peer_public_key: a.body.public_key });
  assert.equal(b.isError, false);
  assert.equal(Buffer.from(b.body.encapsulated_key, 'base64').length, 1088);
  const bSecret = Buffer.from(b.body.shared_secret, 'base64');
  assert.equal(bSecret.length, 32);

  const r = await call('quantum_key_exchange', {
    algorithm: 'ml-kem-768', role: 'responder', key_id: a.body.metadata.key_id, encapsulated_key: b.body.encapsulated_key,
  });
  assert.equal(r.isError, false);
  assert.deepEqual(Buffer.from(r.body.shared_secret, 'base64'), bSecret);

  // An independent encapsulation to the same key yields a different secret.
  const b2 = await call('quantum_key_exchange', { algorithm: 'ml-kem-768', role: 'initiator', peer_public_key: a.body.public_key });
  assert.notEqual(b2.body.shared_secret, b.body.shared_secret);

  // The public key is served as a resource.
  const res = await client.readResource({ uri: `crypto://keys/${a.body.metadata.key_id}` });
  assert.equal(JSON.parse(res.contents[0].text).public_key.data, a.body.public_key);
});

test('key exchange interoperates with @qudag/napi-core directly', async () => {
  const kp = napi.MlKem.keygen();
  const b = await call('quantum_key_exchange', {
    algorithm: 'ml-kem-768', role: 'initiator', peer_public_key: Buffer.from(kp.publicKey).toString('base64'),
  });
  const ss = napi.MlKem.decapsulate(Buffer.from(kp.secretKey), Buffer.from(b.body.encapsulated_key, 'base64'));
  assert.deepEqual(Buffer.from(ss), Buffer.from(b.body.shared_secret, 'base64'));
});

test('key exchange fails closed on unsupported or incomplete input', async () => {
  for (const args of [
    { algorithm: 'ml-kem-512', role: 'initiator' },
    { algorithm: 'ml-kem-1024', role: 'initiator' },
    { algorithm: 'ml-kem-768', role: 'responder', encapsulated_key: 'AAAA' },
    { algorithm: 'ml-kem-768', role: 'responder', key_id: 'key_unknown', encapsulated_key: 'AAAA' },
    { algorithm: 'ml-kem-768', role: 'initiator', peer_public_key: 'not base64!' },
    { algorithm: 'ml-kem-9', role: 'initiator' },
    { algorithm: 'ml-kem-768', role: 'initiator', peer_public_key: Buffer.alloc(1000, 7).toString('base64') },
  ]) {
    const r = await call('quantum_key_exchange', args);
    assert.equal(r.isError, true, JSON.stringify(args));
    assert.equal(r.body.shared_secret, undefined);
  }
  // Wrong-length ciphertext for a key that exists, then the server still answers.
  const a = await call('quantum_key_exchange', { algorithm: 'ml-kem-768', role: 'initiator' });
  const bad = await call('quantum_key_exchange', {
    algorithm: 'ml-kem-768', role: 'responder', key_id: a.body.metadata.key_id, encapsulated_key: Buffer.alloc(100, 1).toString('base64'),
  });
  assert.equal(bad.isError, true);
  assert.equal((await call('system_health_check', {})).isError, false);
});

test('ML-DSA-65 signatures verify with the returned public key', async () => {
  const s = await call('quantum_sign', { data: 'hello', algorithm: 'ml-dsa-65', private_key: 'generate' });
  assert.equal(s.isError, false);
  const pk = napi.MlDsaPublicKey.fromBytes(Buffer.from(s.body.verification.public_key, 'base64'));
  const sig = Buffer.from(s.body.signature, 'base64');
  assert.equal(pk.verify(Buffer.from('hello'), sig), true);
  assert.equal(pk.verify(Buffer.from('hellp'), sig), false);

  // Reusing the key handle signs with the same key.
  const s2 = await call('quantum_sign', {
    data: 'second', algorithm: 'ml-dsa-65', private_key: s.body.metadata.key_id,
    options: { include_context: true, context: 'ctx' },
  });
  assert.equal(s2.body.verification.public_key, s.body.verification.public_key);
  assert.equal(pk.verify(Buffer.from('second\ncontext:ctx'), Buffer.from(s2.body.signature, 'base64')), true);

  for (const args of [
    { data: 'x', algorithm: 'ml-dsa-44', private_key: 'generate' },
    { data: 'x', algorithm: 'ml-dsa-65', private_key: 'c2VjcmV0' },
    { data: 'x', algorithm: 'ml-dsa-65' },
  ]) {
    const r = await call('quantum_sign', args);
    assert.equal(r.isError, true, JSON.stringify(args));
  }
});

test('vault tools return errors', async () => {
  const st = await call('vault_quantum_store', { secret: { label: 'a', data: 'aGk=' }, encryption: { algorithm: 'ml-kem-768' } });
  assert.equal(st.isError, true);
  const rt = await call('vault_quantum_retrieve', { entry: { entry_id: 'e1' }, authentication: { access_token: 't' } });
  assert.equal(rt.isError, true);
});

test('schema validation rejects bad input and accepts numeric levels', async () => {
  const circuit = { qubits: 2, gates: [{ type: 'H', target: 0 }, { type: 'CNOT', target: 1, control: 0 }] };
  assert.equal((await call('execute_quantum_dag', { circuit: { qubits: 'x' } })).isError, true);
  assert.equal((await call('execute_quantum_dag', { circuit, execution: { optimization_level: 7 } })).isError, true);
  assert.equal((await call('execute_quantum_dag', { circuit, execution: { optimization_level: 2, shots: 10 } })).isError, false);
  assert.equal((await call('optimize_circuit', { circuit, optimization: { level: 2, preserve_semantics: true } })).isError, false);
  assert.equal((await call('system_health_check', { depth: 'extreme' })).isError, true);
});
