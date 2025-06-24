/**
 * @description Database connection and query utilities for PostgreSQL MCP Server
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Initial implementation
 */

import {
  createPool,
  sql,
  type DatabasePool,
  type DatabaseTransactionConnection,
  type QueryResult,
  type QueryContext,
  type Query,
  type QueryResultRow,
} from "slonik";
import { appConfig } from "./config";
import { logger } from "./logger";

export class DatabaseManager {
  private pool: DatabasePool | null = null;
  private isConnected = false;

  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing PostgreSQL connection pool...");

      this.pool = await createPool(appConfig.database.url, {
        maximumPoolSize: appConfig.database.maxConnections,
        connectionTimeout: 5000,
        idleTimeout: 60000,
        statementTimeout: appConfig.database.queryTimeout,
        interceptors: [
          {
            // Query logging interceptor
            beforePoolConnection: async (context) => {
              logger.debug("Creating new database connection");
              return null;
            },
            afterPoolConnection: async (context, connection) => {
              logger.debug("Database connection established");
              return null;
            },
            beforeQueryExecution: async (context, query) => {
              if (appConfig.logging.level === "debug") {
                logger.debug("Executing query:", {
                  sql:
                    query.sql.slice(0, 200) +
                    (query.sql.length > 200 ? "..." : ""),
                  values: query.values?.slice(0, 5),
                });
              }
              return null;
            },
            afterQueryExecution: async (context, query, result) => {
              if (appConfig.security.auditLog) {
                logger.info("Query executed", {
                  rowCount: result.rowCount,
                  duration: Date.now() - Date.now(), // Simple placeholder for now
                });
              }
              return null;
            },
          },
        ],
      });

      // Test connection
      await this.pool.query(sql`SELECT 1 as test`);
      this.isConnected = true;

      logger.info("Database connection pool initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize database connection:", error);
      throw new Error(
        `Database initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get database pool instance
   */
  getPool(): DatabasePool {
    if (!this.pool || !this.isConnected) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.pool;
  }

  /**
   * Execute a safe query with proper error handling
   * Note: This method is deprecated in favor of the tools-based approach
   */
  async executeQuery<T = any>(
    query: string,
    values: any[] = [],
    options: { maxRows?: number; timeout?: number } = {}
  ): Promise<QueryResult<T>> {
    // For this MCP server, we'll disable dynamic SQL execution
    // Users should use the specific tool methods instead
    throw new Error(
      "Dynamic SQL execution not supported. Use the specific MCP tools for database operations."
    );
  }

  /**
   * Execute a query with transaction support
   */
  async executeTransaction<T>(
    callback: (connection: DatabaseTransactionConnection) => Promise<T>
  ): Promise<T> {
    const pool = this.getPool();

    try {
      logger.debug("Starting database transaction");
      const result = await pool.transaction(callback);
      logger.debug("Transaction completed successfully");
      return result;
    } catch (error) {
      logger.error("Transaction failed:", error);
      throw error;
    }
  }

  /**
   * Get table information for a schema
   */
  async getSchemaInfo(schemaName: string): Promise<{
    tables: Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        default: string | null;
      }>;
    }>;
  }> {
    const pool = this.getPool();

    try {
      // Get tables in schema
      const tablesResult = await pool.query(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schemaName}
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tables = [];

      for (const table of tablesResult.rows) {
        const tableName = table.table_name as string;

        // Get columns for each table
        const columnsResult = await pool.query(sql`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = ${schemaName}
          AND table_name = ${tableName}
          ORDER BY ordinal_position
        `);

        tables.push({
          name: tableName,
          columns: columnsResult.rows.map((col) => ({
            name: col.column_name as string,
            type: col.data_type as string,
            nullable: col.is_nullable === "YES",
            default: col.column_default as string | null,
          })),
        });
      }

      return { tables };
    } catch (error) {
      logger.error(`Failed to get schema info for ${schemaName}:`, error);
      throw error;
    }
  }

  /**
   * Validate schema access
   */
  isSchemaAllowed(schemaName: string): boolean {
    return appConfig.security.allowedSchemas.includes(schemaName);
  }

  /**
   * Check if operation is allowed based on access mode
   */
  isOperationAllowed(
    operation: "read" | "write" | "admin" | "delete"
  ): boolean {
    if (appConfig.security.accessMode === "unrestricted") {
      return true;
    }

    // In restricted mode, only allow read operations by default
    switch (operation) {
      case "read":
        return true;
      case "write":
      case "admin":
      case "delete":
        return false; // Only read allowed in restricted mode
      default:
        return false;
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      logger.info("Closing database connection pool...");
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info("Database connection pool closed");
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    details: any;
  }> {
    try {
      if (!this.isConnected || !this.pool) {
        return {
          status: "unhealthy",
          details: { error: "Database not connected" },
        };
      }

      const result = await this.pool.query(sql`
        SELECT 
          current_database() as database,
          current_user as user,
          version() as version,
          now() as timestamp
      `);

      return {
        status: "healthy",
        details: {
          database: result.rows[0]?.database,
          user: result.rows[0]?.user,
          timestamp: result.rows[0]?.timestamp,
          poolConnections: "N/A", // Pool connections info not available in this version
          accessMode: appConfig.security.accessMode,
          allowedSchemas: appConfig.security.allowedSchemas,
        },
      };
    } catch (error) {
      logger.error("Database health check failed:", error);
      return {
        status: "unhealthy",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}

// Export singleton instance
export const db = new DatabaseManager();
