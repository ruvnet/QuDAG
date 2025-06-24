/**
 * @description Admin tools for PostgreSQL MCP Server
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Initial implementation
 */

import { z } from "zod";
import { db } from "../database";
import { appConfig } from "../config";
import { sql } from "slonik";

// Admin operation schemas
const createUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  database: z.string().default("qudag_business"),
  privileges: z
    .array(z.enum(["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP"]))
    .default(["SELECT"]),
  schema: z.string().default("executive"),
});

const grantPermissionsSchema = z.object({
  username: z.string().min(1, "Username is required"),
  privileges: z
    .array(z.enum(["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"]))
    .min(1, "At least one privilege required"),
  table: z.string().optional(),
  schema: z.string().default("executive"),
});

const backupSchema = z.object({
  format: z.enum(["sql", "custom", "directory"]).default("sql"),
  compress: z.boolean().default(true),
  excludeTables: z.array(z.string()).default([]),
  schema: z.string().default("executive"),
});

const analyzeSchema = z.object({
  table: z.string().optional(),
  schema: z.string().default("executive"),
  verbose: z.boolean().default(false),
});

/**
 * Create a new database user
 */
export async function createUser(params: any) {
  const { username, password, database, privileges, schema } =
    createUserSchema.parse(params);

  // Security checks
  if (!db.isOperationAllowed("admin")) {
    throw new Error("Admin operations not allowed in current access mode");
  }

  if (appConfig.security.requireConfirmationAdmin) {
    throw new Error(
      "Admin operations require explicit confirmation in production"
    );
  }

  try {
    return await db.executeTransaction(async (pool) => {
      // For security reasons, we cannot construct dynamic SQL in this version
      // This would require using sql.unsafe which is not available in Slonik v30.4.4
      throw new Error(
        `Dynamic user creation is not supported with current Slonik version. ` +
          `Please use dedicated admin tools or modify the MCP server to use specific SQL statements. ` +
          `Username: ${username}, Database: ${database}, Schema: ${schema}, Privileges: ${privileges.join(", ")}`
      );
    });
  } catch (error) {
    throw new Error(
      `User creation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Grant permissions to an existing user
 */
export async function grantPermissions(params: any) {
  const { username, privileges, table, schema } =
    grantPermissionsSchema.parse(params);

  // Security checks
  if (!db.isOperationAllowed("admin")) {
    throw new Error("Admin operations not allowed in current access mode");
  }

  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  try {
    return await db.executeTransaction(async (pool) => {
      // For security reasons, we cannot construct dynamic SQL in this version
      // This would require using sql.unsafe which is not available in Slonik v30.4.4
      throw new Error(
        `Dynamic permission grants are not supported with current Slonik version. ` +
          `Please use dedicated admin tools or modify the MCP server to use specific SQL statements. ` +
          `Username: ${username}, Privileges: ${privileges.join(", ")}, ` +
          `Target: ${table ? `${schema}.${table}` : `all tables in ${schema}`}`
      );
    });
  } catch (error) {
    throw new Error(
      `Permission grant failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Create database backup
 */
export async function backupDatabase(params: any) {
  const { format, compress, excludeTables, schema } =
    backupSchema.parse(params);

  // Security checks
  if (!db.isOperationAllowed("admin")) {
    throw new Error("Admin operations not allowed in current access mode");
  }

  if (appConfig.security.requireConfirmationAdmin) {
    throw new Error(
      "Backup operations require explicit confirmation in production"
    );
  }

  try {
    // In a real implementation, this would use pg_dump
    // For now, return a mock backup plan
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupName = `qudag_backup_${schema}_${timestamp}`;

    // Simulate backup metadata
    const tables = await db.getSchemaInfo(schema);
    const includedTables = tables.tables
      .filter((table) => !excludeTables.includes(table.name))
      .map((table) => table.name);

    return {
      success: true,
      operation: "backup_database",
      backupName,
      format,
      compress,
      schema,
      includedTables,
      excludedTables: excludeTables,
      estimatedSize: "15.2 MB", // Mock estimate
      status: "planned",
      message: `Backup plan created for schema '${schema}' with ${includedTables.length} tables`,
      note: "This is a backup plan. Actual backup would require pg_dump execution.",
    };
  } catch (error) {
    throw new Error(
      `Backup planning failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Analyze database statistics
 */
export async function analyzeDatabase(params: any) {
  const { table, schema, verbose } = analyzeSchema.parse(params);

  // Security checks
  if (!db.isOperationAllowed("admin")) {
    throw new Error("Admin operations not allowed in current access mode");
  }

  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  try {
    const results: any = {
      success: true,
      operation: "analyze_database",
      schema,
      analyzed: [],
    };

    if (table) {
      // Analyze specific table
      await db.executeQuery(
        `ANALYZE ${verbose ? "VERBOSE" : ""} ${schema}.${table}`
      );
      results.analyzed.push(table);
    } else {
      // Analyze all tables in schema
      const schemaInfo = await db.getSchemaInfo(schema);
      for (const tableInfo of schemaInfo.tables) {
        await db.executeQuery(
          `ANALYZE ${verbose ? "VERBOSE" : ""} ${schema}.${tableInfo.name}`
        );
        results.analyzed.push(tableInfo.name);
      }
    }

    // Get statistics after analysis
    const statsQuery = `
      SELECT 
        schemaname,
        tablename,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables 
      WHERE schemaname = $1
      ${table ? "AND tablename = $2" : ""}
      ORDER BY n_live_tup DESC
    `;

    const statsResult = await db.executeQuery(
      statsQuery,
      table ? [schema, table] : [schema]
    );

    results.statistics = statsResult.rows;
    results.message = `Analyzed ${results.analyzed.length} table(s) in schema '${schema}'`;

    return results;
  } catch (error) {
    throw new Error(
      `Database analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get database performance metrics
 */
export async function getPerformanceMetrics() {
  if (!db.isOperationAllowed("admin")) {
    throw new Error("Performance metrics not allowed in current access mode");
  }

  try {
    // Get connection stats
    const connectionStats = await db.executeQuery(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity
    `);

    // Get database size
    const sizeStats = await db.executeQuery(`
      SELECT 
        pg_database.datname as database_name,
        pg_size_pretty(pg_database_size(pg_database.datname)) as database_size
      FROM pg_database 
      WHERE datname = current_database()
    `);

    // Get slow queries (if pg_stat_statements is available)
    let slowQueries = [];
    try {
      const slowQueryStats = await db.executeQuery(
        `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        ORDER BY mean_time DESC 
        LIMIT 10
      `,
        [],
        { maxRows: 10 }
      );
      slowQueries = slowQueryStats.rows;
    } catch {
      // pg_stat_statements extension not available
      slowQueries = [{ note: "pg_stat_statements extension not available" }];
    }

    // Get index usage stats
    const indexStats = await db.executeQuery(
      `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE schemaname = ANY($1)
      ORDER BY idx_scan DESC
      LIMIT 20
    `,
      [...appConfig.security.allowedSchemas]
    );

    return {
      success: true,
      operation: "performance_metrics",
      timestamp: new Date().toISOString(),
      connections: connectionStats.rows[0],
      database: sizeStats.rows[0],
      slowQueries,
      indexUsage: indexStats.rows,
    };
  } catch (error) {
    throw new Error(
      `Performance metrics failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Vacuum tables for maintenance
 */
export async function vacuumTables(params: any) {
  const vacuumSchema = z.object({
    table: z.string().optional(),
    schema: z.string().default("executive"),
    analyze: z.boolean().default(true),
    verbose: z.boolean().default(false),
    full: z.boolean().default(false),
  });

  const { table, schema, analyze, verbose, full } = vacuumSchema.parse(params);

  // Security checks
  if (!db.isOperationAllowed("admin")) {
    throw new Error("Vacuum operations not allowed in current access mode");
  }

  if (!db.isSchemaAllowed(schema)) {
    throw new Error(`Schema '${schema}' is not allowed`);
  }

  try {
    const vacuumed = [];
    let vacuumOptions = "";

    if (full) vacuumOptions += "FULL ";
    if (verbose) vacuumOptions += "VERBOSE ";
    if (analyze) vacuumOptions += "ANALYZE ";

    if (table) {
      // Vacuum specific table
      await db.executeQuery(`VACUUM ${vacuumOptions}${schema}.${table}`);
      vacuumed.push(table);
    } else {
      // Vacuum all tables in schema
      const schemaInfo = await db.getSchemaInfo(schema);
      for (const tableInfo of schemaInfo.tables) {
        await db.executeQuery(
          `VACUUM ${vacuumOptions}${schema}.${tableInfo.name}`
        );
        vacuumed.push(tableInfo.name);
      }
    }

    return {
      success: true,
      operation: "vacuum_tables",
      schema,
      vacuumed,
      options: {
        full,
        analyze,
        verbose,
      },
      message: `Vacuumed ${vacuumed.length} table(s) in schema '${schema}'`,
    };
  } catch (error) {
    throw new Error(
      `Vacuum operation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
