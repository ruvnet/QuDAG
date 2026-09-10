import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, chmod, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { generateSecretKey, getPublicKey, verifyEvent, finalizeEvent } from 'nostr-tools/pure';
import { relayFixture } from './fixture.mjs';
import { keygen, loadKey, claimInvite, httpAuth, relayAuth, coordinationEvent, EventBoundary, MemberConnection, CLAIM_URL, CANONICAL_RELAY } from './client.mjs';
const key = generateSecretKey(); const pubkey = getPublicKey(key); const timestamp = 1000;
test('NIP98 binds exact URL, POST and serialized payload', async () => {
  const body = '{"code":"test-invite"}'; const event = httpAuth(key, body, timestamp);
  assert.ok(verifyEvent(event)); assert.equal(event.kind, 27235); assert.equal(event.content, '');
  assert.deepEqual(event.tags, [['u', CLAIM_URL], ['method', 'POST'], ['payload', createHash('sha256').update(body).digest('hex')]]);
  for (const [index, value] of [[0, 'https://evil.example/'], [1, 'GET'], [2, '0'.repeat(64)]]) {
    const changed = JSON.parse(JSON.stringify(event)); changed.tags[index][1] = value; assert.equal(verifyEvent(changed), false);
  }
  await claimInvite(key, 'test-invite', { fetchImpl: async (url, init) => {
    assert.equal(url, CLAIM_URL); assert.equal(init.redirect, 'error'); assert.equal(init.body, body);
    const auth = JSON.parse(Buffer.from(init.headers.authorization.slice(6), 'base64'));
    assert.ok(verifyEvent(auth)); assert.equal(auth.tags[2][1], createHash('sha256').update(init.body).digest('hex'));
    return new Response('{}');
  } });
});
test('NIP42 signs canonical relay instead of public alias', () => {
  const event = relayAuth(key, 'challenge', timestamp); assert.ok(verifyEvent(event)); assert.equal(event.kind, 22242);
  assert.deepEqual(event.tags, [['relay', CANONICAL_RELAY], ['challenge', 'challenge']]);
  assert.throws(() => relayAuth(key, ''));
});
test('key creation exclusive, private, owned and symlink refusing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qudag-key-test-')); const path = join(dir, 'identity.key');
  try {
    const publicKey = await keygen(path); const loaded = await loadKey(path); assert.equal(getPublicKey(loaded), publicKey); loaded.fill(0);
    assert.equal((await stat(path)).mode & 0o777, 0o600); await assert.rejects(keygen(path));
    await symlink(path, join(dir, 'link')); await assert.rejects(loadKey(join(dir, 'link')));
    await chmod(path, 0o644); await assert.rejects(loadKey(path), /Unsafe/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('event boundary verifies signatures, membership, domain, time, and replay', () => {
  const boundary = () => new EventBoundary({ allowedPubkeys: [pubkey], clock: () => timestamp });
  const event = coordinationEvent(key, 'Task', { command: 'never execute this' }, timestamp);
  const b = boundary(); assert.equal(b.accept(event).trustedForExecution, false); assert.throws(() => b.accept(event), /Replay/);
  const tampered = JSON.parse(JSON.stringify(event)); tampered.content += ' '; assert.throws(() => boundary().accept(tampered));
  assert.throws(() => new EventBoundary({ clock: () => timestamp }).accept(event), /authorized/);
  for (const changed of [{ created_at: 699 }, { created_at: 1031 }, { tags: [['t', 'wrong'], ['relay', CANONICAL_RELAY]] }, { tags: [['t', 'ruflo-swarm'], ['relay', 'wss://x.ruv.io']] }, { content: 'invalid-json' }]) {
    const candidate = finalizeEvent({ kind: 1, created_at: timestamp, tags: event.tags, content: event.content, ...changed }, key);
    assert.throws(() => boundary().accept(candidate));
  }
  let time = timestamp; const bounded = new EventBoundary({ allowedPubkeys: [pubkey], maxEntries: 1, clock: () => time });
  bounded.accept(event); assert.throws(() => bounded.accept(coordinationEvent(key, 'Status', {}, timestamp)), /capacity/);
  time += 301; assert.doesNotThrow(() => bounded.accept(coordinationEvent(key, 'Status', {}, time)));
});
test('offline websocket E2E auth, signed publish ack, verified read', async () => {
  const fixture = await relayFixture(key); const client = new MemberConnection(key, { socketFactory: fixture.socketFactory, timeoutMs: 1000 });
  try {
    await assert.rejects(client.publish('Status', {}), /authenticated/); await client.connect();
    assert.match(await client.publish('PeerHello', { name: 'offline-fixture' }), /^[0-9a-f]{64}$/);
    const results = await client.readRecent(new EventBoundary({ allowedPubkeys: [pubkey] })); assert.equal(results.length, 1); assert.equal(results[0].trustedForExecution, false);
  } finally { client.close(); await fixture.close(); }
});
test('relay authorization denial and tampered incoming events fail closed', async () => {
  for (const options of [{ deny: true }, { badEvent: true }]) {
    const fixture = await relayFixture(key, options); const client = new MemberConnection(key, { socketFactory: fixture.socketFactory, timeoutMs: 1000 });
    try { if (options.deny) await assert.rejects(client.connect()); else { await client.connect(); await assert.rejects(client.readRecent(new EventBoundary({ allowedPubkeys: [pubkey] }))); } }
    finally { client.close(); await fixture.close(); }
  }
});

test('user recipe 64 byte hex key and legacy group-only events interoperate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qudag-key-recipe-')); const path = join(dir, 'identity.key');
  try { await writeFile(path, Buffer.from(key).toString('hex'), { mode: 0o600 }); const loaded = await loadKey(path); assert.equal(getPublicKey(loaded), pubkey); loaded.fill(0); }
  finally { await rm(dir, { recursive: true, force: true }); }
  const event = finalizeEvent({ kind: 1, created_at: timestamp, content: JSON.stringify({ type: 'Status', payload: {} }), tags: [['t', 'ruflo-swarm']] }, key);
  const boundary = new EventBoundary({ allowedPubkeys: [pubkey], clock: () => timestamp });
  assert.throws(() => boundary.accept(event, 'wss://evil.example'), /transport/);
  assert.equal(boundary.accept(event, CANONICAL_RELAY).trustedForExecution, false);
});

