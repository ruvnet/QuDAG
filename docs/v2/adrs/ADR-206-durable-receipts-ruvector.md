# ADR 206: SQLite receipts with disposable native RuVector retrieval

Status: Accepted for the engineering preview, 2026-09-10.

Context: Process local replay windows do not survive restarts. A vector search database should not become the authority for source identity or permission. The RuVector native API differs from its published declaration: vectors must be Float32Array, and default storage can contaminate independent instances.

Decision: Store immutable receipt bodies and SHA256 digests in a private SQLite file with a primary key. Signed event IDs determine Nostr receipt identity. Gateway and board observations use content digests with source namespaces. Transactions enforce capacity and idempotence. Native @ruvector/core 0.1.32, backed by platform binary 0.1.30, provides a temporary derived index using private isolated storage. Rebuild from SQLite on startup; retain durable IDs without expiration. Require Node 24 and one process per ledger. Failed capacity does not discard replay history.

Consequences: Native retrieval is real but uses explicitly lexical feature hashing, not semantic learned embeddings. Benchmarks compare cosine ranking to an exact oracle and do not establish distributed throughput. Source documents remain local plaintext and require operator managed storage encryption when needed. The SQLite ledger provides local durable observation receipts, not replicated consensus, exactly once remote publication or QuDAG vertex admission.

Validation: Native ranking and storage isolation tests, process restart replay and retrieval tests, concurrent local ingestion, private file permissions and signed proof preservation. Native benchmark at 1,000 vectors, 64 dimensions and 100 queries achieved recall@10 1.0. Exact cosine search was faster at this small scale; no blanket speed claim is made.
