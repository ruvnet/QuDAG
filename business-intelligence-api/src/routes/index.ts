/**
 * @description Register all API routes
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial route registration
 */

import { FastifyInstance } from 'fastify';
import { organizationRoutes } from './organizations';
import { agentRoutes } from './agents';
import { metricsRoutes } from './metrics';
import { commandRoutes } from './commands';
import { dashboardRoutes } from './dashboards';
import { healthRoutes } from './health';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

/**
 * @description Register all API routes with Fastify
 * @param {FastifyInstance} app - Fastify instance
 * @returns {Promise<void>}
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  logger.info('Registering API routes...');

  // Health check routes (no auth required)
  await app.register(healthRoutes, { prefix: '/api/v1' });

  // Protected routes
  await app.register(async function (protectedApp) {
    // Add authentication to all routes in this context
    protectedApp.addHook('onRequest', authMiddleware);

    // Organization management
    await protectedApp.register(organizationRoutes, { prefix: '/api/v1/organizations' });

    // Agent operations
    await protectedApp.register(agentRoutes, { prefix: '/api/v1/agents' });

    // Metrics and analytics
    await protectedApp.register(metricsRoutes, { prefix: '/api/v1/metrics' });

    // Natural language commands
    await protectedApp.register(commandRoutes, { prefix: '/api/v1/commands' });

    // Dashboards and reports
    await protectedApp.register(dashboardRoutes, { prefix: '/api/v1/dashboards' });
  });

  // WebSocket routes for real-time updates
  app.register(async function (wsApp) {
    wsApp.get('/ws', { websocket: true }, (connection, req) => {
      connection.socket.on('message', message => {
        // Handle WebSocket messages
        try {
          const data = JSON.parse(message.toString());
          handleWebSocketMessage(connection, data, app);
        } catch (error) {
          logger.error({ error }, 'Invalid WebSocket message');
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }));
        }
      });

      connection.socket.on('close', () => {
        logger.debug('WebSocket connection closed');
      });

      // Send welcome message
      connection.socket.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to QuDAG Business Intelligence',
        timestamp: new Date().toISOString(),
      }));
    });
  });

  logger.info('All routes registered successfully');
}

/**
 * @description Handle WebSocket messages
 * @param {any} connection - WebSocket connection
 * @param {any} data - Message data
 * @param {FastifyInstance} app - Fastify instance
 * @private
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
function handleWebSocketMessage(connection: any, data: any, app: FastifyInstance): void {
  const { type, payload } = data;

  switch (type) {
    case 'subscribe':
      handleSubscription(connection, payload);
      break;
    case 'unsubscribe':
      handleUnsubscription(connection, payload);
      break;
    case 'ping':
      connection.socket.send(JSON.stringify({ type: 'pong' }));
      break;
    default:
      connection.socket.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${type}`,
      }));
  }
}

/**
 * @description Handle WebSocket subscription
 * @param {any} connection - WebSocket connection
 * @param {any} payload - Subscription payload
 * @private
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
function handleSubscription(connection: any, payload: any): void {
  const { topics = [] } = payload;
  
  // Store subscription info on connection
  connection.subscriptions = connection.subscriptions || new Set();
  
  topics.forEach((topic: string) => {
    connection.subscriptions.add(topic);
  });

  connection.socket.send(JSON.stringify({
    type: 'subscribed',
    topics,
  }));
}

/**
 * @description Handle WebSocket unsubscription
 * @param {any} connection - WebSocket connection
 * @param {any} payload - Unsubscription payload
 * @private
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
function handleUnsubscription(connection: any, payload: any): void {
  const { topics = [] } = payload;
  
  if (connection.subscriptions) {
    topics.forEach((topic: string) => {
      connection.subscriptions.delete(topic);
    });
  }

  connection.socket.send(JSON.stringify({
    type: 'unsubscribed',
    topics,
  }));
}