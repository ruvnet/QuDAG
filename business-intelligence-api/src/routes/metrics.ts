/**
 * @description Business metrics and analytics routes
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial metrics routes
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { requireOrganization } from '../middleware/auth';

// Validation schemas
const recordMetricSchema = z.object({
  organization_id: z.string().uuid(),
  metric_type: z.enum(['revenue', 'costs', 'profit', 'efficiency', 'quality']),
  metric_subtype: z.string().optional(),
  value: z.number().or(z.string()).transform(val => new Decimal(val)),
  currency: z.string().default('rUv'),
  period_start: z.string().transform(str => new Date(str)),
  period_end: z.string().transform(str => new Date(str)),
  department_id: z.string().uuid().optional(),
  agent_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const aggregateMetricsSchema = z.object({
  organizationId: z.string().uuid(),
  metricTypes: z.string().transform(str => str.split(',')).optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  start: z.string().transform(str => new Date(str)),
  end: z.string().transform(str => new Date(str)),
});

const compareMetricsSchema = z.object({
  organizationId: z.string().uuid(),
  metricTypes: z.string().transform(str => str.split(',')).optional(),
  currentStart: z.string().transform(str => new Date(str)),
  currentEnd: z.string().transform(str => new Date(str)),
  previousStart: z.string().transform(str => new Date(str)),
  previousEnd: z.string().transform(str => new Date(str)),
});

const roiSchema = z.object({
  organizationId: z.string().uuid(),
  entityType: z.enum(['agent', 'department']),
  entityId: z.string(),
  start: z.string().transform(str => new Date(str)),
  end: z.string().transform(str => new Date(str)),
});

const forecastSchema = z.object({
  organizationId: z.string().uuid(),
  metricType: z.enum(['revenue', 'costs', 'profit', 'efficiency', 'quality']),
  forecastDays: z.string().transform(Number).default('30'),
});

export const metricsRoutes: FastifyPluginAsync = async (fastify) => {
  const { metrics: metricsService } = fastify.services;

  /**
   * @description Record new metric
   * @route POST /metrics
   * @returns {BusinessMetric} Created metric
   */
  fastify.post('/',
    {
      preHandler: requireOrganization((req) => (req.body as any).organization_id)
    },
    async (request, reply) => {
      try {
        const data = recordMetricSchema.parse(request.body);
        const metric = await metricsService.recordMetric(data);

        return reply.code(201).send({
          success: true,
          data: metric,
        });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid metric data',
              details: error.errors,
            },
          });
        }

        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'RECORD_FAILED',
            message: 'Failed to record metric',
          },
        });
      }
    }
  );

  /**
   * @description Get aggregated metrics
   * @route GET /metrics/aggregate
   * @returns {any[]} Aggregated metrics
   */
  fastify.get('/aggregate',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      try {
        const query = aggregateMetricsSchema.parse(request.query);
        
        const metrics = await metricsService.getAggregatedMetrics(
          query.organizationId,
          { start: query.start, end: query.end },
          query.metricTypes,
          query.granularity
        );

        // Convert Decimal values to strings for JSON serialization
        const serializedMetrics = metrics.map(m => ({
          ...m,
          total: m.total.toString(),
          avg: m.avg.toString(),
          min: m.min.toString(),
          max: m.max.toString(),
        }));

        return reply.send({
          success: true,
          data: serializedMetrics,
          meta: {
            organizationId: query.organizationId,
            timeRange: {
              start: query.start.toISOString(),
              end: query.end.toISOString(),
            },
            granularity: query.granularity,
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
            code: 'AGGREGATE_FAILED',
            message: 'Failed to aggregate metrics',
          },
        });
      }
    }
  );

  /**
   * @description Compare metrics between periods
   * @route GET /metrics/compare
   * @returns {any} Comparison results
   */
  fastify.get('/compare',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      try {
        const query = compareMetricsSchema.parse(request.query);
        
        const comparison = await metricsService.compareMetrics(
          query.organizationId,
          { start: query.currentStart, end: query.currentEnd },
          { start: query.previousStart, end: query.previousEnd },
          query.metricTypes
        );

        return reply.send({
          success: true,
          data: comparison,
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
            code: 'COMPARE_FAILED',
            message: 'Failed to compare metrics',
          },
        });
      }
    }
  );

  /**
   * @description Calculate ROI for entity
   * @route GET /metrics/roi
   * @returns {any} ROI calculations
   */
  fastify.get('/roi',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      try {
        const query = roiSchema.parse(request.query);
        
        const roi = await metricsService.calculateROI(
          query.organizationId,
          { start: query.start, end: query.end },
          query.entityType,
          query.entityId
        );

        return reply.send({
          success: true,
          data: roi,
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
            code: 'ROI_FAILED',
            message: 'Failed to calculate ROI',
          },
        });
      }
    }
  );

  /**
   * @description Get performance trends
   * @route GET /metrics/trends
   * @returns {any} Performance trends
   */
  fastify.get('/trends',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      const { organizationId, days = '30' } = request.query as {
        organizationId: string;
        days?: string;
      };

      try {
        const trends = await metricsService.getPerformanceTrends(
          organizationId,
          parseInt(days, 10)
        );

        return reply.send({
          success: true,
          data: trends,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'TRENDS_FAILED',
            message: 'Failed to get performance trends',
          },
        });
      }
    }
  );

  /**
   * @description Generate forecast
   * @route GET /metrics/forecast
   * @returns {any} Forecast data
   */
  fastify.get('/forecast',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      try {
        const query = forecastSchema.parse(request.query);
        
        const forecast = await metricsService.generateForecast(
          query.organizationId,
          query.metricType,
          query.forecastDays
        );

        return reply.send({
          success: true,
          data: forecast,
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
            code: 'FORECAST_FAILED',
            message: 'Failed to generate forecast',
          },
        });
      }
    }
  );

  /**
   * @description Get dashboard data
   * @route GET /metrics/dashboard
   * @returns {any} Dashboard data
   */
  fastify.get('/dashboard',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      const { organizationId } = request.query as { organizationId: string };

      try {
        const dashboard = await metricsService.getDashboardData(organizationId);

        return reply.send({
          success: true,
          data: dashboard,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'DASHBOARD_FAILED',
            message: 'Failed to get dashboard data',
          },
        });
      }
    }
  );

  /**
   * @description Get metrics by department
   * @route GET /metrics/department/:departmentId
   * @returns {BusinessMetric[]} Department metrics
   */
  fastify.get('/department/:departmentId', async (request, reply) => {
    const { departmentId } = request.params as { departmentId: string };
    const { organizationId, start, end } = request.query as {
      organizationId: string;
      start: string;
      end: string;
    };

    try {
      // Check authorization
      const user = request.user!;
      if (user.organizationId !== organizationId && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const timeRange = {
        start: new Date(start),
        end: new Date(end),
      };

      const metrics = await metricsService['model'].getByDepartment(
        organizationId,
        departmentId,
        timeRange
      );

      // Convert Decimal values to strings
      const serializedMetrics = metrics.map(m => ({
        ...m,
        value: m.value.toString(),
      }));

      return reply.send({
        success: true,
        data: serializedMetrics,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'DEPT_METRICS_FAILED',
          message: 'Failed to get department metrics',
        },
      });
    }
  });

  /**
   * @description Get metrics by agent
   * @route GET /metrics/agent/:agentId
   * @returns {BusinessMetric[]} Agent metrics
   */
  fastify.get('/agent/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const { start, end } = request.query as {
      start: string;
      end: string;
    };

    try {
      // Get agent to check organization
      const agent = await fastify.services.agent.getById(agentId);
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

      const timeRange = {
        start: new Date(start),
        end: new Date(end),
      };

      const metrics = await metricsService['model'].getByAgent(
        agentId,
        timeRange
      );

      // Convert Decimal values to strings
      const serializedMetrics = metrics.map(m => ({
        ...m,
        value: m.value.toString(),
      }));

      return reply.send({
        success: true,
        data: serializedMetrics,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'AGENT_METRICS_FAILED',
          message: 'Failed to get agent metrics',
        },
      });
    }
  });

  /**
   * @description Get top performers
   * @route GET /metrics/top-performers
   * @returns {any[]} Top performing entities
   */
  fastify.get('/top-performers',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      const {
        organizationId,
        metricType = 'revenue',
        groupBy = 'agent',
        limit = '10',
        start,
        end,
      } = request.query as any;

      try {
        const timeRange = {
          start: new Date(start),
          end: new Date(end),
        };

        const topPerformers = await metricsService['model'].getTopPerformers(
          organizationId,
          metricType,
          timeRange,
          groupBy,
          parseInt(limit, 10)
        );

        // Convert Decimal values to strings
        const serialized = topPerformers.map(p => ({
          ...p,
          total_value: p.total_value.toString(),
          avg_value: p.avg_value.toString(),
        }));

        return reply.send({
          success: true,
          data: serialized,
          meta: {
            metricType,
            groupBy,
            timeRange: {
              start: timeRange.start.toISOString(),
              end: timeRange.end.toISOString(),
            },
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: {
            code: 'TOP_PERFORMERS_FAILED',
            message: 'Failed to get top performers',
          },
        });
      }
    }
  );
};