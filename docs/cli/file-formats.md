# File Format Specifications for @qudag/cli

This document defines the input and output file formats supported by the @qudag/cli package.

## Supported Formats

The CLI supports four primary formats for data interchange:

1. **JSON** - Human-readable, structured data format
2. **YAML** - Configuration-friendly format with reduced syntax
3. **Binary** - Compact, efficient binary format (Protocol Buffers)
4. **JSONL** - Line-delimited JSON for streaming data

## Format Detection

The CLI automatically detects input formats based on file extensions:

```
*.json     → JSON format
*.jsonl    → JSONL format (line-delimited JSON)
*.yaml     → YAML format
*.yml      → YAML format
*.bin      → Binary format
*.pb       → Protocol Buffer format
```

Override with `--input-format <format>` flag if needed.

## Core Data Types

All formats serialize the following core types:

### DAG Definition

Describes a Directed Acyclic Graph structure with vertices and edges.

#### JSON Format
```json
{
  "version": "1.0",
  "dag_id": "test-dag-001",
  "created_at": "2025-11-10T12:00:00Z",
  "metadata": {
    "description": "Test DAG for consensus analysis",
    "tags": ["testing", "consensus"],
    "author": "test-user"
  },
  "vertices": [
    {
      "id": "vertex-0",
      "timestamp": "2025-11-10T12:00:00Z",
      "data": "SGVsbG8gV29ybGQ=",
      "data_encoding": "base64",
      "parents": [],
      "quantum_fingerprint": "a1b2c3d4e5f6...",
      "ml_dsa_signature": "ml_dsa_sig_bytes_base64",
      "consensus_data": {
        "round": 0,
        "finalized": false
      }
    },
    {
      "id": "vertex-1",
      "timestamp": "2025-11-10T12:00:01Z",
      "data": "QmF0Y2ggZGF0YQ==",
      "data_encoding": "base64",
      "parents": ["vertex-0"],
      "quantum_fingerprint": "b2c3d4e5f6a7...",
      "ml_dsa_signature": "ml_dsa_sig_bytes_base64",
      "consensus_data": {
        "round": 1,
        "finalized": true
      }
    }
  ],
  "edges": [
    {
      "from": "vertex-0",
      "to": "vertex-1",
      "weight": 1.0,
      "type": "parent-child"
    }
  ],
  "consensus_state": {
    "algorithm": "qr-avalanche",
    "current_round": 42,
    "finality_height": 40,
    "byzantine_fault_tolerance": 0.33
  }
}
```

#### YAML Format
```yaml
version: "1.0"
dag_id: test-dag-001
created_at: 2025-11-10T12:00:00Z
metadata:
  description: Test DAG for consensus analysis
  tags:
    - testing
    - consensus
  author: test-user

vertices:
  - id: vertex-0
    timestamp: 2025-11-10T12:00:00Z
    data: "SGVsbG8gV29ybGQ="
    data_encoding: base64
    parents: []
    quantum_fingerprint: a1b2c3d4e5f6...
    ml_dsa_signature: ml_dsa_sig_bytes_base64
    consensus_data:
      round: 0
      finalized: false

  - id: vertex-1
    timestamp: 2025-11-10T12:00:01Z
    data: "QmF0Y2ggZGF0YQ=="
    data_encoding: base64
    parents:
      - vertex-0
    quantum_fingerprint: b2c3d4e5f6a7...
    ml_dsa_signature: ml_dsa_sig_bytes_base64
    consensus_data:
      round: 1
      finalized: true

edges:
  - from: vertex-0
    to: vertex-1
    weight: 1.0
    type: parent-child

consensus_state:
  algorithm: qr-avalanche
  current_round: 42
  finality_height: 40
  byzantine_fault_tolerance: 0.33
```

#### Binary Format (Protocol Buffers)

```protobuf
syntax = "proto3";

package qudag.cli;

message DagDefinition {
  string version = 1;
  string dag_id = 2;
  string created_at = 3;
  Metadata metadata = 4;
  repeated Vertex vertices = 5;
  repeated Edge edges = 6;
  ConsensusState consensus_state = 7;
}

message Vertex {
  string id = 1;
  string timestamp = 2;
  bytes data = 3;
  string data_encoding = 4;
  repeated string parents = 5;
  string quantum_fingerprint = 6;
  string ml_dsa_signature = 7;
  VertexConsensusData consensus_data = 8;
}

message Edge {
  string from = 1;
  string to = 2;
  float weight = 3;
  string type = 4;
}

message ConsensusState {
  string algorithm = 1;
  int32 current_round = 2;
  int32 finality_height = 3;
  double byzantine_fault_tolerance = 4;
}

message VertexConsensusData {
  int32 round = 1;
  bool finalized = 2;
}

message Metadata {
  string description = 1;
  repeated string tags = 2;
  string author = 3;
}
```

