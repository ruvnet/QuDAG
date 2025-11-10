# @qudag/cli Configuration Guide

## Overview

The `@qudag/cli` package provides comprehensive configuration support for customizing behavior across all commands (exec, optimize, analyze, benchmark). Configuration can be specified via configuration files, command-line arguments, or environment variables, with flexible precedence rules.

## Configuration Methods

### 1. Configuration Files

Supported formats: JSON, YAML, TOML

#### Auto-discovery
The CLI searches for configuration files in this order:
```
1. --config <path>                 (explicit path)
2. .qudag-cli.json                 (current directory)
3. .qudag-cli.yaml                 (current directory)
4. .qudag-cli.toml                 (current directory)
5. ~/.qudag-cli/config.json        (home directory)
6. ~/.qudag-cli/config.yaml        (home directory)
7. /etc/qudag-cli/config.json      (system directory)
```

#### Configuration File Precedence

1. Command line arguments (highest priority)
2. Environment variables
3. Configuration file specified with --config
4. Auto-discovered configuration file
5. Default values (lowest priority)

### 2. Environment Variables

All configuration options can be set via environment variables with `QUDAG_CLI_` prefix:

```bash
# Global settings
export QUDAG_CLI_CONFIG=/path/to/config.json
export QUDAG_CLI_FORMAT=json
export QUDAG_CLI_PROFILE=production
export QUDAG_CLI_VERBOSE=true
export QUDAG_CLI_DEBUG=false
export QUDAG_CLI_TIMEOUT=30000
export QUDAG_CLI_OUTPUT=/tmp/results.json

# Command-specific settings
export QUDAG_CLI_EXEC_PARALLEL=8
export QUDAG_CLI_EXEC_VALIDATE=true
export QUDAG_CLI_ANALYZE_COMPREHENSIVE=true
export QUDAG_CLI_BENCHMARK_ITERATIONS=10000
```

## Configuration File Format

### JSON Configuration

```json
{
  "global": {
    "format": "json",
    "verbose": false,
    "debug": false,
    "quiet": false,
    "no_color": false,
    "timeout": 30000,
    "output_dir": "./output"
  },
  "profiles": {
    "default": {
      "parallel": 1,
      "continue_on_error": false,
      "keep_temp": false
    },
    "production": {
      "parallel": 8,
      "continue_on_error": false,
      "keep_temp": false,
      "timeout": 60000
    },
    "development": {
      "parallel": 1,
      "continue_on_error": true,
      "keep_temp": true,
      "verbose": true,
      "debug": true
    },
    "ci_cd": {
      "parallel": 4,
      "format": "json",
      "quiet": true,
      "timeout": 120000
    }
  },
  "exec": {
    "default_strategy": "balanced",
    "validate_on_start": true,
    "stream_enabled": false,
    "chunk_size": 100,
    "max_batch_size": 10000
  },
  "optimize": {
    "simulation_enabled": true,
    "default_strategy": "balanced",
    "max_iterations": 1000,
    "comparison_enabled": true,
    "report_detailed": true
  },
  "analyze": {
    "default_metrics": "all",
    "comprehensive_by_default": false,
    "temporal_analysis": true,
    "visualization_format": "ascii",
    "anomaly_threshold": 2.0
  },
  "benchmark": {
    "default_mode": "quick",
    "warmup_iterations": 100,
    "min_samples": 1000,
    "regression_threshold": 5.0,
    "graph_generation": false
  },
  "crypto": {
    "kem_algorithm": "ML-KEM-768",
    "signature_algorithm": "ML-DSA",
    "hash_algorithm": "BLAKE3"
  },
  "dag": {
    "consensus_algorithm": "qr-avalanche",
    "byzantine_fault_tolerance": 0.33,
    "consensus_threshold": 0.67,
    "finality_threshold": 0.9,
    "max_vertices": 100000
  },
  "network": {
    "bootstrap_nodes": [
      "node1.qudag.network:8000",
      "node2.qudag.network:8000"
    ],
    "default_peers": 50,
    "peer_discovery_enabled": true,
    "peer_discovery_interval": 300
  },
  "performance": {
    "worker_threads": 4,
    "max_memory_mb": 4096,
    "cache_enabled": true,
    "cache_size_mb": 512
  },
  "logging": {
    "level": "info",
    "format": "text",
    "output": "console",
    "file": "/var/log/qudag-cli.log",
    "file_rotation": "daily",
    "file_retention_days": 7
  },
  "security": {
    "enable_memory_protection": true,
    "enable_constant_time": true,
    "tls_enabled": false,
    "tls_verify": true
  }
}
```

### YAML Configuration

