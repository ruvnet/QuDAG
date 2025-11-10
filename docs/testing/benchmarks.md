# QuDAG Performance Testing & Benchmarking Strategy

## Overview
This document details comprehensive performance benchmarking, regression detection, and load testing strategies for QuDAG's quantum-resistant cryptography, DAG consensus, networking, and WASM components.

## 1. Performance Benchmarks

### 1.1 Quantum Cryptography Benchmarks

#### ML-DSA Performance Targets
```rust
// core/crypto/benches/ml_dsa_performance.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use qudag_crypto::ml_dsa::*;
use rand::thread_rng;

fn ml_dsa_benchmarks(c: &mut Criterion) {
    let mut group = c.benchmark_group("ml-dsa");
    group.sample_size(100);
    group.measurement_time(std::time::Duration::from_secs(20));

    // Keypair generation benchmark
    group.bench_function("keypair_generation", |b| {
        let mut rng = thread_rng();
        b.iter(|| {
            MlDsaKeyPair::generate(&mut black_box(rng))
        });
    });

    // Signing benchmark with different message sizes
    for size in [32, 256, 1024, 65536].iter() {
        group.bench_with_input(
            BenchmarkId::new("sign", size),
            size,
            |b, &size| {
                let mut rng = thread_rng();
                let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
                let message = vec![0u8; size];

                b.iter(|| {
                    keypair.sign(black_box(&message), &mut black_box(rng))
                });
            },
        );
    }

    // Verification benchmark
    group.bench_function("verify", |b| {
        let mut rng = thread_rng();
        let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();
        let message = b"test message";
        let signature = keypair.sign(message, &mut rng).unwrap();
        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();

        b.iter(|| {
            public_key.verify(black_box(message), black_box(&signature))
        });
    });

    group.finish();
}

// Performance targets
const ML_DSA_KEYPAIR_GENERATION_TARGET_MS: f64 = 50.0;
const ML_DSA_SIGN_TARGET_MS: f64 = 5.0;
const ML_DSA_VERIFY_TARGET_MS: f64 = 2.0;

criterion_group!(benches, ml_dsa_benchmarks);
criterion_main!(benches);
```

#### ML-KEM Performance Targets
```rust
// core/crypto/benches/ml_kem_performance.rs
fn ml_kem_benchmarks(c: &mut Criterion) {
    let mut group = c.benchmark_group("ml-kem");
    group.sample_size(100);

    // Keypair generation
    group.bench_function("keypair_generation", |b| {
        let mut rng = thread_rng();
        b.iter(|| {
            MlKemKeyPair::generate(&mut black_box(rng))
        });
    });

    // Encapsulation
    group.bench_function("encapsulate", |b| {
        let mut rng = thread_rng();
        let keypair = MlKemKeyPair::generate(&mut rng).unwrap();

        b.iter(|| {
            MlKem::encapsulate(black_box(keypair.public_key()), &mut black_box(rng))
        });
    });

    // Decapsulation
    group.bench_function("decapsulate", |b| {
        let mut rng = thread_rng();
        let keypair = MlKemKeyPair::generate(&mut rng).unwrap();
        let (ciphertext, _) = MlKem::encapsulate(keypair.public_key(), &mut rng).unwrap();

        b.iter(|| {
            MlKem::decapsulate(black_box(keypair.secret_key()), black_box(&ciphertext))
        });
    });

    group.finish();
}

// Performance targets
const ML_KEM_KEYPAIR_GENERATION_TARGET_MS: f64 = 100.0;
const ML_KEM_ENCAPSULATE_TARGET_MS: f64 = 1.0;
const ML_KEM_DECAPSULATE_TARGET_MS: f64 = 1.5;
```