### Message Batch Format

For batch message processing (JSONL):

```jsonl
{"id": "msg-0", "type": "sign", "payload": "SGVsbG8=", "key_id": "key-1"}
{"id": "msg-1", "type": "sign", "payload": "V29ybGQ=", "key_id": "key-1"}
{"id": "msg-2", "type": "verify", "signature": "...", "key_id": "key-1"}
{"id": "msg-3", "type": "encrypt", "plaintext": "...", "recipient": "alice"}
```

### Transaction Format

Exchange transaction format:

#### JSON
```json
{
  "id": "tx-001",
  "timestamp": "2025-11-10T12:00:00Z",
  "type": "transfer",
  "from": "alice",
  "to": "bob",
  "amount": 1000,
  "currency": "rUv",
  "fee": 2.5,
  "ml_dsa_signature": "signature_base64",
  "status": "pending",
  "metadata": {
    "reason": "payment",
    "reference": "INV-123"
  }
}
```

### Operation Result Format

Standard response format for all operations:

#### JSON Response
```json
{
  "operation": "exec|analyze|optimize|benchmark",
  "command": "vertex|consensus|dag|crypto",
  "status": "success|error|partial",
  "timestamp": "2025-11-10T12:00:00Z",
  "duration_ms": 1234,
  "version": "1.0",
  "results": {
    "key": "value",
    "nested": {
      "data": "structure"
    }
  },
  "warnings": [],
  "errors": [],
  "metadata": {
    "input_file": "dag.json",
    "output_file": "results.json",
    "profile": "production",
    "system_info": {
      "cpu_cores": 8,
      "memory_gb": 16,
      "node_id": "node-001"
    }
  }
}
```

#### YAML Response
```yaml
operation: exec
command: consensus
status: success
timestamp: 2025-11-10T12:00:00Z
duration_ms: 1234
version: '1.0'
results:
  consensus_achieved: true
  finality_height: 100
  vertices_processed: 42
warnings: []
errors: []
metadata:
  input_file: dag.json
  output_file: results.json
  profile: production
  system_info:
    cpu_cores: 8
    memory_gb: 16
    node_id: node-001
```

## Streaming Format (JSONL)

For streaming large datasets, use JSONL format (one JSON object per line):

```jsonl
{"index": 0, "vertex_id": "v0", "timestamp": "2025-11-10T12:00:00Z", "data": "..."}
{"index": 1, "vertex_id": "v1", "timestamp": "2025-11-10T12:00:01Z", "data": "..."}
{"index": 2, "vertex_id": "v2", "timestamp": "2025-11-10T12:00:02Z", "data": "..."}
```

Each line must be a complete JSON object. No streaming arrays or multiline objects.

## Configuration File Format

### JSON Configuration
```json
{
  "profiles": {
    "default": {
      "timeout": 30000,
      "parallel": 1,
      "output_format": "json",
      "verbose": false
    },
    "production": {
      "timeout": 60000,
      "parallel": 8,
      "output_format": "json",
      "verbose": false,
      "continue_on_error": true
    },
    "development": {
      "timeout": 120000,
      "parallel": 1,
      "output_format": "text",
      "verbose": true,
      "debug": true
    }
  },
  "dag": {
    "consensus_algorithm": "qr-avalanche",
    "byzantine_fault_tolerance": 0.33,
    "max_vertices": 100000,
    "finality_threshold": 0.67
  },
  "network": {
    "default_peers": 50,
    "bootstrap_nodes": [
      "node1.qudag.network:8000",
      "node2.qudag.network:8000"
    ]
  },
  "crypto": {
    "kem_algorithm": "ml-kem-768",
    "signature_algorithm": "ml-dsa",
    "hash_algorithm": "blake3"
  }
}
```

### YAML Configuration
```yaml
profiles:
  default:
    timeout: 30000
    parallel: 1
    output_format: json
    verbose: false

  production:
    timeout: 60000
    parallel: 8
    output_format: json
    verbose: false
    continue_on_error: true

  development:
    timeout: 120000
    parallel: 1
    output_format: text
    verbose: true
    debug: true

dag:
  consensus_algorithm: qr-avalanche
  byzantine_fault_tolerance: 0.33
  max_vertices: 100000
  finality_threshold: 0.67

network:
  default_peers: 50
  bootstrap_nodes:
    - node1.qudag.network:8000
    - node2.qudag.network:8000

crypto:
  kem_algorithm: ml-kem-768
  signature_algorithm: ml-dsa
  hash_algorithm: blake3
```

