import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { VectorDb } = require('@ruvector/core');
const nativeModules = Object.keys(require.cache).filter(p => p.endsWith('.node') && /ruvector/.test(p));
if (!nativeModules.length) throw new Error('RuVector native binary was not loaded');
export const backend = Object.freeze({ name: '@ruvector/core', version: '0.1.32', binaryVersion: '0.1.30', native: true });

export class RuvectorIndex {
  #db; #directory; #metadata = new Map(); #pending = new Set(); #closed = false;
  constructor({ dimensions = 64, maxElements = 10000 } = {}) {
    if (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 65536) throw new RangeError('dimensions must be 1..65536');
    if (!Number.isSafeInteger(maxElements) || maxElements < 1) throw new RangeError('maxElements must be positive');
    Object.defineProperties(this, { dimensions: { value: dimensions, enumerable: true }, maxElements: { value: maxElements, enumerable: true } });
    this.#directory = mkdtempSync(join(tmpdir(), 'qudag-ruvector-'));
    try { this.#db = new VectorDb({ dimensions, distanceMetric: 'Cosine', storagePath: join(this.#directory, 'index') }); }
    catch (error) { rmSync(this.#directory, { recursive: true, force: true }); throw error; }
  }
  #vector(input) {
    if ((!Array.isArray(input) && !(input instanceof Float32Array) && !(input instanceof Float64Array)) || input.length !== this.dimensions) throw new RangeError('vector dimension mismatch');
    let norm = 0;
    for (const value of input) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('vector values must be finite numbers'); norm = Math.hypot(norm, value); }
    if (!Number.isFinite(norm) || norm === 0) throw new RangeError('vector norm must be finite and nonzero');
    return Float32Array.from(input, x => x / norm);
  }
  #open() { if (this.#closed) throw new Error('index is closed'); }
  async add({ id, vector, metadata = null }) {
    this.#open();
    if (typeof id !== 'string' || !id.length || Buffer.byteLength(id) > 1024) throw new TypeError('id must be a nonempty string of at most 1024 bytes');
    if (this.#metadata.has(id) || this.#pending.has(id)) throw new Error('duplicate id: entries are immutable');
    if (this.#metadata.size + this.#pending.size >= this.maxElements) throw new RangeError('index capacity exceeded');
    const normalized = this.#vector(vector), copy = structuredClone(metadata);
    this.#pending.add(id);
    try { await this.#db.insert({ id, vector: normalized }); this.#metadata.set(id, copy); return id; }
    finally { this.#pending.delete(id); }
  }
  async search(vector, k = 10) {
    this.#open();
    if (!Number.isSafeInteger(k) || k < 1 || k > this.maxElements) throw new RangeError('k must be 1..maxElements');
    const normalized = this.#vector(vector);
    if (!this.#metadata.size) return [];
    const results = await this.#db.search({ vector: normalized, k: Math.min(k, this.#metadata.size) });
    return results.map(({ id, score }) => ({ id, score, metadata: structuredClone(this.#metadata.get(id)) }));
  }
  stats() { return { ...backend, dimensions: this.dimensions, maxElements: this.maxElements, size: this.#metadata.size, pending: this.#pending.size, closed: this.#closed, metric: 'cosine-distance' }; }
  async close() { if (this.#pending.size) throw new Error('insertions are still pending'); if (this.#closed) return; this.#closed = true; if (typeof this.#db.close === 'function') await this.#db.close(); this.#db = null; this.#metadata.clear(); rmSync(this.#directory, { recursive: true, force: true }); }
}

// Deterministic lexical feature hashing, NOT learned semantic embeddings.
export function textEmbedding(text, dimensions = 64) {
  if (typeof text !== 'string' || text.length > 1000000) throw new TypeError('text must be a string of at most 1000000 characters');
  if (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 65536) throw new RangeError('dimensions must be 1..65536');
  const vector = new Float32Array(dimensions);
  const tokens = text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
  if (!tokens.length) throw new RangeError('text must contain lexical tokens');
  for (const token of tokens) { let hash = 2166136261; for (const c of Buffer.from(token)) hash = Math.imul(hash ^ c, 16777619) >>> 0; vector[hash % dimensions] += 1; }
  let norm = 0; for (const value of vector) norm = Math.hypot(norm, value);
  return vector.map(value => value / norm);
}
