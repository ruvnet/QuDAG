# @qudag/cli

Command-line interface for QuDAG quantum-resistant DAG operations.

## Features

- **Execute DAG Operations**: Process vertices, run consensus, handle messages and transactions
- **Optimize**: Analyze and optimize DAG structure, consensus parameters, and network configuration
- **Analyze**: Comprehensive analysis of DAG metrics, consensus behavior, and network health
- **Benchmark**: Performance benchmarking for cryptographic operations, consensus, and network

## Installation

### Global Installation

```bash
npm install -g @qudag/cli
qudag --help
```

### NPX (No Installation)

```bash
npx @qudag/cli --help
```

### Local Development

```bash
cd packages/cli
npm install
npm run build
npm link
```

## Usage

### Basic Commands

```bash
# Show help
qudag --help

# Execute DAG operations
qudag exec --input dag.json

# Optimize DAG structure
qudag optimize --input dag.json --output optimized.json

# Analyze DAG metrics
qudag analyze --input dag.json --comprehensive

# Run benchmarks
qudag benchmark --full --output results.json
```

### Global Options

All commands support the following global options:

```bash
--config <path>       Path to configuration file
--format <format>     Output format: json|yaml|text|binary
--profile <name>      Use named configuration profile
--verbose             Enable verbose logging
--debug               Enable debug mode
--quiet               Suppress output except results
--no-color            Disable colored output
--timeout <ms>        Operation timeout in milliseconds
--output <path>       Save output to file
```

## Commands

### exec

Execute DAG operations and message processing.

```bash
# Basic execution
qudag exec --input dag.json

# With validation
qudag exec --input dag.json --validate

# Stream processing
qudag exec --input large-dag.jsonl --stream --chunk-size 1000

# Dry run mode
qudag exec --input dag.json --dry-run
```

#### Subcommands

**exec vertex** - Process individual DAG vertices
```bash
qudag exec vertex --data <data> --parent-hash <hash> --signature <sig>
```

**exec consensus** - Execute consensus algorithm
```bash
qudag exec consensus --dag-state state.json --round 42
```

**exec message** - Process batch messages
```bash
qudag exec message --messages messages.jsonl --operation sign --key-path key.pem
```

**exec transaction** - Validate transactions
```bash
qudag exec transaction --transaction tx.json --validate-signature
```

### optimize

Analyze and optimize DAG structure and parameters.

```bash
# Optimize DAG structure
qudag optimize dag --input dag.json --strategy balanced

# Tune consensus parameters
qudag optimize consensus --input state.json --metric finality-time

# Optimize network topology
qudag optimize network --topology peers.json --metric latency

# Cost-benefit analysis
qudag optimize cost --input state.json --resource-costs costs.json
```

### analyze

Comprehensive analysis of DAG metrics and network.

```bash
# Full DAG analysis
qudag analyze dag --input dag.json --metrics all

# Consensus analysis
qudag analyze consensus --input state.json --rounds 100 --detailed

# Security audit
qudag analyze security --input state.json --full-audit

# Network health
qudag analyze network --peers peers.json --visualize ascii
```

### benchmark

Performance benchmarking and comparative analysis.

```bash
# Quick benchmark
qudag benchmark --quick

# Full benchmark suite
qudag benchmark --full --output results.json

# Crypto benchmarks
qudag benchmark crypto --operations all --iterations 10000

# Consensus benchmarks
qudag benchmark consensus --vertex-count 1000 --iterations 100

# Network benchmarks
qudag benchmark network --peers 10 --duration 60s

# End-to-end benchmarks
qudag benchmark e2e --nodes 5 --load steady --duration 300s
```

## Configuration

### Configuration Files

The CLI automatically searches for configuration files in:

1. `.qudag-cli.json` (current directory)
2. `.qudag-cli.yaml` (current directory)
3. `~/.qudag-cli/config.json` (home directory)
4. `/etc/qudag-cli/config.json` (system directory)

Example configuration (`.qudag-cli.json`):

