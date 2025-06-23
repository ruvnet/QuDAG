/**
 * @description Organization management routes
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial organization routes
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Validation schemas
const createOrganizationSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  logo_url: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  size: z.enum(['startup', 'smb', 'enterprise']).optional(),
  settings: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
    features: z.object({
      voice_commands: z.boolean().optional(),
      predictive_analytics: z.boolean().optional(),
      auto_scaling: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

const updateOrganizationSchema = createOrganizationSchema.partial().omit({ tenant_id: true });

const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const organizationRoutes: FastifyPluginAsync = async (fastify) => {
  const { organization: orgService } = fastify.services;

  /**
   * @description List organizations
   * @route GET /organizations
   * @returns {PaginatedResponse<Organization>} Paginated organizations
   */
  fastify.get('/', async (request, reply) => {
    try {
      const query = paginationSchema.parse(request.query);
      
      const pagination = {
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
      };

      const result = await orgService.list([], pagination);

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
      fastify.log.error(error);
      return reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }
  });

  /**
   * @description Get organization by ID
   * @route GET /organizations/:id
   * @returns {Organization} Organization details
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const organization = await orgService.getById(id);

      if (!organization) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Organization not found',
          },
        });
      }

      // Check authorization
      const user = request.user;
      if (user.organizationId !== organization.id && !user.isAdmin) {
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
        data: organization,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve organization',
        },
      });
    }
  });

  /**
   * @description Create new organization
   * @route POST /organizations
   * @returns {Organization} Created organization
   */
  fastify.post('/', async (request, reply) => {
    try {
      const data = createOrganizationSchema.parse(request.body);
      
      // Check if tenant already exists
      const existing = await orgService.getByTenantId(data.tenant_id);
      if (existing) {
        return reply.code(409).send({
          success: false,
          error: {
            code: 'ALREADY_EXISTS',
            message: 'Organization already exists for this tenant',
          },
        });
      }

      const organization = await orgService.create(data);

      return reply.code(201).send({
        success: true,
        data: organization,
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
          code: 'INTERNAL_ERROR',
          message: 'Failed to create organization',
        },
      });
    }
  });

  /**
   * @description Update organization
   * @route PATCH /organizations/:id
   * @returns {Organization} Updated organization
   */
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check authorization
      const user = request.user;
      if (user.organizationId !== id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const data = updateOrganizationSchema.parse(request.body);
      const organization = await orgService.update(id, data);

      return reply.send({
        success: true,
        data: organization,
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
          code: 'INTERNAL_ERROR',
          message: 'Failed to update organization',
        },
      });
    }
  });

  /**
   * @description Update organization settings
   * @route PATCH /organizations/:id/settings
   * @returns {Organization} Updated organization
   */
  fastify.patch('/:id/settings', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check authorization
      const user = request.user;
      if (user.organizationId !== id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      const settingsSchema = createOrganizationSchema.shape.settings;
      const settings = settingsSchema.parse(request.body);
      
      const organization = await orgService.updateSettings(id, settings);

      return reply.send({
        success: true,
        data: organization,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid settings data',
            details: error.errors,
          },
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update settings',
        },
      });
    }
  });

  /**
   * @description Toggle feature for organization
   * @route POST /organizations/:id/features/:feature/toggle
   * @returns {Organization} Updated organization
   */
  fastify.post('/:id/features/:feature/toggle', async (request, reply) => {
    const { id, feature } = request.params as { id: string; feature: string };
    const { enabled } = request.body as { enabled: boolean };

    try {
      // Check authorization
      const user = request.user;
      if (user.organizationId !== id && !user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        });
      }

      // Validate feature name
      const validFeatures = ['voice_commands', 'predictive_analytics', 'auto_scaling'];
      if (!validFeatures.includes(feature)) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'INVALID_FEATURE',
            message: `Invalid feature: ${feature}`,
          },
        });
      }

      const organization = await orgService.toggleFeature(id, feature as any, enabled);

      return reply.send({
        success: true,
        data: organization,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to toggle feature',
        },
      });
    }
  });

  /**
   * @description Delete organization (soft delete)
   * @route DELETE /organizations/:id
   * @returns {object} Success status
   */
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Check authorization - only admins can delete
      const user = request.user;
      if (!user.isAdmin) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only administrators can delete organizations',
          },
        });
      }

      const success = await orgService.delete(id);

      if (!success) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Organization not found',
          },
        });
      }

      return reply.send({
        success: true,
        message: 'Organization deleted successfully',
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete organization',
        },
      });
    }
  });

  /**
   * @description Get organization by tenant ID
   * @route GET /organizations/tenant/:tenantId
   * @returns {Organization} Organization details
   */
  fastify.get('/tenant/:tenantId', async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };

    try {
      const organization = await orgService.getByTenantId(tenantId);

      if (!organization) {
        return reply.code(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Organization not found for tenant',
          },
        });
      }

      // Check authorization
      const user = request.user;
      if (user.organizationId !== organization.id && !user.isAdmin) {
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
        data: organization,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve organization',
        },
      });
    }
  });
};