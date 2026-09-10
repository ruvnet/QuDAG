import assert from 'node:assert/strict';
import WebSocket, { WebSocketServer } from 'ws';
import { verifyEvent } from 'nostr-tools/pure';
import { coordinationEvent, CANONICAL_RELAY } from './client.mjs';
export async function relayFixture(key, { deny = false, badEvent = false } = {}) {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1', maxPayload: 65536 });
  await new Promise(resolve => server.on('listening', resolve));
  server.on('connection', socket => {
    socket.send(JSON.stringify(['AUTH', 'fixture-challenge']));
    socket.on('message', raw => {
      const [type, value] = JSON.parse(raw);
      if (type === 'AUTH') { assert.ok(verifyEvent(value)); assert.equal(value.tags[0][1], CANONICAL_RELAY); assert.equal(value.tags[1][1], 'fixture-challenge'); socket.send(JSON.stringify(['OK', value.id, !deny, ''])); }
      if (type === 'EVENT') { assert.ok(verifyEvent(value)); socket.send(JSON.stringify(['OK', value.id, true, ''])); }
      if (type === 'REQ') {
        const event = coordinationEvent(key, 'Status', { fixture: true }); if (badEvent) event.content += 'tampered';
        socket.send(JSON.stringify(['EVENT', value, event])); socket.send(JSON.stringify(['EOSE', value]));
      }
    });
  });
  return { socketFactory: () => new WebSocket(`ws://127.0.0.1:${server.address().port}`, { maxPayload: 65536 }), close: async () => { for (const c of server.clients) c.terminate(); await new Promise(resolve => server.close(resolve)); } };
}
