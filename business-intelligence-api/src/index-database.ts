/**
 * @description QuDAG Business Intelligence API with Database Integration
 * @author CleoClaudeDesktop
 * @created 2025-06-23
 * @lastModified 2025-06-23 by CleoClaudeDesktop - Database version
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { createPool, sql, type DatabasePool } from "slonik";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Please create a .env file with DATABASE_URL."
  );
}

let pool: DatabasePool;

const app = Fastify({
  logger:
    process.env.NODE_ENV === "development" ?
      {
        transport: {
          target: "pino-pretty",
        },
      }
    : true,
});

// Register plugins
app.register(cors, {
  origin: true,
});

app.register(helmet);

// Health check endpoint
app.get("/api/v1/health", async (request, reply) => {
  return {
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "qudag-business-intelligence-api",
    version: "1.0.0",
  };
});

// Default route
app.get("/", async (request, reply) => {
  return {
    message: "QuDAG Business Intelligence API",
    version: "1.0.0",
    status: "running",
  };
});

// Organizations endpoints
app.get("/api/v1/organizations", async (request, reply) => {
  try {
    const page = parseInt((request.query as any)?.page || "1", 10);
    const pageSize = parseInt((request.query as any)?.pageSize || "10", 10);
    const offset = (page - 1) * pageSize;

    const countResult = await pool.query(sql`
      SELECT COUNT(*) as total FROM executive.organizations
    `);
    const totalItems = parseInt(countResult.rows[0].total as string, 10);

    const result = await pool.query(sql.unsafe`
      SELECT * FROM executive.organizations
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      success: true,
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNext: offset + pageSize < totalItems,
        hasPrevious: page > 1,
      },
    };
  } catch (error) {
    app.log.error("Error fetching organizations:", error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch organizations",
    });
  }
});

// Agents endpoints
app.get("/api/v1/agents", async (request, reply) => {
  try {
    const organizationId = (request.query as any)?.organizationId;
    const page = parseInt((request.query as any)?.page || "1", 10);
    const pageSize = parseInt((request.query as any)?.pageSize || "10", 10);
    const offset = (page - 1) * pageSize;

    let countQuery, dataQuery;
    if (organizationId) {
      countQuery = sql`SELECT COUNT(*) as total FROM executive.agent_profiles WHERE organization_id = ${organizationId}`;
      dataQuery = sql.unsafe`
        SELECT * FROM executive.agent_profiles 
        WHERE organization_id = '${organizationId}'
        ORDER BY hired_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      countQuery = sql`SELECT COUNT(*) as total FROM executive.agent_profiles`;
      dataQuery = sql.unsafe`
        SELECT * FROM executive.agent_profiles 
        ORDER BY hired_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    }

    const countResult = await pool.query(countQuery);
    const totalItems = parseInt(countResult.rows[0].total as string, 10);
    const result = await pool.query(dataQuery);

    return {
      success: true,
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNext: offset + pageSize < totalItems,
        hasPrevious: page > 1,
      },
    };
  } catch (error) {
    app.log.error("Error fetching agents:", error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch agents",
    });
  }
});

// Metrics endpoints
app.get("/api/v1/metrics", async (request, reply) => {
  try {
    const organizationId = (request.query as any)?.organizationId;
    const type = (request.query as any)?.type;
    const page = parseInt((request.query as any)?.page || "1", 10);
    const pageSize = parseInt((request.query as any)?.pageSize || "10", 10);
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    if (organizationId) {
      whereClause += ` AND organization_id = '${organizationId}'`;
    }
    if (type) {
      whereClause += ` AND metric_type = '${type}'`;
    }

    const countResult = await pool.query(sql.unsafe`
      SELECT COUNT(*) as total FROM executive.business_metrics ${whereClause}
    `);
    const totalItems = parseInt(countResult.rows[0].total as string, 10);

    const result = await pool.query(sql.unsafe`
      SELECT * FROM executive.business_metrics 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      success: true,
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNext: offset + pageSize < totalItems,
        hasPrevious: page > 1,
      },
    };
  } catch (error) {
    app.log.error("Error fetching metrics:", error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch metrics",
    });
  }
});

// Metrics summary endpoint
app.get("/api/v1/metrics/summary", async (request, reply) => {
  try {
    const organizationId = (request.query as any)?.organizationId;

    let whereClause = "WHERE 1=1";
    if (organizationId) {
      whereClause += ` AND organization_id = '${organizationId}'`;
    }

    const result = await pool.query(sql.unsafe`
      SELECT 
        metric_type,
        SUM(value) as total_value,
        AVG(value) as avg_value,
        COUNT(*) as count
      FROM executive.business_metrics 
      ${whereClause}
      GROUP BY metric_type
    `);

    const metricSummary = result.rows.reduce((acc: any, row: any) => {
      acc[row.metric_type] = {
        total: parseFloat(row.total_value),
        average: parseFloat(row.avg_value),
        count: parseInt(row.count, 10),
      };
      return acc;
    }, {});

    const totalRevenue = metricSummary.revenue?.total || 0;
    const totalCosts = metricSummary.costs?.total || 0;
    const efficiency = metricSummary.efficiency?.average || 0;

    return {
      success: true,
      data: {
        totalRevenue,
        totalCosts,
        profit: totalRevenue - totalCosts,
        efficiency,
        growth: 0.12, // Placeholder - would calculate from time series data
        metricSummary,
      },
    };
  } catch (error) {
    app.log.error("Error fetching metrics summary:", error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch metrics summary",
    });
  }
});

// Projects endpoints
app.get("/api/v1/projects", async (request, reply) => {
  try {
    const organizationId = (request.query as any)?.organizationId;
    const status = (request.query as any)?.status;
    const page = parseInt((request.query as any)?.page || "1", 10);
    const pageSize = parseInt((request.query as any)?.pageSize || "10", 10);
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    if (organizationId) {
      whereClause += ` AND organization_id = '${organizationId}'`;
    }
    if (status) {
      whereClause += ` AND status = '${status}'`;
    }

    const countResult = await pool.query(sql.unsafe`
      SELECT COUNT(*) as total FROM executive.projects ${whereClause}
    `);
    const totalItems = parseInt(countResult.rows[0].total as string, 10);

    const result = await pool.query(sql.unsafe`
      SELECT * FROM executive.projects 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      success: true,
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNext: offset + pageSize < totalItems,
        hasPrevious: page > 1,
      },
    };
  } catch (error) {
    app.log.error("Error fetching projects:", error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch projects",
    });
  }
});

// Departments endpoints
app.get("/api/v1/departments", async (request, reply) => {
  try {
    const organizationId = (request.query as any)?.organizationId;
    const page = parseInt((request.query as any)?.page || "1", 10);
    const pageSize = parseInt((request.query as any)?.pageSize || "10", 10);
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    if (organizationId) {
      whereClause += ` AND organization_id = '${organizationId}'`;
    }

    const countResult = await pool.query(sql.unsafe`
      SELECT COUNT(*) as total FROM executive.departments ${whereClause}
    `);
    const totalItems = parseInt(countResult.rows[0].total as string, 10);

    const result = await pool.query(sql.unsafe`
      SELECT * FROM executive.departments 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      success: true,
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        hasNext: offset + pageSize < totalItems,
        hasPrevious: page > 1,
      },
    };
  } catch (error) {
    app.log.error("Error fetching departments:", error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
      message: "Failed to fetch departments",
    });
  }
});

// Start server
const start = async () => {
  try {
    // Initialize database pool
    pool = await createPool(DATABASE_URL);
    console.log("📅 Database pool connected");

    const port = parseInt(process.env.PORT || "8090", 10);
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({ port, host });
    console.log(`🚀 Server running on http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/api/v1/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  if (pool) {
    await pool.end();
    console.log("📅 Database pool closed");
  }
  await app.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  if (pool) {
    await pool.end();
    console.log("📅 Database pool closed");
  }
  await app.close();
  process.exit(0);
});

start();
