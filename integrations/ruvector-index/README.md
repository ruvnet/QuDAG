# QuDAG native RuVector index

Disposable native retrieval index for the federation gateway. The gateway's SQLite ledger remains the source of truth: rebuild this index from its persisted vectors after restart. It is not a consensus or authorization mechanism.

```sh
npm ci --ignore-scripts
npm test
npm run benchmark
```

```js
import { RuvectorIndex, textEmbedding } from './index.mjs';
const index = new RuvectorIndex({ dimensions: 64, maxElements: 10000 });
await index.add({ id: 'task:1', vector: textEmbedding('quantum relay'), metadata: { source: 'AgentBBS' } });
console.log(await index.search(textEmbedding('relay'), 5));
console.log(index.stats());
await index.close();
```

`search` returns `{id, score, metadata}`; score is **cosine distance**, lower is closer: 0 identical direction, 1 orthogonal, 2 opposite. Input vectors are normalized before conversion to native Float32. Finite nonzero vectors of exactly the configured dimension are required. IDs are immutable and duplicates reject, including concurrent insertions. Capacity and k are bounded. Metadata is cloned on both insertion and retrieval.

`textEmbedding` is deterministic normalized lexical feature hashing, not a learned semantic embedding. Hash collisions and lexical mismatch limit quality. Use a real embedding model consistently at ingest and query time when semantic matching matters. Index presence or similarity must never confer membership, trust, or permission.

The pinned JavaScript package is `@ruvector/core@0.1.32`; its published platform binary dependency is **0.1.30**. Startup verifies a native `.node` binding is loaded and fails if unavailable. No mock or JavaScript fallback is provided. The current native API requires `distanceMetric: 'Cosine'` and Float32Array despite broader published declarations.

The native default storage path persists in the working directory and can contaminate instances. Each adapter instead allocates an isolated private temporary directory. `close()` drops the reference and removes that directory; the current native API has no explicit close operation, so final native memory release relies on garbage collection. Process crashes may leave temporary directories. Applications should close cleanly and manage temporary storage retention.

## Measured scope

`benchmark-results.json` records an actual local run with 1,000 synthetic normalized vectors, 64 dimensions, 100 queries, and k=10. Recall is checked against a brute force exact cosine oracle. This run measured recall@10=1.0, approximately 11,286 inserts/s, and native query p95=0.76ms. The exact JavaScript oracle was faster at this small dataset (37ms total vs 57ms native); this is not a claim of native superiority or production scale. Timings vary by machine and approximate index construction. The benchmark fails below recall@10=0.8.