```yaml
global:
  format: json
  verbose: false
  debug: false
  quiet: false
  no_color: false
  timeout: 30000
  output_dir: ./output

profiles:
  default:
    parallel: 1
    continue_on_error: false
    keep_temp: false

  production:
    parallel: 8
    continue_on_error: false
    keep_temp: false
    timeout: 60000

  development:
    parallel: 1
    continue_on_error: true
    keep_temp: true
    verbose: true
    debug: true

  ci_cd:
    parallel: 4
    format: json
    quiet: true
    timeout: 120000

exec:
  default_strategy: balanced
  validate_on_start: true
  stream_enabled: false
  chunk_size: 100
  max_batch_size: 10000

optimize:
  simulation_enabled: true
  default_strategy: balanced
  max_iterations: 1000
  comparison_enabled: true
  report_detailed: true

analyze:
  default_metrics: all
  comprehensive_by_default: false
  temporal_analysis: true
  visualization_format: ascii
  anomaly_threshold: 2.0

benchmark:
  default_mode: quick
  warmup_iterations: 100
  min_samples: 1000
  regression_threshold: 5.0
  graph_generation: false

crypto:
  kem_algorithm: ML-KEM-768
  signature_algorithm: ML-DSA
  hash_algorithm: BLAKE3

dag:
  consensus_algorithm: qr-avalanche
  byzantine_fault_tolerance: 0.33
  consensus_threshold: 0.67
  finality_threshold: 0.9
  max_vertices: 100000

network:
  bootstrap_nodes:
    - node1.qudag.network:8000
    - node2.qudag.network:8000
  default_peers: 50
  peer_discovery_enabled: true
  peer_discovery_interval: 300

performance:
  worker_threads: 4
  max_memory_mb: 4096
  cache_enabled: true
  cache_size_mb: 512

logging:
  level: info
  format: text
  output: console
  file: /var/log/qudag-cli.log
  file_rotation: daily
  file_retention_days: 7

security:
  enable_memory_protection: true
  enable_constant_time: true
  tls_enabled: false
  tls_verify: true
```

### TOML Configuration

```toml
[global]
format = "json"
verbose = false
debug = false
quiet = false
no_color = false
timeout = 30000
output_dir = "./output"

[profiles.default]
parallel = 1
continue_on_error = false
keep_temp = false

[profiles.production]
parallel = 8
continue_on_error = false
keep_temp = false
timeout = 60000

[profiles.development]
parallel = 1
continue_on_error = true
keep_temp = true
verbose = true
debug = true

[profiles.ci_cd]
parallel = 4
format = "json"
quiet = true
timeout = 120000

[exec]
default_strategy = "balanced"
validate_on_start = true
stream_enabled = false
chunk_size = 100
max_batch_size = 10000

[optimize]
simulation_enabled = true
default_strategy = "balanced"
max_iterations = 1000
comparison_enabled = true
report_detailed = true

[analyze]
default_metrics = "all"
comprehensive_by_default = false
temporal_analysis = true
visualization_format = "ascii"
anomaly_threshold = 2.0

[benchmark]
default_mode = "quick"
warmup_iterations = 100
min_samples = 1000
regression_threshold = 5.0
graph_generation = false

[crypto]
kem_algorithm = "ML-KEM-768"
signature_algorithm = "ML-DSA"
hash_algorithm = "BLAKE3"

[dag]
consensus_algorithm = "qr-avalanche"
byzantine_fault_tolerance = 0.33
consensus_threshold = 0.67
finality_threshold = 0.9
max_vertices = 100000

[network]
bootstrap_nodes = [
    "node1.qudag.network:8000",
    "node2.qudag.network:8000"
]
default_peers = 50
peer_discovery_enabled = true
peer_discovery_interval = 300

[performance]
worker_threads = 4
max_memory_mb = 4096
cache_enabled = true
cache_size_mb = 512

[logging]
level = "info"
format = "text"
output = "console"
file = "/var/log/qudag-cli.log"
file_rotation = "daily"
file_retention_days = 7

[security]
enable_memory_protection = true
enable_constant_time = true
tls_enabled = false
tls_verify = true
```

## Configuration Profiles

Named profiles allow quick switching between different configurations:

```bash
# Use production profile
npx @qudag/cli --profile production exec --input dag.json

# Use development profile with extra verbosity
npx @qudag/cli --profile development exec --input dag.json --verbose

# Create custom profile
npx @qudag/cli config profile create staging \
  --parallel 6 \
  --timeout 45000 \
  --format json

# List available profiles
npx @qudag/cli config profile list
```

## Configuration Sections

### global
Global settings applied to all commands:
- `format`: Output format (json|yaml|text|binary)
- `verbose`: Verbose logging
- `debug`: Debug mode with full traces
- `quiet`: Suppress output except results
- `no_color`: Disable colored output
- `timeout`: Default timeout in milliseconds
- `output_dir`: Default output directory

### profiles
Named configuration profiles for different use cases. Each profile can override any setting.

### exec
Settings for the `exec` command:
- `default_strategy`: Default execution strategy
- `validate_on_start`: Validate inputs before execution
- `stream_enabled`: Enable streaming mode by default
- `chunk_size`: Default chunk size for streaming
- `max_batch_size`: Maximum batch size

### optimize
Settings for the `optimize` command:
- `simulation_enabled`: Run simulations by default
- `default_strategy`: Default optimization strategy
- `max_iterations`: Maximum simulation iterations
- `comparison_enabled`: Enable before/after comparison
- `report_detailed`: Generate detailed reports

