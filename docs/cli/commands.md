# @qudag/cli Command Structure and Design

## Overview

The `@qudag/cli` package is designed as a modern, composable CLI for QuDAG operations that can be executed via `npx @qudag/cli` or as a globally installed tool. The CLI provides four core commands: `exec`, `optimize`, `analyze`, and `benchmark`, each with specialized workflows for DAG processing and performance analysis.

## Design Principles

1. **Composability**: Commands can be chained and piped for complex workflows
2. **Portability**: Works via npx without installation
3. **Modern UX**: Interactive mode with progress reporting, error recovery
4. **Data Flexibility**: Supports JSON, YAML, and binary formats
5. **Non-Interactive Mode**: Full scripting support for CI/CD pipelines
6. **Extensibility**: Plugin system for custom operations

## Global Options

All commands support the following global options:

```
--config <path>          Path to configuration file (optional)
--format <format>        Output format: json|yaml|text|binary (default: text)
--quiet                  Suppress all output except results
--verbose                Detailed logging output
--debug                  Enable debug mode with full traces
--no-color               Disable colored output
--output <path>          Save output to file (optional)
--timeout <ms>           Operation timeout in milliseconds
--profile <name>         Use named configuration profile
```

## Command: exec

Executes DAG operations and message processing on provided definitions.

### Purpose
- Execute DAG vertex processing
- Process message batches with quantum signatures
- Validate consensus states
- Generate consensus rounds
- Support for both single operations and batch execution

### Usage

```bash
# Basic execution
npx @qudag/cli exec --input dag-definition.json

# Interactive mode
npx @qudag/cli exec --input dag-definition.json --interactive

# Batch processing with output
npx @qudag/cli exec \
  --input batch-operations.yaml \
  --output results.json \
  --format json \
  --parallel 4

# Validate and execute with custom timeout
npx @qudag/cli exec \
  --input dag.json \
  --validate \
  --timeout 30000 \
  --verbose

# Stream processing mode (for large DAGs)
npx @qudag/cli exec \
  --input large-dag.binary \
  --stream \
  --chunk-size 1000

# Execute with specific profile
npx @qudag/cli exec \
  --input operations.json \
  --profile production
```

### Subcommands

#### exec vertex
Process individual DAG vertices with quantum signature validation.

```bash
npx @qudag/cli exec vertex \
  --data <vertex-data> \
  --parent-hash <hash1>,<hash2> \
  --signature <ml-dsa-signature> \
  --format json

# Validate vertex consensus state
npx @qudag/cli exec vertex validate \
  --vertex-file vertex.json \
  --check-signature \
  --check-parents
```

#### exec consensus
Execute consensus algorithm steps on DAG state.

```bash
npx @qudag/cli exec consensus \
  --dag-state dag-state.json \
  --round 42 \
  --byzantine-fault-tolerance 0.33

# Execute Byzantine fault-tolerant consensus
npx @qudag/cli exec consensus qr-avalanche \
  --dag-state state.json \
  --threshold 0.67 \
  --iterations 10
```

#### exec message
Process batch messages with ML-DSA signatures.

```bash
npx @qudag/cli exec message \
  --messages messages.jsonl \
  --operation sign|verify|encrypt|decrypt \
  --key-path ./keys/ml-dsa.key \
  --output signed-messages.jsonl

# Process streaming messages
cat message-stream.jsonl | npx @qudag/cli exec message \
  --operation sign \
  --key-path keys.key \
  --stream
```

#### exec transaction
Execute exchange transaction validation and finality.

```bash
npx @qudag/cli exec transaction \
  --transaction tx.json \
  --validate-signature \
  --check-balance \
  --format json

# Batch transaction processing
npx @qudag/cli exec transaction batch \
  --transactions tx-batch.json \
  --parallel 8 \
  --report-mode summary|detailed|failed-only
```

### Options

