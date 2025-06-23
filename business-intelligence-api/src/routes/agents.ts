/**
 * @description Agent management routes
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial agent routes
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireOrganization } from '../middleware/auth';

// Validation schemas
const hireAgentSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  businessRole: z.string().min(1).max(255),
  title: z.string().max(255).optional(),
  level: z.enum(['executive', 'manager', 'specialist', 'operator']),
  personalityType: z.enum(['hunter', 'farmer', 'analyst', 'creative', 'executor']),
  customRequirements: z.object({
    skills: z.array(z.string()).optional(),
    experience: z.string().optional(),
    specializations: z.array(z.string()).optional(),
  }).optional(),
  budget: z.number().positive().optional(),
});

const updateAgentSchema = z.object({
  departmentId: z.string().uuid().optional(),
  businessRole: z.string().min(1).max(255).optional(),
  title: z.string().max(255).optional(),
  level: z.enum(['executive', 'manager', 'specialist', 'operator']).optional(),
  status: z.enum(['active', 'idle', 'error', 'maintenance', 'retired']).optional(),
  performanceRating: z.number().min(0).max(5).optional(),
  customSettings: z.record(z.any()).optional(),
});

const executeTaskSchema = z.object({
  task: z.object({
    type: z.string(),
    params: z.any(),
  }),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
});

const listAgentsSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(['active', 'idle', 'error', 'maintenance', 'retired']).optional(),
  level: z.enum(['executive', 'manager', 'specialist', 'operator']).optional(),
  personalityType: z.enum(['hunter', 'farmer', 'analyst', 'creative', 'executor']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  const { agent: agentService } = fastify.services;

  /**
   * @description Hire new agent
   * @route POST /agents/hire
   * @returns {AgentProfile} Created agent
   */
  fastify.post('/hire', 
    { 
      preHandler: requireOrganization((req) => (req.body as any).organizationId) 
    },
    async (request, reply) => {
      try {
        const data = hireAgentSchema.parse(request.body);
        const agent = await agentService.hireAgent(data);

        return reply.code(201).send({
          success: true,
          data: agent,
          message: `Successfully hired ${data.personalityType} agent for ${data.businessRole}`,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors,
            },
          });
        }

        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'HIRE_FAILED',
            message: 'Failed to hire agent',
          },
        });
      }
    }
  );

  /**
   * @description List agents
   * @route GET /agents
   * @returns {PaginatedResponse<AgentProfile>} Paginated agents
   */
  fastify.get('/', async (request, reply) => {
    try {
      const query = listAgentsSchema.parse(request.query);
      
      // Build filters
      const filters = [];
      if (query.departmentId) {
        filters.push({ field: 'department_id', operator: '=', value: query.departmentId });
      }
      if (query.status) {
        filters.push({ field: 'status', operator: '=', value: query.status });
      }
      if (query.level) {
        filters.push({ field: 'level', operator: '=', value: query.level });
      }
      if (query.personalityType) {
        filters.push({ field: 'personality_type', operator: '=', value: query.personalityType });
      }

      // Build sort
      const sorts = query.sort ? [{
        field: query.sort,
        direction: query.order,
      }] : [];

      // Pagination
      const pagination = {
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
      };

      const result = await agentService.listByOrganization(
        query.organizationId,
        filters,
        sorts,
        pagination
      );

      return reply.send({
        success: true,
        data: result.items,
        pagination: {
          page: query.page,
          pageSize: query.limit,
          totalItems: result.total,
          totalPages: Math.ceil(result.total / query.limit),
          hasNext: query.page < Math.ceil(result.total / query.limit),
          hasPrevious: query.page > 1,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
          },
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'LIST_FAILED',
          message: 'Failed to list agents',
        },
      });
    }
  });

  /**
   * @description Get agent by ID
   * @route GET /agents/:id
   * @returns {AgentProfile} Agent details
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const agent = await agentService.getById(id);

      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        });
      }

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== agent.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      return reply.send({
        success: true,
        data: agent,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'GET_FAILED',
          message: 'Failed to retrieve agent',
        },
      });
    }
  });

  /**
   * @description Update agent
   * @route PATCH /agents/:id
   * @returns {AgentProfile} Updated agent
   */
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Get agent to check organization
      const agent = await agentService.getById(id);
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        });
      }

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== agent.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const data = updateAgentSchema.parse(request.body);
      
      // Handle special updates
      if (data.performanceRating !== undefined) {
        await agentService.updatePerformanceRating(id, data.performanceRating);
        delete data.performanceRating;
      }

      if (data.status !== undefined) {
        await agentService.updateStatus(id, data.status);
        delete data.status;
      }

      // Update other fields
      const updated = await agentService['model'].update(id, data);

      return reply.send({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update data',
            details: error.errors,
          },
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update agent',
        },
      });
    }
  });

  /**
   * @description Execute task with agent
   * @route POST /agents/:id/tasks
   * @returns {any} Task result
   */
  fastify.post('/:id/tasks', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Get agent to check organization
      const agent = await agentService.getById(id);
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        });
      }

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== agent.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const data = executeTaskSchema.parse(request.body);
      const result = await agentService.executeTask(id, data.task);

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid task data',
            details: error.errors,
          },
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'TASK_FAILED',
          message: 'Failed to execute task',
        },
      });
    }
  });

  /**
   * @description Find compatible agents
   * @route GET /agents/:id/compatible
   * @returns {AgentProfile[]} Compatible agents
   */
  fastify.get('/:id/compatible', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const agent = await agentService.getById(id);
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        });
      }

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== agent.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const compatible = await agentService.findCompatibleAgents(
        id,
        agent.organization_id
      );

      return reply.send({
        success: true,
        data: compatible,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'COMPATIBLE_FAILED',
          message: 'Failed to find compatible agents',
        },
      });
    }
  });

  /**
   * @description Assign agent to department
   * @route POST /agents/:id/assign
   * @returns {AgentProfile} Updated agent
   */
  fastify.post('/:id/assign', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { departmentId } = request.body as { departmentId: string };

    try {
      const agent = await agentService.getById(id);
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        });
      }

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== agent.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const updated = await agentService.assignToDepartment(id, departmentId);

      return reply.send({
        success: true,
        data: updated,
        message: 'Agent assigned to department successfully',
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'ASSIGN_FAILED',
          message: 'Failed to assign agent',
        },
      });
    }
  });

  /**
   * @description Retire agent
   * @route POST /agents/:id/retire
   * @returns {object} Success status
   */
  fastify.post('/:id/retire', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const agent = await agentService.getById(id);
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        });
      }

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== agent.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const success = await agentService.retireAgent(id);

      return reply.send({
        success,
        message: success ? 'Agent retired successfully' : 'Failed to retire agent',
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'RETIRE_FAILED',
          message: 'Failed to retire agent',
        },
      });
    }
  });

  /**
   * @description Get agent performance metrics
   * @route GET /agents/:id/performance
   * @returns {any} Performance metrics
   */
  fastify.get('/:id/performance', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { start, end } = request.query as { start?: string; end?: string };

    try {
      const agent = await agentService.getById(id);
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent not found',
          },
        });
      }

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== agent.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = end ? new Date(end) : new Date();

      const metrics = await fastify.services.qudag.getAgentMetrics(
        id,
        startDate,
        endDate
      );

      return reply.send({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'METRICS_FAILED',
          message: 'Failed to retrieve performance metrics',
        },
      });
    }
  });
};