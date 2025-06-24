# PostgreSQL MCP Server Setup for Claude Desktop

## Overview

This setup uses the **official PostgreSQL MCP server** from the Model Context Protocol project. It's the same server recommended by Supabase and is battle-tested across thousands of installations.

## Why This Approach?

✅ **Official Implementation**: Built by the MCP team  
✅ **Battle-Tested**: Used by Supabase and thousands of developers  
✅ **Zero Dependencies**: No custom code to maintain  
✅ **Secure**: Read-only access by default  
✅ **Works Immediately**: No compilation or build steps

## Quick Setup

### 1. Start Your Database

```bash
cd business-intelligence-api
docker-compose up -d postgres
```

### 2. Configure Claude Desktop

Copy the configuration from `claude-desktop-mcp-config.json` to your Claude Desktop MCP settings:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### 3. Test the Connection

1. Restart Claude Desktop
2. Start a new conversation
3. You should see a 🔨 (hammer) icon indicating MCP tools are available
4. Try asking: "What tables are in my database?"

## Available Commands

Once connected, you can ask Claude to:

- **Schema Exploration**: "Show me all tables in the executive schema"
- **Data Analysis**: "What's in the organizations table?"
- **Business Intelligence**: "How many agents are assigned to each department?"
- **Query Help**: "Write a query to find the top performing agents this month"

## Security Features

- **Read-Only Access**: The MCP server only allows SELECT queries
- **Schema Scoped**: Only accesses the specified database
- **Local Connection**: Connects through localhost tunnel only
- **No Data Modification**: Cannot INSERT, UPDATE, or DELETE

## Troubleshooting

### Database Connection Issues

```bash
# Test database connectivity
PGPASSWORD=password123 psql -h localhost -p 5433 -U qudag_executive -d qudag_business -c "SELECT 1;"
```

### MCP Server Issues

```bash
# Test MCP server directly
npx @modelcontextprotocol/server-postgres postgresql://qudag_executive:password123@localhost:5433/qudag_business
```

### Claude Desktop Issues

1. Check that the config file is valid JSON
2. Restart Claude Desktop completely
3. Look for the 🔨 icon in new conversations

## Production Considerations

For production use:

1. **Use Environment Variables**: Store credentials securely
2. **Network Security**: Use SSL connections
3. **Access Control**: Limit database user permissions
4. **Monitoring**: Monitor MCP server usage

## Next Steps

Once working, you can:

1. **Add More Schemas**: Include additional PostgreSQL schemas
2. **Multiple Databases**: Connect to development/staging environments
3. **Custom Queries**: Build saved queries for common business intelligence tasks
4. **Integration**: Combine with other MCP servers (file system, web search, etc.)

This setup gives you enterprise-grade database access in Claude Desktop with minimal configuration and maximum security.
