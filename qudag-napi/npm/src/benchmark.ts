#!/usr/bin/env node
/**
 * QuDAG Crypto Benchmark Suite
 *
 * Compares native vs WASM performance for quantum-resistant cryptography.
 */

import {
  init,
  runBenchmarkSuite,
  getRuntimeInfo,
  getPlatformInfo,
} from './index';
import { loadNativeModule, loadWasmModule, detectPlatform } from './loader';
import type { BenchmarkResult } from './types';

interface ComparisonResult {
  operation: string;
  nativeAvgNs: number;
  wasmAvgNs: number;
  speedup: number;
  nativeOpsPerSec: number;
  wasmOpsPerSec: number;
}

async function runComparison(iterations: number): Promise<void> {
  console.log('='.repeat(70));
  console.log('QuDAG Crypto Benchmark Suite');
  console.log('='.repeat(70));
  console.log();

  const platformInfo = detectPlatform();
  console.log(`Platform: ${platformInfo.platform}-${platformInfo.arch}`);
  if (platformInfo.libc) {
    console.log(`Libc: ${platformInfo.libc}`);
  }
  console.log(`Iterations: ${iterations}`);
  console.log();

  let nativeResults: BenchmarkResult[] | null = null;
  let wasmResults: BenchmarkResult[] | null = null;

  // Try native benchmarks
  console.log('-'.repeat(70));
  console.log('Native Module Benchmarks');
  console.log('-'.repeat(70));

  try {
    const nativeModule = await loadNativeModule(platformInfo);
    const nativeInfo = nativeModule.getRuntimeInfo();
    console.log(`Version: ${nativeInfo.version}`);
    console.log(`Running ${iterations} iterations...`);
    console.log();

    nativeResults = nativeModule.runBenchmarkSuite(iterations);
    printResults(nativeResults);
  } catch (error) {
    console.log(`Native module not available: ${error}`);
    console.log();
  }

  // Try WASM benchmarks
  console.log('-'.repeat(70));
  console.log('WASM Module Benchmarks');
  console.log('-'.repeat(70));

  try {
    const wasmModule = await loadWasmModule();
    const wasmInfo = wasmModule.getRuntimeInfo();
    console.log(`Version: ${wasmInfo.version}`);
    console.log(`Running ${iterations} iterations...`);
    console.log();

    wasmResults = wasmModule.runBenchmarkSuite(iterations);
    printResults(wasmResults);
  } catch (error) {
    console.log(`WASM module not available: ${error}`);
    console.log();
  }

  // Print comparison if both available
  if (nativeResults && wasmResults) {
    console.log('-'.repeat(70));
    console.log('Performance Comparison (Native vs WASM)');
    console.log('-'.repeat(70));
    console.log();

    const comparisons = compareResults(nativeResults, wasmResults);
    printComparison(comparisons);

    // Summary
    const avgSpeedup = comparisons.reduce((sum, c) => sum + c.speedup, 0) / comparisons.length;
    console.log();
    console.log(`Average speedup: ${avgSpeedup.toFixed(2)}x faster with native bindings`);
  }

  console.log();
  console.log('='.repeat(70));
  console.log('Benchmark complete');
  console.log('='.repeat(70));
}

function printResults(results: BenchmarkResult[]): void {
  console.log(
    'Operation'.padEnd(30) +
    'Avg (ns)'.padStart(15) +
    'Min (ns)'.padStart(15) +
    'Max (ns)'.padStart(15) +
    'Ops/sec'.padStart(15)
  );
  console.log('-'.repeat(90));

  for (const result of results) {
    console.log(
      result.operation.padEnd(30) +
      formatNumber(result.avgNs).padStart(15) +
      formatNumber(result.minNs).padStart(15) +
      formatNumber(result.maxNs).padStart(15) +
      formatNumber(result.opsPerSec).padStart(15)
    );
  }
  console.log();
}

function compareResults(
  nativeResults: BenchmarkResult[],
  wasmResults: BenchmarkResult[]
): ComparisonResult[] {
  const comparisons: ComparisonResult[] = [];

  for (const native of nativeResults) {
    const wasm = wasmResults.find(w => w.operation === native.operation);
    if (wasm) {
      comparisons.push({
        operation: native.operation,
        nativeAvgNs: native.avgNs,
        wasmAvgNs: wasm.avgNs,
        speedup: wasm.avgNs / native.avgNs,
        nativeOpsPerSec: native.opsPerSec,
        wasmOpsPerSec: wasm.opsPerSec,
      });
    }
  }

  return comparisons;
}

function printComparison(comparisons: ComparisonResult[]): void {
  console.log(
    'Operation'.padEnd(30) +
    'Native (ns)'.padStart(15) +
    'WASM (ns)'.padStart(15) +
    'Speedup'.padStart(12)
  );
  console.log('-'.repeat(72));

  for (const comp of comparisons) {
    const speedupStr = comp.speedup >= 1
      ? `${comp.speedup.toFixed(2)}x faster`
      : `${(1/comp.speedup).toFixed(2)}x slower`;

    console.log(
      comp.operation.padEnd(30) +
      formatNumber(comp.nativeAvgNs).padStart(15) +
      formatNumber(comp.wasmAvgNs).padStart(15) +
      speedupStr.padStart(12)
    );
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(2)}K`;
  }
  return n.toFixed(2);
}

// Main execution
async function main(): Promise<void> {
  const iterations = parseInt(process.argv[2] || '100', 10);

  if (isNaN(iterations) || iterations < 1) {
    console.error('Usage: benchmark [iterations]');
    console.error('  iterations: number of iterations (default: 100)');
    process.exit(1);
  }

  try {
    await runComparison(iterations);
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
