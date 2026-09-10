import { performance } from 'node:perf_hooks';
import { FederationClient, parseResponse } from './client.mjs';
import { fixture } from './fixture.mjs';
const envelope = JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'x'.repeat(4096) }] } });
const reports = [];
for (const mode of ['json', 'sse']) {
  const body = mode === 'sse' ? `event: message\ndata: ${envelope}\n\n` : envelope;
  const contentType = mode === 'sse' ? 'text/event-stream' : 'application/json';
  for (let i = 0; i < 1000; i++) parseResponse(body, contentType, 1);
  const n = 10000; const begin = performance.now();
  for (let i = 0; i < n; i++) parseResponse(body, contentType, 1);
  reports.push({ operation: `${mode} parse`, iterations: n, payloadBytes: Buffer.byteLength(body), meanMs: (performance.now() - begin) / n });
  const f = await fixture(mode); const c = new FederationClient({ fetchImpl: f.fetchImpl });
  try {
    await c.initialize(); const latencies = [];
    for (let i = 0; i < 100; i++) { const t = performance.now(); await c.call('federation_identity'); latencies.push(performance.now() - t); }
    latencies.sort((a, b) => a - b);
    reports.push({ operation: `${mode} localhost read roundtrip`, iterations: latencies.length, p50Ms: latencies[49], p95Ms: latencies[94], p99Ms: latencies[98] });
    await c.close();
  } finally { await f.close(); }
}
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, note: 'Local fixture measurements. Not production gateway latency or QuDAG consensus throughput.', reports }, null, 2));
