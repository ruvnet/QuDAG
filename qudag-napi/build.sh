#!/bin/bash
set -e

# QuDAG Native Bindings Build Script
# Builds native Node.js bindings using napi-rs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==================================="
echo "QuDAG Native Bindings Build"
echo "==================================="
echo ""

# Check for required tools
command -v cargo >/dev/null 2>&1 || { echo "Error: cargo is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm is required but not installed."; exit 1; }

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    darwin)
        PLATFORM="darwin"
        ;;
    linux)
        PLATFORM="linux"
        ;;
    mingw*|cygwin*|msys*)
        PLATFORM="win32"
        ;;
    *)
        echo "Unsupported platform: $OS"
        exit 1
        ;;
esac

case "$ARCH" in
    x86_64|amd64)
        ARCH="x64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    armv7l)
        ARCH="arm"
        ;;
    *)
        echo "Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "Platform: $PLATFORM-$ARCH"
echo ""

# Install napi-rs CLI if not present
if ! command -v napi >/dev/null 2>&1; then
    echo "Installing @napi-rs/cli..."
    npm install -g @napi-rs/cli
fi

# Build native module
echo "Building native module..."
echo ""

BUILD_MODE="${1:-release}"

if [ "$BUILD_MODE" = "debug" ]; then
    napi build --platform
else
    napi build --platform --release
fi

echo ""
echo "Build complete!"
echo ""

# List built artifacts
echo "Built artifacts:"
ls -la *.node 2>/dev/null || echo "No .node files found"
echo ""

# Build npm package TypeScript
echo "Building npm package..."
cd npm
npm install
npm run build
cd ..

echo ""
echo "==================================="
echo "Build Summary"
echo "==================================="
echo "Native binding: qudag-napi.$PLATFORM-$ARCH.node"
echo "npm package: npm/dist/"
echo ""
