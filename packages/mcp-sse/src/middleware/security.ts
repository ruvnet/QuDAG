/**
 * Security Middleware
 *
 * Input validation, XSS protection, CSRF tokens, and security headers.
 */

import { Request, Response, NextFunction } from "express";
import helmet from "helmet";

/**
 * Input validation middleware
 */
export function validateJsonRpcRequest(req: Request, res: Response, next: NextFunction) {
  // Only validate POST requests
  if (req.method !== "POST") {
    return next();
  }

  const body = req.body;

  // Check basic structure
  if (!body || typeof body !== "object") {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32700,
        message: "Parse error - Invalid JSON"
      }
    });
  }

  // Validate JSON-RPC 2.0 format
  if (body.jsonrpc !== "2.0") {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request - jsonrpc must be 2.0"
      },
      id: body.id
    });
  }

  // Validate method exists
  if (!body.method || typeof body.method !== "string") {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request - method is required"
      },
      id: body.id
    });
  }

  // Validate method name
  if (!/^[a-zA-Z0-9_/\-]+$/.test(body.method)) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: "Method Not Found - invalid method name",
        data: { method: body.method }
      },
      id: body.id
    });
  }

  // Check payload size
  const payloadSize = JSON.stringify(req.body).length;
  if (payloadSize > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Request entity too large",
        data: { max_size: "10MB", actual_size: payloadSize }
      },
      id: body.id
    });
  }

  next();
}

/**
 * Input sanitization middleware
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "POST" || !req.body) {
    return next();
  }

  // Sanitize params if present
  if (req.body.params && typeof req.body.params === "object") {
    req.body.params = sanitizeObject(req.body.params);
  }

  next();
}

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize key
    const cleanKey = sanitizeString(key);

    // Sanitize value
    if (typeof value === "string") {
      sanitized[cleanKey] = sanitizeString(value);
    } else if (typeof value === "object") {
      sanitized[cleanKey] = sanitizeObject(value);
    } else {
      sanitized[cleanKey] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize string values
 */
function sanitizeString(str: string): string {
  // Remove control characters
  str = str.replace(/[\x00-\x1F\x7F]/g, "");

  // Prevent path traversal
  str = str.replace(/\.\.\//g, "");

  // Prevent common injection patterns (basic)
  str = str.replace(/<script[^>]*>.*?<\/script>/gi, "");
  str = str.replace(/javascript:/gi, "");

  return str;
}

/**
 * Security headers middleware using helmet
 */
export function createSecurityHeadersMiddleware(cspEnabled: boolean = true) {
  const options: helmet.HelmetOptions = {
    contentSecurityPolicy: cspEnabled ? {
      directives: {
        defaultSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    } : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true
  };

  return helmet(options);
}

/**
 * CORS origin validation middleware
 */
export function validateOrigin(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get("origin");
    const host = req.get("host");

    if (origin) {
      // Check if origin is allowed
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed === "*") return true;
        if (allowed === origin) return true;
        if (allowed.startsWith("*.")) {
          const domain = allowed.slice(2);
          return origin.endsWith(domain);
        }
        return false;
      });

      if (!isAllowed) {
        console.warn(`Blocked request from origin: ${origin}`);
        return res.status(403).json({
          error: "Forbidden",
          message: "Origin not allowed"
        });
      }
    }

    // Validate Host header
    if (host && !host.includes(":") && host.includes(".")) {
      // Basic validation - in production use more sophisticated checks
      if (!host.match(/^[\w\-\.]+$/)) {
        console.warn(`Blocked request with invalid host: ${host}`);
        return res.status(403).json({
          error: "Forbidden",
          message: "Invalid host"
        });
      }
    }

    next();
  };
}

/**
 * Request ID middleware for tracking
 */
export function addRequestId(req: Request, res: Response, next: NextFunction) {
  const requestId = req.get("X-Request-ID") || generateRequestId();
  (req as any).request_id = requestId;
  res.set("X-Request-ID", requestId);

  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error handling middleware
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error("Error:", err);

  const requestId = (req as any).request_id;

  if (res.headersSent) {
    return next(err);
  }

  // JSON-RPC error response
  if (req.path === "/mcp" && req.method === "POST") {
    return res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal error",
        data: {
          error: err.message,
          request_id: requestId
        }
      },
      id: req.body?.id
    });
  }

  // Standard error response
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
    request_id: requestId
  });
}

export const createSecurityMiddleware = () => ({
  validateJsonRpcRequest,
  sanitizeInputs,
  createSecurityHeadersMiddleware,
  validateOrigin,
  addRequestId,
  errorHandler
});
