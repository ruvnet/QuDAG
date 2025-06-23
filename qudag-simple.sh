#!/bin/bash
# Simple QuDAG runner that works around all the build issues

set -e

echo "🚀 QuDAG Simple Runner - No Build Required"
echo "=========================================="
echo ""
echo "This script runs QuDAG directly without building the problematic dependencies."
echo ""

# Check if we have cargo
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo not found. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Function to run QuDAG commands
qudag_run() {
    echo "🔧 Running QuDAG with command: $@"
    cd "$(dirname "$0")"
    
    # Try different approaches
    if [ -f "target/release/qudag" ]; then
        echo "Using existing binary..."
        ./target/release/qudag "$@"
    elif [ -f "qudag-testnet/qudag" ]; then
        echo "Using testnet binary..."
        ./qudag-testnet/qudag "$@"
    else
        echo "Running via cargo (this may take a moment on first run)..."
        # Run the examples which don't depend on the problematic crypto
        if [ "$1" = "help" ] || [ "$1" = "--help" ]; then
            cat << EOF
QuDAG - Quantum-Resistant Distributed Communication Platform

USAGE:
    qudag <COMMAND>

COMMANDS:
    start       Start a QuDAG node
    stop        Stop the QuDAG node  
    status      Check node status
    peer        Manage peers
    dark        Dark addressing commands
    vault       Password vault commands
    exchange    Resource exchange commands
    help        Print this message

For now, use the examples to test functionality:
    cargo run --example simple_node
    cargo run --example dark_addressing_example
    
Or use Docker:
    docker-compose up -d
EOF
        elif [ "$1" = "example" ]; then
            shift
            cargo run --example "$@"
        else
            echo "⚠️  Direct compilation is currently blocked by ARM64 compatibility issues."
            echo ""
            echo "Available workarounds:"
            echo "1. Run examples: ./qudag-simple.sh example <example_name>"
            echo "2. Use Docker: docker-compose up -d"
            echo "3. Wait for upstream fix to pqcrypto-kyber"
            echo ""
            echo "Run './qudag-simple.sh help' for more information."
        fi
    fi
}

# Main entry point
if [ $# -eq 0 ]; then
    qudag_run help
else
    qudag_run "$@"
fi 