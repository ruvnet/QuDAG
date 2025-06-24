# QuDAG PostgreSQL MCP Server

A production-ready PostgreSQL MCP (Model Context Protocol) server for Claude Desktop, designed specifically for QuDAG Business Intelligence operations.

## Features

- **Secure Database Access**: Multi-mode security with restricted/unrestricted access levels
- **Comprehensive CRUD Operations**: Full Create, Read, Update, Delete capabilities with safety controls
- **Advanced Query Tools**: SQL execution, schema exploration, performance analysis
- **Business Intelligence**: Executive reporting, agent performance analysis, operational metrics
- **Admin Tools**: Database maintenance, user management, performance monitoring
- **Natural Language Integration**: Optimized for Claude Desktop's conversational interface

## Quick Start

### 1. Installation

```bash
# Clone or create the directory
cd qudag-postgres-mcp

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### 2. Configuration

Edit `.env` with your PostgreSQL connection details:

```env
DATABASE_URL=postgresql://qudag_executive:password@localhost:5433/qudag_business
MCP_ACCESS_MODE=restricted
MCP_ALLOWED_SCHEMAS=executive
```

### 3. Build and Start

```bash
# Build the TypeScript code
npm run build

# Start the server (for development)
npm run dev

# Or run production build
npm start
```

### 4. Claude Desktop Integration

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "postgres": {
      "command": "node",
      "args": ["/path/to/qudag-postgres-mcp/dist/server.js"],
      "env": {
        "DATABASE_URL": "postgresql://qudag_executive:password@localhost:5433/qudag_business",
        "MCP_ACCESS_MODE": "restricted",
        "MCP_ALLOWED_SCHEMAS": "executive"
      }
    }
  }
}
```

## Usage Examples

Once configured, you can use natural language in Claude Desktop:

### Query Operations

```
> "Show me all organizations in the database"
> "Find agents hired in the last 30 days"
> "Get performance metrics for agent-123"
```

### Schema Exploration

```
> "Describe the database schema"
> "Show me the structure of the agent_profiles table"
> "What tables are available in the executive schema?"
```

### Business Intelligence

```
> "Generate an executive summary for organization uuid-123"
> "Analyze agent performance trends this quarter"
> "Show me top performing departments"
```

### Database Administration

```
> "Check database health and performance"
> "Analyze query performance for slow operations"
> "Run database maintenance on the executive schema"
```

## Available Tools

### Query Tools

- `postgres_execute_query` - Execute safe SQL queries
- `postgres_get_schema_info` - Get schema information
- `postgres_explain_query` - Analyze query execution plans
- `postgres_search_database` - Search tables and columns
- `postgres_get_health` - Database health status

### CRUD Tools

- `postgres_select_records` - Select with filtering and pagination
- `postgres_insert_record` - Insert new records
- `postgres_update_record` - Update existing records
- `postgres_delete_record` - Delete records (with confirmation)
- `postgres_upsert_record` - Insert or update with conflict resolution

### Admin Tools (Unrestricted Mode Only)

- `postgres_get_performance_metrics` - Performance statistics
- `postgres_analyze_database` - Update table statistics
- `postgres_vacuum_tables` - Database maintenance

## Security Modes

### Restricted Mode (Default)

- Read-only operations only
- Schema access limited to allowed list
- Query validation and safety checks
- Audit logging enabled

### Unrestricted Mode

- Full read/write access
- Admin operations available
- Backup and maintenance tools
- Production confirmation required

## Configuration Options

| Environment Variable          | Default      | Description                             |
| ----------------------------- | ------------ | --------------------------------------- |
| `DATABASE_URL`                | Required     | PostgreSQL connection string            |
| `MCP_ACCESS_MODE`             | `restricted` | Security mode (restricted/unrestricted) |
| `MCP_ALLOWED_SCHEMAS`         | `executive`  | Comma-separated list of allowed schemas |
| `MCP_AUDIT_LOG`               | `true`       | Enable audit logging                    |
| `REQUIRE_CONFIRMATION_DELETE` | `true`       | Require confirmation for deletes        |
| `REQUIRE_CONFIRMATION_ADMIN`  | `true`       | Require confirmation for admin ops      |
| `MAX_QUERY_ROWS`              | `1000`       | Maximum rows per query                  |
| `QUERY_TIMEOUT_MS`            | `30000`      | Query timeout in milliseconds           |
| `LOG_LEVEL`                   | `info`       | Logging level (error/warn/info/debug)   |

## Development

### Project Structure

```
src/
├── server.ts          # Main MCP server
├── config.ts          # Configuration management
├── database.ts        # Database connection & utilities
├── logger.ts          # Logging configuration
└── tools/             # MCP tool implementations
    ├── query.ts       # Query operations
    ├── crud.ts        # CRUD operations
    └── admin.ts       # Admin operations
```

### Development Commands

```bash
npm run dev         # Start with hot reload
npm run build       # Compile TypeScript
npm run test        # Run tests
npm run lint        # Run ESLint
npm run typecheck   # TypeScript type checking
```

### Adding New Tools

1. Create tool function in appropriate file under `src/tools/`
2. Add tool definition to `tools` array in `server.ts`
3. Add handler case in `CallToolRequestSchema` handler
4. Update documentation

## Testing

Create test database:

```bash
# Using your existing PostgreSQL setup
psql -h localhost -p 5433 -U qudag_executive -d qudag_business
```

Test MCP server directly:

```bash
# Build and test
npm run build
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/server.js
```

## Troubleshooting

### Connection Issues

- Verify PostgreSQL is running on specified port
- Check database credentials and permissions
- Ensure network connectivity to database

### Permission Errors

- Verify user has access to specified schemas
- Check `MCP_ALLOWED_SCHEMAS` configuration
- Review access mode settings

### Claude Desktop Integration

- Restart Claude Desktop after configuration changes
- Check logs for MCP server startup errors
- Verify file paths in configuration

### Performance Issues

- Adjust `MAX_QUERY_ROWS` and `QUERY_TIMEOUT_MS`
- Monitor database connection pool usage
- Review query execution plans with explain tools

## Best Practices

1. **Security**: Always start with `restricted` mode in production
2. **Monitoring**: Enable audit logging for compliance
3. **Performance**: Use LIMIT clauses and avoid SELECT \* queries
4. **Maintenance**: Regular VACUUM and ANALYZE operations
5. **Backup**: Implement regular backup procedures
6. **Testing**: Test configuration changes in development first

## Support

For issues specific to QuDAG implementation, refer to the main QuDAG documentation or create an issue in the project repository.

For MCP protocol questions, see the [official MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp).

## License

MIT License - see LICENSE file for details.
