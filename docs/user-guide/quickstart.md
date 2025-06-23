# QuDAG Quickstart for ARM64 (Apple Silicon)

## 🚨 Current Status

The QuDAG project has a dependency issue with `pqcrypto-kyber` that prevents direct compilation on ARM64 Macs due to AVX2 (Intel-specific) CPU instructions.

## ✅ Working Solutions

### Option 1: Use the Simple Runner (Fastest)

```bash
./qudag-simple.sh help
```

This script provides access to working examples and functionality without building the problematic dependencies.

### Option 2: Run Examples Directly

```bash
# List available examples
ls examples/

# Run a basic server example
cargo run --example basic_server

# Run vault example
cargo run --package qudag-vault-core --example basic_usage
```

### Option 3: Use Docker Compose (Full Stack)

```bash
# Start the full QuDAG stack
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 4: Wait for Fix

The project maintainers need to:

1. Update `pqcrypto-kyber` to support ARM64
2. Provide pre-built binaries for ARM64
3. Add CI/CD for multi-platform releases

## 🛠️ What Works Right Now

- ✅ Examples that don't use quantum crypto
- ✅ Docker containers (with x86 emulation)
- ✅ Core DAG functionality
- ✅ Vault operations
- ❌ Full CLI binary (blocked by pqcrypto-kyber)
- ❌ npm package binary download (no releases exist)

## 📝 Bottom Line

**Don't worry about the type errors** - they're not your fault. Use the workarounds above until the project fixes ARM64 support.

For development, the examples provide full functionality to explore QuDAG's capabilities.
