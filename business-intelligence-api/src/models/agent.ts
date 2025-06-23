/**
 * @description Agent profile model for managing AI workforce
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial agent model implementation
 */

import { sql } from 'slonik';
import { BaseModel } from './base';
import { AgentProfile, FilterParams, PaginationParams, SortParams } from '../types';
import { cacheKeys, withCache, invalidateCache } from '../cache';
import { config } from '../config';
import { Decimal } from 'decimal.js';

export class AgentModel extends BaseModel<AgentProfile> {
  constructor(db?: any) {
    super('agent_profiles', db);
  }

  /**
   * @description Get agent by ID
   * @param {string} agentId - QuDAG agent ID
   * @returns {Promise<AgentProfile | null>} Agent profile or null
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getById(agentId: string): Promise<AgentProfile | null> {
    const cacheKey = cacheKeys.agent(agentId);
    
    return withCache(cacheKey, async () => {
      const query = sql`
        SELECT 
          agent_id,
          organization_id::text,
          department_id::text,
          business_role,
          title,
          level,
          personality_type,
          personality_traits,
          compatibility,
          cost_per_hour,
          hired_at,
          last_active,
          status,
          performance_rating,
          custom_settings,
          metadata
        FROM ${this.table}
        WHERE agent_id = ${agentId}
      `;

      const result = await this.executeQuery(query);
      return result.rows[0] || null;
    }, config.redis.ttl.agents);
  }

  /**
   * @description Create new agent profile
   * @param {Partial<AgentProfile>} data - Agent data
   * @returns {Promise<AgentProfile>} Created agent profile
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async create(data: Partial<AgentProfile>): Promise<AgentProfile> {
    const query = sql`
      INSERT INTO ${this.table} (
        agent_id,
        organization_id,
        department_id,
        business_role,
        title,
        level,
        personality_type,
        personality_traits,
        compatibility,
        cost_per_hour,
        status,
        performance_rating,
        custom_settings,
        metadata
      ) VALUES (
        ${data.agent_id},
        ${data.organization_id},
        ${data.department_id || null},
        ${data.business_role},
        ${data.title || null},
        ${data.level},
        ${data.personality_type},
        ${sql.json(data.personality_traits || {
          speed: 50,
          accuracy: 50,
          creativity: 50,
          collaboration: 50
        })},
        ${sql.json(data.compatibility || {
          best_with: [],
          avoid_with: []
        })},
        ${data.cost_per_hour || 0},
        ${data.status || 'active'},
        ${data.performance_rating || 0},
        ${sql.json(data.custom_settings || {})},
        ${sql.json(data.metadata || {})}
      )
      RETURNING 
        agent_id,
        organization_id::text,
        department_id::text,
        business_role,
        title,
        level,
        personality_type,
        personality_traits,
        compatibility,
        cost_per_hour,
        hired_at,
        last_active,
        status,
        performance_rating,
        custom_settings,
        metadata
    `;

    const result = await this.executeQuery(query);
    return result.rows[0];
  }

  /**
   * @description Update agent profile
   * @param {string} agentId - Agent ID
   * @param {Partial<AgentProfile>} data - Update data
   * @returns {Promise<AgentProfile>} Updated agent profile
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async update(agentId: string, data: Partial<AgentProfile>): Promise<AgentProfile> {
    const updateFields = [];

    if (data.department_id !== undefined) {
      updateFields.push(sql`department_id = ${data.department_id}`);
    }
    if (data.business_role !== undefined) {
      updateFields.push(sql`business_role = ${data.business_role}`);
    }
    if (data.title !== undefined) {
      updateFields.push(sql`title = ${data.title}`);
    }
    if (data.level !== undefined) {
      updateFields.push(sql`level = ${data.level}`);
    }
    if (data.personality_type !== undefined) {
      updateFields.push(sql`personality_type = ${data.personality_type}`);
    }
    if (data.personality_traits !== undefined) {
      updateFields.push(sql`personality_traits = ${sql.json(data.personality_traits)}`);
    }
    if (data.compatibility !== undefined) {
      updateFields.push(sql`compatibility = ${sql.json(data.compatibility)}`);
    }
    if (data.cost_per_hour !== undefined) {
      updateFields.push(sql`cost_per_hour = ${data.cost_per_hour}`);
    }
    if (data.status !== undefined) {
      updateFields.push(sql`status = ${data.status}`);
    }
    if (data.performance_rating !== undefined) {
      updateFields.push(sql`performance_rating = ${data.performance_rating}`);
    }
    if (data.custom_settings !== undefined) {
      updateFields.push(sql`custom_settings = ${sql.json(data.custom_settings)}`);
    }
    if (data.metadata !== undefined) {
      updateFields.push(sql`metadata = ${sql.json(data.metadata)}`);
    }

    // Always update last_active
    updateFields.push(sql`last_active = CURRENT_TIMESTAMP`);

    const query = sql`
      UPDATE ${this.table}
      SET ${sql.join(updateFields, sql`, `)}
      WHERE agent_id = ${agentId}
      RETURNING 
        agent_id,
        organization_id::text,
        department_id::text,
        business_role,
        title,
        level,
        personality_type,
        personality_traits,
        compatibility,
        cost_per_hour,
        hired_at,
        last_active,
        status,
        performance_rating,
        custom_settings,
        metadata
    `;

    const result = await this.executeQuery(query);
    
    // Invalidate cache
    await invalidateCache(cacheKeys.agent(agentId));
    
    return result.rows[0];
  }

  /**
   * @description List agents for organization with filters
   * @param {string} organizationId - Organization ID
   * @param {FilterParams[]} filters - Additional filters
   * @param {SortParams[]} sorts - Sort parameters
   * @param {PaginationParams} pagination - Pagination parameters
   * @returns {Promise<{items: AgentProfile[], total: number}>} Agents and total count
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async listByOrganization(
    organizationId: string,
    filters: FilterParams[] = [],
    sorts: SortParams[] = [],
    pagination: PaginationParams = { limit: 20, offset: 0 }
  ): Promise<{ items: AgentProfile[]; total: number }> {
    // Add organization filter
    const allFilters = [
      { field: 'organization_id', operator: '=', value: organizationId },
      ...filters
    ];
    
    const whereClause = this.buildFilters(allFilters);
    const orderBy = this.buildOrderBy(sorts);
    
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
        agent_id,
        organization_id::text,
        department_id::text,
        business_role,
        title,
        level,
        personality_type,
        personality_traits,
        compatibility,
        cost_per_hour,
        hired_at,
        last_active,
        status,
        performance_rating,
        custom_settings,
        metadata
      FROM ${this.table}
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      ${this.buildPagination(pagination)}
    `;
    
    const result = await this.executeQuery(query);
    
    return {
      items: result.rows,
      total,
    };
  }

  /**
   * @description Get agents by department
   * @param {string} departmentId - Department ID
   * @returns {Promise<AgentProfile[]>} List of agents in department
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getByDepartment(departmentId: string): Promise<AgentProfile[]> {
    const query = sql`
      SELECT 
        agent_id,
        organization_id::text,
        department_id::text,
        business_role,
        title,
        level,
        personality_type,
        personality_traits,
        compatibility,
        cost_per_hour,
        hired_at,
        last_active,
        status,
        performance_rating,
        custom_settings,
        metadata
      FROM ${this.table}
      WHERE department_id = ${departmentId} AND status = 'active'
      ORDER BY performance_rating DESC, hired_at ASC
    `;
    
    const result = await this.executeQuery(query);
    return result.rows;
  }

  /**
   * @description Find compatible agents for collaboration
   * @param {string} agentId - Base agent ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<AgentProfile[]>} Compatible agents
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async findCompatibleAgents(
    agentId: string,
    organizationId: string
  ): Promise<AgentProfile[]> {
    // First get the agent's compatibility data
    const agent = await this.getById(agentId);
    if (!agent) {
      return [];
    }

    const query = sql`
      SELECT 
        agent_id,
        organization_id::text,
        department_id::text,
        business_role,
        title,
        level,
        personality_type,
        personality_traits,
        compatibility,
        cost_per_hour,
        hired_at,
        last_active,
        status,
        performance_rating,
        custom_settings,
        metadata
      FROM ${this.table}
      WHERE 
        organization_id = ${organizationId}
        AND agent_id != ${agentId}
        AND status = 'active'
        ${agent.compatibility.best_with.length > 0 
          ? sql`AND agent_id = ANY(${sql.array(agent.compatibility.best_with, 'text')})`
          : sql``
        }
        ${agent.compatibility.avoid_with.length > 0
          ? sql`AND agent_id != ALL(${sql.array(agent.compatibility.avoid_with, 'text')})`
          : sql``
        }
      ORDER BY performance_rating DESC
      LIMIT 10
    `;
    
    const result = await this.executeQuery(query);
    return result.rows;
  }

  /**
   * @description Update agent status (active, idle, error, etc.)
   * @param {string} agentId - Agent ID
   * @param {string} status - New status
   * @returns {Promise<boolean>} Success status
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async updateStatus(agentId: string, status: string): Promise<boolean> {
    const query = sql`
      UPDATE ${this.table}
      SET 
        status = ${status},
        last_active = CURRENT_TIMESTAMP
      WHERE agent_id = ${agentId}
    `;
    
    const result = await this.executeQuery(query);
    
    // Invalidate cache
    await invalidateCache(cacheKeys.agent(agentId));
    
    return result.rowCount > 0;
  }

  /**
   * @description Retire agent (soft delete)
   * @param {string} agentId - Agent ID
   * @returns {Promise<boolean>} Success status
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async retire(agentId: string): Promise<boolean> {
    return this.updateStatus(agentId, 'retired');
  }
}