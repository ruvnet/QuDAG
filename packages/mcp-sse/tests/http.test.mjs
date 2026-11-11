// Starts the built HTTP server on an ephemeral port and drives the JSON-RPC endpoint.
// Run with `npm test` (builds first). Uses @qudag/napi-core to verify outputs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.QUDAG_PROTOCOL = 'http';
process.env.QUDAG_HOST = '127.0.0.1';
process.env.QUDAG_PORT = '0';
process.env.QUDAG_REQUIRE_AUTH = 'false';
process.env.QUDAG_LOG_LEVEL = 'error';

const require = createRequire(import.meta.url);
const napi = require('@qudag/napi-core');
const { QuDAGMcpServer } = require('../dist/server.js');

let server;
let base;
let nextId = 1;

async function rpc(method, params) {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  return res.json();
}
async function call(name, args) {
  const r = await rpc('tools/call', { name, arguments: args });
  return r.error ? { error: r.error } : { body: JSON.parse(r.result.content[0].text) };
}

before(async () => {
  server = new QuDAGMcpServer();
  await server.start();
  base = `http://127.0.0.1:${server.getPort()}`;
});
after(async () => server && server.stop());

test('health and tools/list', async () => {
  assert.equal((await fetch(`${base}/health`)).status, 200);
  const init = await rpc('initialize', {});
  assert.equal(init.result.serverInfo.version, '0.1.1');
  const names = (await rpc('tools/list', {})).result.tools.map((t) => t.name);
  for (const n of ['quantum_key_exchange', 'quantum_sign', 'execute_quantum_dag', 'system_health_check']) {
    assert.ok(names.includes(n), n);
  }
});

test('ML-KEM-768 exchange round-trips over HTTP', async () => {
  const a = await call('quantum_key_exchange', { algorithm: 'ml-kem-768', role: 'initiator' });
  assert.equal(Buffer.from(a.body.public_key, 'base64').length, 1184);
  const b = await call('quantum_key_exchange', { algorithm: 'ml-kem-768', role: 'initiator', peer_public_key: a.body.public_key });
  const r = await call('quantum_key_exchange', {
    algorithm: 'ml-kem-768', role: 'responder', key_id: a.body.metadata.key_id, encapsulated_key: b.body.encapsulated_key,
  });
  assert.equal(Buffer.from(b.body.shared_secret, 'base64').length, 32);
  assert.equal(r.body.shared_secret, b.body.shared_secret);

  const kp = napi.MlKem.keygen();
  const e = await call('quantum_key_exchange', { algorithm: 'ml-kem-768', role: 'initiator', peer_public_key: Buffer.from(kp.publicKey).toString('base64') });
  assert.deepEqual(
    Buffer.from(napi.MlKem.decapsulate(Buffer.from(kp.secretKey), Buffer.from(e.body.encapsulated_key, 'base64'))),
    Buffer.from(e.body.shared_secret, 'base64'),
  );

  for (const args of [
    { algorithm: 'ml-kem-1024', role: 'initiator' },
    { algorithm: 'ml-kem-768', role: 'responder', key_id: 'key_unknown', encapsulated_key: 'AAAA' },
    { algorithm: 'ml-kem-768', role: 'initiator', peer_public_key: Buffer.alloc(1000, 7).toString('base64') },
    { algorithm: 'ml-kem-768', role: 'responder', key_id: a.body.metadata.key_id, encapsulated_key: Buffer.alloc(100, 1).toString('base64') },
  ]) {
    const x = await call('quantum_key_exchange', args);
    assert.ok(x.error, JSON.stringify(args));
  }
  assert.equal((await fetch(`${base}/health`)).status, 200);
});

test('ML-DSA-65 signature verifies with the returned public key', async () => {
  const s = await call('quantum_sign', { data: 'hello', algorithm: 'ml-dsa-65', private_key: 'generate' });
  const pk = napi.MlDsaPublicKey.fromBytes(Buffer.from(s.body.verification.public_key, 'base64'));
  assert.equal(pk.verify(Buffer.from('hello'), Buffer.from(s.body.signature, 'base64')), true);
  assert.ok((await call('quantum_sign', { data: 'x', algorithm: 'ml-dsa-65', private_key: 'c2VjcmV0' })).error);
  assert.ok((await call('quantum_sign', { data: 'x', algorithm: 'ml-dsa-87', private_key: 'generate' })).error);
});

test('with auth required and no OAuth2 issuer, /mcp rejects requests', async () => {
  const s = new QuDAGMcpServer({ security: { ...server.config?.security, require_auth: true, rate_limit_requests_per_minute: 600, rate_limit_per_user: true, helmet_enabled: true, csp_enabled: false } });
  await s.start();
  try {
    const res = await fetch(`http://127.0.0.1:${s.getPort()}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(res.status, 401);
  } finally {
    await s.stop();
  }
});

test('OAuth2: JWTs are verified against the issuer JWKS', async () => {
  const http = require('node:http');
  const { generateKeyPairSync, createHmac } = require('node:crypto');
  const jwt = require('jsonwebtoken');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' };
  const jwks = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((r) => jwks.listen(0, '127.0.0.1', r));
  const issuer = `http://127.0.0.1:${jwks.address().port}`;
  const s = new QuDAGMcpServer({
    security: { require_auth: true, rate_limit_requests_per_minute: 600, rate_limit_per_user: true, helmet_enabled: true, csp_enabled: false },
    oauth2: { issuer_url: issuer, audience: 'qudag-mcp-api', jwks_url: `${issuer}/jwks.json`, verify_signature: true, verify_expiry: true },
  });
  await s.start();
  const url = `http://127.0.0.1:${s.getPort()}/mcp`;
  const post = (token, method, params) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
  const claims = { sub: 'u1', iss: issuer, aud: 'qudag-mcp-api' };
  const sign = (extra = {}, key = privateKey) =>
    jwt.sign({ exp: Math.floor(Date.now() / 1000) + 300, ...claims, ...extra }, key, { algorithm: 'RS256', keyid: 'k1' });
  try {
    assert.equal((await post(sign(), 'tools/list')).status, 200);
    const callArgs = { name: 'quantum_sign', arguments: { data: 'x', algorithm: 'ml-dsa-65', private_key: 'generate' } };
    // Default role ("user") may list tools but not call them; admin may call.
    assert.equal((await post(sign(), 'tools/call', callArgs)).status, 403);
    assert.equal((await post(sign({ roles: ['admin'] }), 'tools/call', callArgs)).status, 200);

    const rejected = {
      wrongKey: sign({}, other),
      expired: sign({ exp: Math.floor(Date.now() / 1000) - 60 }),
      wrongAudience: sign({ aud: 'other' }),
      wrongIssuer: sign({ iss: 'http://evil' }),
      algNone: jwt.sign(claims, null, { algorithm: 'none', keyid: 'k1' }),
      hs256WithPublicKey: (() => {
        const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
        const head = enc({ alg: 'HS256', typ: 'JWT', kid: 'k1' });
        const body = enc({ ...claims, exp: Math.floor(Date.now() / 1000) + 300 });
        const mac = createHmac('sha256', publicKey.export({ type: 'spki', format: 'pem' })).update(`${head}.${body}`).digest('base64url');
        return `${head}.${body}.${mac}`;
      })(),
    };
    for (const [name, token] of Object.entries(rejected)) {
      assert.equal((await post(token, 'tools/list')).status, 401, name);
    }
  } finally {
    await s.stop();
    jwks.close();
  }
});
