/**
 * @description Simplified PostgreSQL MCP Server for Claude Desktop
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Simplified implementation
 */

import { Pool } from "pg";
import { appConfig } from "./config.js";

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: any;
}

class SimpleMCPServer {
  private pool: Pool | null = null;

  constructor() {
    this.setupStdio();
  }

  private setupStdio() {
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (data) => {
      this.handleRequest(data.toString().trim());
    });
  }

  private async handleRequest(data: string) {
    try {
      const request: MCPRequest = JSON.parse(data);
      let response: MCPResponse;

      switch (request.method) {
        case "initialize":
          response = await this.handleInitialize(request);
          break;
        case "tools/list":
          response = await this.handleToolsList(request);
          break;
        case "tools/call":
          response = await this.handleToolCall(request);
          break;
        default:
          response = {
            jsonrpc: "2.0",
            id: request.id,
            error: { code: -32601, message: "Method not found" },
          };
      }

      console.log(JSON.stringify(response));
    } catch (error) {
      console.error("Error handling request:", error);
      console.log(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          error: { code: -32700, message: "Parse error" },
        })
      );
    }
  }

  private async handleInitialize(request: MCPRequest): Promise<MCPResponse> {
    await this.initializeDatabase();

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          prompts: {},
        },
        serverInfo: {
          name: "qudag-postgres-mcp",
          version: "1.0.0",
        },
      },
    };
  }

  private async handleToolsList(request: MCPRequest): Promise<MCPResponse> {
    const tools = [
      {
        name: "postgres_execute_query",
        description: "Execute a safe SQL query",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
            schema: { type: "string", default: "executive" },
          },
          required: ["sql"],
        },
      },
      {
        name: "postgres_get_schema_info",
        description: "Get database schema information",
        inputSchema: {
          type: "object",
          properties: {
            schema: { type: "string", default: "executive" },
          },
        },
      },
      {
        name: "postgres_get_health",
        description: "Get database health status",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { tools },
    };
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case "postgres_execute_query":
          result = await this.executeQuery(args);
          break;
        case "postgres_get_schema_info":
          result = await this.getSchemaInfo(args);
          break;
        case "postgres_get_health":
          result = await this.getHealth();
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  private async initializeDatabase() {
    if (this.pool) return;

    this.pool = new Pool({
      connectionString: appConfig.database.url,
      max: appConfig.database.maxConnections,
    });

    // Test connection
    const client = await this.pool.connect();
    await client.query("SELECT 1");
    client.release();

    console.error("PostgreSQL MCP Server started successfully");
  }

  private async executeQuery(args: any) {
    if (!this.pool) throw new Error("Database not initialized");

    const { sql, schema = "executive" } = args;

    // Basic security check
    if (!appConfig.security.allowedSchemas.includes(schema)) {
      throw new Error(`Schema '${schema}' not allowed`);
    }

    // Basic query validation
    const upperSql = sql.toUpperCase();
    const dangerous = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE"];
    if (appConfig.security.accessMode === "restricted") {
      for (const keyword of dangerous) {
        if (upperSql.includes(keyword)) {
          throw new Error(
            `Operation '${keyword}' not allowed in restricted mode`
          );
        }
      }
    }

    const result = await this.pool.query(sql);

    return {
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      query: sql,
    };
  }

  private async getSchemaInfo(args: any) {
    if (!this.pool) throw new Error("Database not initialized");

    const { schema = "executive" } = args;

    if (!appConfig.security.allowedSchemas.includes(schema)) {
      throw new Error(`Schema '${schema}' not allowed`);
    }

    // Get tables
    const tablesResult = await this.pool.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `,
      [schema]
    );

    const tables = [];
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;

      // Get columns
      const columnsResult = await this.pool.query(
        `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `,
        [schema, tableName]
      );

      tables.push({
        name: tableName,
        columns: columnsResult.rows,
      });
    }

    return {
      success: true,
      schema,
      tables,
    };
  }

  private async getHealth() {
    if (!this.pool) throw new Error("Database not initialized");

    const result = await this.pool.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        now() as timestamp
    `);

    return {
      success: true,
      status: "healthy",
      details: result.rows[0],
      accessMode: appConfig.security.accessMode,
      allowedSchemas: appConfig.security.allowedSchemas,
    };
  }
}

// Start the server
const server = new SimpleMCPServer();

// Graceful shutdown
process.on("SIGINT", () => {
  console.error("Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("Shutting down...");
  process.exit(0);
});
