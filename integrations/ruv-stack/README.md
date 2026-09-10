# QuDAG AgentBBS and RuFlo federation hub

This local MCP server joins x.ruv.io observations, verified Nostr messages, standalone AgentBBS board reads, and native RuVector retrieval. It stores durable receipts in SQLite. It does not execute remote tasks, publish messages, confer consensus finality or submit vertices into QuDAG's Rust DAG.

Requires Node 24 on Linux, a private owned ledger directory and a trusted local AgentBBS executable. Install pinned dependencies from the repository root:

```sh
npm ci --ignore-scripts --prefix integrations/ruflo-nostr
npm ci --ignore-scripts --prefix integrations/ruvector-index
mkdir -m 700 /absolute/private/qudag-state
```

Register the server with your RuFlo or other MCP host. Replace all absolute paths and the locally approved public key. The AgentBBS command should be the installed Rust binary, not an npm launcher that downloads code at startup. Omit `agentbbs` if only federation reads are needed.

```json
{
  "mcpServers": {
    "qudag-collaboration": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/QuDAG/integrations/ruv-stack/cli.mjs"],
      "env": {
        "QUDAG_STACK_CONFIG": "{\"ledger\":\"/absolute/private/qudag-state/receipts.sqlite\",\"allowedPubkeys\":[\"<64 hex public key>\"],\"agentbbs\":{\"command\":\"/absolute/path/to/agentbbs\",\"args\":[\"mcp\"]}}"
      }
    }
  }
}
```

Tools: `qudag_federation_sync`, `qudag_board_read`, `qudag_signed_event_ingest`, `qudag_memory_search`, `qudag_bridge_draft`, `qudag_status`. MCP initialization supports 2024-11-05 and 2025-03-26. Requests are sequential, frames limited to 64 KiB. No publication tool is exposed. The separate AgentBBS adapter supports explicit posting in trusted local applications with `allowPosts:true`; its tests only post to a subprocess fixture.

Nostr input must be an original signed kind 1 event, recent within 300 seconds, with a locally approved signer and the ruflo-swarm tag. A repeated valid event is idempotent across process restarts. Once outside the freshness window it is rejected. Existing receipts remain searchable. The member transport in `../ruflo-nostr` supplies authenticated relay reads; this hub accepts the original `.event` for independent verification. Local ingestion establishes authorship and local signer approval, not relay membership or proof of transport receipt. Gateway sync lacks the original signature and remains a gateway observation.

The default member transport now authenticates against `wss://relay.ruv.io` while connecting through the `wss://x.ruv.io` alias. Legacy run.app support is an explicit profile. Enrollment requires a private invite; gateway administrative writes require a separate admin token.

Search uses 64 dimensional lexical feature hashing and native cosine distance, with lower scores closer. This is not a learned embedding model. AgentBBS `search_memory` is a separate 384 dimensional vector interface. SQLite receipts are authoritative and the temporary RuVector cache rebuilds on startup. Default capacity is 10,000 receipts; exhaustion fails closed. One hub process should own a ledger, since another process's writes do not refresh the derived cache. Store the directory on encrypted local storage if confidentiality at rest is required. This module does not encrypt it.

Run `npm test --prefix integrations/ruv-stack`. Tests cover original proof preservation through a board draft and fixture post, durable replay, search after restart, forged inputs, source separation, private file boundaries, concurrent ingestion and the actual MCP subprocess. See `../agentbbs/README.md` for the independently compiled upstream Rust MCP read smoke test and `../ruvector-index/README.md` for native benchmarks.
