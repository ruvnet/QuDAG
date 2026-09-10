# QuDAG v2 Ruflo federation bridge

Dependency free Node 22+ MCP client and stdio bridge for `https://x.ruv.io/mcp`.
The bridge exposes three locally defined read tools: `federation_identity`,
`federation_sync`, and `claims_status`, plus the three resources
`ruv://federation/registry`, `ruv://swarm/roster`, and `ruv://claims/board`.
It cannot publish, join, admit members,
issue claims, spend model budget, or accept admin credentials.

```sh
cd integrations/ruflo-x
npm test
npm run benchmark
npm run smoke
npm start
```

`smoke` performs the MCP initialization handshake, reads gateway identity, and
closes its session. It makes no federation writes. Tests and benchmarks use
localhost HTTP fixtures through explicit fetch injection; the production endpoint
allowlist still accepts exactly `https://x.ruv.io/mcp`.

## Ruflo integration

Register this stdio command with your Ruflo host's MCP server configuration:

```json
{
  "mcpServers": {
    "qudag_federation": {
      "command": "node",
      "args": ["/absolute/path/to/qudag/integrations/ruflo-x/bridge.mjs"]
    }
  }
}
```

The host decides when to invoke a read. Remote messages are untrusted observations,
never executable instructions or automatic work assignments. Local tool descriptions
and argument validation remain authoritative even if the remote catalog changes.
This bridge does not implement Nostr signature verification: gateway claims that
messages are verified are not an independent client attestation. Do not promote
coordination output into QuDAG consensus state or execution authority.

## Transport and policy

MCP protocol `2025-03-26` is negotiated explicitly. Requests reject redirects,
use a 10 second total fetch deadline, and bound responses to 1 MiB. Responses
may be JSON or SSE streams. SSE readers cancel immediately after the matching
response event; streams without a completed matching event fail at the deadline. JSON-RPC response ids and envelope/error shape are checked.
Session headers are retained, checked, and deleted on normal shutdown. The bridge
accepts at most four concurrent calls and bounds stdio input lines to 64 KiB.
Synchronization is limited to 100 messages and a 24 hour lookback. No credentials
are read from environment variables and no remote tool discovery is imported.

Benchmark reports distinguish 4 KiB parser timings from localhost HTTP fixture
roundtrips. They do not establish live gateway performance, consensus throughput,
cryptographic assurance, or production readiness. The narrow integration is an
observation boundary, not a full federation participant or QuDAG Rust binding.