test('current canonical endpoints and explicitly selected legacy profile', async () => {
  const { RELAY_PROFILES } = await import('./client.mjs');
  assert.equal(CLAIM_URL, 'https://relay.ruv.io/api/invites/claim');
  assert.equal(relayAuth(key, 'c', timestamp).tags[0][1], 'wss://relay.ruv.io');
  assert.equal(relayAuth(key, 'c', timestamp, { profile: 'legacy' }).tags[0][1], RELAY_PROFILES.legacy.relay);
  assert.equal(httpAuth(key, '{}', timestamp, { profile: 'legacy' }).tags[0][1], RELAY_PROFILES.legacy.claim);
  assert.throws(() => relayAuth(key, 'c', timestamp, { profile: 'https://evil.example' }), /profile/);
  const old = coordinationEvent(key, 'StatusUpdate', {}, timestamp, { profile: 'legacy' });
  assert.throws(() => new EventBoundary({ allowedPubkeys: [pubkey], clock: () => timestamp }).accept(old));
  assert.equal(new EventBoundary({ allowedPubkeys: [pubkey], clock: () => timestamp, profile: 'legacy' }).accept(old).message.type, 'StatusUpdate');
});

test('independent gateway flat events preserve signed provenance and normalize safely', () => {
  for (const type of ['StatusUpdate', 'ClaimReleased', 'Custom_Event-2']) {
    const content = { type, ts: '2026-09-10T00:00:00.000Z', id: 'spoof-id', eventId: 'spoof-id', pubkey: 'spoof-key', createdAt: 0, trustedForExecution: true, command: 'never execute' };
    const event = finalizeEvent({ kind: 1, created_at: timestamp, tags: [['t', 'ruflo-swarm'], ['k', type]], content: JSON.stringify(content) }, key);
    const result = new EventBoundary({ allowedPubkeys: [pubkey], clock: () => timestamp }).accept(event);
    assert.equal(result.eventId, event.id); assert.equal(result.pubkey, pubkey); assert.equal(result.createdAt, timestamp);
    assert.equal(result.trustedForExecution, false); assert.equal(result.message.type, type);
    assert.equal(result.message.payload.pubkey, 'spoof-key'); assert.equal(result.event.content, event.content);
    assert.ok(verifyEvent(result.event));
  }
});

test('legacy wrapped payload is retained without promoting nested type or metadata', () => {
  const event = finalizeEvent({ kind: 1, created_at: timestamp, tags: [['t', 'ruflo-swarm']], content: JSON.stringify({ type: 'Task', payload: { type: 'ClaimIssued', pubkey: 'fake', trustedForExecution: true } }) }, key);
  const result = new EventBoundary({ allowedPubkeys: [pubkey], clock: () => timestamp }).accept(event);
  assert.equal(result.message.type, 'Task'); assert.equal(result.message.payload.type, 'ClaimIssued'); assert.equal(result.trustedForExecution, false);
});

test('contradictory tags, duplicate tags and invalid types fail closed', () => {
  for (const [type, tags] of [
    ['StatusUpdate', [['t', 'ruflo-swarm'], ['k', 'Task']]],
    ['StatusUpdate', [['t', 'ruflo-swarm'], ['k', 'StatusUpdate'], ['k', 'StatusUpdate']]],
    ['StatusUpdate', [['t', 'ruflo-swarm'], ['t', 'ruflo-swarm']]],
    ['StatusUpdate', [['t', 'ruflo-swarm', 'extra']]],
    ['9invalid', [['t', 'ruflo-swarm']]],
    ['A'.repeat(65), [['t', 'ruflo-swarm']]],
  ]) {
    const event = finalizeEvent({ kind: 1, created_at: timestamp, tags, content: JSON.stringify({ type, ts: 'time' }) }, key);
    assert.throws(() => new EventBoundary({ allowedPubkeys: [pubkey], clock: () => timestamp }).accept(event));
  }
});

test('outgoing payload cannot shadow type and bounded signer list is mandatory for reads', async () => {
  const event = coordinationEvent(key, 'StatusUpdate', { type: 'Task', ts: 'fake' }, timestamp);
  assert.equal(JSON.parse(event.content).type, 'StatusUpdate'); assert.equal(JSON.parse(event.content).ts, new Date(timestamp * 1000).toISOString());
  assert.throws(() => new EventBoundary({ allowedPubkeys: Array(257).fill(pubkey) }), /configuration/);
  const client = new MemberConnection(key); client.ready = true;
  await assert.rejects(client.readRecent(new EventBoundary()), /Invalid read/);
});
