# ADR 203: Reproducible validation and honest benchmarks

Date: 2026-09-10. Status: accepted policy; distributed qualification proposed.

## Decision

Every report records source SHA, dirty tree status, toolchain, dependency lock state, exact command, exit status, elapsed time, and environment limitations. Separate passed, failed, blocked, and not executed. A blocked build is not a passing security check. Save raw measurements with the benchmark rather than copying headline claims from README files.

## Required evidence layers

| Layer | Current increment acceptance | Later release qualification |
| --- | --- | --- |
| Cryptography | Backend interoperability; negative input and tampering tests; downstream roundtrip | Pinned known answer vectors; platform entropy and side channel review; key rotation drills |
| MCP bridge | Local end to end stdio process against controlled HTTP fixture; deny writes | Authenticated member identity only if writable federation is introduced |
| Live gateway | Initialize and open read smoke evidence | Availability and latency SLO from a separately approved measurement window |
| DAG | Report reachable compatibility and simulated paths | Authenticated votes, canonical ordering, crash recovery, fault injection |
| Supply chain | Resolve lockfile and inspect applicable advisories | Reproducible build, dependency update policy, provenance attestation |

## Benchmark protocol

Microbenchmarks report operation, iteration count, warmup, payload size, median, p95, p99, throughput, and sample distribution or raw timings. Keep setup separate from operation timing. For crypto include key generation, encapsulation, and decapsulation independently. For bridge tests distinguish local parsing overhead from simulated HTTP roundtrip. Do not describe local fixture latency as WAN performance.

A later distributed matrix uses 4, 7, and 16 validators; 256 byte, 1 KiB, and 16 KiB payloads; LAN and controlled WAN delays; and failure cases including one crashed node, equivocation within the specified fault bound, partition and recovery, replay, and malformed signatures. These sizes are proposed test inputs, not measured capacity. Record bandwidth, CPU, memory, commit p50/p95/p99, successful throughput, and divergence count.

Consensus safety requires zero conflicting finalized histories among honest replicas in the tested scenarios. This empirical gate supplements, not replaces, a protocol argument. Performance promotion requires identical security settings and no correctness regression. Any claimed improvement must exceed measured run to run variation across at least five independent runs.

## Acceptance

An independent reviewer can execute the exact validation commands from a clean checkout, reproduce the scope of each result, and identify every remaining release blocker without interpreting marketing language.
