# ADR 204: Separate member identity from the gateway observation plane

Date: 2026-09-10. Status: accepted integration contract; member adapter implementation is recorded in the final validation report. Live enrollment is not completed.

## Context and provenance

The user supplied the following deployment contract. These exact service paths and canonical relay requirements are application configuration, not claims established by the Nostr specifications:

| Operation | User supplied deployment contract |
| --- | --- |
| Invite claim | POST `https://buzz-relay-186366152200.us-central1.run.app/api/invites/claim` with JSON `{ "code": "<invite>" }`, authenticated by NIP 98 using the member's own key |
| Relay connection | `wss://x.ruv.io` |
| Canonical authentication relay tag | Exactly `wss://buzz-relay-186366152200.us-central1.run.app`, even when connecting through the x.ruv.io alias |
| Coordination envelope | Nostr kind 1 with `t` tag `ruflo-swarm`; JSON content for PeerHello, Status, Task, Result, or ClaimIssued |
| Invitation handling | Private, limited use, expiring; no actual invitation was supplied in this session |

Read only MCP discovery independently verified the three resource URIs documented in ADR 202. That does not verify invite redemption or relay enrollment. No live member key was generated, no invitation redeemed, and no member publication is claimed.

## Verified protocol foundations

NIP 01 defines signed Nostr event serialization and identifiers. Its Schnorr signatures use secp256k1; this federation identity layer is not post quantum cryptography. A QuDAG ML-KEM improvement does not change that trust property. [NIP 01](https://github.com/nostr-protocol/nips/blob/master/01.md).

NIP 98 defines HTTP authentication using signed kind 27235 events tied to request URL and method, with payload hashing available for request body binding. The member claim implementation must bind the exact serialized claim payload rather than treating possession of an arbitrary signed event as authorization. [NIP 98](https://github.com/nostr-protocol/nips/blob/master/98.md).

NIP 42 defines challenge based relay authentication using an ephemeral kind 22242 event with relay and challenge tags. Authentication acknowledgment is separate from authorization to publish a coordination event. The stricter canonical relay match above is deployment policy; the specification permits normalization choices. [NIP 42](https://github.com/nostr-protocol/nips/blob/master/42.md).

## Decision

Implement member protocol support in `integrations/ruflo-nostr`, separate from the read only MCP bridge. Require explicit member key material and an explicit invocation for each write. Never use the gateway administrator identity. Pin dependencies and constrain HTTP and WebSocket destinations to the supplied contract. Reject redirects, bound payloads and timeouts, verify response identity where the protocol exposes it, and require authentication acknowledgment before publication.

Keep private keys and invitations out of logs, fixtures, saved research, and remote model context. Use synthetic keys and fake invitations for local tests. Invitation errors must not trigger automatic repeated redemption because codes are use limited. Remote coordination content remains untrusted; successful authentication cannot grant local tool execution or QuDAG finality.

## Validation and remaining gates

Local tests must exercise deterministic signing, signature validation, exact HTTP URL/method/body binding, canonical relay tags, challenge handling, failed authentication, publication acknowledgment, and endpoint restrictions. These prove adapter behavior against fixtures only. A future live test requires an actual invitation and authorized member identity, then records successful claim, AUTH acknowledgment, permitted publication, and observed signed echo with no secrets retained. Until then, describe the member flow as implemented locally and not enrolled.

Full deployment still needs key custody, rotation and revocation procedures, replay handling, event retention policy, and a defined mapping from member identity to permitted actions. Membership does not authorize arbitrary task assignment, and claims are coordination records rather than consensus certificates.