#### HQC Performance Targets
```rust
// core/crypto/benches/hqc_performance.rs
fn hqc_benchmarks(c: &mut Criterion) {
    let mut group = c.benchmark_group("hqc");

    group.bench_function("keypair_generation", |b| {
        let mut rng = thread_rng();
        b.iter(|| HQC::generate_keypair(&mut black_box(rng)));
    });

    for size in [256, 4096, 65536].iter() {
        group.bench_with_input(
            BenchmarkId::new("encrypt", size),
            size,
            |b, &size| {
                let mut rng = thread_rng();
                let (pk, _) = HQC::generate_keypair(&mut rng).unwrap();
                let plaintext = vec![0u8; size];

                b.iter(|| {
                    HQC::encrypt(&pk, black_box(&plaintext), &mut black_box(rng))
                });
            },
        );
    }

    group.bench_function("decrypt", |b| {
        let mut rng = thread_rng();
        let (pk, sk) = HQC::generate_keypair(&mut rng).unwrap();
        let plaintext = b"test message";
        let ciphertext = HQC::encrypt(&pk, plaintext, &mut rng).unwrap();

        b.iter(|| {
            HQC::decrypt(&sk, black_box(&ciphertext))
        });
    });

    group.finish();
}

// Performance targets
const HQC_KEYPAIR_GENERATION_TARGET_MS: f64 = 150.0;
const HQC_ENCRYPT_TARGET_MS: f64 = 10.0;
const HQC_DECRYPT_TARGET_MS: f64 = 5.0;
```

#### Fingerprinting Performance
```rust
// core/crypto/benches/fingerprint_performance.rs
fn fingerprint_benchmarks(c: &mut Criterion) {
    let mut group = c.benchmark_group("fingerprint");
    group.sample_size(1000);

    for size in [32, 256, 4096, 1048576].iter() {
        group.bench_with_input(
            BenchmarkId::new("generate", size),
            size,
            |b, &size| {
                let data = vec![0u8; size];
                b.iter(|| Fingerprint::generate(black_box(&data)));
            },
        );
    }

    group.bench_function("verify", |b| {
        let data = b"test data";
        let fp = Fingerprint::generate(data).unwrap();

        b.iter(|| {
            Fingerprint::verify(black_box(&fp), black_box(data))
        });
    });

    group.finish();
}

// Performance targets (per MB)
const FINGERPRINT_GENERATE_TARGET_MB_PER_MS: f64 = 500.0; // 500 MB/sec
const FINGERPRINT_VERIFY_TARGET_MB_PER_MS: f64 = 500.0;
```

### 1.2 DAG Consensus Benchmarks

```rust
// core/dag/benches/consensus_benchmarks.rs
fn dag_consensus_benchmarks(c: &mut Criterion) {
    let mut group = c.benchmark_group("consensus");
    group.sample_size(50);

    // Block creation
    group.bench_function("block_creation", |b| {
        b.iter(|| {
            Block::new()
                .with_timestamp(SystemTime::now())
                .with_data(black_box(b"test data"))
                .finalize()
        });
    });

    // Block validation
    group.bench_function("block_validation", |b| {
        let block = create_test_block();
        b.iter(|| {
            Validator::validate_block(black_box(&block))
        });
    });

    // Tip selection (important for DAG)
    group.bench_function("tip_selection", |b| {
        let dag = create_test_dag(1000); // 1000 blocks

        b.iter(|| {
            dag.select_tips(black_box(2))
        });
    });

    // Consensus round
    group.bench_function("avalanche_consensus_round", |b| {
        let validator = create_test_validator();
        let transactions = create_test_transactions(100);

        b.iter(|| {
            validator.consensus_round(black_box(&transactions))
        });
    });

    // Transaction validation
    group.bench_function("transaction_validation", |b| {
        let tx = create_test_transaction();
        b.iter(|| {
            Validator::validate_transaction(black_box(&tx))
        });
    });

    group.finish();
}

// Performance targets
const BLOCK_CREATION_TARGET_MS: f64 = 1.0;
const BLOCK_VALIDATION_TARGET_MS: f64 = 5.0;
const TIP_SELECTION_TARGET_MS: f64 = 10.0;
const CONSENSUS_ROUND_TARGET_MS: f64 = 50.0;
const TX_VALIDATION_TARGET_MS: f64 = 2.0;
```

### 1.3 Network Performance Benchmarks