```
--input <path>           Input file path (required)
--input-format <fmt>     Auto-detect or specify: json|yaml|binary (auto-detect by default)
--output <path>          Output file path (optional, defaults to stdout)
--output-format <fmt>    Output format: json|yaml|text|binary
--validate               Validate inputs before execution
--parallel <n>           Number of parallel workers (default: 1)
--timeout <ms>           Operation timeout per item
--stream                 Stream processing mode for large inputs
--chunk-size <n>         Batch size for stream processing (default: 100)
--interactive            Interactive execution with prompts
--dry-run                Parse and validate without execution
--keep-temp              Keep temporary files for debugging
--profile <name>         Configuration profile to use
--continue-on-error      Continue processing on errors
--report-errors          Generate error report at end
```

### Output Formats

#### JSON Output
```json
{
  "operation": "exec",
  "command": "consensus",
  "status": "success",
  "timestamp": "2025-11-10T12:00:00Z",
  "duration_ms": 1234,
  "results": {
    "vertices_processed": 42,
    "consensus_achieved": true,
    "finality_height": 100,
    "warnings": []
  },
  "metadata": {
    "input_file": "dag-state.json",
    "profile": "default"
  }
}
```

#### YAML Output
```yaml
operation: exec
command: consensus
status: success
timestamp: '2025-11-10T12:00:00Z'
duration_ms: 1234
results:
  vertices_processed: 42
  consensus_achieved: true
  finality_height: 100
  warnings: []
metadata:
  input_file: dag-state.json
  profile: default
```

### Interactive Mode Features

When `--interactive` flag is used:
- Prompts for parameter confirmation
- Real-time progress visualization with `ora`
- Option to skip/retry failed operations
- Interactive error recovery with suggestions
- Colored output with status indicators
- Ability to save state and resume

## Command: optimize

Analyzes and optimizes DAG structure, consensus parameters, and network routing.

### Purpose
- DAG structure optimization (tip selection, vertex arrangement)
- Consensus parameter tuning
- Network routing optimization
- Resource utilization tuning
- Cost-benefit analysis

### Usage

```bash
# Analyze and optimize DAG structure
npx @qudag/cli optimize dag \
  --input dag-state.json \
  --output optimized-dag.json

# Optimize consensus parameters
npx @qudag/cli optimize consensus \
  --input dag-state.json \
  --current-threshold 0.67 \
  --simulate-impact

# Network routing optimization
npx @qudag/cli optimize routing \
  --network-topology peers.json \
  --target latency|throughput|resilience \
  --output optimized-routes.json

# Generate optimization report
npx @qudag/cli optimize report \
  --input dag-state.json \
  --detailed \
  --recommendations
```

### Subcommands

#### optimize dag
Optimize DAG structure for better consensus performance.

```bash
# Basic DAG optimization
npx @qudag/cli optimize dag \
  --input dag.json \
  --strategy fastest|balanced|resilient

# Aggressive optimization with simulation
npx @qudag/cli optimize dag \
  --input dag.json \
  --aggressive \
  --simulate \
  --iterations 1000

# Tip selection optimization
npx @qudag/cli optimize dag tips \
  --input dag.json \
  --algorithm weight-based|entropy-based|novelty-based
```

#### optimize consensus
Tune consensus algorithm parameters.

```bash
# Find optimal threshold
npx @qudag/cli optimize consensus threshold \
  --input dag-state.json \
  --min 0.5 \
  --max 0.9 \
  --step 0.05 \
  --metric finality-time

# Optimize finality delay
npx @qudag/cli optimize consensus finality \
  --input dag-state.json \
  --target-latency 150 \
  --safety-factor 2.0
```

#### optimize network
Optimize P2P network configuration.

```bash
# Optimize peer selection
npx @qudag/cli optimize network peers \
  --topology current-peers.json \
  --metric latency|bandwidth|resilience

# Optimize routing paths
npx @qudag/cli optimize network routes \
  --topology topology.json \
  --algorithm dijkstra|tabu-search
```

#### optimize cost
Analyze cost-benefit tradeoffs.

```bash
# Generate cost analysis
npx @qudag/cli optimize cost \
  --input dag-state.json \
  --resource-costs costs.yaml \
  --constraints constraints.json \
  --output cost-analysis.json
```

### Options

