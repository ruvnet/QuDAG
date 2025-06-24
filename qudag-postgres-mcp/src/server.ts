/**
 * @description Main PostgreSQL MCP Server for Claude Desktop
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Initial implementation
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { db } from "./database";
import { appConfig } from "./config";
import { logger, logToolExecution } from "./logger";

// Tool implementations
import * as queryTools from "./tools/query";
import * as crudTools from "./tools/crud";
import * as adminTools from "./tools/admin";

// Tool definitions for MCP
const tools = [
  // Query tools
  {
    name: "postgres_execute_query",
    description: "Execute a safe SQL query with result formatting options",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query to execute" },
        schema: {
          type: "string",
          default: "executive",
          description: "Database schema to query",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 10000,
          description: "Maximum rows to return",
        },
        format: {
          type: "string",
          enum: ["json", "csv", "table"],
          default: "json",
          description: "Output format",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "postgres_get_schema_info",
    description: "Get database schema information with multiple output formats",
    inputSchema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          default: "executive",
          description: "Schema name to inspect",
        },
        format: {
          type: "string",
          enum: ["json", "markdown", "mermaid"],
          default: "json",
          description: "Output format",
        },
      },
    },
  },
  {
    name: "postgres_explain_query",
    description: "Analyze query execution plan for performance optimization",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query to analyze" },
        analyze: {
          type: "boolean",
          default: false,
          description: "Include actual execution statistics",
        },
        buffers: {
          type: "boolean",
          default: false,
          description: "Include buffer usage statistics",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "postgres_search_database",
    description: "Search tables and columns by name",
    inputSchema: {
      type: "object",
      properties: {
        term: { type: "string", description: "Search term" },
        schema: {
          type: "string",
          default: "executive",
          description: "Schema to search in",
        },
        searchIn: {
          type: "string",
          enum: ["tables", "columns", "both"],
          default: "both",
          description: "What to search",
        },
      },
      required: ["term"],
    },
  },
  {
    name: "postgres_get_health",
    description: "Get database health status and statistics",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // CRUD tools
  {
    name: "postgres_select_records",
    description: "Select records from a table with filtering and pagination",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        schema: {
          type: "string",
          default: "executive",
          description: "Schema name",
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Columns to select",
        },
        where: {
          type: "object",
          description: "WHERE conditions as key-value pairs",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 10000,
          default: 100,
          description: "Maximum records to return",
        },
        offset: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Number of records to skip",
        },
        orderBy: { type: "string", description: "ORDER BY clause" },
      },
      required: ["table"],
    },
  },
  {
    name: "postgres_insert_record",
    description: "Insert a new record into a table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        schema: {
          type: "string",
          default: "executive",
          description: "Schema name",
        },
        data: {
          type: "object",
          description: "Data to insert as key-value pairs",
        },
        returnRecord: {
          type: "boolean",
          default: true,
          description: "Return the inserted record",
        },
      },
      required: ["table", "data"],
    },
  },
  {
    name: "postgres_update_record",
    description: "Update records in a table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        schema: {
          type: "string",
          default: "executive",
          description: "Schema name",
        },
        where: {
          type: "object",
          description: "WHERE conditions as key-value pairs",
        },
        data: {
          type: "object",
          description: "Data to update as key-value pairs",
        },
        limit: {
          type: "number",
          minimum: 1,
          default: 1,
          description: "Maximum records to update",
        },
      },
      required: ["table", "where", "data"],
    },
  },
  {
    name: "postgres_delete_record",
    description: "Delete records from a table (requires confirmation)",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        schema: {
          type: "string",
          default: "executive",
          description: "Schema name",
        },
        where: {
          type: "object",
          description: "WHERE conditions as key-value pairs",
        },
        limit: {
          type: "number",
          minimum: 1,
          description: "Maximum records to delete",
        },
        confirm: {
          type: "boolean",
          description: "Must be true to confirm deletion",
        },
      },
      required: ["table", "where", "confirm"],
    },
  },
  {
    name: "postgres_upsert_record",
    description: "Insert or update a record using ON CONFLICT",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        schema: {
          type: "string",
          default: "executive",
          description: "Schema name",
        },
        data: { type: "object", description: "Data as key-value pairs" },
        conflictColumns: {
          type: "array",
          items: { type: "string" },
          description: "Columns that define conflicts",
        },
        updateColumns: {
          type: "array",
          items: { type: "string" },
          description: "Columns to update on conflict",
        },
      },
      required: ["table", "data", "conflictColumns"],
    },
  },

  // Admin tools (only available in unrestricted mode)
  {
    name: "postgres_get_performance_metrics",
    description: "Get database performance metrics and statistics",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "postgres_analyze_database",
    description: "Analyze database tables for query optimization",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Specific table to analyze (optional)",
        },
        schema: {
          type: "string",
          default: "executive",
          description: "Schema name",
        },
        verbose: {
          type: "boolean",
          default: false,
          description: "Verbose output",
        },
      },
    },
  },
  {
    name: "postgres_vacuum_tables",
    description: "Vacuum tables for maintenance and performance",
    inputSchema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Specific table to vacuum (optional)",
        },
        schema: {
          type: "string",
          default: "executive",
          description: "Schema name",
        },
        analyze: {
          type: "boolean",
          default: true,
          description: "Update statistics after vacuum",
        },
        verbose: {
          type: "boolean",
          default: false,
          description: "Verbose output",
        },
        full: {
          type: "boolean",
          default: false,
          description: "Full vacuum (locks table)",
        },
      },
    },
  },
];

// Business Intelligence prompts
const prompts = [
  {
    name: "executive_summary",
    description: "Generate an executive summary report for an organization",
    arguments: [
      {
        name: "organization_id",
        description: "Organization UUID",
        required: true,
      },
      {
        name: "period",
        description: "Time period (daily, weekly, monthly, quarterly)",
        required: false,
      },
    ],
  },
  {
    name: "agent_performance_analysis",
    description: "Analyze agent performance metrics and trends",
    arguments: [
      {
        name: "agent_id",
        description: "Specific agent ID (optional)",
        required: false,
      },
      {
        name: "department_id",
        description: "Department UUID (optional)",
        required: false,
      },
      {
        name: "time_range",
        description: "Time range in days (default: 30)",
        required: false,
      },
    ],
  },
  {
    name: "schema_explorer",
    description: "Interactive database schema exploration",
    arguments: [
      {
        name: "schema",
        description: "Schema name to explore",
        required: false,
      },
    ],
  },
];

/**
 * Main MCP Server class
 */
class PostgresMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "qudag-postgres-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupPromptHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const availableTools = tools.filter((tool) => {
        // Filter admin tools based on access mode
        if (
          tool.name.includes("performance") ||
          tool.name.includes("analyze") ||
          tool.name.includes("vacuum")
        ) {
          return appConfig.security.accessMode === "unrestricted";
        }
        return true;
      });

      logger.info(`Listing ${availableTools.length} available tools`);
      return { tools: availableTools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info(`Executing tool: ${name}`, { arguments: args });

      try {
        let result;

        switch (name) {
          // Query tools
          case "postgres_execute_query":
            result = await queryTools.executeQuery(args);
            break;
          case "postgres_get_schema_info":
            result = await queryTools.getSchemaInfo(args);
            break;
          case "postgres_explain_query":
            result = await queryTools.explainQuery(args);
            break;
          case "postgres_search_database":
            result = await queryTools.searchDatabase(args);
            break;
          case "postgres_get_health":
            result = await queryTools.getDatabaseHealth();
            break;

          // CRUD tools
          case "postgres_select_records":
            result = await crudTools.selectRecords(args);
            break;
          case "postgres_insert_record":
            result = await crudTools.insertRecord(args);
            break;
          case "postgres_update_record":
            result = await crudTools.updateRecord(args);
            break;
          case "postgres_delete_record":
            result = await crudTools.deleteRecord(args);
            break;
          case "postgres_upsert_record":
            result = await crudTools.upsertRecord(args);
            break;

          // Admin tools
          case "postgres_get_performance_metrics":
            result = await adminTools.getPerformanceMetrics();
            break;
          case "postgres_analyze_database":
            result = await adminTools.analyzeDatabase(args);
            break;
          case "postgres_vacuum_tables":
            result = await adminTools.vacuumTables(args);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        logToolExecution(name, args, "success", result);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(`Tool execution failed: ${name}`, {
          error: errorMessage,
          arguments: args,
        });

        logToolExecution(name, args, "error", { error: errorMessage });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: errorMessage,
                  tool: name,
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupPromptHandlers() {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.info(`Listing ${prompts.length} available prompts`);
      return { prompts };
    });

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info(`Executing prompt: ${name}`, { arguments: args });

      try {
        let messages;

        switch (name) {
          case "executive_summary":
            messages = await this.generateExecutiveSummaryPrompt(args);
            break;
          case "agent_performance_analysis":
            messages = await this.generateAgentPerformancePrompt(args);
            break;
          case "schema_explorer":
            messages = await this.generateSchemaExplorerPrompt(args);
            break;
          default:
            throw new Error(`Unknown prompt: ${name}`);
        }

        return { messages };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(`Prompt execution failed: ${name}`, {
          error: errorMessage,
          arguments: args,
        });

        return {
          messages: [
            {
              role: "assistant",
              content: {
                type: "text",
                text: `Error generating prompt: ${errorMessage}`,
              },
            },
          ],
        };
      }
    });
  }

  // Prompt generators
  private async generateExecutiveSummaryPrompt(args: any) {
    const organizationId = args?.organization_id;
    const period = args?.period || "monthly";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate an executive summary report for organization ${organizationId || "all organizations"} for the ${period} period. Include:

1. Key performance metrics
2. Agent performance summary
3. Department efficiency analysis
4. Revenue and cost analysis
5. Strategic recommendations

Use the postgres_select_records and postgres_execute_query tools to gather the necessary data from the executive schema.`,
        },
      },
    ];
  }

  private async generateAgentPerformancePrompt(args: any) {
    const agentId = args?.agent_id;
    const departmentId = args?.department_id;
    const timeRange = args?.time_range || 30;

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Analyze agent performance for the last ${timeRange} days. ${
            agentId ? `Focus on agent ${agentId}.` : ""
          } ${departmentId ? `Filter by department ${departmentId}.` : ""}

Include analysis of:
1. Task completion rates
2. Response times
3. Quality scores
4. ROI metrics
5. Performance trends
6. Recommendations for improvement

Use the postgres tools to query agent_performance and agent_profiles tables.`,
        },
      },
    ];
  }

  private async generateSchemaExplorerPrompt(args: any) {
    const schema = args?.schema || "executive";

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Explore the ${schema} database schema and provide:

1. Schema overview with postgres_get_schema_info
2. Table relationships and key insights
3. Data volume and statistics
4. Suggested queries for common business questions
5. Schema optimization recommendations

Present the information in a clear, executive-friendly format with actionable insights.`,
        },
      },
    ];
  }

  async start() {
    logger.info("Starting PostgreSQL MCP Server...");

    try {
      // Initialize database connection
      await db.initialize();
      logger.info("Database connection established");

      // Start the server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info("PostgreSQL MCP Server started successfully", {
        accessMode: appConfig.security.accessMode,
        allowedSchemas: appConfig.security.allowedSchemas,
        toolCount: tools.length,
        promptCount: prompts.length,
      });
    } catch (error) {
      logger.error("Failed to start PostgreSQL MCP Server:", error);
      process.exit(1);
    }
  }

  async stop() {
    logger.info("Stopping PostgreSQL MCP Server...");

    try {
      await db.close();
      logger.info("PostgreSQL MCP Server stopped successfully");
    } catch (error) {
      logger.error("Error stopping PostgreSQL MCP Server:", error);
    }
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  await server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  await server.stop();
  process.exit(0);
});

// Start the server
const server = new PostgresMCPServer();
server.start().catch((error) => {
  logger.error("Unhandled error during server startup:", error);
  process.exit(1);
});