```json
{
  "global": {
    "format": "json",
    "verbose": false,
    "timeout": 30000
  },
  "profiles": {
    "production": {
      "parallel": 8,
      "timeout": 60000,
      "quiet": true
    }
  },
  "exec": {
    "validate_on_start": true,
    "chunk_size": 100
  },
  "crypto": {
    "kem_algorithm": "ML-KEM-768",
    "signature_algorithm": "ML-DSA",
    "hash_algorithm": "BLAKE3"
  }
}
```

### Configuration Commands

```bash
# Show current configuration
qudag config show

# Show specific section
qudag config show --section exec

# Validate configuration
qudag config validate --config ./config.json
```

### Environment Variables

Override configuration with environment variables:

```bash
export QUDAG_CLI_FORMAT=json
export QUDAG_CLI_VERBOSE=true
export QUDAG_CLI_TIMEOUT=60000
export QUDAG_CLI_EXEC_PARALLEL=8
```

### Named Profiles

Use pre-configured profiles:

```bash
# Production profile (optimized, quiet)
qudag --profile production exec --input dag.json

# Development profile (verbose, keep temp files)
qudag --profile development exec --input dag.json

# CI/CD profile (JSON output, parallel processing)
qudag --profile ci_cd exec --input dag.json
```

## File Formats

### Supported Formats

- **JSON** - Human-readable, default format
- **YAML** - Configuration-friendly format
- **JSONL** - Line-delimited JSON for streaming
- **Binary** - Protocol Buffers for efficiency (80% size reduction)

### Format Detection

Formats are auto-detected by file extension:

- `.json` → JSON
- `.yaml`, `.yml` → YAML
- `.jsonl` → JSONL
- `.bin`, `.pb` → Binary (Protocol Buffers)

### Format Conversion

```bash
# Convert JSON to YAML
qudag exec --input dag.json --output-format yaml --output dag.yaml

# Convert to binary for efficiency
qudag exec --input dag.json --output-format binary --output dag.bin

# Convert binary back to JSON
qudag exec --input dag.bin --output-format json --output dag.json
```

## Examples

### Pipeline Workflow

```bash
# Execute, analyze, and optimize
qudag exec --input dag.json --output executed.json && \
qudag analyze --input executed.json --output analysis.json && \
qudag optimize --input executed.json --output optimized.json
```

### CI/CD Integration

```bash
# Run with CI/CD profile
qudag --profile ci_cd exec --input dag.json --format json --output exec.json

# Analyze and fail if health is poor
qudag --profile ci_cd analyze --input exec.json --format json | \
  jq -e '.analysis.health.status == "healthy"'
```

### Benchmark and Compare

```bash
# Run baseline benchmark
qudag benchmark --full --output baseline.json

# Make changes, run again, and compare
qudag benchmark --full --baseline baseline.json --compare
```

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Invalid arguments
- `3` - File not found
- `4` - Permission denied
- `5` - Timeout
- `6` - Format error
- `64` - Configuration error
- `128` - Internal error

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run test:watch
```

### Type Check

```bash
npm run typecheck
```

### Clean

```bash
npm run clean
```

## Integration with @qudag/napi-core

This CLI package is designed to integrate with `@qudag/napi-core` for quantum-resistant DAG operations:

```typescript
import { QuantumDAG } from '@qudag/napi-core';

// CLI internally uses napi-core for operations
const dag = new QuantumDAG();
// ... operations
```

## Documentation

For detailed documentation, see:

- [Commands Reference](/home/user/QuDAG/docs/cli/commands.md)
- [File Formats](/home/user/QuDAG/docs/cli/file-formats.md)
- [Configuration Guide](/home/user/QuDAG/docs/cli/configuration.md)
- [Quick Start](/home/user/QuDAG/docs/cli/quickstart.md)

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## Support

For issues and questions:
- GitHub Issues: https://github.com/ruvnet/QuDAG/issues
- Documentation: /home/user/QuDAG/docs/cli/

## Version

Current version: 0.1.0
