/**
 * QuDAG MCP-SSE HTTP Server
 *
 * Implements Model Context Protocol with Streamable HTTP transport
 * supporting SSE (Server-Sent Events) for real-time updates.
 */

import express, { Request, Response, NextFunction, Application } from "express";
import cors from "cors";
import * as https from "https";
import * as fs from "fs";
import { configManager, ServerConfig } from "./config";
import { createOAuth2Manager, OAuth2Manager, AuthContext } from "./auth/oauth2";
import { createRBACManager, RBACManager } from "./auth/rbac";
import { createRateLimitMiddleware } from "./middleware/rate-limit";
import {
  validateJsonRpcRequest,
  sanitizeInputs,
  createSecurityHeadersMiddleware,
  validateOrigin,
  addRequestId,
  errorHandler
} from "./middleware/security";
import { toolRegistry, ToolRegistry } from "./tools";
import { v4 as uuidv4 } from "uuid";

/**
 * Extend Express Request with auth context
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      request_id?: string;
      rbac?: RBACManager;
    }
  }
}

/**
 * QuDAG MCP HTTP Server
 */
export class QuDAGMcpServer {
  private app: Application;
  private config: Readonly<ServerConfig>;
  private oauth2Manager?: OAuth2Manager;
  private rbacManager: RBACManager;
  private toolRegistry: ToolRegistry;
  private server?: https.Server;

