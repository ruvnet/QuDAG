# QuDAG v2 research and implementation boundary

Research date: 2026-09-10. Reviewed baseline: `6c17c59`. This is a targeted engineering review, not a comprehensive security audit or a claim that the entire platform is production ready. Findings below refer to the baseline even when the accompanying change repairs them.

## Decision

Build v2 as gated increments: correct the exported cryptographic backend, local DAG admission and verification boundaries, and authentication library; disable simulated vault success; add a least privilege RuFlo federation observation bridge; retain explicit release blockers for authenticated consensus and distributed validation. Renaming the existing implementation cannot establish Byzantine fault tolerance.

## Source grounded findings

| Surface at baseline | Evidence | Consequence | Disposition |
| --- | --- | --- | --- |
| Public ML-KEM API | `core/crypto/src/lib.rs` exports `ml_kem::MlKem768`; `core/crypto/src/ml_kem/mod.rs::keygen_with_rng`, `encapsulate`, and `decapsulate` use placeholder arithmetic | Successful local roundtrips do not establish ML-KEM security | Backend correction in this increment; require interoperability tests |
| Secret retention | `core/crypto/src/ml_kem/mod.rs::KEY_CACHE` is a global `Mutex<HashMap<Vec<u8>, Vec<u8>>>` | Secret material has additional process lifetime copies | Remove cache instead of optimizing it |
| Signature verification facade | `core/dag/src/lib.rs::verify_message` returns `true` without verification | Public callers can mistake compatibility behavior for authentication | Companion change fails the compatibility method closed and adds a signed API; production callers still require migration |
| Finality facade | `core/dag/src/lib.rs::add_vertex` writes `ConsensusStatus::Final` before submitting to the underlying DAG | Local acceptance can be misrepresented as distributed finality | Corrected to transactional local Pending admission in this increment; distributed finality remains unimplemented |
| Ordering facade | `core/dag/src/lib.rs::get_total_order` sorts by timestamp | Timestamp ordering alone does not guarantee parent precedence or deterministic tie handling | Corrected with deterministic Kahn ordering and accurate tips; authenticated finality still requires a later backend |
| Consensus sampling | `core/dag/src/consensus.rs::simulate_participant_vote` derives a vote from identifier bytes | Simulation does not authenticate a remote participant vote | Keep simulation separate from production protocol |
| MCP authentication library | `qudag-mcp/src/auth.rs::AuthManager` accepted nonempty API, OAuth, and vault credentials at baseline; required authentication could be bypassed through the None method | Library callers can receive unauthorized sessions | Companion fix uses configured API credentials and rejects unsupported providers |
| Mock vault tools | `qudag-mcp/src/tools/vault.rs` exposed simulated vault operations | A successful mock response can be mistaken for persistent secure storage | Companion change returns unavailable until a persistent backend is connected |
| MCP server enforcement | `qudag-mcp/src/server.rs` does not wire `AuthManager` into request handling | Repairing the library alone does not secure the server transport | Network server modes now explicitly reject startup until real authentication middleware exists |
| Disabled optimization surface | `core/dag/src/optimized/validation_cache.rs::perform_validation` treats a nonempty signature as valid; `validate_parents` always returns true | Unsafe if enabled | Currently disabled by `core/dag/src/lib.rs`; do not report as an active network exploit |
| Disabled crypto optimization | `core/crypto/src/optimized/ml_kem_optimized.rs` contains placeholder operations | Optimization cannot be promoted by latency alone | Currently disabled by `core/crypto/src/lib.rs`; quarantine until semantic equivalence tests |

Reachability here means publicly exported source or a source call path, not proof that a deployed service exposes the method. Deployment reachability, all network authentication, persistence, and all cryptographic consumers remain to be mapped.

## Current primary research

### Post quantum cryptography

NIST finalized ML-KEM in FIPS 203 and ML-DSA in FIPS 204 on August 13, 2024. The FIPS 203 landing page now carries a November 17, 2025 errata planning note; FIPS 204 carries a July 31, 2026 note about minor issues. Track the linked errata during backend upgrades. This review verified the notices, not every spreadsheet correction. A crate using these algorithms is not automatically a FIPS validated module. [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final), [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final).

