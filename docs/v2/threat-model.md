# QuDAG v2 targeted threat model and root cause repairs

Scope: changed crypto, local/asynchronous DAG admission, MCP authentication library and transport boundary, vault tools, and federation adapters. This is not a full audit of every workspace crate or deployed service. Baseline: `6c17c59`. Evidence commands and final results belong to the companion validation report.

## Assets and trust boundaries

Protect KEM secret keys and shared secrets, API credentials and sessions, DAG contents and ordering, member private keys and invitations, and the authority to publish or execute work. Untrusted boundaries include caller supplied encodings, network messages, remote MCP responses, Nostr events, credential submissions, and transitive dependencies. A retrieved event may contain hostile instructions even when its signature is valid.

## Root causes and repairs

| Root cause | Changed boundary | Evidence and remaining limitation |
| --- | --- | --- |
| Placeholder arithmetic was exported as ML-KEM | `core/crypto/src/ml_kem/mod.rs` delegates to RustCrypto 0.3.2; honors caller RNG; removes raw secret cache | 37 focused crypto tests reported; cross implementation tests are not a FIPS certificate or full side channel assessment |
| Compatibility signature method always returned true | `core/dag/src/lib.rs` fails unsigned method closed and provides explicit signed verification | Signature boundary tests reject forged and mutated messages; caller migration still matters |
| Local insertion minted unearned Final status | `core/dag/src/lib.rs` transactionally validates and inserts Pending vertices | Canonical topological order and exact tips tested; no authenticated distributed finality |
| Detached admission discarded errors and incomplete work | `core/dag/src/dag.rs` bounds work with a semaphore and awaits admission results | Full DAG library suite reports 49 passes; fault tolerant network consensus remains separate |
| Conflicts and sync were not tied to actual admitted state | Duplicate IDs are rejected; ordinary siblings are permitted; sync validates the union before mutation and handles self sync | Structural consistency is not durable consensus or a Byzantine proof |
| Nonempty credentials were treated as identity | `qudag-mcp/src/auth.rs` validates configured API credentials and rejects unavailable providers | Library authentication is tested; it does not independently supply remote middleware |
| Network server placeholders implied a protected service | `qudag-mcp/src/server.rs::MCPServer::new` explicitly disables network server modes until authentication middleware exists | Deliberate availability reduction prevents unsupported exposure; stdio remains a local trust boundary |
| Mock vault operations implied persistent storage | `qudag-mcp/src/tools/vault.rs` returns unavailable | Real persistent vault integration remains incomplete |
| Dynamic remote capabilities could expand authority | `integrations/ruflo-x` exposes three fixed reads and three exact resource URIs | Bounded parsing and endpoint policy; upstream Nostr verification is not independently reverified by this bridge |
| Gateway identity could be confused with member authority | Separate member adapter and explicit NIP 98/NIP 42 contract in ADR 204 | No live enrollment without invitation; secp256k1 member signatures are not post quantum |

## Residual risks and release gates

The RustSec snapshot at commit `b50980aad8b8f14f77e25a97b32dd94bf008b0af` still reports two vulnerabilities in `hickory-proto` 0.25.2 and ten unmaintained dependency warnings. RUSTSEC-2026-0118 concerns an unbounded DNSSEC proof traversal; RUSTSEC-2026-0119 concerns quadratic DNS message compression cost. Deployment exposure depends on the enabled features and reached code paths; the lockfile scan alone does not settle exploitability. Fix or document a defensible constrained deployment before a release readiness claim.

Full workspace release tests remain blocked by `qudag-exchange` test/benchmark API drift. RuFlo's earlier crypto scan returned zero findings despite the independently confirmed placeholder, showing why static scan output cannot replace semantic review. Simulated consensus votes, network authorization middleware, durable vault integration, distributed fault injection, and live member onboarding remain explicit gates.

Acceptance test: reproduce the focused suites and negative boundary cases, verify unsupported operations fail closed, then attempt the full workspace release gate and retain its actual result. A release cannot be called complete while that gate fails or a critical trust boundary remains simulated.
