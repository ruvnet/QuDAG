import { createHash } from 'node:crypto';
import { open, constants } from 'node:fs/promises';
import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure';
import WebSocket from 'ws';
export const RELAY_PROFILES = Object.freeze({ current: Object.freeze({ relay: 'wss://relay.ruv.io', claim: 'https://relay.ruv.io/api/invites/claim' }), legacy: Object.freeze({ relay: 'wss://buzz-relay-186366152200.us-central1.run.app', claim: 'https://buzz-relay-186366152200.us-central1.run.app/api/invites/claim' }) });
const profileFor = name => { if (!Object.hasOwn(RELAY_PROFILES, name)) throw Error('Unknown relay profile'); return RELAY_PROFILES[name]; };
export const CLAIM_URL = RELAY_PROFILES.current.claim;
export const SOCKET_URL = 'wss://x.ruv.io';
export const CANONICAL_RELAY = RELAY_PROFILES.current.relay;
export const GROUP = 'ruflo-swarm';
export const TYPES = ['PeerHello', 'Status', 'Task', 'Result', 'ClaimIssued'];
export const validMessageType = type => typeof type === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(type);
const now = () => Math.floor(Date.now() / 1000);
const hash = body => createHash('sha256').update(body).digest('hex');
const hex = /^[0-9a-f]{64}$/;
export async function keygen(path) {
  const key = generateSecretKey();
  let file;
  try { file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); await file.writeFile(Buffer.from(key).toString('hex') + '\n'); await file.sync(); return getPublicKey(key); }
  finally { key.fill(0); await file?.close(); }
}
export async function loadKey(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || ![64, 65].includes(stat.size) || (stat.mode & 0o777) !== 0o600 || (process.getuid && stat.uid !== process.getuid())) throw Error('Unsafe key file ownership, permissions or size');
    const buffer = Buffer.alloc(66);
    const { bytesRead } = await file.read(buffer, 0, 66, 0);
    if (![64, 65].includes(bytesRead)) throw Error('Invalid key file length');
    const encoded = buffer.subarray(0, bytesRead).toString('utf8'); buffer.fill(0);
    if (!/^[0-9a-f]{64}\n?$/.test(encoded)) throw Error('Invalid key format');
    const value = encoded.replace(/\n$/, '');
    if (!hex.test(value)) throw Error('Invalid key format');
    const key = Uint8Array.from(Buffer.from(value, 'hex')); getPublicKey(key); return key;
  } finally { await file.close(); }
}
export function httpAuth(key, body, timestamp = now(), { profile = 'current' } = {}) {
  return finalizeEvent({ kind: 27235, created_at: timestamp, content: '', tags: [['u', profileFor(profile).claim], ['method', 'POST'], ['payload', hash(body)]] }, key);
}
export function relayAuth(key, challenge, timestamp = now(), { profile = 'current' } = {}) {
  if (typeof challenge !== 'string' || challenge.length < 1 || Buffer.byteLength(challenge) > 1024) throw Error('Invalid relay challenge');
  return finalizeEvent({ kind: 22242, created_at: timestamp, content: '', tags: [['relay', profileFor(profile).relay], ['challenge', challenge]] }, key);
}
export async function claimInvite(key, code, { fetchImpl = fetch, profile = 'current' } = {}) {
  if (typeof code !== 'string' || code.length < 1 || code.length > 512 || /\s/.test(code)) throw Error('Invalid invite');
  const body = JSON.stringify({ code });
  const authorization = 'Nostr ' + Buffer.from(JSON.stringify(httpAuth(key, body, now(), { profile }))).toString('base64');
  const response = await fetchImpl(profileFor(profile).claim, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json', authorization }, body });
  if (!response.ok) { await response.body?.cancel(); throw Error(`Invite claim HTTP ${response.status}`); }
  const reader = response.body?.getReader(); if (!reader) return;
  let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65536) throw Error('Claim response too large'); } }
  finally { await reader.cancel().catch(() => {}); }
  // Do not expose response content, which may include membership credentials.
}
export function coordinationEvent(key, type, payload, timestamp = now(), { profile = 'current' } = {}) {
  if (!validMessageType(type) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('Invalid message type or payload');
  const content = JSON.stringify({ ...payload, type, ts: new Date(timestamp * 1000).toISOString() });
  if (Buffer.byteLength(content) > 16384) throw Error('Message too large');
  return finalizeEvent({ kind: 1, created_at: timestamp, tags: [['t', GROUP], ['k', type], ['relay', profileFor(profile).relay]], content }, key);
}
export class EventBoundary {
  constructor({ allowedPubkeys = [], maxEntries = 4096, maxAgeSeconds = 300, futureSkewSeconds = 30, clock = now, profile = 'current' } = {}) {
    if (!Array.isArray(allowedPubkeys) || allowedPubkeys.length > 256 || allowedPubkeys.some(k => !hex.test(k)) || !Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 100000 || !Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1 || maxAgeSeconds > 86400 || !Number.isInteger(futureSkewSeconds) || futureSkewSeconds < 0 || futureSkewSeconds > 60) throw Error('Invalid boundary configuration');
    this.profile = profile; this.relay = profileFor(profile).relay; this.allowed = new Set(allowedPubkeys); this.seen = new Map(); this.maxEntries = maxEntries; this.maxAge = maxAgeSeconds; this.skew = futureSkewSeconds; this.clock = clock;
  }
  accept(input, transportOrigin = this.relay) {
    if (transportOrigin !== this.relay) throw Error('Untrusted transport origin');
    // Reparse to remove any nostr-tools verification-cache symbols on caller objects.
    const serialized = JSON.stringify(input); if (Buffer.byteLength(serialized) > 32768) throw Error('Event too large');
    const event = JSON.parse(serialized); const time = this.clock();
    if (!event || event.kind !== 1 || !Number.isInteger(event.created_at) || event.created_at < time - this.maxAge || event.created_at > time + this.skew || !Array.isArray(event.tags) || event.tags.length > 32 || !verifyEvent(event)) throw Error('Invalid signed event');
    const tag = name => event.tags.filter(t => Array.isArray(t) && t[0] === name);
    if (tag('t').length !== 1 || tag('t')[0][1] !== GROUP || tag('relay').length > 1 || (tag('relay').length === 1 && tag('relay')[0][1] !== this.relay)) throw Error('Wrong federation domain or group');
    if (!this.allowed.has(event.pubkey)) throw Error('Signer is not locally authorized');
    if (Buffer.byteLength(event.content) > 16384) throw Error('Content too large');
    const content = JSON.parse(event.content);
    if (!content || typeof content !== 'object' || Array.isArray(content) || !validMessageType(content.type)) throw Error('Invalid coordination envelope');
    if (tag('k').length > 1 || (tag('k').length === 1 && (tag('k')[0].length !== 2 || tag('k')[0][1] !== content.type))) throw Error('Mismatched message type tag');
    if (tag('t')[0].length !== 2) throw Error('Invalid group tag');
    const { type, ...rest } = content;
    const wrapped = Object.keys(rest).length === 1 && Object.hasOwn(rest, 'payload');
    if (wrapped && (!rest.payload || typeof rest.payload !== 'object' || Array.isArray(rest.payload))) throw Error('Invalid legacy payload');
    const message = { type, payload: wrapped ? rest.payload : rest };
    for (const [id, expiry] of this.seen) if (expiry < time) this.seen.delete(id);
    if (this.seen.has(event.id)) throw Error('Replay rejected');
    if (this.seen.size >= this.maxEntries) throw Error('Replay window capacity exhausted');
    this.seen.set(event.id, event.created_at + this.maxAge);
    return { event, eventId: event.id, pubkey: event.pubkey, createdAt: event.created_at, message, trustedForExecution: false };
  }
}
export class MemberConnection {
  constructor(key, { socketFactory, timeoutMs = 10000, profile = 'current' } = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw Error('Invalid timeout');
    this.profile = profile; profileFor(profile); this.key = key; this.socketFactory = socketFactory ?? (() => new WebSocket(profile === 'current' ? SOCKET_URL : profileFor(profile).relay, { maxPayload: 65536, handshakeTimeout: 10000, followRedirects: false })); this.timeoutMs = timeoutMs; this.ready = false; this.waiters = new Map();
  }
  async connect() {
    if (this.socket) throw Error('Connection already opened');
    this.socket = this.socketFactory();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => fail(Error('Relay authentication timeout')), this.timeoutMs);
      const fail = error => { clearTimeout(timer); reject(error); this.reading?.reject(error); this.reading = undefined; for (const waiter of this.waiters.values()) waiter.reject(error); this.waiters.clear(); this.close(); };
      let authId;
      this.socket.on('error', () => fail(Error('Relay connection failed')));
      this.socket.on('close', () => { this.ready = false; clearTimeout(timer); reject(Error('Relay closed')); for (const waiter of this.waiters.values()) waiter.reject(Error('Relay closed')); this.waiters.clear(); this.reading?.reject(Error('Relay closed')); this.reading = undefined; });
      this.socket.on('message', raw => {
        try {
          if (raw.length > 65536) throw Error('Relay frame too large');
          if (this.socket.readyState !== WebSocket.OPEN) return;
          const frame = JSON.parse(raw.toString()); if (!Array.isArray(frame)) throw Error('Invalid relay frame');
          if (frame[0] === 'AUTH') {
            if (authId) throw Error('Repeated auth challenge');
            const event = relayAuth(this.key, frame[1], now(), { profile: this.profile }); authId = event.id; this.socket.send(JSON.stringify(['AUTH', event]));
          } else if (frame[0] === 'OK' && frame[1] === authId) {
            if (frame[2] !== true) throw Error('Relay authentication denied');
            this.ready = true; clearTimeout(timer); resolve(this);
          } else if (frame[0] === 'OK' && this.waiters.has(frame[1])) {
            const waiter = this.waiters.get(frame[1]); this.waiters.delete(frame[1]);
            frame[2] === true ? waiter.resolve(frame[1]) : waiter.reject(Error('Publish denied'));
          }
          else if (frame[0] === 'EVENT' && this.reading && frame[1] === 'qudag-read') {
            if (this.reading.events.length >= 100) throw Error('Read limit exceeded');
            this.reading.events.push(this.reading.boundary.accept(frame[2]));
          } else if (frame[0] === 'EOSE' && this.reading && frame[1] === 'qudag-read') {
            const reading = this.reading; this.reading = undefined;
            this.socket.send(JSON.stringify(['CLOSE', 'qudag-read'])); reading.resolve(reading.events);
          }
          // Other messages are never dispatched, executed, or granted authority.
        } catch { fail(Error('Relay protocol or authentication failure')); }
      });
    });
  }
  async publish(type, payload) {
    if (!this.ready) throw Error('Relay is not authenticated');
    if (this.waiters.size >= 4) throw Error('Publish concurrency exhausted');
    const event = coordinationEvent(this.key, type, payload, now(), { profile: this.profile });
    if (this.waiters.has(event.id)) throw Error('Duplicate in-flight event');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters.delete(event.id); reject(Error('Publish ack timeout')); }, this.timeoutMs);
      this.waiters.set(event.id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      this.socket.send(JSON.stringify(['EVENT', event]));
    });
  }
  async readRecent(boundary) {
    if (!this.ready || this.reading || !(boundary instanceof EventBoundary) || boundary.profile !== this.profile || boundary.allowed.size === 0) throw Error('Invalid read state or boundary');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.reading = undefined; this.socket.send(JSON.stringify(['CLOSE', 'qudag-read'])); reject(Error('Read timeout')); }, this.timeoutMs);
      this.reading = { boundary, events: [], resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } };
      this.socket.send(JSON.stringify(['REQ', 'qudag-read', { kinds: [1], authors: [...boundary.allowed], '#t': [GROUP], since: now() - boundary.maxAge, limit: 100 }]));
    });
  }
  close() { this.ready = false; this.socket?.terminate(); }
}
