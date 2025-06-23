/**
 * QuDAG Business Intelligence API
 * Main entry point for the Executive Intelligence Center backend
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config';
import { logger } from './utils/logger';
import { setupDatabase } from './db';
import { setupRedis } from './cache';
import { registerRoutes } from './routes';
import { initializeServices } from './services';
import { startMetricsCollector } from './services/metrics-collector';

async function start() {
  // Initialize Fastify with logging
  const app = Fastify({
    logger: logger,
    trustProxy: true,
  });

  try {
    // Register security plugins
    await app.register(helmet, {
      contentSecurityPolicy: false, // We'll handle CSP ourselves
    });

    // CORS configuration
    await app.register(cors, {
      origin: config.cors.origins,
      credentials: true,
    });

    // Rate limiting
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });

    // JWT authentication
    await app.register(jwt, {
      secret: config.jwt.secret,
      sign: {
        expiresIn: config.jwt.expiresIn,
      },
    });

    // WebSocket support for real-time updates
    await app.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
      },
    });

    // Initialize database connection
    const db = await setupDatabase();
    app.decorate('db', db);

    // Initialize Redis cache
    const redis = await setupRedis();
    app.decorate('redis', redis);

    // Initialize services
    const services = await initializeServices(db, redis);
    app.decorate('services', services);

    // Register API routes
    await registerRoutes(app);

    // Health check endpoint
    app.get('/health', async () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: config.app.version,
    }));

    // Start metrics collector
    startMetricsCollector(services);

    // Start server
    await app.listen({
      port: config.app.port,
      host: config.app.host,
    });

    logger.info(`Business Intelligence API started on ${config.app.host}:${config.app.port}`);
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
start();
