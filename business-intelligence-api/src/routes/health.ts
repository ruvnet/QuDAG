/**
 * @description Health check routes
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial health routes
 */

import { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * @description Basic health check
   * @route GET /health
   * @returns {object} Health status
   */
  fastify.get('/health', async (request, reply) => {
    const db = fastify.db;
    const redis = fastify.redis;
    
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: 'unknown',
        redis: 'unknown',
        memory: 'unknown',
      },
    };

    // Check database
    try {
      await db.query`SELECT 1`;
      checks.checks.database = 'healthy';
    } catch (error) {
      checks.checks.database = 'unhealthy';
      checks.status = 'degraded';
    }

    // Check Redis
    try {
      await redis.ping();
      checks.checks.redis = 'healthy';
    } catch (error) {
      checks.checks.redis = 'unhealthy';
      checks.status = 'degraded';
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const maxMemory = 1024 * 1024 * 1024; // 1GB
    if (memoryUsage.heapUsed > maxMemory * 0.9) {
      checks.checks.memory = 'warning';
      checks.status = 'degraded';
    } else {
      checks.checks.memory = 'healthy';
    }

    // Add memory details
    checks.memory = {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
    };

    return reply.code(checks.status === 'healthy' ? 200 : 503).send(checks);
  });

  /**
   * @description Detailed health check
   * @route GET /health/detailed
   * @returns {object} Detailed health information
   */
  fastify.get('/health/detailed', async (request, reply) => {
    const services = fastify.services;
    
    const details = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: await checkDatabase(fastify.db),
        redis: await checkRedis(fastify.redis),
        qudag: await checkQuDAG(services.qudag),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuUsage: process.cpuUsage(),
        memory: process.memoryUsage(),
      },
    };

    // Determine overall status
    const unhealthyServices = Object.values(details.services).filter(s => s.status !== 'healthy');
    if (unhealthyServices.length > 0) {
      details.status = 'degraded';
    }

    return reply.send(details);
  });

  /**
   * @description Readiness check for Kubernetes
   * @route GET /health/ready
   * @returns {object} Readiness status
   */
  fastify.get('/health/ready', async (request, reply) => {
    try {
      // Check if all critical services are ready
      await fastify.db.query`SELECT 1`;
      await fastify.redis.ping();
      
      return reply.send({ ready: true });
    } catch (error) {
      return reply.code(503).send({ ready: false });
    }
  });

  /**
   * @description Liveness check for Kubernetes
   * @route GET /health/live
   * @returns {object} Liveness status
   */
  fastify.get('/health/live', async (request, reply) => {
    return reply.send({ alive: true });
  });
};

/**
 * @description Check database health
 * @param {any} db - Database instance
 * @returns {Promise<object>} Database health status
 */
async function checkDatabase(db: any): Promise<any> {
  try {
    const start = Date.now();
    const result = await db.query`SELECT version()`;
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      version: result.rows[0].version,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * @description Check Redis health
 * @param {any} redis - Redis instance
 * @returns {Promise<object>} Redis health status
 */
async function checkRedis(redis: any): Promise<any> {
  try {
    const start = Date.now();
    const info = await redis.info();
    const latency = Date.now() - start;
    
    // Parse Redis info
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    const usedMemory = info.match(/used_memory_human:([^\r\n]+)/)?.[1];
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      version,
      memory: usedMemory,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * @description Check QuDAG integration health
 * @param {any} qudag - QuDAG service
 * @returns {Promise<object>} QuDAG health status
 */
async function checkQuDAG(qudag: any): Promise<any> {
  try {
    // Check if WebSocket is connected
    const wsConnected = qudag.listenerCount('connected') > 0;
    
    // Try to get exchange rates as a health check
    const start = Date.now();
    await qudag.getExchangeRates();
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      websocket: wsConnected ? 'connected' : 'disconnected',
      latency: `${latency}ms`,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}