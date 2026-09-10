import { keygen, loadKey, claimInvite, MemberConnection, EventBoundary, TYPES } from './client.mjs';
async function stdin(limit) { let text = ''; for await (const chunk of process.stdin) { text += chunk; if (Buffer.byteLength(text) > limit) throw Error('Input too large'); } return text.trim(); }
const [command, path, type, extra] = process.argv.slice(2);
let key; let connection;
try {
  if (!path || extra || !['keygen', 'claim', 'connect', 'publish', 'read'].includes(command) || (command !== 'publish' && type)) throw Error('Usage: node cli.mjs keygen|claim|connect|read PATH; node cli.mjs publish PATH TYPE (payload JSON on stdin)');
  if (command === 'keygen') console.log(JSON.stringify({ pubkey: await keygen(path) }));
  else {
    key = await loadKey(path);
    if (command === 'claim') {
      const invite = process.env.RUFLO_INVITE || await stdin(512); delete process.env.RUFLO_INVITE;
      await claimInvite(key, invite); console.log('Invite claim HTTP request succeeded; connect to verify relay membership');
    } else {
      let payload;
      if (command === 'publish') { if (!TYPES.includes(type)) throw Error('Unsupported message type'); payload = JSON.parse(await stdin(16384)); }
      connection = new MemberConnection(key); await connection.connect();
      if (command === 'publish') console.log(JSON.stringify({ eventId: await connection.publish(type, payload) }));
      else if (command === 'read') {
        const allowedPubkeys = (process.env.RUFLO_ALLOWED_PUBKEYS || '').split(',').filter(Boolean);
        if (!allowedPubkeys.length) throw Error('Explicit RUFLO_ALLOWED_PUBKEYS required');
        console.log(JSON.stringify(await connection.readRecent(new EventBoundary({ allowedPubkeys }))));
      } else console.log('Relay authentication accepted');
    }
  }
} catch { console.error('Operation failed. Check command, input, key permissions, network and authorization.'); process.exitCode = 1; }
finally { connection?.close(); key?.fill(0); }
