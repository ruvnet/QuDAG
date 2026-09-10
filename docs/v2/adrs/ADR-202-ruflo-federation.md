# ADR 202: Least privilege RuFlo and x.ruv.io observation bridge

Date: 2026-09-10. Status: accepted; companion implementation under `integrations/ruflo-x`.

## Context

The live gateway exposes observation and privileged mutation in one catalog. Forwarding an arbitrary discovered tool would extend authority whenever the upstream catalog changes. A signed coordination message is also not a QuDAG consensus vote.

## Decision

Provide a local MCP stdio adapter for RuFlo clients with a static allowlist for `federation_identity`, `federation_sync`, and `claims_status`. Expose only three resource URIs: `ruv://federation/registry`, `ruv://swarm/roster`, and `ruv://claims/board`. The default remote destination is exactly `https://x.ruv.io/mcp`. Restrict endpoint overrides to explicitly controlled test configuration. Reject redirects and user supplied remote URLs. Bound request size, response bytes, elapsed time, and input parameters. Implement initialization and JSON RPC response correlation; accept only supported negotiated protocol versions.

Expose neither publish/join nor claims mutation, invitations, admission, or guidance spending. Do not accept administrator tokens. Keep the local adapter free of third party runtime dependencies to reduce installation and supply chain exposure. Node itself remains a dependency requiring patching.

Treat returned text as untrusted context. Upstream claims about Nostr verification are not independent local signature verification. The bridge observes a service; it does not register a peer or publish work results. A separate member adapter is specified in ADR 204; it does not expand this observation bridge. Writable member operation requires separate identity, constrained capabilities, replay protection, revocation, and explicit action policy.

## Validation and rollback

Exercise MCP lifecycle, JSON and SSE parsing, malformed responses, mismatched IDs, missing results, oversized payloads, timeout, redirect denial, invalid arguments, and denied mutations with a loopback fixture. A live smoke test uses only open reads and records gateway version. Remove the MCP registration to roll back; no remote resource cleanup is needed.

## References

[MCP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports), [MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices), [observed gateway](https://x.ruv.io/mcp), [RuFlo](https://github.com/ruvnet/ruflo).