```
--input <path>           DAG state or configuration file (required)
--strategy <name>        Optimization strategy (default: balanced)
--simulate               Run simulation instead of actual optimization
--iterations <n>         Number of simulation iterations
--aggressive             More aggressive optimization (higher impact)
--metric <name>          Optimization metric to target
--constraints <path>     Constraints file (resource limits, etc)
--target <value>         Target value for metric
--min <value>            Minimum acceptable value
--max <value>            Maximum acceptable value
--step <value>           Step size for parameter tuning
--dry-run                Show optimizations without applying
--compare                Compare before/after metrics
--report                 Generate detailed optimization report
--output <path>          Save optimized configuration
```

### Output Example

```json
{
  "operation": "optimize",
  "command": "dag",
  "status": "success",
  "optimizations": {
    "tip_count_reduced": true,
    "previous_tip_count": 127,
    "optimized_tip_count": 42,
    "improvement": "67%"
  },
  "metrics": {
    "consensus_latency_ms": {
      "before": 450,
      "after": 280,
      "improvement_percent": 37.8
    },
    "throughput_tx_sec": {
      "before": 850,
      "after": 1240,
      "improvement_percent": 45.9
    }
  },
  "recommendations": [
    "Implement parent selection algorithm for 15% additional improvement",
    "Enable batch processing mode for 20% efficiency gain"
  ]
}
```

## Command: analyze

Provides comprehensive analysis of DAG metrics, consensus behavior, and network characteristics.

### Purpose
- Performance analysis and profiling
- Bottleneck identification
- Security analysis (timing attacks, fork detection)
- Network health assessment
- Consensus finality analysis

### Usage

```bash
# Full analysis report
npx @qudag/cli analyze dag \
  --input dag-state.json \
  --comprehensive

# Identify bottlenecks
npx @qudag/cli analyze bottlenecks \
  --input dag-state.json \
  --metrics consensus|throughput|latency

# Security analysis
npx @qudag/cli analyze security \
  --input dag-state.json \
  --check-timing-attacks \
  --check-fork-detection

# Network health analysis
npx @qudag/cli analyze network \
  --peers-data peers.json \
  --check-connectivity \
  --latency-threshold 200
```

### Subcommands

#### analyze dag
Comprehensive DAG analysis.

```bash
# Basic DAG metrics
npx @qudag/cli analyze dag \
  --input dag.json \
  --metrics all

# Focus on specific metrics
npx @qudag/cli analyze dag \
  --input dag.json \
  --metrics vertex-count|tip-count|consensus-rounds|finality

# Temporal analysis over time series data
npx @qudag/cli analyze dag timeline \
  --input dag-history.jsonl \
  --window-size 100 \
  --metric-interval 10
```

#### analyze consensus
Consensus algorithm behavior analysis.

```bash
# Analyze consensus rounds
npx @qudag/cli analyze consensus rounds \
  --input dag-state.json \
  --rounds 42 \
  --detailed

# Finality analysis
npx @qudag/cli analyze consensus finality \
  --input dag-state.json \
  --check-safety \
  --check-liveness
```

#### analyze security
Security and cryptographic analysis.

```bash
# Comprehensive security audit
npx @qudag/cli analyze security \
  --input dag-state.json \
  --full-audit

# Timing attack resistance
npx @qudag/cli analyze security timing \
  --samples 10000 \
  --operation sign|verify|encrypt

# Check quantum resistance
npx @qudag/cli analyze security quantum \
  --algorithms ml-kem|ml-dsa|hqc \
  --standards-check
```

#### analyze network
Network topology and health analysis.

```bash
# Network topology analysis
npx @qudag/cli analyze network topology \
  --peers peers.json \
  --visualize ascii

# Latency analysis
npx @qudag/cli analyze network latency \
  --peers peers.json \
  --percentiles 50,95,99
```

### Options

```
--input <path>           Input data file (required)
--metrics <list>         Specific metrics to analyze (comma-separated)
--comprehensive          Run all available analyses
--detailed               Include detailed breakdown
--temporal               Analyze temporal patterns if available
--visualize <format>     Visualization output: ascii|svg|html
--threshold <value>      Alert threshold for anomalies
--compare <path>         Compare with baseline
--output <path>          Save analysis report
--format <format>        json|yaml|html|markdown
```

### Analysis Output Structure