NIST SP 800-227 provides KEM usage guidance. Protocol authentication and key derivation require separate review from a KEM roundtrip. For v2, preserve standard encodings, reject malformed lengths, and test ciphertext tampering according to implicit rejection semantics: an altered well formed ciphertext may yield a different secret rather than an error. [SP 800-227](https://csrc.nist.gov/pubs/sp/800/227/final).

### DAG consensus

Mysticeti v6, revised November 24, 2025, describes an uncertified DAG construction with three message round consensus and a specialized fast commit path. Its authors report approximately 0.5 second WAN commits and over 200,000 transactions per second in their evaluated configuration. These are comparison targets, not transferable QuDAG measurements. The relevant design lesson is to reduce certification overhead while preserving an explicit commit rule and its safety proof. Integrating only a DAG data structure does not integrate this protocol. [Mysticeti paper](https://arxiv.org/abs/2310.14821v6).

Proposed investigation: implement a replaceable consensus backend boundary, then compare an established protocol against the current simulation using identical validator count, payload, network delay, signatures, and durability settings. A post quantum signature budget must be measured directly; classical signature benchmark results cannot be relabeled quantum resistant.

### MCP and x.ruv.io federation

The live `https://x.ruv.io/mcp` endpoint was initialized read only during this review. It reported gateway version `0.2.0` and protocol `2025-03-26`; its tool catalog distinguished open observation methods from administrator gated writes. The observed read methods were `federation_identity`, `federation_sync`, and `claims_status`. Tool descriptions claim verified coordination messages; the bridge does not independently verify Nostr signatures and must label this upstream trust dependency. [Endpoint](https://x.ruv.io/mcp).

The observed catalog also includes publishing, joining as the gateway, issuing and releasing claims, invite minting, admission, and budget consuming guidance. These are intentionally excluded from this increment's bridge. Observation is not federation membership, task assignment, quorum evidence, or consensus finality.

MCP transport requires careful JSON RPC lifecycle handling and supports JSON or event stream responses. Security guidance discusses confused deputy behavior, forbidden token passthrough, SSRF, session hijacking, and scope minimization. The resulting design is a fixed HTTPS destination, redirect rejection, bounded response handling, a static tool allowlist, and no gateway administrator credential. This is a scoped client adapter, not a general purpose OAuth proxy. [2025-03-26 transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports), [MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices).

### Latest RuV surfaces examined

RuFlo's current repository documents MCP based orchestration, federation, and MetaHarness readiness checks. Use it to coordinate bounded engineering tasks and retain validation outcomes. A harness readiness score is not a security certification or consensus proof. Pin the actual installed package version in execution evidence rather than using a changing `latest` command in CI. [RuFlo repository](https://github.com/ruvnet/ruflo).

RuVector's current capability map exposes vector retrieval, graph memory, RVF witnesses, and snapshots. Its documented boundaries explicitly include simulated replication transport and incomplete Raft transport/snapshot paths. Therefore, use retrieval for investigation and tamper evident records for evidence only after integration testing. Do not substitute these surfaces for validated Byzantine consensus. RVF witnesses do not encrypt data, and retrieval content remains untrusted input. No RuVector runtime dependency is added in this increment. [RuVector repository](https://github.com/ruvnet/RuVector).

## Delivery and evidence rules

The companion ADRs specify accepted architecture and proposed later stages. Implementation status must be read from the final validation report and actual source changes; an ADR does not assert a passing test. Live endpoint discovery verifies availability and schema only. Local mock tests prove adapter behavior under controlled responses. Local microbenchmarks do not establish federation WAN latency or DAG throughput.

Acceptance test: a clean checkout must reproduce the documented crypto tests and bridge tests, deny every nonallowlisted remote action, and report every unexecuted release gate explicitly.

Automated scan limitation: the execution coordinator reported that RuFlo's scan of `core/crypto` returned zero findings despite the exported placeholder KEM confirmed above. This is a demonstrated false negative for that scan scope, not evidence of clean cryptography. Preserve the raw scan result with execution evidence.

## Final reconciliation of implemented boundaries

The final production KEM backend is RustCrypto `ml-kem` 0.3.2 with zeroization and operating system entropy support. The supplied RNG path now consumes the caller RNG and propagates failure. PQClean remains a development only interoperability reference. See ADR 201 for the measured latency tradeoff.

The asynchronous DAG admission path now applies bounded semaphore backpressure, awaits admission errors, rejects duplicate identifiers rather than treating ordinary siblings as conflicts, and validates state sync transactionally over the union. Self sync returns without deadlocking. Local facade insertion stays Pending; passing these tests does not establish authenticated distributed finality. The final focused DAG run reported 49 passing library tests.

The read bridge exposes exactly `ruv://federation/registry`, `ruv://swarm/roster`, and `ruv://claims/board` in addition to its three read tools. The separate member protocol adapter is described in ADR 204. No real enrollment is claimed without a valid invitation and successful live member flow.

Dependency remediation reduced the recorded audit from seven vulnerabilities and four unsound warnings to two vulnerabilities and ten unmaintained warnings. The remaining vulnerability records concern `hickory-proto` 0.25.2: RUSTSEC-2026-0118 and RUSTSEC-2026-0119. This is not a clean dependency audit. The advisory snapshot had 1,243 advisories, commit `b50980aad8b8f14f77e25a97b32dd94bf008b0af`, updated 2026-09-09T12:49:52+02:00. Applicability must be checked against enabled features and deployed call paths before severity claims.

The full workspace release validation remains blocked by compilation failures in `qudag-exchange` tests and benchmarks with existing API drift. Focused passing suites cannot substitute for that release gate. Consult the final validation report for exact commands, output, and final counts; this research document does not promote failed or unexecuted checks.