```rust
// core/network/benches/network_benchmarks.rs
fn network_benchmarks(c: &mut Criterion) {
    let mut group = c.benchmark_group("network");
    group.sample_size(100);

    // Message serialization/deserialization
    group.bench_function("message_serialize", |b| {
        let msg = create_test_message();
        b.iter(|| {
            bincode::serialize(black_box(&msg))
        });
    });

    // Onion routing layer creation
    group.bench_function("onion_layer_creation", |b| {
        let keypair = generate_test_keypair();
        let message = b"test message";

        b.iter(|| {
            OnionLayer::create(
                black_box(&keypair.public_key),
                black_box(message)
            )
        });
    });

    // Dark domain resolution
    group.bench_function("dark_domain_resolution", |b| {
        let mut cache = create_test_cache();

        b.iter(|| {
            cache.resolve(black_box("test.dark"))
        });
    });

    // NAT traversal
    group.bench_function("nat_traversal_hole_punch", |b| {
        b.iter(|| {
            NatTraversal::punch_hole(black_box(&test_peer_id()))
        });
    });

    group.finish();
}

// Performance targets
const MESSAGE_SERIALIZE_TARGET_US: f64 = 100.0; // microseconds
const ONION_LAYER_TARGET_US: f64 = 500.0;
const DOMAIN_RESOLUTION_TARGET_MS: f64 = 5.0;
const NAT_PUNCH_TARGET_MS: f64 = 50.0;
```

### 1.4 WASM Performance Benchmarks

```javascript
// qudag-wasm/benchmarks/wasm_benchmarks.js
import { performance } from 'perf_hooks';
import * as wasm from './pkg-nodejs/index.js';

async function runWasmBenchmarks() {
  console.log('QuDAG WASM Performance Benchmarks\n');

  // Initialize WASM
  wasm.init_crypto();

  // ML-DSA benchmarks
  console.log('ML-DSA Benchmarks:');
  const mlDsaKeypair = wasm.generate_ml_dsa_keypair();
  const message = new Uint8Array(1024).fill(42);

  // Keypair generation
  let start = performance.now();
  for (let i = 0; i < 10; i++) {
    wasm.generate_ml_dsa_keypair();
  }
  const keygenTime = (performance.now() - start) / 10;
  console.log(`  Keypair generation: ${keygenTime.toFixed(2)}ms`);
  console.assert(keygenTime < 50, 'Keypair generation too slow');

  // Signing
  start = performance.now();
  const signIterations = 100;
  for (let i = 0; i < signIterations; i++) {
    wasm.ml_dsa_sign(mlDsaKeypair.secret_key, message);
  }
  const signTime = (performance.now() - start) / signIterations;
  console.log(`  Sign: ${signTime.toFixed(2)}ms`);
  console.assert(signTime < 5, 'Signing too slow');

  // Verification
  const signature = wasm.ml_dsa_sign(mlDsaKeypair.secret_key, message);
  start = performance.now();
  const verifyIterations = 1000;
  for (let i = 0; i < verifyIterations; i++) {
    wasm.ml_dsa_verify(mlDsaKeypair.public_key, message, signature);
  }
  const verifyTime = (performance.now() - start) / verifyIterations;
  console.log(`  Verify: ${verifyTime.toFixed(3)}ms`);
  console.assert(verifyTime < 2, 'Verification too slow');

  // ML-KEM benchmarks
  console.log('\nML-KEM Benchmarks:');
  const mlKemKeypair = wasm.generate_ml_kem_keypair();

  // Encapsulation
  start = performance.now();
  const encapIterations = 100;
  for (let i = 0; i < encapIterations; i++) {
    wasm.ml_kem_encapsulate(mlKemKeypair.public_key);
  }
  const encapTime = (performance.now() - start) / encapIterations;
  console.log(`  Encapsulate: ${encapTime.toFixed(2)}ms`);
  console.assert(encapTime < 1, 'Encapsulation too slow');

  // Decapsulation
  const { ciphertext } = wasm.ml_kem_encapsulate(mlKemKeypair.public_key);
  start = performance.now();
  const decapIterations = 100;
  for (let i = 0; i < decapIterations; i++) {
    wasm.ml_kem_decapsulate(mlKemKeypair.secret_key, ciphertext);
  }
  const decapTime = (performance.now() - start) / decapIterations;
  console.log(`  Decapsulate: ${decapTime.toFixed(2)}ms`);
  console.assert(decapTime < 1.5, 'Decapsulation too slow');
}

runWasmBenchmarks().catch(console.error);
```

## 2. Regression Detection Strategy

### 2.1 Baseline Establishment

