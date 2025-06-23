#!/bin/bash
# Native ARM64 build script for QuDAG
# Uses libcrux-ml-kem + oqs for ARM64, pqcrypto for x86_64

set -e

echo "🚀 QuDAG Native ARM64 Build"
echo "=========================="
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

# Check for OpenSSL (needed for oqs library)
if [ ! -d "/opt/homebrew/opt/openssl@3" ]; then
    echo "❌ OpenSSL not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install openssl@3
    else
        echo "Please install OpenSSL: brew install openssl@3"
        exit 1
    fi
fi

echo "✅ Building QuDAG with quantum-resistant ARM64 optimizations..."
echo ""

# Set environment for optimal ARM64 build
export RUSTFLAGS="-C target-cpu=native -L /opt/homebrew/opt/openssl@3/lib"
export CARGO_PROFILE_RELEASE_LTO=true
export CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1

# Set OpenSSL paths for oqs library
export OPENSSL_DIR=/opt/homebrew/opt/openssl@3
export PKG_CONFIG_PATH=/opt/homebrew/opt/openssl@3/lib/pkgconfig
export OPENSSL_LIB_DIR=/opt/homebrew/opt/openssl@3/lib
export OPENSSL_INCLUDE_DIR=/opt/homebrew/opt/openssl@3/include

# Clean previous builds (optional)
if [ "$1" == "--clean" ]; then
    echo "🧹 Cleaning previous builds..."
    cargo clean
fi

# Build core components first to catch issues early
echo "📦 Building QuDAG core components..."

# Build crypto library (libcrux + oqs on ARM64)
echo "🔐 Building qudag-crypto..."
cargo build --release --package qudag-crypto
if [ $? -ne 0 ]; then
    echo "❌ Crypto library build failed"
    exit 1
fi
echo "✅ Crypto library built (libcrux-ml-kem + oqs ML-DSA)"

# Build other core components
for component in qudag-dag qudag-network qudag-protocol qudag-exchange-core; do
    echo "📦 Building $component..."
    cargo build --release --package $component
    if [ $? -ne 0 ]; then
        echo "❌ $component build failed"
        exit 1
    fi
    echo "✅ $component built successfully"
done

# Build main library
echo "📚 Building qudag main library..."
cargo build --release --package qudag
if [ $? -ne 0 ]; then
    echo "❌ Main library build failed"
    exit 1
fi
echo "✅ Main library built successfully"

# Build CLI
echo "🖥️  Building qudag CLI..."
cargo build --release --package qudag-cli
CLI_SUCCESS=$?

# Check if CLI was built successfully
if [ $CLI_SUCCESS -eq 0 ]; then
    echo "✅ CLI built successfully"
    
    # Install CLI to user's local bin
    echo "📥 Installing CLI to ~/.local/bin..."
    mkdir -p ~/.local/bin
    cp target/release/qudag ~/.local/bin/
    chmod +x ~/.local/bin/qudag
    
    echo ""
    echo "🎉 Complete Build Success!"
    echo "========================="
    echo "✅ All components built successfully:"
    echo "  • qudag-crypto (libcrux + oqs for ARM64)"
    echo "  • qudag-dag (DAG consensus)"
    echo "  • qudag-network (P2P with conditional dark_resolver)"
    echo "  • qudag-protocol (quantum-resistant protocol)"
    echo "  • qudag-exchange-core (rUv token exchange)"
    echo "  • qudag CLI (fully functional)"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Add ~/.local/bin to your PATH:"
    echo "   echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
    echo "   source ~/.zshrc"
    echo ""
    echo "2. Test the installation:"
    echo "   qudag --help"
    echo ""
    echo "3. Start a QuDAG node:"
    echo "   qudag start --port 8000"
    echo ""
    echo "4. Generate quantum keys:"
    echo "   qudag key generate --algorithm ml-dsa"
    echo "   qudag key generate --algorithm ml-kem"
    echo ""
    echo "5. Create rUv exchange account:"
    echo "   qudag exchange create-account --name my_vault"
    echo ""
    echo "🧪 Run tests:"
    echo "   cargo test --workspace"
    
else
    echo "⚠️  CLI build had issues, but core libraries are functional"
    echo ""
    echo "🎉 Core Libraries Built Successfully!"
    echo "===================================="
    echo "✅ All core components built:"
    echo "  • qudag-crypto (libcrux + oqs for ARM64)"
    echo "  • qudag-dag (DAG consensus)"
    echo "  • qudag-network (P2P networking)"
    echo "  • qudag-protocol (quantum-resistant protocol)"
    echo "  • qudag-exchange-core (rUv token exchange)"
    echo ""
    echo "🔧 Development Usage:"
    echo "Use these libraries in your Rust projects:"
    echo ""
    echo "Add to your Cargo.toml:"
    echo "  [dependencies]"
    echo "  qudag = { path = \"$(pwd)\" }"
    echo "  qudag-crypto = { path = \"$(pwd)/core/crypto\" }"
    echo ""
    echo "Example usage:"
    echo "  use qudag_crypto::{MlDsaKeyPair, MlKem768};"
    echo "  use qudag_dag::Dag;"
    echo "  use qudag_network::P2PNode;"
fi

echo ""
echo "🚀 Performance notes:"
echo "   - libcrux-ml-kem: Formally verified, ARM64 NEON optimized"
echo "   - oqs ML-DSA: NIST standard, quantum-resistant signatures"
echo "   - Native ARM64 performance (no emulation)"
echo "   - Conditional compilation for optimal architecture support"