  constructor(config?: Partial<ServerConfig>) {
    this.config = config ? { ...configManager.getConfig(), ...config } : configManager.getConfig();
    this.rbacManager = createRBACManager();
    this.toolRegistry = toolRegistry;
    this.app = express();

    // Initialize OAuth2 if configured
    if (this.config.oauth2) {
      this.oauth2Manager = createOAuth2Manager(this.config.oauth2);
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Body parser
    this.app.use(express.json({ limit: "10mb" }));

    // Request ID
    this.app.use(addRequestId);

    // Security headers
    if (this.config.security.helmet_enabled) {
      this.app.use(createSecurityHeadersMiddleware(this.config.security.csp_enabled));
    }

    // CORS
    this.app.use(
      cors({
        origin: this.config.cors.origins,
        credentials: this.config.cors.credentials,
        methods: this.config.cors.methods,
        allowedHeaders: this.config.cors.allowed_headers
      })
    );

    // Origin validation
    this.app.use(validateOrigin(this.config.cors.origins));

    // Rate limiting
    this.app.use(createRateLimitMiddleware(this.config.security.rate_limit_requests_per_minute));

    // Authentication middleware
    if (this.config.security.require_auth && this.oauth2Manager) {
      this.app.use(this.authMiddleware.bind(this));
    }

    // Input validation
    this.app.use(validateJsonRpcRequest);
    this.app.use(sanitizeInputs);

    // Attach RBAC manager to request
    this.app.use((req, res, next) => {
      req.rbac = this.rbacManager;
      next();
    });
  }

  /**
   * Authentication middleware
   */
  private async authMiddleware(req: Request, res: Response, next: NextFunction) {
    // Skip auth for health check and OPTIONS
    if (req.method === "OPTIONS" || (req.path === "/health" && req.method === "GET")) {
      return next();
    }

    const authHeader = req.get("Authorization");
    if (!authHeader) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authorization header required"
      });
    }

    try {
      const token = this.oauth2Manager!.extractBearerToken(authHeader);
      if (!token) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Invalid authorization header format"
        });
      }

      const authContext = await this.oauth2Manager!.validateToken(token);
      req.auth = authContext;

      // Set default roles if not provided
      if (!req.auth.roles || req.auth.roles.length === 0) {
        req.auth.roles = ["user"];
      }

      next();
    } catch (error: any) {
      console.error("Authentication error:", error);
      res.status(401).json({
        error: "Unauthorized",
        message: error.message
      });
    }
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        version: "0.1.0",
        timestamp: new Date().toISOString()
      });
    });

    // MCP server info endpoint
    this.app.get("/mcp", (req, res) => {
      res.json({
        version: "2025-03-26",
        name: "QuDAG MCP-SSE",
        tools: this.toolRegistry.getToolSchemas(),
        transport: "streamable-http"
      });
    });

    // Main MCP endpoint - handles both synchronous and streaming responses
    this.app.post("/mcp", this.handleMcpRequest.bind(this));

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: "Not Found",
        message: `Endpoint not found: ${req.path}`
      });
    });

    // Error handler
    this.app.use(errorHandler);
  }

  /**
   * Handle MCP requests
   */
  private async handleMcpRequest(req: Request, res: Response): Promise<void> {
    const body = req.body;
    const requestId = req.request_id || `req_${uuidv4()}`;

    try {
      // Handle initialize method
      if (body.method === "initialize") {
        return this.handleInitialize(req, res, body, requestId);
      }

      // Handle tools/list method
      if (body.method === "tools/list") {
        return this.handleToolsList(req, res, body, requestId);
      }

      // Handle tools/call method
      if (body.method === "tools/call") {
        return this.handleToolCall(req, res, body, requestId);
      }

      // Unknown method
      return res.status(400).json({
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32601,
          message: "Method not found",
          data: { method: body.method }
        }
      });
    } catch (error: any) {
      console.error("MCP request error:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32603,
          message: "Internal error",
          data: { error: error.message, request_id: requestId }
        }
      });
    }
  }

  /**
   * Handle initialize method
   */
  private async handleInitialize(req: Request, res: Response, body: any, requestId: string) {
    const initResult = {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: {
          listChanged: false
        },
        resources: {
          subscribe: false
        }
      },
      serverInfo: {
        name: "QuDAG MCP Server",
        version: "0.1.0"
      }
    };

    res.json({
      jsonrpc: "2.0",
      id: body.id,
      result: initResult
    });
  }

  /**
   * Handle tools/list method
   */
  private async handleToolsList(req: Request, res: Response, body: any, requestId: string) {
    const tools = this.toolRegistry.getToolSchemas();

    res.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        tools
      }
    });
  }

  /**
   * Handle tools/call method - with Streamable HTTP support
   */
  private async handleToolCall(req: Request, res: Response, body: any, requestId: string) {
    const { name, arguments: args } = body.params || {};

    if (!name) {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32602,
          message: "Invalid params - tool name required"
        }
      });
    }

    try {
      // Check tool exists
      const tool = this.toolRegistry.getTool(name);
      if (!tool) {
        return res.status(400).json({
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: -32601,
            message: `Tool not found: ${name}`
          }
        });
      }

      // Check authorization
      if (
        req.auth &&
        !this.rbacManager.hasPermission(req.auth.roles || [], name.split("/")[0], "execute", {
          user_id: req.auth.user_id
        })
      ) {
        return res.status(403).json({
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: -32603,
            message: "Insufficient permissions for this tool"
          }
        });
      }

      // Execute tool
      const toolContext = {
        user_id: req.auth?.user_id,
        request_id: requestId,
        roles: req.auth?.roles || [],
        rbac: this.rbacManager
      };

      const result = await tool.execute(args || {}, toolContext);

      // Send result
      res.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          content: [result]
        }
      });
    } catch (error: any) {
      console.error("Tool execution error:", error);

      // Handle validation errors
      if (error.code && error.message) {
        return res.status(400).json({
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: error.code,
            message: error.message,
            data: error.data
          }
        });
      }

      res.status(500).json({
        jsonrpc: "2.0",
        id: body.id,
        error: {
          code: -32603,
          message: "Internal error",
          data: {
            error: error.message,
            request_id: requestId
          }
        }
      });
    }
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        configManager.validate();

        if (this.config.protocol === "https" && this.config.tls) {
          const options = {
            cert: fs.readFileSync(this.config.tls.cert_path),
            key: fs.readFileSync(this.config.tls.key_path),
            ...(this.config.tls.ca_path && {
              ca: fs.readFileSync(this.config.tls.ca_path)
            })
          };

          this.server = https.createServer(options, this.app);
        } else {
          // For development only - HTTP without TLS
          const http = require("http");
          this.server = http.createServer(this.app);
        }

        this.server.listen(this.config.port, this.config.host, () => {
          console.log(`QuDAG MCP Server running on ${this.config.protocol}://${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on("error", reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get Express app (for testing)
   */
  public getApp(): Application {
    return this.app;
  }
}

/**
 * Main entry point
 */
if (require.main === module) {
  const server = new QuDAGMcpServer();

  server.start().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully");
    await server.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down gracefully");
    await server.stop();
    process.exit(0);
  });
}

export default QuDAGMcpServer;
