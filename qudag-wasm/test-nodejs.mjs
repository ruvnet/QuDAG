// Node.js smoke test for the `wasm-pack build --target nodejs` output.
// Usage: node test-nodejs.mjs [pkg-dir]   (default: ./pkg-nodejs)
// Exits non-zero on any failure.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(process.argv[2] ?? join(here, 'pkg-nodejs'));
const require = createRequire(import.meta.url);
const { QuDAGClient, getInitStatus, Encoding } = require(join(pkgDir, 'qudag_wasm.js'));

const status = getInitStatus();
assert.equal(status.is_initialized(), true);
assert.match(status.version(), /^\d+\.\d+\.\d+/);
assert.ok(Array.isArray(status.features()));
console.log(`qudag-wasm ${status.version()} features: ${status.features().join(', ')}`);

const client = new QuDAGClient();
assert.ok(client.getConfig(), 'client config');
assert.ok(Array.isArray(client.getFeatures()));
assert.equal(QuDAGClient.getVersion(), status.version());
assert.equal(typeof QuDAGClient.hasFeature('crypto'), 'boolean');

assert.equal(Encoding.bytesToHex(Encoding.hexToBytes('00ff10')), '00ff10');
assert.equal(Encoding.bytesToString(Encoding.stringToBytes('qudag')), 'qudag');

console.log('All Node.js tests passed.');
