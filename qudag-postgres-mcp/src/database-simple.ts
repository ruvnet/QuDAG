/**
 * @description Simplified database connection for PostgreSQL MCP Server
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Simplified implementation
 */

import { Pool, QueryResult, QueryResultRow } from "pg";
import { appConfig } from "./config";
import { logger } from "./logger";

export class DatabaseManager {
  private pool: Pool | null = null;
  private isConnected = false;

  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing PostgreSQL connection pool...");

      this.pool = new Pool({
        connectionString: appConfig.database.url,
        max: appConfig.database.maxConnections,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 5000,
        statement_timeout: appConfig.database.queryTimeout,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query("SELECT 1 as test");
      client.release();

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
  getPool(): Pool {
    if (!this.pool || !this.isConnected) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.pool;
  }

  /**
   * Execute a query with parameters
   */
  async executeQuery<T extends QueryResultRow = any>(
    query: string,
    values?: any[]
  ): Promise<QueryResult<T>> {
    const pool = this.getPool();

    try {
      logger.debug("Executing query:", {
        query: query.slice(0, 100),
        valueCount: values?.length || 0,
      });

      const result = await pool.query<T>(query, values);

      return result;
    } catch (error) {
      logger.error("Query execution failed:", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: query.slice(0, 100) + "...",
        valueCount: values?.length || 0,
      });
      throw error;
    }
  }

  /**
   * Execute a query with transaction support
   */
  async executeTransaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      logger.debug("Starting database transaction");
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      logger.debug("Transaction completed successfully");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error("Transaction failed:", error);
      throw error;
    } finally {
      client.release();
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
      const tablesResult = await pool.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
        [schemaName]
      );

      const tables = [];

      for (const table of tablesResult.rows) {
        const tableName = table.table_name as string;

        // Get columns for each table
        const columnsResult = await pool.query(
          `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1
          AND table_name = $2
          ORDER BY ordinal_position
        `,
          [schemaName, tableName]
        );

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

      const result = await this.pool.query(`
        SELECT 
          current_database() as database,
          current_user as user,
          version() as version,
          now() as timestamp
      `);

      return {
        status: "healthy",
        details: {
          database: result.rows[0].database,
          user: result.rows[0].user,
          timestamp: result.rows[0].timestamp,
          poolConnections: this.pool.totalCount,
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