```rust
// benchmarks/src/baseline.rs
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceBaseline {
    pub version: String,
    pub timestamp: String,
    pub benchmarks: HashMap<String, BenchmarkResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub name: String,
    pub mean_ns: u64,
    pub std_dev_ns: u64,
    pub median_ns: u64,
    pub p99_ns: u64,
}

pub fn establish_baseline() -> Result<PerformanceBaseline> {
    // Run all benchmarks and save baseline
    let results = run_all_benchmarks()?;

    let baseline = PerformanceBaseline {
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Local::now().to_rfc3339(),
        benchmarks: results,
    };

    // Save to file for future comparisons
    let json = serde_json::to_string_pretty(&baseline)?;
    std::fs::write("baseline.json", json)?;

    Ok(baseline)
}
```

### 2.2 Regression Detection

```rust
// benchmarks/src/regression.rs
pub fn detect_regressions(
    baseline: &PerformanceBaseline,
    current: &PerformanceBaseline,
) -> Vec<RegressionAlert> {
    let mut alerts = Vec::new();

    for (name, baseline_result) in &baseline.benchmarks {
        if let Some(current_result) = current.benchmarks.get(name) {
            let regression_percent = calculate_regression_percent(baseline_result, current_result);

            // Alert on > 10% regression
            if regression_percent > 10.0 {
                alerts.push(RegressionAlert {
                    benchmark: name.clone(),
                    baseline_ns: baseline_result.mean_ns,
                    current_ns: current_result.mean_ns,
                    regression_percent,
                    severity: if regression_percent > 50.0 {
                        Severity::Critical
                    } else if regression_percent > 25.0 {
                        Severity::High
                    } else {
                        Severity::Medium
                    },
                });
            }
        }
    }

    alerts
}

fn calculate_regression_percent(baseline: &BenchmarkResult, current: &BenchmarkResult) -> f64 {
    ((current.mean_ns as f64 - baseline.mean_ns as f64) / baseline.mean_ns as f64) * 100.0
}

#[derive(Debug)]
pub struct RegressionAlert {
    pub benchmark: String,
    pub baseline_ns: u64,
    pub current_ns: u64,
    pub regression_percent: f64,
    pub severity: Severity,
}

#[derive(Debug)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}
```

### 2.3 CI Pipeline Integration

```yaml
# .github/workflows/regression-detection.yml
name: Performance Regression Detection

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  regression-detection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main

      - name: Checkout base branch for comparison
        run: |
          git fetch origin ${{ github.base_ref }}:base_branch
          git checkout base_branch

      - name: Run benchmarks on base
        run: |
          cargo bench --workspace --features bench -- --output-format bencher | tee base_benchmarks.txt

      - name: Checkout PR branch
        run: |
          git checkout -

      - name: Run benchmarks on PR
        run: |
          cargo bench --workspace --features bench -- --output-format bencher | tee pr_benchmarks.txt

      - name: Detect regressions
        run: |
          cargo run --bin regression-detector -- \
            --baseline base_benchmarks.txt \
            --current pr_benchmarks.txt \
            --threshold 10 \
            --output regressions.json

      - name: Comment on PR if regressions found
        uses: actions/github-script@v6
        if: always()
        with:
          script: |
            const fs = require('fs');
            if (fs.existsSync('regressions.json')) {
              const regressions = JSON.parse(fs.readFileSync('regressions.json'));
              if (regressions.length > 0) {
                let comment = '## Performance Regressions Detected\n\n';
                comment += '| Benchmark | Baseline | Current | Change |\n';
                comment += '|-----------|----------|---------|--------|\n';
                for (const regression of regressions) {
                  const percent = regression.regression_percent.toFixed(1);
                  comment += `| ${regression.benchmark} | ${regression.baseline_ns}ns | ${regression.current_ns}ns | +${percent}% |\n`;
                }
                github.rest.issues.createComment({
                  issue_number: context.issue.number,
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  body: comment
                });
              }
            }
```

## 3. Load Testing Strategy

### 3.1 Load Testing Scenarios

