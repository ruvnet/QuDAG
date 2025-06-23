#!/bin/bash
# Start QuDAG Real MCP Server locally

echo "🚀 Starting QuDAG Real MCP Server..."

# Check if container is already running
if docker ps | grep -q qudag-mcp-local; then
    echo "✅ MCP server is already running on http://localhost:3000"
    echo "   To restart: docker restart qudag-mcp-local"
else
    # Check if container exists but is stopped
    if docker ps -a | grep -q qudag-mcp-local; then
        echo "🔄 Restarting existing container..."
        docker start qudag-mcp-local
    else
        echo "🐳 Starting new container..."
        docker run -d --name qudag-mcp-local -p 3000:3000 qudag-mcp-real:standalone
    fi
    
    # Wait for server to be ready
    echo "⏳ Waiting for server to be ready..."
    for i in {1..10}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo "✅ MCP server is running on http://localhost:3000"
            echo ""
            echo "Available MCP configurations:"
            echo "  - qudag-testnet (primary)"
            echo "  - qudag-local"
            echo "  - qudag-mcp-real"
            echo ""
            echo "All 7 QuDAG tools are available:"
            curl -s http://localhost:3000/mcp/tools | jq -r '.tools[].name' | sed 's/^/  - /'
            exit 0
        fi
        sleep 1
    done
    
    echo "❌ Failed to start MCP server"
    exit 1
fi