```json
{
  "operation": "analyze",
  "command": "dag",
  "timestamp": "2025-11-10T12:00:00Z",
  "duration_ms": 2345,
  "analysis": {
    "metrics": {
      "vertex_count": 1024,
      "edge_count": 2048,
      "tip_count": 48,
      "average_parents_per_vertex": 2.1,
      "longest_path": 42,
      "consensus_rounds_completed": 100
    },
    "health": {
      "status": "healthy",
      "consensus_finality": 0.98,
      "fork_probability": 0.001,
      "anomalies": []
    },
    "performance": {
      "throughput": {
        "current": 1200,
        "average": 1100,
        "peak": 1500,
        "unit": "tx/sec"
      },
      "latency": {
        "p50": 125,
        "p95": 280,
        "p99": 450,
        "unit": "ms"
      }
    }
  },
  "recommendations": [
    "DAG health is optimal",
    "Consider increasing peer count for better distribution"
  ],
  "alerts": []
}
```

## Command: benchmark

Performance benchmarking and comparative analysis.

### Purpose
- Cryptographic operation benchmarking (ML-KEM, ML-DSA, BLAKE3)
- DAG consensus performance measurement
- Network throughput and latency testing
- Comparative benchmarks against baselines
- Regression detection

### Usage

```bash
# Quick benchmark suite
npx @qudag/cli benchmark --quick

# Full benchmark with all tests
npx @qudag/cli benchmark --full

# Benchmark specific component
npx @qudag/cli benchmark crypto ml-kem
npx @qudag/cli benchmark consensus qr-avalanche
npx @qudag/cli benchmark network throughput

# Comparative benchmark against baseline
npx @qudag/cli benchmark --baseline baseline.json --compare

# Generate detailed performance report
npx @qudag/cli benchmark --full --report detailed
```

### Subcommands

#### benchmark crypto
Cryptographic primitive benchmarking.

```bash
# Benchmark all crypto operations
npx @qudag/cli benchmark crypto \
  --operations all \
  --iterations 10000

# Specific algorithm benchmarks
npx @qudag/cli benchmark crypto ml-kem \
  --test key-generation|encapsulation|decapsulation
  --iterations 1000

npx @qudag/cli benchmark crypto ml-dsa \
  --test signing|verification \
  --key-size 2048

# BLAKE3 hashing benchmarks
npx @qudag/cli benchmark crypto hash \
  --sizes 1KB,1MB,10MB \
  --iterations 1000
```

#### benchmark consensus
DAG consensus algorithm benchmarking.

```bash
# Benchmark QR-Avalanche algorithm
npx @qudag/cli benchmark consensus qr-avalanche \
  --vertex-count 1000 \
  --network-size 10 \
  --iterations 100

# Benchmark under Byzantine conditions
npx @qudag/cli benchmark consensus qr-avalanche \
  --vertex-count 1000 \
  --faulty-nodes 3 \
  --network-latency 100
```

#### benchmark network
Network performance benchmarking.

```bash
# Throughput test
npx @qudag/cli benchmark network throughput \
  --peers 10 \
  --message-size 1KB \
  --duration 60s

# Latency test
npx @qudag/cli benchmark network latency \
  --peers 10 \
  --samples 10000

# Onion routing performance
npx @qudag/cli benchmark network onion-routing \
  --hops 5 \
  --messages-per-sec 100 \
  --duration 60s
```

#### benchmark end-to-end
Full system end-to-end benchmarking.

```bash
# Comprehensive system benchmark
npx @qudag/cli benchmark e2e \
  --nodes 5 \
  --load steady|ramp|spike \
  --duration 300s

# Transaction throughput
npx @qudag/cli benchmark e2e transactions \
  --tx-rate 1000 \
  --duration 60s \
  --measure throughput|latency|finality
```

### Options

```
--quick                  Run quick benchmark suite (default)
--full                   Run comprehensive benchmarks
--iterations <n>         Number of iterations per test
--warmup <n>            Warm-up iterations before measuring
--samples <n>           Number of samples to collect
--baseline <path>        Baseline file for comparison
--compare                Compare against baseline
--threshold <percent>    Regression detection threshold
--cpu-affinity           Pin to specific CPU cores
--memory-limit <mb>      Limit memory usage
--timeout <ms>           Per-test timeout
--report <format>        json|markdown|csv|html
--output <path>          Save benchmark results
--graph                  Generate performance graphs
--parallel               Run independent benchmarks in parallel
```

