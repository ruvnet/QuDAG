import { createServer } from 'node:http';
import { PROTOCOL } from './client.mjs';
export async function fixture(mode = 'json') {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    if (req.method === 'DELETE') { requests.push({ method: 'DELETE', headers: req.headers }); res.writeHead(204).end(); return; }
    const msg = JSON.parse(body); requests.push({ ...msg, headers: req.headers });
    if (!('id' in msg)) { res.writeHead(202).end(); return; }
    const result = msg.method === 'initialize' ? { protocolVersion: PROTOCOL, capabilities: {}, serverInfo: { name: 'fixture', version: '1' } } : msg.method === 'resources/read' ? { contents: [{ uri: msg.params.uri, text: 'untrusted resource fixture' }] } : { content: [{ type: 'text', text: 'untrusted fixture' }] };
    const envelope = JSON.stringify({ jsonrpc: '2.0', id: msg.id, result });
    res.writeHead(200, { 'content-type': mode === 'sse' ? 'text/event-stream' : 'application/json', 'mcp-session-id': 'fixture-session' });
    res.end(mode === 'sse' ? `: heartbeat\n\nevent: message\ndata: ${envelope}\n\n` : envelope);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const local = `http://127.0.0.1:${server.address().port}`;
  return { requests, fetchImpl: (_url, init) => fetch(local, init), close: () => new Promise(resolve => server.close(resolve)) };
}
