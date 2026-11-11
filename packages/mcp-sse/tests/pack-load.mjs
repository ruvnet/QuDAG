// Usage: node tests/pack-load.mjs <consumerDir>
// <consumerDir> has the packed tarball installed; checks every export path loads.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const req = createRequire(path.resolve(process.argv[2], 'package.json'));
const main = req('@qudag/mcp-sse');
assert.equal(typeof main.QuDAGMcpServer, 'function', 'main export QuDAGMcpServer');
assert.equal(typeof req('@qudag/mcp-sse/auth').createOAuth2Manager, 'function', './auth export');
assert.equal(typeof req('@qudag/mcp-sse/middleware').createRateLimitMiddleware, 'function', './middleware export');
const native = req('@qudag/napi-core');
assert.equal(typeof native.MlKem.keygen, 'function');
console.log('pack-load ok: @qudag/mcp-sse', req('@qudag/mcp-sse/package.json').version);
