/**
 * @description Base model class for database operations
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial base model implementation
 */

import { DatabasePool, sql } from 'slonik';
import { getDb } from '../db';
import { getRedis } from '../cache';
import { logger } from '../utils/logger';
import { PaginationParams, FilterParams, SortParams } from '../types';

export abstract class BaseModel<T> {
  protected db: DatabasePool;
  protected tableName: string;
  protected schema: string = 'executive';

  constructor(tableName: string, db?: DatabasePool) {
    this.db = db || getDb();
    this.tableName = tableName;
  }

  /**
   * @description Build filter conditions for queries
   * @param {FilterParams[]} filters - Array of filter parameters
   * @returns {any} SQL fragment for WHERE clause
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  protected buildFilters(filters: FilterParams[]): any {
    if (!filters || filters.length === 0) {
      return sql`TRUE`;
    }

    const conditions = filters.map(filter => {
      const { field, operator, value } = filter;
      
      switch (operator) {
        case '=':
          return sql`${sql.identifier([field])} = ${value}`;
        case '!=':
          return sql`${sql.identifier([field])} != ${value}`;
        case '>':
          return sql`${sql.identifier([field])} > ${value}`;
        case '<':
          return sql`${sql.identifier([field])} < ${value}`;
        case '>=':
          return sql`${sql.identifier([field])} >= ${value}`;
        case '<=':
          return sql`${sql.identifier([field])} <= ${value}`;
        case 'LIKE':
          return sql`${sql.identifier([field])} LIKE ${value}`;
        case 'IN':
          return sql`${sql.identifier([field])} = ANY(${sql.array(value, 'text')})`;
        case 'IS NULL':
          return sql`${sql.identifier([field])} IS NULL`;
        case 'IS NOT NULL':
          return sql`${sql.identifier([field])} IS NOT NULL`;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    });

    return sql`${sql.join(conditions, sql` AND `)}`;
  }

  /**
   * @description Build ORDER BY clause
   * @param {SortParams[]} sorts - Array of sort parameters
   * @returns {any} SQL fragment for ORDER BY clause
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  protected buildOrderBy(sorts: SortParams[]): any {
    if (!sorts || sorts.length === 0) {
      return sql`created_at DESC`;
    }

    const orderClauses = sorts.map(sort => {
      const direction = sort.direction.toUpperCase() === 'DESC' ? sql`DESC` : sql`ASC`;
      return sql`${sql.identifier([sort.field])} ${direction}`;
    });

    return sql`${sql.join(orderClauses, sql`, `)}`;
  }

  /**
   * @description Apply pagination to query
   * @param {PaginationParams} pagination - Pagination parameters
   * @returns {any} SQL fragment for LIMIT and OFFSET
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  protected buildPagination(pagination: PaginationParams): any {
    return sql`LIMIT ${pagination.limit} OFFSET ${pagination.offset}`;
  }

  /**
   * @description Execute a query with error handling
   * @param {any} query - Slonik query
   * @returns {Promise<any>} Query result
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  protected async executeQuery(query: any): Promise<any> {
    try {
      return await this.db.query(query);
    } catch (error) {
      logger.error({ error, query: query.sql }, 'Database query failed');
      throw error;
    }
  }

  /**
   * @description Get full table name with schema
   * @returns {any} SQL identifier for table
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  protected get table(): any {
    return sql.identifier([this.schema, this.tableName]);
  }
}