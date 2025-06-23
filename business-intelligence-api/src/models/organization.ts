/**
 * @description Organization model for managing company data
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial organization model
 */

import { sql } from 'slonik';
import { BaseModel } from './base';
import { Organization, FilterParams, PaginationParams } from '../types';
import { cacheKeys, withCache, invalidateCache } from '../cache';
import { config } from '../config';

export class OrganizationModel extends BaseModel<Organization> {
  constructor(db?: any) {
    super('organizations', db);
  }

  /**
   * @description Get organization by ID
   * @param {string} id - Organization UUID
   * @returns {Promise<Organization | null>} Organization or null if not found
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getById(id: string): Promise<Organization | null> {
    const cacheKey = cacheKeys.organization(id);
    
    return withCache(cacheKey, async () => {
      const query = sql`
        SELECT 
          id::text,
          tenant_id::text,
          name,
          logo_url,
          industry,
          size,
          created_at,
          updated_at,
          settings,
          metadata
        FROM ${this.table}
        WHERE id = ${id}
      `;

      const result = await this.executeQuery(query);
      return result.rows[0] || null;
    }, config.redis.ttl.organization);
  }

  /**
   * @description Get organization by tenant ID
   * @param {string} tenantId - Firebase/Auth tenant ID
   * @returns {Promise<Organization | null>} Organization or null if not found
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getByTenantId(tenantId: string): Promise<Organization | null> {
    const query = sql`
      SELECT 
        id::text,
        tenant_id::text,
        name,
        logo_url,
        industry,
        size,
        created_at,
        updated_at,
        settings,
        metadata
      FROM ${this.table}
      WHERE tenant_id = ${tenantId}
    `;

    const result = await this.executeQuery(query);
    return result.rows[0] || null;
  }

  /**
   * @description Create new organization
   * @param {Partial<Organization>} data - Organization data
   * @returns {Promise<Organization>} Created organization
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async create(data: Partial<Organization>): Promise<Organization> {
    const query = sql`
      INSERT INTO ${this.table} (
        tenant_id,
        name,
        logo_url,
        industry,
        size,
        settings,
        metadata
      ) VALUES (
        ${data.tenant_id},
        ${data.name},
        ${data.logo_url || null},
        ${data.industry || null},
        ${data.size || null},
        ${sql.json(data.settings || {
          theme: 'dark',
          language: 'en',
          timezone: 'UTC',
          features: {
            voice_commands: true,
            predictive_analytics: true,
            auto_scaling: true
          }
        })},
        ${sql.json(data.metadata || {})}
      )
      RETURNING 
        id::text,
        tenant_id::text,
        name,
        logo_url,
        industry,
        size,
        created_at,
        updated_at,
        settings,
        metadata
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  /**
   * @description Update organization
   * @param {string} id - Organization ID
   * @param {Partial<Organization>} data - Update data
   * @returns {Promise<Organization>} Updated organization
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    const updateFields = [];
    const values = [];

    if (data.name !== undefined) {
      updateFields.push(sql`name = ${data.name}`);
    }
    if (data.logo_url !== undefined) {
      updateFields.push(sql`logo_url = ${data.logo_url}`);
    }
    if (data.industry !== undefined) {
      updateFields.push(sql`industry = ${data.industry}`);
    }
    if (data.size !== undefined) {
      updateFields.push(sql`size = ${data.size}`);
    }
    if (data.settings !== undefined) {
      updateFields.push(sql`settings = ${sql.json(data.settings)}`);
    }
    if (data.metadata !== undefined) {
      updateFields.push(sql`metadata = ${sql.json(data.metadata)}`);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = sql`
      UPDATE ${this.table}
      SET ${sql.join(updateFields, sql`, `)}
      WHERE id = ${id}
      RETURNING 
        id::text,
        tenant_id::text,
        name,
        logo_url,
        industry,
        size,
        created_at,
        updated_at,
        settings,
        metadata
    `;

    const result = await this.executeQuery(query);
    
    // Invalidate cache
    await invalidateCache(cacheKeys.organization(id));
    
    return result.rows[0];
  }

  /**
   * @description List organizations with filters
   * @param {FilterParams[]} filters - Filter conditions
   * @param {PaginationParams} pagination - Pagination parameters
   * @returns {Promise<{items: Organization[], total: number}>} Organizations and total count
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async list(
    filters: FilterParams[] = [],
    pagination: PaginationParams = { limit: 20, offset: 0 }
  ): Promise<{ items: Organization[]; total: number }> {
    const whereClause = this.buildFilters(filters);
    
    // Get total count
    const countQuery = sql`
      SELECT COUNT(*) as total
      FROM ${this.table}
      WHERE ${whereClause}
    `;
    
    const countResult = await this.executeQuery(countQuery);
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Get paginated results
    const query = sql`
      SELECT 
        id::text,
        tenant_id::text,
        name,
        logo_url,
        industry,
        size,
        created_at,
        updated_at,
        settings,
        metadata
      FROM ${this.table}
      WHERE ${whereClause}
      ORDER BY created_at DESC
      ${this.buildPagination(pagination)}
    `;
    
    const result = await this.executeQuery(query);
    
    return {
      items: result.rows,
      total,
    };
  }

  /**
   * @description Delete organization (soft delete by updating status)
   * @param {string} id - Organization ID
   * @returns {Promise<boolean>} Success status
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async delete(id: string): Promise<boolean> {
    const query = sql`
      UPDATE ${this.table}
      SET 
        metadata = jsonb_set(metadata, '{deleted}', 'true'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    
    const result = await this.executeQuery(query);
    
    // Invalidate cache
    await invalidateCache(cacheKeys.organization(id));
    
    return result.rowCount > 0;
  }
}