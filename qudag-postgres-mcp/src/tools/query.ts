/**
 * @description Query tools for PostgreSQL MCP Server
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Initial implementation
 */

import { z } from "zod";
import { db } from "../database";
import { appConfig } from "../config";

// Query parameters schema
const querySchema = z.object({
  sql: z.string().min(1, "SQL query is required"),
  schema: z.string().default("executive"),
  limit: z.number().min(1).max(10000).optional(),
  format: z.enum(["json", "csv", "table"]).default("json"),
});

const schemaInfoSchema = z.object({
  schema: z.string().default("executive"),
  format: z.enum(["json", "markdown", "mermaid"]).default("json"),
});

const explainQuerySchema = z.object({
  sql: z.string().min(1, "SQL query is required"),
  analyze: z.boolean().default(false),
  buffers: z.boolean().default(false),
});

/**
 * Execute a safe SQL query
 */
export async function executeQuery(params: any) {
  const { sql: query, schema, limit, format } = querySchema.parse(params);

  // Security checks
  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  if (!db.isOperationAllowed("read")) {
    throw new Error("Read operations not allowed in current access mode");
  }

  // Validate query for safety (basic checks)
  const upperQuery = query.toUpperCase().trim();
  const dangerousKeywords = [
    "DROP",
    "DELETE",
    "UPDATE",
    "INSERT",
    "ALTER",
    "CREATE",
    "TRUNCATE",
  ];

  if (appConfig.security.accessMode === "restricted") {
    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        throw new Error(
          `Operation '${keyword}' not allowed in restricted mode`
        );
      }
    }
  }

  try {
    // Add schema qualification if not present
    let finalQuery = query;
    if (
      !query.toLowerCase().includes("from " + schema + ".") &&
      !query.toLowerCase().includes("from " + schema)
    ) {
      // This is a basic schema injection - in production, use proper query parsing
      finalQuery = query.replace(/FROM\s+(\w+)/gi, `FROM ${schema}.$1`);
    }

    const options: { maxRows?: number; timeout?: number } = {};
    if (typeof limit === "number") {
      options.maxRows = limit;
    }
    const result = await db.executeQuery(finalQuery, [], options);

    // Format response based on requested format
    switch (format) {
      case "csv":
        return formatAsCSV(result.rows);
      case "table":
        return formatAsTable(result.rows);
      default:
        return {
          success: true,
          data: result.rows,
          rowCount: result.rowCount,
          query: finalQuery,
          executionTime: Date.now(),
        };
    }
  } catch (error) {
    throw new Error(
      `Query execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get schema information
 */
export async function getSchemaInfo(params: any) {
  const { schema, format } = schemaInfoSchema.parse(params);

  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  try {
    const schemaInfo = await db.getSchemaInfo(schema);

    switch (format) {
      case "markdown":
        return formatSchemaAsMarkdown(schemaInfo, schema);
      case "mermaid":
        return formatSchemaAsMermaid(schemaInfo, schema);
      default:
        return {
          success: true,
          schema,
          ...schemaInfo,
        };
    }
  } catch (error) {
    throw new Error(
      `Failed to get schema info: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Explain query execution plan
 */
export async function explainQuery(params: any) {
  const { sql: query, analyze, buffers } = explainQuerySchema.parse(params);

  if (!db.isOperationAllowed("read")) {
    throw new Error("Query analysis not allowed in current access mode");
  }

  try {
    let explainQuery = "EXPLAIN";
    if (analyze) explainQuery += " (ANALYZE true";
    if (buffers) explainQuery += ", BUFFERS true";
    if (analyze || buffers) explainQuery += ")";
    explainQuery += ` ${query}`;

    const result = await db.executeQuery(explainQuery);

    return {
      success: true,
      plan: result.rows,
      query: query,
      explainOptions: { analyze, buffers },
    };
  } catch (error) {
    throw new Error(
      `Query explain failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get database health and statistics
 */
export async function getDatabaseHealth() {
  if (!db.isOperationAllowed("read")) {
    throw new Error("Health check not allowed in current access mode");
  }

  try {
    const health = await db.healthCheck();

    // Get additional stats if allowed
    const stats = await db.executeQuery(
      `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        last_vacuum,
        last_analyze
      FROM pg_stat_user_tables 
      WHERE schemaname = ANY($1)
      ORDER BY n_live_tup DESC
              LIMIT 10
      `,
      [...appConfig.security.allowedSchemas]
    );

    return {
      success: true,
      health: health.status,
      details: health.details,
      tableStats: stats.rows,
    };
  } catch (error) {
    throw new Error(
      `Health check failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Search tables and columns
 */
export async function searchDatabase(params: any) {
  const searchSchema = z.object({
    term: z.string().min(1, "Search term is required"),
    schema: z.string().default("executive"),
    searchIn: z.enum(["tables", "columns", "both"]).default("both"),
  });

  const { term, schema, searchIn } = searchSchema.parse(params);

  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  try {
    const results: any = { tables: [], columns: [] };

    if (searchIn === "tables" || searchIn === "both") {
      const tableResults = await db.executeQuery(
        `
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = $1 
        AND table_name ILIKE $2
        ORDER BY table_name
      `,
        [schema, `%${term}%`]
      );
      results.tables = tableResults.rows;
    }

    if (searchIn === "columns" || searchIn === "both") {
      const columnResults = await db.executeQuery(
        `
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1 
        AND column_name ILIKE $2
        ORDER BY table_name, column_name
      `,
        [schema, `%${term}%`]
      );
      results.columns = columnResults.rows;
    }

    return {
      success: true,
      searchTerm: term,
      schema,
      ...results,
    };
  } catch (error) {
    throw new Error(
      `Database search failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Helper functions for formatting

function formatAsCSV(rows: any[]): string {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]).join(",");
  const data = rows
    .map((row) =>
      Object.values(row)
        .map((val) =>
          typeof val === "string" && val.includes(",") ?
            `"${val}"`
          : String(val)
        )
        .join(",")
    )
    .join("\n");

  return headers + "\n" + data;
}

function formatAsTable(rows: any[]): string {
  if (!rows.length) return "No data found";

  const headers = Object.keys(rows[0]);
  const maxWidths = headers.map((header) =>
    Math.max(
      header.length,
      ...rows.map((row) => String(row[header] || "").length)
    )
  );

  const separator =
    "+" + maxWidths.map((width) => "-".repeat(width + 2)).join("+") + "+";
  const headerRow =
    "|" +
    headers.map((header, i) => ` ${header.padEnd(maxWidths[i])} `).join("|") +
    "|";

  const dataRows = rows.map(
    (row) =>
      "|" +
      headers
        .map(
          (header, i) => ` ${String(row[header] || "").padEnd(maxWidths[i])} `
        )
        .join("|") +
      "|"
  );

  return [separator, headerRow, separator, ...dataRows, separator].join("\n");
}

function formatSchemaAsMarkdown(schemaInfo: any, schemaName: string): string {
  let markdown = `# Database Schema: ${schemaName}\n\n`;

  for (const table of schemaInfo.tables) {
    markdown += `## Table: ${table.name}\n\n`;
    markdown += "| Column | Type | Nullable | Default |\n";
    markdown += "|--------|------|----------|----------|\n";

    for (const column of table.columns) {
      markdown += `| ${column.name} | ${column.type} | ${column.nullable ? "Yes" : "No"} | ${column.default || "NULL"} |\n`;
    }
    markdown += "\n";
  }

  return markdown;
}

function formatSchemaAsMermaid(schemaInfo: any, schemaName: string): string {
  let mermaid = "erDiagram\n";

  for (const table of schemaInfo.tables) {
    mermaid += `  ${table.name.toUpperCase()} {\n`;
    for (const column of table.columns) {
      const type = column.type.toLowerCase();
      const key = column.name.toLowerCase().includes("id") ? "PK" : "";
      mermaid += `    ${type} ${column.name} ${key}\n`;
    }
    mermaid += "  }\n";
  }

  return mermaid;
}
