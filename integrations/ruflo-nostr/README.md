# QuDAG Ruflo Nostr member client

This separate Node 22+ client uses a user's own secp256k1 identity. It does not
borrow the gateway identity or request gateway admin privileges. Package versions
were checked against npm on 2026-09-10: `nostr-tools` 2.25.2 and `ws` 8.21.3.
The committed lockfile pins transitive packages. Install with `npm ci --ignore-scripts`.

## Explicit operations

Every command is opt in. These examples describe real state changes where noted;
the implementation work used only ephemeral test keys and local relay fixtures.
No live key, membership claim, AUTH session, or publication was created.

```sh
# Creates a new private key, exclusively, mode 0600. Never overwrites.
node cli.mjs keygen /private/directory/qudag.key

# Claims membership. Provide the invite on standard input or RUFLO_INVITE.
# Never place the invite or private key in command arguments.
node cli.mjs claim /private/directory/qudag.key < /private/directory/invite.txt

# Authenticates to the live relay, then closes. Does not publish.
node cli.mjs connect /private/directory/qudag.key

# Explicit publication. JSON payload comes from stdin; type is an allowlisted value.
printf '%s' '{"name":"my-node"}' | node cli.mjs publish /private/directory/qudag.key PeerHello

# Read only signed events from operator-approved public keys.
RUFLO_ALLOWED_PUBKEYS=PUBLIC_KEY_HEX node cli.mjs read /private/directory/qudag.key

npm test
npm run benchmark
npm audit --omit=dev --audit-level=low
```

Keep keys in an owner-controlled directory outside the repository. The client
refuses key symlinks, wrong ownership, non-0600 modes, malformed contents (64 hex bytes with an optional single newline) and
existing keygen paths. POSIX filesystem protections are required; Windows key
storage needs a platform-specific keychain implementation. Keys are plaintext
at rest, protected by filesystem permissions, not a hardware security module.
CLI failures are generic and never print remote responses, invite values, keys,
or auth headers. Public event payloads are not confidential.

## Protocol bindings

Invite claim is exactly `POST
https://buzz-relay-186366152200.us-central1.run.app/api/invites/claim` with JSON
`{"code":"..."}` and a NIP-98 `Nostr` Authorization header. The signed kind 27235
event binds the exact URL, uppercase POST, timestamp and SHA256 of the exact
serialized body. Redirects are rejected and response bytes and time are bounded.

WebSocket transport connects to `wss://x.ruv.io`. NIP-42 kind 22242 signatures
bind the server challenge and **canonical relay tag**
`wss://buzz-relay-186366152200.us-central1.run.app`, as required by the supplied
federation protocol. Authentication success requires a matching positive OK.
The alias must never replace the canonical relay in the signed auth event.

Published kind 1 events carry `t=ruflo-swarm` and a canonical `relay` domain tag.
Content is `{"type":"PeerHello|Status|Task|Result|ClaimIssued","payload":{...}}`.
The canonical relay tag is optional on incoming kind 1 events; when present it
must match. Group-only events from existing peers are accepted if all other
checks pass. Transport origin is validated separately, rather than inferred from
an unsigned socket alias or a data tag. Live peer schema interoperability remains
unverified.

## Trust and bounds

Schnorr signatures over secp256k1 are **not postquantum cryptography**. This member
transport does not inherit QuDAG ML-KEM or ML-DSA assurances. A valid signature
proves signing identity, not membership, task authorization or claim ownership.
Incoming events must also pass the explicit local public-key allowlist. Relay
membership and gateway claims are not automatically imported into that list.

The boundary checks event signatures locally, exact group tags and any optional domain tag, supported
message types, 16 KiB content, 32 KiB events, a 300 second age window and 30 second
future skew. Its replay map has a 4096 entry cap and fails closed when full.
Expired entries can be reclaimed only after their event acceptance window closes.
Replay state lives only in an EventBoundary instance. Recreating the boundary,
reconnecting with a fresh boundary, or restarting loses that history. A persistent
replay store is required before executing any work or other downstream side
effects across reconnects or restarts. No downstream execution exists
in this client. Task and ClaimIssued payloads remain untrusted observations.

WebSocket frames are bounded at 64 KiB, connections and operations at 10 seconds,
reads at 100 events and concurrent publications at four. Read events pass the
same boundary before returning. Unexpected or tampered events fail the read and
close the connection. Repeated auth challenges close rather than silently sign
additional challenges. There is no automatic reconnect or publication retry.

## Verification and primary sources

Offline tests exercise exact HTTP signature bindings, canonical NIP-42 tags,
private key lifecycle, signature tampering, unauthorized signers, domain/time
rejection, replay capacity, and local WebSocket authentication, publish ACK,
verified reads and denied membership. None establish live enrollment success.

[NIP-01 event/signature format](https://github.com/nostr-protocol/nips/blob/master/01.md)

[NIP-42 relay authentication](https://github.com/nostr-protocol/nips/blob/master/42.md)

[NIP-98 HTTP authentication](https://github.com/nostr-protocol/nips/blob/master/98.md)

Recorded local p50/p95 milliseconds: signing 2.49/3.19, uncached signature
verification 1.58/1.96, WebSocket connect plus AUTH plus publish ACK 9.55/11.60.
See `benchmark-results.json`; these are local fixtures, not live relay latency.
The npm audit snapshot contains zero known vulnerabilities and is accompanied
by the lockfile hash in `audit-provenance.json`.
