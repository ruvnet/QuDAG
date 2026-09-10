# ADR 200: Stage v2 behind evidence gates

Date: 2026-09-10. Status: accepted architecture; full platform migration proposed.

## Context

The baseline publicly exports placeholder cryptography and compatibility methods that overstate authentication and finality. See [research](../research.md). A version bump does not repair these properties.

## Decision

Stage A corrects exported KEM semantics, fails unsigned verification closed, establishes transactional local Pending admission with deterministic Kahn ordering and accurate tips, corrects configured credential authentication, rejects unsupported identity providers, disables mock vault success, and establishes a bounded federation observation adapter. The synchronous facade owns its local vertex map instead of starting an asynchronous background worker. This avoids requiring an undeclared Tokio reactor and does not imply durable storage or distributed consensus. Stage B defines an authenticated, versioned message envelope with canonical encoding, parent ordering, domain separation, replay protection, and explicit validator identity. Stage C replaces simulated votes with authenticated network votes and a specified consensus backend. Stage D qualifies crash recovery, partitions, Byzantine behavior, key rotation, and deployment operations.

The companion changes implement Stage A and selected fail-closed corrections. The requested complete v2 remains unfinished until Stages B through D are implemented and validated. Every stage requires evidence before public readiness claims. Do not bump all workspace packages to 2.0 merely because this plan exists.

## Invariants

1. Local DAG insertion never establishes distributed finality by itself.
2. Invalid signatures cannot pass a production verification API.
3. Finalized ordering preserves parent precedence and is identical at honest replicas.
4. Simulation and test shims cannot be enabled through a production default.
5. No federation message can mutate consensus or policy merely by being retrieved.

## Alternatives and consequences

A full rewrite increases the review surface before the baseline is trustworthy. Retrofitting Mysticeti immediately introduces protocol and signature integration work without a validated transport harness. Incremental hardening produces independently reviewable changes, but cannot support a claim of completed v2 until later gates pass.

## Rollback and acceptance

Keep wire formats versioned. Never silently fall back to placeholder crypto to preserve compatibility. Rollback of the bridge means removing its MCP registration. A release candidate fails if any documented production blocker remains without a disabled call path or an explicit unsupported status.

## Explicit compatibility changes

Local insertion previously reported Final without an authenticated quorum. It now remains Pending. Tests asserting automatic local Final are migrated to Pending admission stability; they no longer claim distributed liveness. The unsigned verification compatibility method rejects all messages; callers must pass an explicit ML-DSA signature to the signed method. Authentication requires configured credentials, while OAuth and vault authentication reject requests until real verifiers exist. Mock vault operations return unavailable instead of fabricated persistence success. Network server startup is explicitly disabled until request authentication middleware exists. Distributed consensus remains a separate release gate.

Stage A also repairs asynchronous admission backpressure and error propagation, duplicate identifier conflict handling, and transactional state sync including self sync. These are data structure and execution correctness improvements; simulated voting is still not a production consensus backend.