### analyze
Settings for the `analyze` command:
- `default_metrics`: Metrics to analyze by default
- `comprehensive_by_default`: Run comprehensive analysis
- `temporal_analysis`: Enable temporal analysis
- `visualization_format`: Default visualization format
- `anomaly_threshold`: Threshold for anomaly detection (in sigma)

### benchmark
Settings for the `benchmark` command:
- `default_mode`: Default benchmark mode (quick|full)
- `warmup_iterations`: Number of warm-up iterations
- `min_samples`: Minimum samples to collect
- `regression_threshold`: Regression detection threshold (%)
- `graph_generation`: Generate performance graphs

### crypto
Cryptographic algorithm selection:
- `kem_algorithm`: Key encapsulation algorithm
- `signature_algorithm`: Digital signature algorithm
- `hash_algorithm`: Hash function algorithm

### dag
DAG consensus parameters:
- `consensus_algorithm`: Consensus algorithm to use
- `byzantine_fault_tolerance`: BFT threshold (default: 0.33)
- `consensus_threshold`: Minimum consensus threshold
- `finality_threshold`: Finality confirmation threshold
- `max_vertices`: Maximum vertices to process

### network
Network configuration:
- `bootstrap_nodes`: Initial peer addresses
- `default_peers`: Default number of peers to maintain
- `peer_discovery_enabled`: Enable peer discovery
- `peer_discovery_interval`: Peer discovery interval (seconds)

### performance
Performance tuning:
- `worker_threads`: Number of worker threads
- `max_memory_mb`: Maximum memory usage
- `cache_enabled`: Enable caching
- `cache_size_mb`: Cache size in MB

### logging
Logging configuration:
- `level`: Log level (debug|info|warn|error)
- `format`: Log format (text|json)
- `output`: Output destination (console|file|both)
- `file`: Log file path
- `file_rotation`: Log rotation policy (daily|size)
- `file_retention_days`: Log file retention days

### security
Security settings:
- `enable_memory_protection`: Zero memory on completion
- `enable_constant_time`: Use constant-time operations
- `tls_enabled`: Enable TLS for connections
- `tls_verify`: Verify TLS certificates

## Configuration Management Commands

```bash
# Show current configuration
npx @qudag/cli config show

# Show specific section
npx @qudag/cli config show --section exec

# Get specific setting
npx @qudag/cli config get exec.default_strategy

# Set configuration value
npx @qudag/cli config set exec.parallel 8

# Validate configuration file
npx @qudag/cli config validate --config ./config.json

# Initialize configuration with defaults
npx @qudag/cli config init

# Merge additional configuration
npx @qudag/cli config merge --config ./additional.json

# Export current configuration
npx @qudag/cli config export --output ./exported-config.json

# Import configuration
npx @qudag/cli config import --input ./new-config.json
```

## Security Considerations

1. **File Permissions**: Protect configuration files containing sensitive data
   ```bash
   chmod 600 ~/.qudag-cli/config.json
   ```

2. **Secrets Management**: Use environment variables for sensitive values
   ```bash
   export QUDAG_CLI_API_KEY=your_secret_key
   ```

3. **Memory Protection**: Enable memory protection for sensitive operations
   ```json
   {
     "security": {
       "enable_memory_protection": true,
       "enable_constant_time": true
     }
   }
   ```

4. **Audit Logging**: Enable audit logs for compliance
   ```json
   {
     "logging": {
       "level": "info",
       "file": "/var/log/qudag-cli-audit.log"
     }
   }
   ```

## Performance Optimization

```json
{
  "performance": {
    "worker_threads": 8,
    "max_memory_mb": 8192,
    "cache_enabled": true,
    "cache_size_mb": 1024
  }
}
```

For systems with specific hardware:
- **High-core count systems**: Increase `worker_threads`
- **Memory-constrained systems**: Reduce `cache_size_mb`
- **Network-heavy workloads**: Reduce `worker_threads`, increase connections

## Interactive vs Non-Interactive Mode

Configure default modes:

```json
{
  "exec": {
    "interactive_by_default": true,
    "confirm_on_error": true,
    "progress_reporting": "spinner"
  }
}
```

Override via CLI:
```bash
npx @qudag/cli exec --input dag.json --interactive
npx @qudag/cli exec --input dag.json --quiet  # Non-interactive
```

## Configuration Validation

Configuration files are validated against a JSON schema. View the schema:

```bash
npx @qudag/cli config schema --output schema.json
```

## Troubleshooting Configuration

```bash
# Debug configuration loading
npx @qudag/cli --debug config show

# Check configuration sources
npx @qudag/cli config info

# Verify configuration file syntax
npx @qudag/cli config validate --strict

# List all effective settings
npx @qudag/cli config list --all --include-defaults
```

---

**See Also**:
- [commands.md](commands.md) for command specifications
- [file-formats.md](file-formats.md) for input/output format specifications