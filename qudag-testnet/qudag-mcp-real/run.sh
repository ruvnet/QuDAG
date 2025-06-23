#!/bin/bash

# QuDAG MCP Real Implementation Runner

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 QuDAG MCP Real Implementation${NC}"
echo "=================================="

# Parse command line arguments
MODE=${1:-http}
PORT=${2:-3000}
HOST=${3:-0.0.0.0}

# Build the project
echo -e "${YELLOW}Building project...${NC}"
cargo build --release

echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Run based on mode
case $MODE in
    http)
        echo -e "${BLUE}Starting HTTP/WebSocket server on ${HOST}:${PORT}${NC}"
        cargo run --release -- start --host $HOST --port $PORT
        ;;
    stdio)
        echo -e "${BLUE}Starting stdio server for Claude Desktop${NC}"
        cargo run --release -- start --stdio
        ;;
    info)
        cargo run --release -- info
        ;;
    test)
        echo -e "${BLUE}Running integration tests${NC}"
        # Test health endpoint
        echo -e "${YELLOW}Testing health endpoint...${NC}"
        curl -s http://localhost:${PORT}/health | jq .
        
        # Test tools list
        echo -e "${YELLOW}Testing tools list...${NC}"
        curl -s http://localhost:${PORT}/tools | jq .
        
        # Test MCP initialize
        echo -e "${YELLOW}Testing MCP initialize...${NC}"
        curl -s -X POST http://localhost:${PORT}/mcp \
            -H "Content-Type: application/json" \
            -d '{"id": "test-1", "method": "initialize", "params": {}}' | jq .
        ;;
    *)
        echo "Usage: ./run.sh [mode] [port] [host]"
        echo ""
        echo "Modes:"
        echo "  http   - Start HTTP/WebSocket server (default)"
        echo "  stdio  - Start stdio server for Claude Desktop"
        echo "  info   - Show server information"
        echo "  test   - Run integration tests"
        echo ""
        echo "Examples:"
        echo "  ./run.sh              # Start HTTP server on 0.0.0.0:3000"
        echo "  ./run.sh http 8080    # Start HTTP server on port 8080"
        echo "  ./run.sh stdio        # Start stdio mode"
        echo "  ./run.sh test         # Run tests (requires running server)"
        exit 1
        ;;
esac