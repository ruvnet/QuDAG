/**
 * @description Natural language command processing routes
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial command routes
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireOrganization } from '../middleware/auth';

// Validation schemas
const executeCommandSchema = z.object({
  command: z.string().min(1).max(1000),
  context: z.object({
    departmentId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    timeRange: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
  }).optional(),
});

const commandHistorySchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  commandType: z.enum(['hire', 'scale', 'analyze', 'report', 'optimize']).optional(),
  success: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  start: z.string().transform(str => new Date(str)).optional(),
  end: z.string().transform(str => new Date(str)).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

export const commandRoutes: FastifyPluginAsync = async (fastify) => {
  const { command: commandService } = fastify.services;

  /**
   * @description Execute natural language command
   * @route POST /commands
   * @returns {CommandResponse} Command execution result
   */
  fastify.post('/', async (request, reply) => {
    try {
      const data = executeCommandSchema.parse(request.body);
      const user = request.user!;

      // Add organization context
      const context = {
        ...data.context,
        organizationId: user.organizationId,
      };

      const result = await commandService.processCommand(
        user.id,
        user.organizationId,
        data.command,
        context
      );

      return reply.send({
        success: true,
        ...result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid command data',
            details: error.errors,
          },
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'COMMAND_FAILED',
          message: error.message || 'Failed to execute command',
        },
      });
    }
  });

  /**
   * @description Get command suggestions
   * @route GET /commands/suggestions
   * @returns {string[]} Command suggestions
   */
  fastify.get('/suggestions', async (request, reply) => {
    const user = request.user!;

    try {
      const suggestions = await commandService.getCommandSuggestions(
        user.organizationId,
        { userId: user.id }
      );

      return reply.send({
        success: true,
        data: suggestions,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'SUGGESTIONS_FAILED',
          message: 'Failed to get command suggestions',
        },
      });
    }
  });

  /**
   * @description Get command history
   * @route GET /commands/history
   * @returns {PaginatedResponse<CommandHistory>} Command history
   */
  fastify.get('/history',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      try {
        const query = commandHistorySchema.parse(request.query);
        const db = fastify.db;

        // Build filters
        const conditions = [`organization_id = ${query.organizationId}`];
        const params: any[] = [query.organizationId];

        if (query.userId) {
          conditions.push(`user_id = $${params.length + 1}`);
          params.push(query.userId);
        }

        if (query.commandType) {
          conditions.push(`command_type = $${params.length + 1}`);
          params.push(query.commandType);
        }

        if (query.success !== undefined) {
          conditions.push(`success = $${params.length + 1}`);
          params.push(query.success);
        }

        if (query.start) {
          conditions.push(`executed_at >= $${params.length + 1}`);
          params.push(query.start);
        }

        if (query.end) {
          conditions.push(`executed_at <= $${params.length + 1}`);
          params.push(query.end);
        }

        // Get total count
        const countQuery = `
          SELECT COUNT(*) as total
          FROM executive.command_history
          WHERE ${conditions.join(' AND ')}
        `;
        const countResult = await db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total, 10);

        // Get paginated results
        const offset = (query.page - 1) * query.limit;
        const dataQuery = `
          SELECT 
            id,
            organization_id,
            user_id,
            command_text,
            command_type,
            intent,
            result,
            success,
            error_message,
            execution_time_ms,
            executed_at,
            metadata
          FROM executive.command_history
          WHERE ${conditions.join(' AND ')}
          ORDER BY executed_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(query.limit, offset);

        const result = await db.query(dataQuery, params);

        return reply.send({
          success: true,
          data: result.rows,
          pagination: {
            page: query.page,
            pageSize: query.limit,
            totalItems: total,
            totalPages: Math.ceil(total / query.limit),
            hasNext: query.page < Math.ceil(total / query.limit),
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
            code: 'HISTORY_FAILED',
            message: 'Failed to get command history',
          },
        });
      }
    }
  );

  /**
   * @description Get command statistics
   * @route GET /commands/stats
   * @returns {object} Command statistics
   */
  fastify.get('/stats',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      const { organizationId, days = '30' } = request.query as {
        organizationId: string;
        days?: string;
      };

      try {
        const db = fastify.db;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days, 10));

        const query = `
          SELECT 
            COUNT(*) as total_commands,
            COUNT(CASE WHEN success = true THEN 1 END) as successful_commands,
            COUNT(CASE WHEN success = false THEN 1 END) as failed_commands,
            AVG(execution_time_ms) as avg_execution_time,
            MIN(execution_time_ms) as min_execution_time,
            MAX(execution_time_ms) as max_execution_time,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT DATE(executed_at)) as active_days,
            jsonb_object_agg(
              COALESCE(command_type, 'unknown'), 
              command_type_count
            ) as commands_by_type
          FROM (
            SELECT 
              command_type,
              COUNT(*) as command_type_count
            FROM executive.command_history
            WHERE 
              organization_id = $1
              AND executed_at >= $2
            GROUP BY command_type
          ) as type_counts
          CROSS JOIN (
            SELECT 
              COUNT(*) as total_commands,
              COUNT(CASE WHEN success = true THEN 1 END) as successful_commands,
              COUNT(CASE WHEN success = false THEN 1 END) as failed_commands,
              AVG(execution_time_ms) as avg_execution_time,
              MIN(execution_time_ms) as min_execution_time,
              MAX(execution_time_ms) as max_execution_time,
              COUNT(DISTINCT user_id) as unique_users,
              COUNT(DISTINCT DATE(executed_at)) as active_days
            FROM executive.command_history
            WHERE 
              organization_id = $1
              AND executed_at >= $2
          ) as overall_stats
        `;

        const result = await db.query(query, [organizationId, daysAgo]);
        const stats = result.rows[0];

        // Calculate success rate
        const successRate = stats.total_commands > 0
          ? (stats.successful_commands / stats.total_commands * 100).toFixed(2)
          : 0;

        // Get most common commands
        const commonCommandsQuery = `
          SELECT 
            command_text,
            COUNT(*) as count
          FROM executive.command_history
          WHERE 
            organization_id = $1
            AND executed_at >= $2
            AND success = true
          GROUP BY command_text
          ORDER BY count DESC
          LIMIT 10
        `;

        const commonCommands = await db.query(commonCommandsQuery, [organizationId, daysAgo]);

        return reply.send({
          success: true,
          data: {
            summary: {
              totalCommands: parseInt(stats.total_commands, 10),
              successfulCommands: parseInt(stats.successful_commands, 10),
              failedCommands: parseInt(stats.failed_commands, 10),
              successRate: parseFloat(successRate),
              avgExecutionTime: Math.round(stats.avg_execution_time),
              minExecutionTime: Math.round(stats.min_execution_time),
              maxExecutionTime: Math.round(stats.max_execution_time),
              uniqueUsers: parseInt(stats.unique_users, 10),
              activeDays: parseInt(stats.active_days, 10),
            },
            commandsByType: stats.commands_by_type || {},
            mostCommonCommands: commonCommands.rows.map(row => ({
              command: row.command_text,
              count: parseInt(row.count, 10),
            })),
            period: {
              days: parseInt(days, 10),
              start: daysAgo.toISOString(),
              end: new Date().toISOString(),
            },
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'STATS_FAILED',
            message: 'Failed to get command statistics',
          },
        });
      }
    }
  );

  /**
   * @description Get command details
   * @route GET /commands/:id
   * @returns {CommandHistory} Command details
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const db = fastify.db;
      const query = `
        SELECT 
          id,
          organization_id,
          user_id,
          command_text,
          command_type,
          intent,
          result,
          success,
          error_message,
          execution_time_ms,
          executed_at,
          metadata
        FROM executive.command_history
        WHERE id = $1
      `;

      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Command not found',
          },
        });
      }

      const command = result.rows[0];

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== command.organization_id && !user.isAdmin) {
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
        data: command,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'GET_FAILED',
          message: 'Failed to get command details',
        },
      });
    }
  });

  /**
   * @description Retry failed command
   * @route POST /commands/:id/retry
   * @returns {CommandResponse} Command execution result
   */
  fastify.post('/:id/retry', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const db = fastify.db;
      
      // Get original command
      const query = `
        SELECT 
          organization_id,
          command_text,
          intent
        FROM executive.command_history
        WHERE id = $1
      `;

      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Command not found',
          },
        });
      }

      const originalCommand = result.rows[0];

      // Check authorization
      const user = request.user!;
      if (user.organizationId !== originalCommand.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      // Retry the command
      const retryResult = await commandService.processCommand(
        user.id,
        originalCommand.organization_id,
        originalCommand.command_text,
        { 
          retry: true,
          originalIntent: originalCommand.intent,
          organizationId: originalCommand.organization_id,
        }
      );

      return reply.send({
        success: true,
        ...retryResult,
        originalCommandId: id,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'RETRY_FAILED',
          message: 'Failed to retry command',
        },
      });
    }
  });

  /**
   * @description Get command templates
   * @route GET /commands/templates
   * @returns {object[]} Command templates
   */
  fastify.get('/templates', async (request, reply) => {
    const templates = [
      {
        category: 'Agent Management',
        templates: [
          {
            command: 'Hire 3 sales agents with hunter personality',
            description: 'Hire multiple agents with specific traits',
            variables: ['count', 'role', 'personality'],
          },
          {
            command: 'Scale up customer service team by 20%',
            description: 'Automatically scale team based on demand',
            variables: ['department', 'percentage'],
          },
          {
            command: 'Retire underperforming agents in operations',
            description: 'Remove agents below performance threshold',
            variables: ['department', 'threshold'],
          },
        ],
      },
      {
        category: 'Analytics & Reports',
        templates: [
          {
            command: 'Show revenue metrics for this month',
            description: 'Display specific metrics for time period',
            variables: ['metric', 'timeframe'],
          },
          {
            command: 'Compare this quarter to last quarter',
            description: 'Period-over-period comparison',
            variables: ['current_period', 'previous_period'],
          },
          {
            command: 'Generate weekly performance report',
            description: 'Create automated reports',
            variables: ['frequency', 'report_type'],
          },
        ],
      },
      {
        category: 'Optimization',
        templates: [
          {
            command: 'Optimize team for maximum efficiency',
            description: 'AI-driven team optimization',
            variables: ['target_metric'],
          },
          {
            command: 'Reduce operational costs by 15%',
            description: 'Cost optimization strategies',
            variables: ['target_reduction'],
          },
          {
            command: 'Balance workload across all departments',
            description: 'Workload distribution optimization',
            variables: [],
          },
        ],
      },
      {
        category: 'Forecasting',
        templates: [
          {
            command: 'Forecast revenue for next quarter',
            description: 'Predictive analytics',
            variables: ['metric', 'period'],
          },
          {
            command: 'Predict staffing needs for holiday season',
            description: 'Demand-based forecasting',
            variables: ['event', 'department'],
          },
          {
            command: 'Estimate ROI for expanding sales team',
            description: 'Investment analysis',
            variables: ['action', 'department'],
          },
        ],
      },
    ];

    return reply.send({
      success: true,
      data: templates,
    });
  });
};