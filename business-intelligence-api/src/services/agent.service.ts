/**
 * @description Agent management service for AI workforce operations
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial agent service implementation
 */

import { DatabasePool } from 'slonik';
import Redis from 'ioredis';
import { AgentModel } from '../models/agent';
import { AgentProfile, FilterParams, PaginationParams, SortParams } from '../types';
import { QuDAGIntegration } from './qudag-integration.service';
import { logger } from '../utils/logger';
import { Decimal } from 'decimal.js';

export class AgentService {
  private model: AgentModel;
  private redis: Redis;
  private qudag: QuDAGIntegration;

  constructor(db: DatabasePool, redis: Redis, qudag: QuDAGIntegration) {
    this.model = new AgentModel(db);
    this.redis = redis;
    this.qudag = qudag;

    // Listen for QuDAG events
    this.setupEventListeners();
  }

  /**
   * @description Setup event listeners for QuDAG updates
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private setupEventListeners(): void {
    // Update agent status in real-time
    this.qudag.on('agent:status', async (data) => {
      try {
        await this.updateStatus(data.agentId, data.status);
      } catch (error) {
        logger.error({ error, data }, 'Failed to update agent status from event');
      }
    });

    // Update performance metrics
    this.qudag.on('agent:performance', async (data) => {
      try {
        await this.updatePerformanceRating(data.agentId, data.rating);
      } catch (error) {
        logger.error({ error, data }, 'Failed to update agent performance from event');
      }
    });
  }

  /**
   * @description Hire a new agent
   * @param {any} params - Hiring parameters
   * @returns {Promise<AgentProfile>} Created agent profile
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async hireAgent(params: {
    organizationId: string;
    departmentId?: string;
    businessRole: string;
    title?: string;
    level: AgentProfile['level'];
    personalityType: AgentProfile['personality_type'];
    customRequirements?: any;
    budget?: number;
  }): Promise<AgentProfile> {
    try {
      // Map personality type to QuDAG capabilities
      const capabilityMap = {
        hunter: ['sales', 'lead_generation', 'negotiation'],
        farmer: ['customer_service', 'relationship_management', 'support'],
        analyst: ['data_analysis', 'reporting', 'forecasting'],
        creative: ['content_creation', 'design', 'innovation'],
        executor: ['task_management', 'process_optimization', 'automation'],
      };

      // Hire agent through QuDAG
      const quDagAgent = await this.qudag.hireAgent({
        personality: {
          type: params.personalityType,
          traits: this.generatePersonalityTraits(params.personalityType),
        },
        capabilities: capabilityMap[params.personalityType] || [],
        metadata: {
          organizationId: params.organizationId,
          departmentId: params.departmentId,
          businessRole: params.businessRole,
          level: params.level,
          ...params.customRequirements,
        },
      });

      // Create business profile
      const agentProfile = await this.model.create({
        agent_id: quDagAgent.id,
        organization_id: params.organizationId,
        department_id: params.departmentId,
        business_role: params.businessRole,
        title: params.title,
        level: params.level,
        personality_type: params.personalityType,
        personality_traits: quDagAgent.personality.traits,
        cost_per_hour: new Decimal(params.budget || this.calculateHourlyCost(params.level)),
        status: 'active',
        performance_rating: 3.0, // Start with average rating
      });

      logger.info({ agentId: quDagAgent.id, organizationId: params.organizationId }, 'Agent hired successfully');

      // Emit event
      await this.redis.publish('agent:hired', JSON.stringify(agentProfile));

      return agentProfile;
    } catch (error) {
      logger.error({ error, params }, 'Failed to hire agent');
      throw error;
    }
  }

  /**
   * @description Generate personality traits based on type
   * @param {string} type - Personality type
   * @returns {any} Personality traits
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private generatePersonalityTraits(type: string): any {
    const traitProfiles = {
      hunter: { speed: 80, accuracy: 60, creativity: 70, collaboration: 50 },
      farmer: { speed: 50, accuracy: 80, creativity: 40, collaboration: 90 },
      analyst: { speed: 60, accuracy: 90, creativity: 50, collaboration: 60 },
      creative: { speed: 40, accuracy: 60, creativity: 95, collaboration: 70 },
      executor: { speed: 90, accuracy: 75, creativity: 30, collaboration: 60 },
    };

    return traitProfiles[type as keyof typeof traitProfiles] || {
      speed: 50,
      accuracy: 50,
      creativity: 50,
      collaboration: 50,
    };
  }

  /**
   * @description Calculate hourly cost based on agent level
   * @param {string} level - Agent level
   * @returns {number} Hourly cost in rUv
   * @private
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  private calculateHourlyCost(level: string): number {
    const costMap = {
      executive: 100,
      manager: 50,
      specialist: 25,
      operator: 10,
    };

    return costMap[level as keyof typeof costMap] || 20;
  }

  /**
   * @description Get agent by ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<AgentProfile | null>} Agent profile
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async getById(agentId: string): Promise<AgentProfile | null> {
    try {
      return await this.model.getById(agentId);
    } catch (error) {
      logger.error({ error, agentId }, 'Failed to get agent');
      throw error;
    }
  }

  /**
   * @description List agents for organization
   * @param {string} organizationId - Organization ID
   * @param {FilterParams[]} filters - Filters
   * @param {SortParams[]} sorts - Sort parameters
   * @param {PaginationParams} pagination - Pagination
   * @returns {Promise<{items: AgentProfile[], total: number}>} Agents
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
    try {
      return await this.model.listByOrganization(organizationId, filters, sorts, pagination);
    } catch (error) {
      logger.error({ error, organizationId }, 'Failed to list agents');
      throw error;
    }
  }

  /**
   * @description Update agent status
   * @param {string} agentId - Agent ID
   * @param {string} status - New status
   * @returns {Promise<boolean>} Success
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async updateStatus(agentId: string, status: string): Promise<boolean> {
    try {
      const result = await this.model.updateStatus(agentId, status);
      
      if (result) {
        // Emit status change event
        await this.redis.publish('agent:status:changed', JSON.stringify({ agentId, status }));
      }
      
      return result;
    } catch (error) {
      logger.error({ error, agentId, status }, 'Failed to update agent status');
      throw error;
    }
  }

  /**
   * @description Update agent performance rating
   * @param {string} agentId - Agent ID
   * @param {number} rating - New rating (0-5)
   * @returns {Promise<AgentProfile>} Updated agent
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async updatePerformanceRating(agentId: string, rating: number): Promise<AgentProfile> {
    try {
      // Validate rating
      if (rating < 0 || rating > 5) {
        throw new Error('Rating must be between 0 and 5');
      }

      return await this.model.update(agentId, { performance_rating: rating });
    } catch (error) {
      logger.error({ error, agentId, rating }, 'Failed to update performance rating');
      throw error;
    }
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
    try {
      return await this.model.findCompatibleAgents(agentId, organizationId);
    } catch (error) {
      logger.error({ error, agentId, organizationId }, 'Failed to find compatible agents');
      throw error;
    }
  }

  /**
   * @description Assign agent to department
   * @param {string} agentId - Agent ID
   * @param {string} departmentId - Department ID
   * @returns {Promise<AgentProfile>} Updated agent
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async assignToDepartment(
    agentId: string,
    departmentId: string
  ): Promise<AgentProfile> {
    try {
      const agent = await this.model.update(agentId, { department_id: departmentId });
      
      // Emit assignment event
      await this.redis.publish('agent:assigned', JSON.stringify({
        agentId,
        departmentId,
      }));
      
      return agent;
    } catch (error) {
      logger.error({ error, agentId, departmentId }, 'Failed to assign agent to department');
      throw error;
    }
  }

  /**
   * @description Execute task with agent
   * @param {string} agentId - Agent ID
   * @param {any} task - Task details
   * @returns {Promise<any>} Task result
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async executeTask(agentId: string, task: any): Promise<any> {
    try {
      // Update agent status to busy
      await this.updateStatus(agentId, 'busy');

      // Execute task through QuDAG
      const result = await this.qudag.executeTask({
        agentId,
        task,
      });

      // Update agent status back to active
      await this.updateStatus(agentId, 'active');

      return result;
    } catch (error) {
      // Update agent status to error on failure
      await this.updateStatus(agentId, 'error');
      
      logger.error({ error, agentId, task }, 'Failed to execute task');
      throw error;
    }
  }

  /**
   * @description Retire agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<boolean>} Success
   * @author CleoClaudeDesktop
   * @since 1.0.0
   * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
   */
  async retireAgent(agentId: string): Promise<boolean> {
    try {
      const result = await this.model.retire(agentId);
      
      if (result) {
        // Emit retirement event
        await this.redis.publish('agent:retired', JSON.stringify({ agentId }));
      }
      
      return result;
    } catch (error) {
      logger.error({ error, agentId }, 'Failed to retire agent');
      throw error;
    }
  }
}