## Data Encoding

### Binary Data in Text Formats

Binary data (signatures, fingerprints, encrypted data) is encoded as:
- **Base64** for JSON and YAML formats
- **Hex strings** as alternative (with `encoding: "hex"` hint)
- **Raw bytes** in binary format

Example in JSON:
```json
{
  "ml_dsa_signature": "aGVsbG8gd29ybGQgdGhpcyBpcyBhIHNpZ25hdHVyZQ==",
  "encoding": "base64"
}
```

### Size Conventions

For numeric sizes:
- **Bytes**: `1B`, `100B`, `1KB`, `1MB`, `1GB`
- **Time**: `100ms`, `1s`, `1m`, `1h`
- **Percentage**: `0.5%`, `50%`, `99.9%`

## Validation Schemas

### DAG Definition Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "QuDAG Definition",
  "type": "object",
  "required": ["version", "dag_id", "vertices"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+$"
    },
    "dag_id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256
    },
    "vertices": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "timestamp"],
        "properties": {
          "id": {"type": "string"},
          "timestamp": {"type": "string", "format": "date-time"},
          "parents": {
            "type": "array",
            "items": {"type": "string"}
          }
        }
      }
    }
  }
}
```

## Format Conversion

The CLI can convert between formats:

```bash
# Convert JSON to YAML
npx @qudag/cli exec \
  --input dag.json \
  --input-format json \
  --output-format yaml \
  --output dag.yaml

# Convert YAML to binary
npx @qudag/cli optimize \
  --input config.yaml \
  --input-format yaml \
  --output-format binary \
  --output config.bin

# Convert binary to JSON
npx @qudag/cli analyze \
  --input data.bin \
  --input-format binary \
  --output-format json \
  --output data.json
```

## Performance Considerations

### Format Overhead

Comparison of format sizes and parsing speed:

| Format | Size | Speed | Streaming | Human-Readable |
|--------|------|-------|-----------|-----------------|
| JSON | ~100% | Medium | No | Yes |
| YAML | ~80% | Slow | No | Yes |
| Binary | ~20% | Fast | Yes | No |
| JSONL | ~100% | Medium | Yes | Partial |

### Recommendations

- **Development**: Use JSON for clarity and debugging
- **Production**: Use binary for performance and size
- **Streaming**: Use JSONL for large datasets
- **Configuration**: Use YAML for readability
- **CI/CD**: Use JSON for portability

## Error Handling in Formats

When operations produce errors or warnings:

### JSON Error Format
```json
{
  "status": "error",
  "error": {
    "code": 1,
    "message": "Invalid vertex format",
    "context": "Processing vertex-42",
    "suggestion": "Check vertex schema at line 150"
  },
  "partial_results": {
    "processed": 41,
    "total": 100
  }
}
```

### YAML Error Format
```yaml
status: error
error:
  code: 1
  message: Invalid vertex format
  context: Processing vertex-42
  suggestion: Check vertex schema at line 150
partial_results:
  processed: 41
  total: 100
```

## Extensibility

Support for custom formats via plugins:

```bash
# Register custom format handler
npx @qudag/cli format register \
  --format msgpack \
  --handler ./handlers/msgpack-handler.js

# Use custom format
npx @qudag/cli exec \
  --input data.msgpack \
  --input-format msgpack \
  --output-format msgpack
```

## Backward Compatibility

Version negotiation for format compatibility:

```json
{
  "format_version": "1.0",
  "compatibility": {
    "min_version": "0.9",
    "max_version": "2.0",
    "warnings": ["Field 'deprecated_field' will be removed in 2.0"]
  }
}
```

## Performance Tuning

### Large File Handling

For files > 100MB, use streaming mode:

```bash
# Stream processing instead of loading entire file
npx @qudag/cli exec \
  --input huge-dag.jsonl \
  --stream \
  --chunk-size 10000 \
  --output results.jsonl
```

### Memory Optimization

```bash
# Limit memory usage
npx @qudag/cli analyze \
  --input large-dag.json \
  --memory-limit 4GB \
  --output analysis.json
```

### Compression

CLI automatically detects and handles compressed files:

```bash
# Automatic decompression
npx @qudag/cli exec \
  --input dag.json.gz \
  --output results.json.gz

# Manual compression specification
npx @qudag/cli exec \
  --input dag.json \
  --compression gzip \
  --output results.json.gz
```

Supported compression formats:
- gzip (.gz)
- brotli (.br)
- zstd (.zst)

---

**See Also**:
- [commands.md](commands.md) for command specifications
- [configuration.md](configuration.md) for configuration options