### Benchmark Output Example

```json
{
  "operation": "benchmark",
  "command": "crypto",
  "timestamp": "2025-11-10T12:00:00Z",
  "system_info": {
    "cpu_model": "Intel Core i7",
    "cpu_cores": 8,
    "memory_gb": 16,
    "os": "Linux"
  },
  "results": {
    "ml_kem_768": {
      "key_generation": {
        "ops_per_sec": 516,
        "avg_time_ms": 1.94,
        "min_time_ms": 1.89,
        "max_time_ms": 2.01,
        "stddev_ms": 0.03
      },
      "encapsulation": {
        "ops_per_sec": 1124,
        "avg_time_ms": 0.89,
        "min_time_ms": 0.87,
        "max_time_ms": 0.91,
        "stddev_ms": 0.01
      }
    },
    "ml_dsa": {
      "signing": {
        "ops_per_sec": 562,
        "avg_time_ms": 1.78
      }
    }
  },
  "comparisons": {
    "vs_baseline": {
      "ml_kem_key_generation": {
        "baseline_ms": 1.85,
        "current_ms": 1.94,
        "regression_percent": 4.9,
        "status": "within_threshold"
      }
    }
  }
}
```

## Command Chaining and Piping

The CLI supports UNIX-style piping and composition:

```bash
# Chain multiple operations
npx @qudag/cli exec --input dag.json \
  | npx @qudag/cli analyze --input - \
  | npx @qudag/cli optimize --input - --output optimized.json

# Stream processing
cat large-dag.jsonl | npx @qudag/cli exec --input - --stream \
  | npx @qudag/cli analyze --input - \
  > analysis.json

# Benchmark and compare
npx @qudag/cli benchmark crypto --output baseline.json && \
npx @qudag/cli benchmark crypto --compare --baseline baseline.json
```

## Exit Codes

- `0`: Success
- `1`: General error
- `2`: Invalid arguments
- `3`: File not found
- `4`: Permission denied
- `5`: Timeout
- `6`: Format error
- `64`: Configuration error
- `128`: Internal error

## Error Handling

All commands implement consistent error handling:

```json
{
  "status": "error",
  "error": {
    "code": 1,
    "message": "Descriptive error message",
    "context": "Operation context",
    "suggestion": "Suggested fix or next step"
  },
  "details": {
    "file": "input.json",
    "line": 42,
    "column": 10
  }
}
```

## Progress Reporting

Interactive mode uses `ora` spinner for progress:

```
✔ Loading configuration (2s)
⠋ Processing vertices (35%)
  └─ 350/1000 vertices processed
  └─ Estimated time remaining: 45s
```

Non-interactive mode outputs minimal progress:

```
Processing: [====>  ] 42%
```

## Configuration Profiles

Commands support named profiles for different use cases:

```bash
npx @qudag/cli --profile production exec --input dag.json
npx @qudag/cli --profile development exec --input dag.json
npx @qudag/cli --profile testnet analyze --input dag-state.json
```

## Examples

### Example 1: DAG Execution Pipeline
```bash
# Execute, analyze, and optimize a DAG
npx @qudag/cli exec \
  --input production-dag.json \
  --output executed-dag.json \
  --format json && \

npx @qudag/cli analyze \
  --input executed-dag.json \
  --comprehensive \
  --output analysis-report.json && \

npx @qudag/cli optimize \
  --input executed-dag.json \
  --strategy balanced \
  --output optimized-dag.json
```

### Example 2: Performance Testing
```bash
# Run benchmarks and compare against baseline
npx @qudag/cli benchmark \
  --full \
  --baseline saved-baseline.json \
  --compare \
  --output benchmark-results.json \
  --report markdown > PERFORMANCE.md
```

### Example 3: Automated Analysis in CI/CD
```bash
# Analyze DAG and fail if health is poor
npx @qudag/cli analyze dag \
  --input dag-state.json \
  --format json | \
  node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    if (data.analysis.health.status !== 'healthy') {
      process.exit(1);
    }
  "
```

---

**Next Steps**: See [file-formats.md](file-formats.md) for detailed input/output format specifications and [configuration.md](configuration.md) for configuration file schemas.
