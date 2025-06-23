#!/bin/bash
# Essential QuDAG ARM64 Build Script
# Builds core components that work on ARM64 without ML-DSA dependencies

set -e

echo "🚀 QuDAG Essential ARM64 Build"
echo "=============================="
echo "Building core components without ML-DSA dependencies..."
echo ""

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
    echo "✅ Running on ARM64 architecture"
else
    echo "⚠️  Warning: Not on ARM64 (detected: $ARCH)"
fi

# Set environment for ARM64
export RUSTFLAGS="-C target-cpu=native"
export CARGO_PROFILE_RELEASE_LTO=true
export CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1

# Build essential components
echo "📦 Building essential QuDAG components..."
echo ""

# Build crypto module (with libcrux for ML-KEM)
echo "1️⃣ Building crypto module..."
cd core/crypto
cargo build --release
cd ../..

# Build DAG module (consensus)
echo "2️⃣ Building DAG consensus module..."
cd core/dag
cargo build --release
cd ../..

# Build vault module (key management)
echo "3️⃣ Building vault module..."
cd core/vault
cargo build --release
cd ../..

# Build exchange core (with Ed25519 fallback)
echo "4️⃣ Building exchange core..."
cd qudag-exchange/core
cargo build --release
cd ../..

# Try to build QuDAG CLI (if it doesn't depend on ML-DSA)
echo "5️⃣ Attempting to build QuDAG CLI..."
cd tools/cli
if cargo build --release 2>/dev/null; then
    echo "✅ CLI built successfully!"
    BINARY_PATH="../../target/release/qudag-cli"
else
    echo "⚠️  CLI build failed (likely due to ML-DSA dependencies)"
    BINARY_PATH=""
fi
cd ../..

echo ""
echo "✅ Essential build completed!"
echo ""
echo "📋 Build Summary:"
echo "  - ✅ Crypto module (with libcrux ML-KEM for ARM64)"
echo "  - ✅ DAG consensus module"
echo "  - ✅ Vault module"
echo "  - ✅ Exchange core (with Ed25519 fallback)"

if [ -n "$BINARY_PATH" ] && [ -f "$BINARY_PATH" ]; then
    echo "  - ✅ QuDAG CLI"
    echo ""
    echo "🎉 QuDAG CLI available at: $BINARY_PATH"
    echo ""
    echo "To install to your PATH:"
    echo "  sudo cp $BINARY_PATH /usr/local/bin/qudag"
else
    echo "  - ❌ QuDAG CLI (requires ML-DSA refactoring)"
fi

echo ""
echo "📝 Next Steps for Full ARM64 Support:"
echo "1. Replace ML-DSA dependencies with Ed25519 or wait for ARM64-compatible ML-DSA"
echo "2. Update network module to make dark_resolver optional"
echo "3. Update protocol module to use crypto compatibility layer"
echo "4. Add CI/CD for multi-platform builds"
echo ""
echo "💡 For now, you can:"
echo "- Use the crypto, DAG, vault, and exchange libraries in your projects"
echo "- Import them as dependencies in your Cargo.toml"
echo "- Use Docker for full QuDAG functionality (./build-arm64.sh)"