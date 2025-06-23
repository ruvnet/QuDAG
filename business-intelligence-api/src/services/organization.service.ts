/**
 * @description Organization service for business logic
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial organization service
 */

import { DatabasePool } from 'slonik';
import Redis from 'ioredis';
import { OrganizationModel } from '../models/organization';
import { Organization, FilterParams, PaginationParams } from '../types';
import { logger } from '../utils/logger';

export class OrganizationService {
  private model: OrganizationModel;
  private redis: Redis;

  constructor(db: DatabasePool, redis: Redis) {
    this.model = new OrganizationModel(db);
    this.redis = redis;
  }

  /**
   * @description Get organization by ID
   * @param {string} id - Organization ID
   * @returns {Promise<Organization | null>} Organization or null
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getById(id: string): Promise<Organization | null> {
    try {
      return await this.model.getById(id);
    } catch (error) {
      logger.error({ error, id }, 'Failed to get organization');
      throw error;
    }
  }

  /**
   * @description Get organization by tenant ID
   * @param {string} tenantId - Firebase/Auth tenant ID
   * @returns {Promise<Organization | null>} Organization or null
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getByTenantId(tenantId: string): Promise<Organization | null> {
    try {
      return await this.model.getByTenantId(tenantId);
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get organization by tenant ID');
      throw error;
    }
  }

  /**
   * @description Create new organization with default settings
   * @param {Partial<Organization>} data - Organization data
   * @returns {Promise<Organization>} Created organization
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async create(data: Partial<Organization>): Promise<Organization> {
    try {
      // Validate required fields
      if (!data.tenant_id || !data.name) {
        throw new Error('Missing required fields: tenant_id and name');
      }

      // Set default settings if not provided
      if (!data.settings) {
        data.settings = {
          theme: 'dark',
          language: 'en',
          timezone: 'UTC',
          features: {
            voice_commands: true,
            predictive_analytics: true,
            auto_scaling: true,
          },
        };
      }

      const org = await this.model.create(data);
      
      logger.info({ organizationId: org.id }, 'Organization created');
      
      // Emit event for other services
      await this.redis.publish('organization:created', JSON.stringify(org));
      
      return org;
    } catch (error) {
      logger.error({ error, data }, 'Failed to create organization');
      throw error;
    }
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
    try {
      const org = await this.model.update(id, data);
      
      logger.info({ organizationId: id }, 'Organization updated');
      
      // Emit event for other services
      await this.redis.publish('organization:updated', JSON.stringify(org));
      
      return org;
    } catch (error) {
      logger.error({ error, id, data }, 'Failed to update organization');
      throw error;
    }
  }

  /**
   * @description List organizations
   * @param {FilterParams[]} filters - Filter conditions
   * @param {PaginationParams} pagination - Pagination parameters
   * @returns {Promise<{items: Organization[], total: number}>} Organizations
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async list(
    filters: FilterParams[] = [],
    pagination: PaginationParams = { limit: 20, offset: 0 }
  ): Promise<{ items: Organization[]; total: number }> {
    try {
      return await this.model.list(filters, pagination);
    } catch (error) {
      logger.error({ error, filters, pagination }, 'Failed to list organizations');
      throw error;
    }
  }

  /**
   * @description Update organization settings
   * @param {string} id - Organization ID
   * @param {Partial<Organization['settings']>} settings - Settings to update
   * @returns {Promise<Organization>} Updated organization
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async updateSettings(
    id: string,
    settings: Partial<Organization['settings']>
  ): Promise<Organization> {
    try {
      // Get current organization
      const org = await this.getById(id);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Merge settings
      const updatedSettings = {
        ...org.settings,
        ...settings,
        features: {
          ...org.settings.features,
          ...(settings.features || {}),
        },
      };

      return await this.update(id, { settings: updatedSettings });
    } catch (error) {
      logger.error({ error, id, settings }, 'Failed to update organization settings');
      throw error;
    }
  }

  /**
   * @description Enable/disable feature for organization
   * @param {string} id - Organization ID
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Enable or disable
   * @returns {Promise<Organization>} Updated organization
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async toggleFeature(
    id: string,
    feature: keyof Organization['settings']['features'],
    enabled: boolean
  ): Promise<Organization> {
    try {
      const org = await this.getById(id);
      if (!org) {
        throw new Error('Organization not found');
      }

      const updatedSettings = {
        ...org.settings,
        features: {
          ...org.settings.features,
          [feature]: enabled,
        },
      };

      return await this.update(id, { settings: updatedSettings });
    } catch (error) {
      logger.error({ error, id, feature, enabled }, 'Failed to toggle feature');
      throw error;
    }
  }

  /**
   * @description Delete organization (soft delete)
   * @param {string} id - Organization ID
   * @returns {Promise<boolean>} Success status
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.model.delete(id);
      
      if (result) {
        logger.info({ organizationId: id }, 'Organization deleted');
        
        // Emit event for cleanup
        await this.redis.publish('organization:deleted', JSON.stringify({ id }));
      }
      
      return result;
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete organization');
      throw error;
    }
  }
}