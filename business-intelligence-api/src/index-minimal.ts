/**
 * @description Minimal QuDAG Business Intelligence API
 * @author CleoClaudeDesktop  
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Minimal working version
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { testOrganizations, testDepartments, testAgents, testMetrics, testProjects } from './test-data';

const app = Fastify({
  logger: process.env.NODE_ENV === 'development' ? {
    transport: {
      target: 'pino-pretty'
    }
  } : true
});

// Register plugins
app.register(cors, {
  origin: true
});

app.register(helmet);

// Health check endpoint
app.get('/api/v1/health', async (request, reply) => {
  return {
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'qudag-business-intelligence-api',
    version: '1.0.0'
  };
});

// Default route
app.get('/', async (request, reply) => {
  return {
    message: 'QuDAG Business Intelligence API',
    version: '1.0.0',
    status: 'running'
  };
});

// Organizations endpoints
app.get('/api/v1/organizations', async (request, reply) => {
  const page = parseInt((request.query as any)?.page || '1', 10);
  const pageSize = parseInt((request.query as any)?.pageSize || '10', 10);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = testOrganizations.slice(start, end);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalItems: testOrganizations.length,
      totalPages: Math.ceil(testOrganizations.length / pageSize),
      hasNext: end < testOrganizations.length,
      hasPrevious: page > 1,
    }
  };
});

// Agents endpoints
app.get('/api/v1/agents', async (request, reply) => {
  const organizationId = (request.query as any)?.organizationId;
  const page = parseInt((request.query as any)?.page || '1', 10);
  const pageSize = parseInt((request.query as any)?.pageSize || '10', 10);
  
  let filteredAgents = testAgents;
  if (organizationId) {
    filteredAgents = testAgents.filter(agent => agent.organization_id === organizationId);
  }
  
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = filteredAgents.slice(start, end);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalItems: filteredAgents.length,
      totalPages: Math.ceil(filteredAgents.length / pageSize),
      hasNext: end < filteredAgents.length,
      hasPrevious: page > 1,
    }
  };
});

// Metrics endpoints
app.get('/api/v1/metrics', async (request, reply) => {
  const organizationId = (request.query as any)?.organizationId;
  const type = (request.query as any)?.type;
  const page = parseInt((request.query as any)?.page || '1', 10);
  const pageSize = parseInt((request.query as any)?.pageSize || '10', 10);
  
  let filteredMetrics = testMetrics;
  if (organizationId) {
    filteredMetrics = filteredMetrics.filter(metric => metric.organization_id === organizationId);
  }
  if (type) {
    filteredMetrics = filteredMetrics.filter(metric => metric.metric_type === type);
  }
  
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = filteredMetrics.slice(start, end);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalItems: filteredMetrics.length,
      totalPages: Math.ceil(filteredMetrics.length / pageSize),
      hasNext: end < filteredMetrics.length,
      hasPrevious: page > 1,
    }
  };
});

// Metrics summary endpoint
app.get('/api/v1/metrics/summary', async (request, reply) => {
  const organizationId = (request.query as any)?.organizationId;
  const orgMetrics = testMetrics.filter(m => !organizationId || m.organization_id === organizationId);
  
  const totalRevenue = orgMetrics
    .filter(m => m.metric_type === 'revenue')
    .reduce((sum, m) => sum + m.value, 0);
    
  const totalCosts = orgMetrics
    .filter(m => m.metric_type === 'costs')
    .reduce((sum, m) => sum + m.value, 0);
    
  const efficiency = orgMetrics
    .filter(m => m.metric_type === 'efficiency')
    .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0);
  
  return {
    success: true,
    data: {
      totalRevenue,
      totalCosts,
      profit: totalRevenue - totalCosts,
      efficiency,
      growth: 0.12 // 12% growth
    }
  };
});

// Projects endpoints
app.get('/api/v1/projects', async (request, reply) => {
  const organizationId = (request.query as any)?.organizationId;
  const status = (request.query as any)?.status;
  const page = parseInt((request.query as any)?.page || '1', 10);
  const pageSize = parseInt((request.query as any)?.pageSize || '10', 10);
  
  let filteredProjects = testProjects;
  if (organizationId) {
    filteredProjects = filteredProjects.filter(project => project.organization_id === organizationId);
  }
  if (status) {
    filteredProjects = filteredProjects.filter(project => project.status === status);
  }
  
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = filteredProjects.slice(start, end);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalItems: filteredProjects.length,
      totalPages: Math.ceil(filteredProjects.length / pageSize),
      hasNext: end < filteredProjects.length,
      hasPrevious: page > 1,
    }
  };
});

// Departments endpoints
app.get('/api/v1/departments', async (request, reply) => {
  const organizationId = (request.query as any)?.organizationId;
  const page = parseInt((request.query as any)?.page || '1', 10);
  const pageSize = parseInt((request.query as any)?.pageSize || '10', 10);
  
  let filteredDepartments = testDepartments;
  if (organizationId) {
    filteredDepartments = filteredDepartments.filter(dept => dept.organization_id === organizationId);
  }
  
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = filteredDepartments.slice(start, end);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalItems: filteredDepartments.length,
      totalPages: Math.ceil(filteredDepartments.length / pageSize),
      hasNext: end < filteredDepartments.length,
      hasPrevious: page > 1,
    }
  };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8090', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    console.log(`🚀 Server running on http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/api/v1/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await app.close();
  process.exit(0);
});

start();