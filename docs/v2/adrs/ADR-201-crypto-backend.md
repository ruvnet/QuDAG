# ADR 201: Correct the exported ML-KEM backend

Date: 2026-09-10. Status: implemented; qualification limits below.

## Context

The baseline `core/crypto/src/ml_kem/mod.rs` exports an API labeled ML-KEM while generating random key bytes and using placeholder arithmetic. Its global raw secret cache also duplicates sensitive material. Successful self roundtrips cannot distinguish a standardized KEM from an imitation.

## Decision

Use RustCrypto `ml-kem` 0.3.2 with `zeroize` and `getrandom` features as the production ML-KEM-768 backend. Retain `pqcrypto-mlkem` only as a development dependency for independent cross implementation interoperability. The source adapter preserves standard expanded key encodings and byte sizes, validates malformed encodings, removes the secret cache, and clears temporary seeds and shared secrets where owned by the wrapper.

`keygen_with_rng` consumes the supplied cryptographic RNG through fallible seed filling, propagates entropy failure, and supports reproducible seeded tests. Production `keygen` supplies `OsRng`. This is a real entropy boundary, not a compatibility argument that the backend ignores. See `core/crypto/src/ml_kem/mod.rs` and `core/crypto/Cargo.toml`.

Do not implement new lattice arithmetic or hybrid combiners in this increment. Keep the disabled `optimized` placeholder module unavailable. Track [FIPS 203 and errata](https://csrc.nist.gov/pubs/fips/203/final), [FIPS 204 and errata](https://csrc.nist.gov/pubs/fips/204/final), and [KEM guidance](https://csrc.nist.gov/pubs/sp/800/227/final) during dependency review. Backend source: [RustCrypto KEMs](https://github.com/RustCrypto/KEMs/tree/master/ml-kem).

## Validation and performance

The focused crypto validation reports 37 passing tests, including cross implementation behavior, malformed input, tampering, wrong keys, and caller RNG behavior. The final validation report owns exact commands and logs. Future qualification still requires pinned known answer vectors, platform entropy review, and backend specific side channel evidence. Test success is not FIPS module validation.

Observed RustCrypto operation timings were approximately 44.7 microseconds for key generation, 45.2 for encapsulation, and 56.6 for decapsulation. An earlier PQClean run was approximately 11, 11, and 15 microseconds respectively. These were not a controlled comparative experiment; they indicate a potential roughly fourfold operation cost to investigate, not a validated regression ratio or hardware independent claim. The decision prioritizes explicit caller entropy handling and secret lifetime control. Repeat paired benchmarks under identical build, hardware, warmup, and sampling conditions before choosing another backend for performance.

## Migration and rollback

Old placeholder keys are not standardized keys and require rotation. Never downgrade to legacy arithmetic for compatibility. Preserve wire version and key provenance during rotation. Removing the secret cache may increase repeated operation cost but removes additional process lifetime copies. Reverting the backend requires the same interoperability, entropy failure, and secret handling gates.
