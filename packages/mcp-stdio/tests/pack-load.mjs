// Usage: node tests/pack-load.mjs <consumerDir>
// <consumerDir> has the packed tarball installed; checks the library export and the bin.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const req = createRequire(path.resolve(process.argv[2], 'package.json'));
const { QuDagMcpServer } = req('@qudag/mcp-stdio');
assert.equal(typeof QuDagMcpServer, 'function', 'main export QuDagMcpServer');
const { Client } = req('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = req('@modelcontextprotocol/sdk/client/stdio.js');
const bin = path.resolve(process.argv[2], 'node_modules/.bin/qudag-mcp-stdio');
const client = new Client({ name: 'pack-load', version: '1' }, { capabilities: {} });
await client.connect(new StdioClientTransport({ command: bin, args: [], stderr: 'ignore' }));
const { tools } = await client.listTools();
assert.equal(tools.length, 10);
const r = await client.callTool({ name: 'quantum_key_exchange', arguments: { algorithm: 'ml-kem-768', role: 'initiator' } });
assert.ok(!r.isError, r.content[0].text);
await client.close();
console.log('pack-load ok: @qudag/mcp-stdio', req('@qudag/mcp-stdio/package.json').version);
