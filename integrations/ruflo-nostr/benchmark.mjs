import { performance } from 'node:perf_hooks';
import { generateSecretKey, verifyEvent } from 'nostr-tools/pure';
import { coordinationEvent, MemberConnection } from './client.mjs';
import { relayFixture } from './fixture.mjs';
const key = generateSecretKey();
const reports = [];
function report(operation, samples) {
  samples.sort((a, b) => a - b);
  reports.push({ operation, iterations: samples.length, p50Ms: samples[Math.floor(samples.length * 0.5)], p95Ms: samples[Math.floor(samples.length * 0.95)] });
}
try {
  const events = []; const sign = [];
  for (let i = 0; i < 250; i++) { const start = performance.now(); events.push(coordinationEvent(key, 'Status', { fixture: i })); sign.push(performance.now() - start); }
  report('secp256k1 sign coordination event', sign);
  const verify = [];
  for (const event of events) {
    // JSON roundtrip removes nostr-tools verification cache; measure real verification.
    const fresh = JSON.parse(JSON.stringify(event)); const start = performance.now(); if (!verifyEvent(fresh)) throw Error('Verification failed'); verify.push(performance.now() - start);
  }
  report('secp256k1 verify fresh event', verify);
  const fixture = await relayFixture(key); const latencies = [];
  try {
    for (let i = 0; i < 30; i++) {
      const client = new MemberConnection(key, { socketFactory: fixture.socketFactory }); const start = performance.now();
      try { await client.connect(); await client.publish('Status', { fixture: i }); latencies.push(performance.now() - start); }
      finally { client.close(); }
    }
  } finally { await fixture.close(); }
  report('localhost WS connect AUTH and signed publish ACK', latencies);
} finally { key.fill(0); }
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), node: process.version, nostrTools: '2.25.2', ws: '8.21.3', note: 'Ephemeral test key, localhost fixture. No live network federation or production throughput claims.', reports }, null, 2));
