#!/bin/bash
set -e

# QuDAG MCP Real Implementation Build Script

echo "Building QuDAG MCP Real Implementation..."

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    echo "Error: Must run from qudag-mcp-real directory"
    exit 1
fi

# Parse command line arguments
BUILD_TYPE="debug"
RUN_AFTER=false
DOCKER_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            BUILD_TYPE="release"
            shift
            ;;
        --run)
            RUN_AFTER=true
            shift
            ;;
        --docker)
            DOCKER_BUILD=true
            shift
            ;;
        --help)
            echo "Usage: ./build.sh [options]"
            echo "Options:"
            echo "  --release    Build in release mode"
            echo "  --run        Run after building"
            echo "  --docker     Build Docker image"
            echo "  --help       Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create necessary directories
mkdir -p data/keys data/db

# Build the project
if [ "$BUILD_TYPE" = "release" ]; then
    echo "Building in release mode..."
    cargo build --release
    BINARY_PATH="target/release/qudag-mcp-real"
else
    echo "Building in debug mode..."
    cargo build
    BINARY_PATH="target/debug/qudag-mcp-real"
fi

echo "Build complete!"

# Build Docker image if requested
if [ "$DOCKER_BUILD" = true ]; then
    echo "Building Docker image..."
    docker build -t qudag-mcp-real:latest .
    echo "Docker image built: qudag-mcp-real:latest"
fi

# Run if requested
if [ "$RUN_AFTER" = true ]; then
    echo "Starting QuDAG MCP Real..."
    export RUST_LOG=debug
    $BINARY_PATH
fi