/**
 * @description Logging configuration for PostgreSQL MCP Server
 * @author QuDAG-PostgreSQL-MCP-Agent
 * @created 2025-01-27
 * @lastModified 2025-01-27 by QuDAG-PostgreSQL-MCP-Agent - Initial implementation
 */

import winston from "winston";
import { appConfig } from "./config";

// Custom log format for MCP operations
const mcpFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      service: "qudag-postgres-mcp",
      ...meta,
    };
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: mcpFormat,
  defaultMeta: {
    service: "qudag-postgres-mcp",
    environment: appConfig.environment,
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format:
        appConfig.environment === "development" ? consoleFormat : mcpFormat,
    }),
  ],
});

// Add file transport if configured
if (appConfig.logging.file) {
  logger.add(
    new winston.transports.File({
      filename: appConfig.logging.file,
      format: mcpFormat,
    })
  );
}

// Audit logger for security events
export const auditLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const auditEntry = {
        timestamp,
        level,
        message,
        service: "qudag-postgres-mcp",
        type: "audit",
        ...meta,
      };
      return JSON.stringify(auditEntry);
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [AUDIT] ${message} ${JSON.stringify(meta)}`;
        })
      ),
    }),
  ],
});

// Add audit file if configured
if (appConfig.logging.file) {
  const auditFile = appConfig.logging.file.replace(".log", "-audit.log");
  auditLogger.add(
    new winston.transports.File({
      filename: auditFile,
    })
  );
}

/**
 * Log MCP tool execution
 */
export function logToolExecution(
  toolName: string,
  params: any,
  result: "success" | "error",
  details?: any
) {
  if (appConfig.security.auditLog) {
    auditLogger.info("MCP tool executed", {
      tool: toolName,
      params: typeof params === "object" ? JSON.stringify(params) : params,
      result,
      details,
    });
  }
}

/**
 * Log database operation
 */
export function logDatabaseOperation(
  operation: string,
  schema: string,
  table?: string,
  rowsAffected?: number,
  details?: any
) {
  if (appConfig.security.auditLog) {
    auditLogger.info("Database operation", {
      operation,
      schema,
      table,
      rowsAffected,
      details,
    });
  }
}

/**
 * Log security event
 */
export function logSecurityEvent(event: string, details: any) {
  auditLogger.warn("Security event", {
    event,
    details,
  });
}

// Unhandled error logging
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// Graceful shutdown logging
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully...");
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
});