```rust
// benchmarks/src/load_testing.rs
#[tokio::test(flavor = "multi_thread")]
async fn load_test_1m_nodes() {
    // Simulates network with 1M nodes
    let mut handles = Vec::new();

    for node_id in 0..1_000_000 {
        let handle = tokio::spawn(async move {
            simulate_node_operations(node_id).await
        });
        handles.push(handle);

        // Spawn nodes in batches to avoid resource exhaustion
        if node_id % 10_000 == 0 {
            let results: Vec<_> = handles.drain(..).collect();
            for result in results {
                result.await.expect("Node failed");
            }
        }
    }

    // Wait for remaining nodes
    for handle in handles {
        handle.await.expect("Node failed");
    }
}

async fn simulate_node_operations(node_id: u64) {
    // Each node generates keys
    let mut rng = rand::thread_rng();
    let keypair = MlDsaKeyPair::generate(&mut rng).expect("Keygen failed");

    // Each node signs transactions
    for i in 0..100 {
        let message = format!("tx-{}-{}", node_id, i);
        let signature = keypair.sign(message.as_bytes(), &mut rng)
            .expect("Sign failed");

        // Verify signature
        let public_key = MlDsaPublicKey::from_bytes(keypair.public_key())
            .expect("Key conversion failed");
        public_key.verify(message.as_bytes(), &signature)
            .expect("Verify failed");
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn load_test_consensus_network() {
    // Simulate consensus with multiple rounds
    const NUM_VALIDATORS: usize = 10_000;
    const NUM_ROUNDS: usize = 100;

    for round in 0..NUM_ROUNDS {
        let mut handles = Vec::new();

        for validator_id in 0..NUM_VALIDATORS {
            let handle = tokio::spawn(async move {
                simulate_validator_round(validator_id, round).await
            });
            handles.push(handle);
        }

        // Wait for all validators to complete round
        for handle in handles {
            handle.await.expect("Validator failed");
        }

        println!("Completed consensus round {} of {}", round + 1, NUM_ROUNDS);
    }
}

async fn simulate_validator_round(validator_id: usize, round: u64) {
    let mut rng = rand::thread_rng();
    let keypair = MlDsaKeyPair::generate(&mut rng).unwrap();

    // Validator participates in consensus
    let block_hash = format!("block-{}-{}", validator_id, round);
    let signature = keypair.sign(block_hash.as_bytes(), &mut rng).unwrap();

    // Verify own signature
    let public_key = MlDsaPublicKey::from_bytes(keypair.public_key()).unwrap();
    let _ = public_key.verify(block_hash.as_bytes(), &signature);
}
```

### 3.2 Stress Testing

```rust
// benchmarks/src/stress_testing.rs
#[test]
#[ignore] // Run manually with: cargo test -- --ignored stress_test
fn stress_test_concurrent_operations() {
    let num_threads = num_cpus::get() * 4; // 4x CPU count
    let iterations_per_thread = 100_000;

    let start = std::time::Instant::now();

    let handles: Vec<_> = (0..num_threads)
        .map(|_| {
            std::thread::spawn(|| {
                let mut rng = rand::thread_rng();

                for _ in 0..iterations_per_thread {
                    // Random crypto operations
                    match rand::random::<u32>() % 3 {
                        0 => {
                            // Key generation
                            let _ = MlDsaKeyPair::generate(&mut rng);
                        }
                        1 => {
                            // Signing
                            let kp = MlDsaKeyPair::generate(&mut rng).unwrap();
                            let msg = b"test";
                            let _ = kp.sign(msg, &mut rng);
                        }
                        _ => {
                            // ML-KEM
                            let _ = MlKemKeyPair::generate(&mut rng);
                        }
                    }
                }
            })
        })
        .collect();

    for handle in handles {
        handle.join().unwrap();
    }

    let elapsed = start.elapsed();
    let total_ops = num_threads * iterations_per_thread;
    let ops_per_sec = total_ops as f64 / elapsed.as_secs_f64();

    println!("Stress test completed in {:?}", elapsed);
    println!("Total operations: {}", total_ops);
    println!("Operations per second: {:.0}", ops_per_sec);

    // Ensure minimum throughput
    assert!(ops_per_sec > 1000.0, "Stress test throughput too low");
}
```

## 4. Performance Monitoring

### 4.1 Continuous Performance Tracking

