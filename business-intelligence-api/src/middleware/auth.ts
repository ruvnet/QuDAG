/**
 * @description Authentication middleware
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial auth middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      organizationId: string;
      role: string;
      isAdmin: boolean;
    };
  }
}

/**
 * @description JWT authentication middleware
 * @param {FastifyRequest} request - Fastify request
 * @param {FastifyReply} reply - Fastify reply
 * @returns {Promise<void>}
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify JWT token
      const decoded = await request.jwtVerify();
      
      // Attach user to request
      request.user = {
        id: decoded.sub as string,
        email: decoded.email as string,
        organizationId: decoded.organizationId as string,
        role: decoded.role as string,
        isAdmin: decoded.role === 'admin',
      };

      logger.debug({ userId: request.user.id }, 'User authenticated');
    } catch (error: any) {
      logger.warn({ error: error.message }, 'JWT verification failed');
      
      return reply.code(401).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        },
      });
    }
  } catch (error: any) {
    logger.error({ error }, 'Authentication middleware error');
    
    return reply.code(500).send({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * @description Check if user has required role
 * @param {string[]} allowedRoles - Allowed roles
 * @returns {Function} Middleware function
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export function requireRole(allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }
  };
}

/**
 * @description Check if user belongs to organization
 * @param {Function} getOrgId - Function to get organization ID from request
 * @returns {Function} Middleware function
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export function requireOrganization(getOrgId: (req: FastifyRequest) => string) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const orgId = getOrgId(request);
    
    if (request.user.organizationId !== orgId && !request.user.isAdmin) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this organization',
        },
      });
    }
  };
}

/**
 * @description Rate limiting middleware
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Middleware function
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async function (request: FastifyRequest, reply: FastifyReply) {
    const key = request.user?.id || request.ip;
    const now = Date.now();
    
    const userRequests = requests.get(key);
    
    if (!userRequests || userRequests.resetTime < now) {
      // New window
      requests.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
    } else if (userRequests.count >= maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((userRequests.resetTime - now) / 1000);
      
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          retryAfter,
        },
      });
    } else {
      // Increment counter
      userRequests.count++;
    }

    // Clean up old entries periodically
    if (requests.size > 1000) {
      for (const [k, v] of requests.entries()) {
        if (v.resetTime < now) {
          requests.delete(k);
        }
      }
    }
  };
}