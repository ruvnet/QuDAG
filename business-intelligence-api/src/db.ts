/**
 * @description Database connection and query utilities
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial database setup with Slonik
 */

import {
  createPool,
  DatabasePool,
  sql,
  createTypeParserPreset,
  createBigintTypeParser,
  createTimestampTypeParser,
  createTimestampWithTimeZoneTypeParser,
  createNumericTypeParser,
} from 'slonik';
import { config } from './config';
import { logger } from './utils/logger';
import { Decimal } from 'decimal.js';

// Custom type parsers
const customTypeParser = createTypeParserPreset({
  ...createBigintTypeParser(),
  ...createTimestampTypeParser(),
  ...createTimestampWithTimeZoneTypeParser(),
  ...createNumericTypeParser((value) => new Decimal(value)),
});

let pool: DatabasePool | null = null;

/**
 * @description Initialize database connection pool
 * @returns {Promise<DatabasePool>} Database connection pool
 * @throws {Error} If connection fails
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function setupDatabase(): Promise<DatabasePool> {
  if (pool) {
    return pool;
  }

  try {
    pool = await createPool(config.database.connectionString, {
      maximumPoolSize: config.database.poolSize,
      typeParsers: [...customTypeParser],
      interceptors: [
        {
          // Log slow queries
          afterQueryExecution: async (context, query, result) => {
            const { executionTime } = context;
            if (executionTime > 1000) {
              logger.warn({
                query: query.sql,
                duration: executionTime,
                rowCount: result.rowCount,
              }, 'Slow query detected');
            }
            return result;
          },
          // Log query errors
          queryExecutionError: async (context, query, error) => {
            logger.error({
              query: query.sql,
              error: error.message,
            }, 'Query execution error');
            throw error;
          },
        },
      ],
    });

    // Test connection
    await pool.query(sql`SELECT 1`);
    logger.info('Database connection established');

    return pool;
  } catch (error) {
    logger.error(error, 'Failed to connect to database');
    throw error;
  }
}

/**
 * @description Get the database pool instance
 * @returns {DatabasePool} Database connection pool
 * @throws {Error} If pool not initialized
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export function getDb(): DatabasePool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call setupDatabase() first.');
  }
  return pool;
}

/**
 * @description Close database connections
 * @returns {Promise<void>}
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connections closed');
  }
}

// Export commonly used Slonik utilities
export { sql, DatabasePool } from 'slonik';
export type { QueryResult } from 'slonik';