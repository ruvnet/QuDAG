#!/bin/bash
# Test QuDAG MCP Real Implementation

BASE_URL="${MCP_URL:-http://localhost:3000}"

echo "Testing QuDAG MCP Real Implementation at $BASE_URL"
echo "============================================="

# Test health check
echo -n "Testing health check... "
if curl -s "$BASE_URL/health" | grep -q "OK"; then
    echo "✓ OK"
else
    echo "✗ Failed"
    exit 1
fi

# Test system status
echo -n "Testing system status... "
if curl -s "$BASE_URL/status" | jq . > /dev/null 2>&1; then
    echo "✓ OK"
else
    echo "✗ Failed"
fi

# Test MCP tools listing
echo -e "\n## MCP Tools"
echo "Listing available tools..."
curl -s "$BASE_URL/mcp/tools" | jq -r '.[] | "- \(.name): \(.description)"'

# Test MCP resources listing
echo -e "\n## MCP Resources"
echo "Listing available resources..."
curl -s "$BASE_URL/mcp/resources" | jq -r '.[] | "- \(.uri): \(.name)"'

# Test MCP prompts listing
echo -e "\n## MCP Prompts"
echo "Listing available prompts..."
curl -s "$BASE_URL/mcp/prompts" | jq -r '.[] | "- \(.name): \(.description)"'

# Test crypto tool
echo -e "\n## Testing Crypto Tool"
echo "Generating ML-DSA keypair..."
RESULT=$(curl -s -X POST "$BASE_URL/mcp/tool/crypto_generate_keypair" \
    -H "Content-Type: application/json" \
    -d '{"algorithm": "ml-dsa"}')
    
if echo "$RESULT" | jq -e '.content[0].data.public_key' > /dev/null 2>&1; then
    echo "✓ Keypair generated successfully"
    PUBLIC_KEY=$(echo "$RESULT" | jq -r '.content[0].data.public_key')
    echo "  Public key: ${PUBLIC_KEY:0:32}..."
else
    echo "✗ Failed to generate keypair"
fi

# Test network tool
echo -e "\n## Testing Network Tool"
echo "Listing peers..."
PEERS=$(curl -s -X POST "$BASE_URL/mcp/tool/network_list_peers" \
    -H "Content-Type: application/json" \
    -d '{}')
    
if echo "$PEERS" | jq -e '.content[0].data.count' > /dev/null 2>&1; then
    PEER_COUNT=$(echo "$PEERS" | jq -r '.content[0].data.count')
    echo "✓ Connected peers: $PEER_COUNT"
else
    echo "✗ Failed to list peers"
fi

# Test DAG status
echo -e "\n## Testing DAG Tool"
echo "Getting DAG status..."
DAG_STATUS=$(curl -s -X POST "$BASE_URL/mcp/tool/dag_get_status" \
    -H "Content-Type: application/json" \
    -d '{}')
    
if echo "$DAG_STATUS" | jq -e '.content[0].data.height' > /dev/null 2>&1; then
    HEIGHT=$(echo "$DAG_STATUS" | jq -r '.content[0].data.height')
    echo "✓ DAG height: $HEIGHT"
else
    echo "✗ Failed to get DAG status"
fi

# Test resource fetching
echo -e "\n## Testing Resource Fetching"
echo "Fetching system status resource..."
RESOURCE=$(curl -s "$BASE_URL/mcp/resource/qudag%3A%2F%2Fsystem%2Fstatus")

if echo "$RESOURCE" | jq -e '.content' > /dev/null 2>&1; then
    echo "✓ Resource fetched successfully"
    echo "$RESOURCE" | jq -r '.content' | jq '.' | head -10
else
    echo "✗ Failed to fetch resource"
fi

echo -e "\n============================================="
echo "Testing complete!"