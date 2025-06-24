/**
 * @description Configuration for QuDAG PostgreSQL MCP Server
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Initial implementation
 */

import { config } from "dotenv";
import { z } from "zod";

// Load environment variables
config();

// Configuration schema validation
const configSchema = z.object({
  // Database connection
  DATABASE_URL: z.string().url(),

  // MCP Server settings
  MCP_ACCESS_MODE: z.enum(["restricted", "unrestricted"]).default("restricted"),
  MCP_ALLOWED_SCHEMAS: z.string().default("executive"),
  MCP_AUDIT_LOG: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Security settings
  REQUIRE_CONFIRMATION_DELETE: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  REQUIRE_CONFIRMATION_ADMIN: z
    .string()
    .transform((val) => val === "true")
    .default("true"),

  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.string().transform(Number).default("60"),
  MAX_CONCURRENT_CONNECTIONS: z.string().transform(Number).default("10"),

  // Query limits
  MAX_QUERY_ROWS: z.string().transform(Number).default("1000"),
  QUERY_TIMEOUT_MS: z.string().transform(Number).default("30000"),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FILE: z.string().optional(),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// Parse and validate configuration
const env = {
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://qudag_executive:password@localhost:5433/qudag_business",
  MCP_ACCESS_MODE: process.env.MCP_ACCESS_MODE || "restricted",
  MCP_ALLOWED_SCHEMAS: process.env.MCP_ALLOWED_SCHEMAS || "executive",
  MCP_AUDIT_LOG: process.env.MCP_AUDIT_LOG || "true",
  REQUIRE_CONFIRMATION_DELETE:
    process.env.REQUIRE_CONFIRMATION_DELETE || "true",
  REQUIRE_CONFIRMATION_ADMIN: process.env.REQUIRE_CONFIRMATION_ADMIN || "true",
  RATE_LIMIT_REQUESTS_PER_MINUTE:
    process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || "60",
  MAX_CONCURRENT_CONNECTIONS: process.env.MAX_CONCURRENT_CONNECTIONS || "10",
  MAX_QUERY_ROWS: process.env.MAX_QUERY_ROWS || "1000",
  QUERY_TIMEOUT_MS: process.env.QUERY_TIMEOUT_MS || "30000",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  LOG_FILE: process.env.LOG_FILE,
  NODE_ENV: process.env.NODE_ENV || "development",
};

// Validate configuration
export const config_validated = configSchema.parse(env);

// Export typed configuration
export interface PostgresMCPConfig {
  database: {
    url: string;
    maxConnections: number;
    queryTimeout: number;
    maxRows: number;
  };
  security: {
    accessMode: "restricted" | "unrestricted";
    allowedSchemas: string[];
    requireConfirmationDelete: boolean;
    requireConfirmationAdmin: boolean;
    auditLog: boolean;
  };
  rateLimit: {
    requestsPerMinute: number;
    maxConcurrentConnections: number;
  };
  logging: {
    level: "error" | "warn" | "info" | "debug";
    file?: string;
  };
  environment: "development" | "production" | "test";
}

export const appConfig: PostgresMCPConfig = {
  database: {
    url: config_validated.DATABASE_URL,
    maxConnections: config_validated.MAX_CONCURRENT_CONNECTIONS,
    queryTimeout: config_validated.QUERY_TIMEOUT_MS,
    maxRows: config_validated.MAX_QUERY_ROWS,
  },
  security: {
    accessMode: config_validated.MCP_ACCESS_MODE,
    allowedSchemas: config_validated.MCP_ALLOWED_SCHEMAS.split(",").map((s) =>
      s.trim()
    ),
    requireConfirmationDelete: config_validated.REQUIRE_CONFIRMATION_DELETE,
    requireConfirmationAdmin: config_validated.REQUIRE_CONFIRMATION_ADMIN,
    auditLog: config_validated.MCP_AUDIT_LOG,
  },
  rateLimit: {
    requestsPerMinute: config_validated.RATE_LIMIT_REQUESTS_PER_MINUTE,
    maxConcurrentConnections: config_validated.MAX_CONCURRENT_CONNECTIONS,
  },
  logging: {
    level:
      (process.env.LOG_LEVEL as "error" | "warn" | "info" | "debug") || "info",
    ...(process.env.LOG_FILE && { file: process.env.LOG_FILE }),
  },
  environment: config_validated.NODE_ENV,
};

// Validate database URL format
if (!config_validated.DATABASE_URL.startsWith("postgresql://")) {
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection string");
}

// Log configuration (excluding sensitive data)
console.log("PostgreSQL MCP Server Configuration:", {
  accessMode: appConfig.security.accessMode,
  allowedSchemas: appConfig.security.allowedSchemas,
  maxConnections: appConfig.database.maxConnections,
  environment: appConfig.environment,
});