```yaml
# .github/workflows/performance-tracking.yml
name: Performance Tracking

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC

jobs:
  performance-tracking:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run full benchmark suite
        run: |
          cargo bench --workspace --features bench -- --output-format bencher | tee benchmarks.txt

      - name: Store results
        run: |
          mkdir -p performance-data
          cp benchmarks.txt performance-data/${{ github.sha }}.txt
          git add performance-data
          git commit -m "Add performance data for ${{ github.sha }}"
          git push

      - name: Generate performance report
        run: |
          cat > PERFORMANCE.md << 'EOF'
          # Performance Report

          Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
          Commit: ${{ github.sha }}

          [Benchmark results will be inserted here]
          EOF

      - name: Upload performance artifacts
        uses: actions/upload-artifact@v3
        with:
          name: performance-data
          path: performance-data/
```

### 4.2 Memory Profiling

```bash
# scripts/profile-memory.sh
#!/bin/bash

echo "Memory profiling QuDAG components..."

# ML-DSA operations
echo "Profiling ML-DSA..."
valgrind --tool=massif --massif-out-file=ml-dsa.massif \
  cargo run --release -- crypto generate-ml-dsa-keypair

ms_print ml-dsa.massif > ml-dsa-memory.txt
echo "ML-DSA memory profile saved to ml-dsa-memory.txt"

# DAG operations
echo "Profiling DAG consensus..."
valgrind --tool=massif --massif-out-file=dag.massif \
  cargo run --release -- test dag-consensus

ms_print dag.massif > dag-memory.txt
echo "DAG memory profile saved to dag-memory.txt"

# Network operations
echo "Profiling network..."
valgrind --tool=massif --massif-out-file=network.massif \
  cargo run --release -- test network-operations

ms_print network.massif > network-memory.txt
echo "Network memory profile saved to network-memory.txt"

echo "Memory profiling complete!"
```

## 5. Performance Targets Summary

### Cryptographic Operations
| Operation | Target | Tolerance |
|-----------|--------|-----------|
| ML-DSA keypair generation | < 50ms | ±10% |
| ML-DSA sign | < 5ms | ±10% |
| ML-DSA verify | < 2ms | ±10% |
| ML-KEM keypair generation | < 100ms | ±10% |
| ML-KEM encapsulate | < 1ms | ±10% |
| ML-KEM decapsulate | < 1.5ms | ±10% |
| HQC keypair generation | < 150ms | ±15% |
| HQC encrypt (4KB) | < 10ms | ±15% |
| HQC decrypt (4KB) | < 5ms | ±15% |
| Fingerprint generation | > 500 MB/s | ±20% |

### DAG Consensus
| Operation | Target | Tolerance |
|-----------|--------|-----------|
| Block creation | < 1ms | ±10% |
| Block validation | < 5ms | ±10% |
| Tip selection | < 10ms | ±20% |
| Consensus round | < 50ms | ±20% |
| Transaction validation | < 2ms | ±15% |

### Network Operations
| Operation | Target | Tolerance |
|-----------|--------|-----------|
| Message serialization | < 100µs | ±20% |
| Onion layer creation | < 500µs | ±20% |
| Dark domain resolution | < 5ms | ±25% |
| NAT traversal | < 50ms | ±30% |

### WASM Operations
| Operation | Target | Platform |
|-----------|--------|----------|
| ML-DSA sign | < 10ms | Node.js, Browser |
| ML-DSA verify | < 5ms | Node.js, Browser |
| ML-KEM encapsulate | < 5ms | Node.js, Browser |
| ML-KEM decapsulate | < 5ms | Node.js, Browser |

## 6. Performance Testing Best Practices

### Benchmark Execution
- Run benchmarks in release mode (`--release`)
- Isolate benchmarks from other processes
- Use consistent hardware for comparisons
- Run benchmarks multiple times (100+ samples)
- Use statistical analysis (mean, median, p99)

### Regression Detection
- Alert on > 10% regression
- Critical alert on > 50% regression
- Review and document intentional regressions
- Run regression tests before releases

### Load Testing
- Test with realistic workloads
- Monitor resource usage (CPU, memory, disk)
- Test for resource leaks
- Document maximum capacity

### Continuous Monitoring
- Track performance trends over time
- Alert on anomalies
- Generate weekly performance reports
- Archive historical performance data
