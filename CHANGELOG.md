# Changelog

## qudag 2.0.0 and library crates 0.6.0 (2026-11-10)

This is the first crates.io release built from `main`. The previous releases (`qudag-*` 0.5.x, `qudag-exchange-core` 0.4.0, `qudag` 1.4.0, `qudag-wasm` 0.1.0, `qudag-exchange` 0.2.0) were published from commit `74577cd`, which is not on `main`. This release ships the RustSec dependency fixes from #33 and #35 to crates.io users.

| Crate | Previous on crates.io | Now |
|---|---|---|
| `qudag-crypto` | 0.5.1 | 0.6.0 |
| `qudag-dag` | 0.5.0 | 0.6.0 |
| `qudag-network` | 0.5.0 | 0.6.0 |
| `qudag-protocol` | 0.5.0 | 0.6.0 |
| `qudag-vault-core` | 0.5.1 | 0.6.0 |
| `qudag-exchange-core` | 0.4.0 | 0.6.0 |
| `qudag-mcp` | 0.5.0 | 0.6.0 |
| `qudag-cli` (binary `qudag`) | 0.5.0 | 0.6.0 |
| `qudag-wasm` | 0.1.0 | 0.6.0 |
| `qudag-exchange` | 0.2.0 | 0.6.0 |
| `qudag` | 1.4.0 | 2.0.0 |

`qudag` moves to 2.0.0, not 0.6.0. A 0.6.0 would sort below the existing 1.4.0, so `cargo add qudag` and `^1` requirements would never select it.

### Breaking changes compared with 0.5.x

- **libp2p 0.53 → 0.57 in the public API of `qudag-network`.** `connected_peers()`, `local_peer_id()`, `connect_peer()`, `get_connected_peers()`, `listeners()` and the public Kademlia structs return or contain `libp2p` 0.57 `PeerId` and `Multiaddr` values. Code that passes these values to its own `libp2p` 0.53 dependency must upgrade to `libp2p` 0.57. libp2p 0.57 requires Rust 1.88 or newer.
- **Crate graph moves together.** Every `qudag-*` crate now depends on the others at `0.6`. Types from 0.5.x crates (for example a `qudag-crypto` 0.5 key passed to `qudag-dag` 0.6) do not unify, so upgrade all `qudag-*` dependencies at once.
- **`qudag_dag::QrDag::verify_message` / `DAGConsensus::verify_message` is deprecated and always returns `false`.** It never checked a signature. Use `verify_signed_message` with an explicit ML-DSA signature. This is the only API-level change `cargo semver-checks` 0.51 reports against the published versions (all eleven crates were checked).
- **`qudag-protocol` no longer depends on `sqlx`.** No code used it. Downstream crates that relied on it arriving transitively must declare it themselves.
- **Package contents.** Each crate now ships only `src/`, `Cargo.toml` and `README.md`. Examples, tests, benches and stray build artifacts are no longer in the `.crate` files.

### Security

The dependency tree of every crate audits clean with `cargo audit`:

- RUSTSEC-2026-0118 and RUSTSEC-2026-0119 (hickory-proto) are fixed by libp2p 0.57, which brings hickory 0.26.
- RUSTSEC-2026-0459 (bundled SQLite in libsqlite3-sys) is fixed by removing `sqlx`.
- Resolved fresh today, the 0.5.x line still pulls in `ring` 0.16, `rustls` 0.21, `rustls-webpki` 0.101, `webpki-roots` 0.25, `h2` 0.3, `rsa`, `sqlx` 0.7 and hickory-proto 0.24/0.25, which is 14 open advisories. None of these are in the 0.6.0 dependency graph.

### Other

- crates.io metadata: homepage https://ruv.io; `qudag-vault-core` documentation link fixed to docs.rs/qudag-vault-core.
- README dependency snippets updated to the new versions.
