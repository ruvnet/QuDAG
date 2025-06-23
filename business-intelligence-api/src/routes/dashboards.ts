/**
 * @description Dashboard and report management routes
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial dashboard routes
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'slonik';
import { requireOrganization } from '../middleware/auth';

// Validation schemas
const widgetSchema = z.object({
  id: z.string(),
  type: z.enum(['metric', 'chart', 'table', 'gauge', 'heatmap', 'org-chart']),
  title: z.string(),
  dataSource: z.object({
    metric: z.string(),
    aggregation: z.string().optional(),
    filters: z.array(z.any()).optional(),
    groupBy: z.array(z.string()).optional(),
  }),
  visualization: z.object({
    chartType: z.enum(['line', 'bar', 'pie', 'area', 'scatter']).optional(),
    colors: z.array(z.string()).optional(),
    showLegend: z.boolean().optional(),
    showLabels: z.boolean().optional(),
  }).optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

const createDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  widgets: z.array(widgetSchema),
  layout: z.enum(['grid', 'flow']).default('grid'),
  refreshInterval: z.number().optional(),
  isPublic: z.boolean().default(false),
});

const updateDashboardSchema = createDashboardSchema.partial();

const createReportSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['dashboard', 'report', 'analysis', 'board_package']),
  description: z.string().optional(),
  configuration: z.object({
    metrics: z.array(z.string()),
    filters: z.record(z.any()),
    timeRange: z.object({
      start: z.string(),
      end: z.string(),
    }),
    groupBy: z.array(z.string()).optional(),
    visualization: z.string().optional(),
  }),
  schedule: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    hour: z.number().min(0).max(23),
    timezone: z.string(),
  }).optional(),
  recipients: z.array(z.string().email()).default([]),
  isPublic: z.boolean().default(false),
});

const listDashboardsSchema = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(['dashboard', 'report', 'analysis', 'board_package']).optional(),
  isPublic: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.db;

  /**
   * @description Create dashboard
   * @route POST /dashboards
   * @returns {DashboardConfig} Created dashboard
   */
  fastify.post('/', async (request, reply) => {
    try {
      const data = createDashboardSchema.parse(request.body);
      const user = request.user!;

      const query = sql`
        INSERT INTO executive.saved_reports (
          organization_id,
          name,
          type,
          description,
          configuration,
          schedule,
          recipients,
          is_public,
          created_by
        ) VALUES (
          ${user.organizationId},
          ${data.name},
          'dashboard',
          ${data.description || null},
          ${sql.json({
            widgets: data.widgets,
            layout: data.layout,
            refreshInterval: data.refreshInterval,
          })},
          ${null},
          ${sql.array([], 'text')},
          ${data.isPublic},
          ${user.id}
        )
        RETURNING 
          id::text,
          organization_id::text,
          name,
          type,
          description,
          configuration,
          schedule,
          recipients,
          is_public,
          created_by::text,
          created_at,
          updated_at,
          last_generated_at,
          metadata
      `;

      const result = await db.query(query);
      const dashboard = result.rows[0];

      return reply.code(201).send({
        success: true,
        data: dashboard,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid dashboard data',
            details: error.errors,
          },
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create dashboard',
        },
      });
    }
  });

  /**
   * @description List dashboards and reports
   * @route GET /dashboards
   * @returns {PaginatedResponse<SavedReport>} Paginated dashboards
   */
  fastify.get('/',
    {
      preHandler: requireOrganization((req) => (req.query as any).organizationId)
    },
    async (request, reply) => {
      try {
        const query = listDashboardsSchema.parse(request.query);
        const user = request.user!;

        // Build filters
        const conditions = [sql`organization_id = ${query.organizationId}`];
        
        if (query.type) {
          conditions.push(sql`type = ${query.type}`);
        }

        if (query.isPublic !== undefined) {
          conditions.push(sql`is_public = ${query.isPublic}`);
        }

        // Non-admins can only see public dashboards or their own
        if (!user.isAdmin) {
          conditions.push(sql`(is_public = true OR created_by = ${user.id})`);
        }

        const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

        // Get total count
        const countQuery = sql`
          SELECT COUNT(*) as total
          FROM executive.saved_reports
          ${whereClause}
        `;

        const countResult = await db.query(countQuery);
        const total = parseInt(countResult.rows[0].total, 10);

        // Get paginated results
        const offset = (query.page - 1) * query.limit;
        const dataQuery = sql`
          SELECT 
            id::text,
            organization_id::text,
            name,
            type,
            description,
            configuration,
            schedule,
            recipients,
            is_public,
            created_by::text,
            created_at,
            updated_at,
            last_generated_at,
            metadata
          FROM executive.saved_reports
          ${whereClause}
          ORDER BY updated_at DESC
          LIMIT ${query.limit} OFFSET ${offset}
        `;

        const result = await db.query(dataQuery);

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
            code: 'LIST_FAILED',
            message: 'Failed to list dashboards',
          },
        });
      }
    }
  );

  /**
   * @description Get dashboard by ID
   * @route GET /dashboards/:id
   * @returns {SavedReport} Dashboard details
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const query = sql`
        SELECT 
          id::text,
          organization_id::text,
          name,
          type,
          description,
          configuration,
          schedule,
          recipients,
          is_public,
          created_by::text,
          created_at,
          updated_at,
          last_generated_at,
          metadata
        FROM executive.saved_reports
        WHERE id = ${id}
      `;

      const result = await db.query(query);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Dashboard not found',
          },
        });
      }

      const dashboard = result.rows[0];
      const user = request.user!;

      // Check authorization
      if (!dashboard.is_public && 
          dashboard.created_by !== user.id && 
          user.organizationId !== dashboard.organization_id && 
          !user.isAdmin) {
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
        data: dashboard,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'GET_FAILED',
          message: 'Failed to get dashboard',
        },
      });
    }
  });

  /**
   * @description Update dashboard
   * @route PATCH /dashboards/:id
   * @returns {SavedReport} Updated dashboard
   */
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check if dashboard exists and user has permission
      const checkQuery = sql`
        SELECT organization_id::text, created_by::text
        FROM executive.saved_reports
        WHERE id = ${id}
      `;

      const checkResult = await db.query(checkQuery);
      
      if (checkResult.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Dashboard not found',
          },
        });
      }

      const existing = checkResult.rows[0];
      const user = request.user!;

      // Check authorization
      if (existing.created_by !== user.id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only the creator can update this dashboard',
          },
        });
      }

      const data = updateDashboardSchema.parse(request.body);
      
      // Build update fields
      const updates = [];
      if (data.name !== undefined) {
        updates.push(sql`name = ${data.name}`);
      }
      if (data.description !== undefined) {
        updates.push(sql`description = ${data.description}`);
      }
      if (data.widgets !== undefined || data.layout !== undefined || data.refreshInterval !== undefined) {
        const currentConfig = await db.query(sql`
          SELECT configuration FROM executive.saved_reports WHERE id = ${id}
        `);
        const updatedConfig = {
          ...currentConfig.rows[0].configuration,
          ...(data.widgets && { widgets: data.widgets }),
          ...(data.layout && { layout: data.layout }),
          ...(data.refreshInterval !== undefined && { refreshInterval: data.refreshInterval }),
        };
        updates.push(sql`configuration = ${sql.json(updatedConfig)}`);
      }
      if (data.isPublic !== undefined) {
        updates.push(sql`is_public = ${data.isPublic}`);
      }

      if (updates.length === 0) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'NO_UPDATES',
            message: 'No fields to update',
          },
        });
      }

      const updateQuery = sql`
        UPDATE executive.saved_reports
        SET ${sql.join(updates, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id::text,
          organization_id::text,
          name,
          type,
          description,
          configuration,
          schedule,
          recipients,
          is_public,
          created_by::text,
          created_at,
          updated_at,
          last_generated_at,
          metadata
      `;

      const result = await db.query(updateQuery);

      return reply.send({
        success: true,
        data: result.rows[0],
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
          message: 'Failed to update dashboard',
        },
      });
    }
  });

  /**
   * @description Delete dashboard
   * @route DELETE /dashboards/:id
   * @returns {object} Success status
   */
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check ownership
      const checkQuery = sql`
        SELECT created_by::text
        FROM executive.saved_reports
        WHERE id = ${id}
      `;

      const checkResult = await db.query(checkQuery);
      
      if (checkResult.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Dashboard not found',
          },
        });
      }

      const user = request.user!;
      if (checkResult.rows[0].created_by !== user.id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only the creator can delete this dashboard',
          },
        });
      }

      const deleteQuery = sql`
        DELETE FROM executive.saved_reports
        WHERE id = ${id}
      `;

      await db.query(deleteQuery);

      return reply.send({
        success: true,
        message: 'Dashboard deleted successfully',
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete dashboard',
        },
      });
    }
  });

  /**
   * @description Create scheduled report
   * @route POST /dashboards/reports
   * @returns {SavedReport} Created report
   */
  fastify.post('/reports', async (request, reply) => {
    try {
      const data = createReportSchema.parse(request.body);
      const user = request.user!;

      const query = sql`
        INSERT INTO executive.saved_reports (
          organization_id,
          name,
          type,
          description,
          configuration,
          schedule,
          recipients,
          is_public,
          created_by
        ) VALUES (
          ${user.organizationId},
          ${data.name},
          ${data.type},
          ${data.description || null},
          ${sql.json(data.configuration)},
          ${data.schedule ? sql.json(data.schedule) : null},
          ${sql.array(data.recipients, 'text')},
          ${data.isPublic},
          ${user.id}
        )
        RETURNING 
          id::text,
          organization_id::text,
          name,
          type,
          description,
          configuration,
          schedule,
          recipients,
          is_public,
          created_by::text,
          created_at,
          updated_at,
          last_generated_at,
          metadata
      `;

      const result = await db.query(query);

      return reply.code(201).send({
        success: true,
        data: result.rows[0],
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid report data',
            details: error.errors,
          },
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create report',
        },
      });
    }
  });

  /**
   * @description Generate report
   * @route POST /dashboards/:id/generate
   * @returns {object} Generated report data
   */
  fastify.post('/:id/generate', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Get report configuration
      const query = sql`
        SELECT 
          organization_id::text,
          configuration,
          created_by::text
        FROM executive.saved_reports
        WHERE id = ${id}
      `;

      const result = await db.query(query);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Report not found',
          },
        });
      }

      const report = result.rows[0];
      const user = request.user!;

      // Check authorization
      if (user.organizationId !== report.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      // Generate report using metrics service
      const metricsService = fastify.services.metrics;
      const { metrics, timeRange, groupBy } = report.configuration;

      const data = await metricsService.getAggregatedMetrics(
        report.organization_id,
        {
          start: new Date(timeRange.start),
          end: new Date(timeRange.end),
        },
        metrics,
        'day'
      );

      // Update last generated timestamp
      await db.query(sql`
        UPDATE executive.saved_reports
        SET last_generated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `);

      return reply.send({
        success: true,
        data: {
          reportId: id,
          generatedAt: new Date().toISOString(),
          configuration: report.configuration,
          results: data,
        },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'GENERATE_FAILED',
          message: 'Failed to generate report',
        },
      });
    }
  });

  /**
   * @description Get dashboard templates
   * @route GET /dashboards/templates
   * @returns {object[]} Dashboard templates
   */
  fastify.get('/templates', async (request, reply) => {
    const templates = [
      {
        name: 'Executive Overview',
        description: 'High-level metrics for C-suite executives',
        type: 'dashboard',
        widgets: [
          {
            id: 'revenue-gauge',
            type: 'gauge',
            title: 'Monthly Revenue',
            dataSource: {
              metric: 'revenue',
              aggregation: 'sum',
            },
            position: { x: 0, y: 0, width: 3, height: 2 },
          },
          {
            id: 'profit-chart',
            type: 'chart',
            title: 'Profit Trend',
            dataSource: {
              metric: 'profit',
              aggregation: 'sum',
              groupBy: ['date'],
            },
            visualization: {
              chartType: 'line',
              showLegend: true,
            },
            position: { x: 3, y: 0, width: 9, height: 2 },
          },
          {
            id: 'agent-performance',
            type: 'table',
            title: 'Top Performing Agents',
            dataSource: {
              metric: 'revenue',
              aggregation: 'sum',
              groupBy: ['agent_id'],
            },
            position: { x: 0, y: 2, width: 6, height: 3 },
          },
          {
            id: 'department-heatmap',
            type: 'heatmap',
            title: 'Department Efficiency',
            dataSource: {
              metric: 'efficiency',
              aggregation: 'avg',
              groupBy: ['department_id', 'date'],
            },
            position: { x: 6, y: 2, width: 6, height: 3 },
          },
        ],
        layout: 'grid',
        refreshInterval: 300000, // 5 minutes
      },
      {
        name: 'Sales Performance',
        description: 'Detailed sales metrics and agent performance',
        type: 'dashboard',
        widgets: [
          {
            id: 'sales-revenue',
            type: 'metric',
            title: 'Total Sales Revenue',
            dataSource: {
              metric: 'revenue',
              aggregation: 'sum',
              filters: [{ field: 'department', value: 'sales' }],
            },
            position: { x: 0, y: 0, width: 4, height: 1 },
          },
          {
            id: 'conversion-rate',
            type: 'metric',
            title: 'Conversion Rate',
            dataSource: {
              metric: 'efficiency',
              aggregation: 'avg',
              filters: [{ field: 'department', value: 'sales' }],
            },
            position: { x: 4, y: 0, width: 4, height: 1 },
          },
          {
            id: 'sales-agents',
            type: 'metric',
            title: 'Active Sales Agents',
            dataSource: {
              metric: 'agent_count',
              aggregation: 'count',
              filters: [{ field: 'department', value: 'sales' }],
            },
            position: { x: 8, y: 0, width: 4, height: 1 },
          },
          {
            id: 'sales-trend',
            type: 'chart',
            title: 'Sales Trend (30 Days)',
            dataSource: {
              metric: 'revenue',
              aggregation: 'sum',
              filters: [{ field: 'department', value: 'sales' }],
              groupBy: ['date'],
            },
            visualization: {
              chartType: 'area',
              colors: ['#10b981'],
            },
            position: { x: 0, y: 1, width: 12, height: 3 },
          },
        ],
        layout: 'grid',
        refreshInterval: 60000, // 1 minute
      },
      {
        name: 'Operations Dashboard',
        description: 'Operational efficiency and cost management',
        type: 'dashboard',
        widgets: [
          {
            id: 'cost-breakdown',
            type: 'chart',
            title: 'Cost Breakdown by Department',
            dataSource: {
              metric: 'costs',
              aggregation: 'sum',
              groupBy: ['department_id'],
            },
            visualization: {
              chartType: 'pie',
              showLabels: true,
            },
            position: { x: 0, y: 0, width: 6, height: 3 },
          },
          {
            id: 'efficiency-score',
            type: 'gauge',
            title: 'Overall Efficiency Score',
            dataSource: {
              metric: 'efficiency',
              aggregation: 'avg',
            },
            position: { x: 6, y: 0, width: 3, height: 3 },
          },
          {
            id: 'agent-utilization',
            type: 'chart',
            title: 'Agent Utilization Rate',
            dataSource: {
              metric: 'quality',
              aggregation: 'avg',
              groupBy: ['hour'],
            },
            visualization: {
              chartType: 'bar',
              colors: ['#6366f1'],
            },
            position: { x: 9, y: 0, width: 3, height: 3 },
          },
        ],
        layout: 'grid',
        refreshInterval: 600000, // 10 minutes
      },
    ];

    return reply.send({
      success: true,
      data: templates,
    });
  });

  /**
   * @description Clone dashboard
   * @route POST /dashboards/:id/clone
   * @returns {SavedReport} Cloned dashboard
   */
  fastify.post('/:id/clone', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };

    try {
      // Get original dashboard
      const query = sql`
        SELECT 
          organization_id::text,
          name,
          type,
          description,
          configuration,
          is_public
        FROM executive.saved_reports
        WHERE id = ${id}
      `;

      const result = await db.query(query);

      if (result.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Dashboard not found',
          },
        });
      }

      const original = result.rows[0];
      const user = request.user!;

      // Check authorization
      if (!original.is_public && user.organizationId !== original.organization_id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      // Create clone
      const cloneQuery = sql`
        INSERT INTO executive.saved_reports (
          organization_id,
          name,
          type,
          description,
          configuration,
          schedule,
          recipients,
          is_public,
          created_by
        ) VALUES (
          ${user.organizationId},
          ${name || `${original.name} (Copy)`},
          ${original.type},
          ${original.description},
          ${sql.json(original.configuration)},
          ${null},
          ${sql.array([], 'text')},
          ${false},
          ${user.id}
        )
        RETURNING 
          id::text,
          organization_id::text,
          name,
          type,
          description,
          configuration,
          schedule,
          recipients,
          is_public,
          created_by::text,
          created_at,
          updated_at,
          last_generated_at,
          metadata
      `;

      const cloneResult = await db.query(cloneQuery);

      return reply.code(201).send({
        success: true,
        data: cloneResult.rows[0],
        message: 'Dashboard cloned successfully',
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'CLONE_FAILED',
          message: 'Failed to clone dashboard',
        },
      });
    }
  });
};