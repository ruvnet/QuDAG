# QuDAG v2 validation and release gates

Status: engineering preview. The complete platform v2 request is not yet fulfilled.

The implemented boundaries pass focused validation. The repository as a whole does not pass release qualification. No release tag, live membership enrollment, federation publication, or production deployment was performed.

## Reproduce

```bash
scripts/validate-v2.sh --targeted --ruflo
scripts/validate-v2.sh --release
cd integrations/ruflo-x && npm run smoke
```

Use Node 22 or newer, current stable Rust, and native build prerequisites. `--ruflo` downloads the explicitly pinned `@claude-flow/cli@3.25.6` if absent. Full qualification additionally requires `cargo-audit 0.22.2` and access to its advisory database. The script prints its artifact directory. CI has independent focused, full workspace, and dependency audit jobs; no release failure is ignored.

## Observed results

| Boundary | Evidence | Result |
| --- | --- | --- |
| Crypto library and legacy KEM target | `cargo test --locked -p qudag-crypto --lib --test ml_kem_v2 --test ml_kem_tests` | 37 pass |
| Independent KEM interoperability | RustCrypto 0.3.2 and PQClean exchange in both directions | Pass; not FIPS certification |
| Local sync and async DAG library | `cargo test --locked -p qudag-dag --lib` | 49 pass |
| MCP library | `cargo test --locked -p qudag-mcp --lib` | 38 pass |
| Nostr member client | `npm test --prefix integrations/ruflo-nostr` | 7 pass, including offline WebSocket end to end |
| Nostr dependency audit | `npm audit --omit=dev --prefix integrations/ruflo-nostr` | Zero known vulnerabilities |
| Federation MCP client and stdio bridge | `node --test integrations/ruflo-x/test.mjs` | 10 pass |
| Live gateway initialization and identity | `integrations/ruflo-x/live-smoke.json` | Pass; no writes |
| Live gateway resources | `evidence/live-resources.json` | All three URI reads pass; no writes |
| RuFlo routing, coordination and scan | Pinned CLI route, hierarchical swarm init, scan, post-task outcome records | Executed; scanner missed baseline fake KEM |
| Whole workspace tests and benchmarks | `cargo test --locked --workspace --all-targets` | Fail: exchange test/benchmark missing dependencies and API drift |
| Historical full crypto integration targets | `cargo test -p qudag-crypto --tests --locked` | Fail: stale APIs, missing helpers/dependencies, incompatible test serialization |
| Dependency audit | `evidence/dependency-audit.json` | Fail: 2 vulnerability entries, 10 unmaintained warnings |
| Strict crypto and DAG lint | `cargo clippy -p qudag-crypto -p qudag-dag --lib --locked -- -D warnings` | Pass |
| Strict lint through MCP dependencies | `cargo clippy -p qudag-crypto -p qudag-dag -p qudag-mcp --lib --locked -- -D warnings` | Fail on 6 existing network lint/deprecation warnings |

Historical tests were repaired when their oracle contradicted intended semantics: local insertion now expects Pending, zero arrays are no longer labeled official NIST vectors, and ordinary shared-parent branches are not equivocation. No failing release tests were ignored or converted into passing security claims. The repaired tip property asserts exact equality against admitted edges.

Implemented-boundary total: 141 passing tests. Nostr fixture tests use ephemeral identities only. The member client supports explicit user-owned key creation, HTTP invite claims, canonical relay authentication, publication acknowledgments and verified reads. No invite or persistent live member key was supplied or generated in this session. Its replay cache is bounded and process-local; it does not authorize downstream work execution.

## Benchmarks

All numbers are local shared-container measurements, without CPU pinning. See JSON evidence for host, toolchain, backend, lockfile hash and measurement details. No before/after speedup claim is made against the placeholder implementation.

| Operation | Measured workload | Result |
| --- | --- | --- |
| ML-KEM key generation | 100 warmup + 1,000 fresh exchanges | Mean 45.628 us; p95 55.613 us |
| ML-KEM encapsulation | Same workload | Mean 43.934 us; p95 54.171 us |
| ML-KEM decapsulation | Every shared secret checked | Mean 56.942 us; p95 68.111 us |
| Local DAG chain admission | 10,000 vertices, 256-byte payloads | 13.017 ms total including input construction; admission p95 531 ns |
| Local topological ordering | Same 10,000-vertex chain | 9.417 ms; every parent precedence checked |
| JSON MCP roundtrip | 100 loopback HTTP fixture calls | p95 2.549 ms |
| SSE MCP roundtrip | 100 loopback HTTP fixture calls | p95 2.013 ms |
| Nostr event signing | Local pinned library | p95 3.19 ms |
| Nostr uncached verification | Fresh event copies | p95 1.96 ms |
| Nostr authentication and publication ACK | Loopback WebSocket fixture | p95 11.60 ms |

Local admission is not distributed consensus, and a microbenchmark is not constant-time or cryptographic security evidence.

## Security review outcome

The baseline exported fake KEM operations, secret caching, unconditional signature acceptance, caller-controlled authentication bypass, arbitrary-token acceptance and successful mock vault operations. These paths are corrected or fail closed. The network MCP server explicitly refuses startup because authentication middleware and real server transports are not connected. The local stdio bridge has a separate fixed read policy.

The dependency refresh removes five vulnerability entries and four unsoundness warnings from the observed baseline audit. Remaining hickory-proto 0.25.2 entries are RUSTSEC-2026-0118 and RUSTSEC-2026-0119. They are transitive networking dependencies, not fixed by the KEM rewrite. HQC and ML-DSA still depend on archived PQClean components. The ML-KEM PQClean dependency remains only for development interoperability within the crypto crate. See the audit evidence for all remaining packages and advisory database revision.

## Remaining release work

1. Repair every historical workspace test and benchmark target, preserving substantive assertions. The observed first full-workspace stop is exchange test dependencies (`rayon`, `rand`, `criterion`, `dashmap`, `lru`, `parking_lot`, `num_cpus`). Additional crypto integration targets already have independent failures. A green focused run cannot substitute for these targets.
2. Remove or migrate vulnerable DNS dependencies and replace or explicitly retire unmaintained cryptographic paths. No risk acceptance was granted in this task. Preserve interoperability and key migration evidence.
3. Specify and implement authenticated distributed consensus, durable replay protection, crash recovery and partition tests. The current local graph intentionally remains Pending and is not a production Byzantine consensus protocol.
4. Connect real persistent vault operations and network MCP authorization before enabling those serving modes. Local configuration is the only authority to disable authentication.
5. Complete live member enrollment only with an operator-supplied private invite and an explicitly selected member identity. The gateway owner key and admin token are not needed for member-owned signing. Secp256k1 authorship is classical, not post-quantum protection.

Rollback: remove MCP registration and stop member processes to disable federation integration. Do not restore placeholder cryptography or accept old placeholder keys; rotate invalid legacy keys. No live federation writes need reversal.

Acceptance: `scripts/validate-v2.sh --release` must pass, and a permitted member must complete invite claim, canonical relay authentication, signed publication acknowledgment and independently verified receipt before this work is described as complete end to end v2.
