/**
 * @description Initialize all services and dependency injection
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial services setup
 */

import { DatabasePool } from 'slonik';
import Redis from 'ioredis';
import { OrganizationService } from './organization.service';
import { AgentService } from './agent.service';
import { MetricsService } from './metrics.service';
import { CommandService } from './command.service';
import { QuDAGIntegration } from './qudag-integration.service';
import { logger } from '../utils/logger';

export interface Services {
  organization: OrganizationService;
  agent: AgentService;
  metrics: MetricsService;
  command: CommandService;
  qudag: QuDAGIntegration;
}

/**
 * @description Initialize all services with dependencies
 * @param {DatabasePool} db - Database connection pool
 * @param {Redis} redis - Redis client
 * @returns {Promise<Services>} Initialized services
 * @author CleoClaudeDesktop
 * @since 1.0.0
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Initial implementation
 */
export async function initializeServices(
  db: DatabasePool,
  redis: Redis
): Promise<Services> {
  logger.info('Initializing services...');

  // Initialize QuDAG integration first as other services depend on it
  const qudag = new QuDAGIntegration();
  await qudag.initialize();

  // Initialize core services
  const organization = new OrganizationService(db, redis);
  const agent = new AgentService(db, redis, qudag);
  const metrics = new MetricsService(db, redis);
  const command = new CommandService(db, redis, agent, metrics);

  const services: Services = {
    organization,
    agent,
    metrics,
    command,
    qudag,
  };

  logger.info('All services initialized successfully');
  return services;
}