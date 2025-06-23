#!/bin/bash
# Native ARM64 build script for QuDAG using libcrux
# This provides native ARM64 performance without Docker

set -e

echo "🚀 QuDAG Native ARM64 Build (libcrux)"
echo "====================================="
echo ""

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" && "$ARCH" != "aarch64" ]]; then
    echo "⚠️  Warning: Not on ARM64 architecture (detected: $ARCH)"
    echo "   This build is optimized for ARM64/Apple Silicon"
fi

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install from https://rustup.rs/"
    exit 1
fi

echo "✅ Building QuDAG with native ARM64 optimizations..."
echo ""

# Set environment for optimal ARM64 build
export RUSTFLAGS="-C target-cpu=native"
export CARGO_PROFILE_RELEASE_LTO=true
export CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1

# Clean previous builds (optional)
if [ "$1" == "--clean" ]; then
    echo "🧹 Cleaning previous builds..."
    cargo clean
fi

# Build the project
echo "📦 Building QuDAG..."
cargo build --release

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
    echo "🎉 QuDAG binary location:"
    echo "   ./target/release/qudag"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Run tests: cargo test"
    echo "   2. Start QuDAG: ./target/release/qudag start"
    echo "   3. Check help: ./target/release/qudag --help"
    echo ""
    echo "🚀 Performance notes:"
    echo "   - Using libcrux with ARM64 NEON optimizations"
    echo "   - Formally verified quantum-resistant cryptography"
    echo "   - Native performance (no emulation)"
else
    echo ""
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi