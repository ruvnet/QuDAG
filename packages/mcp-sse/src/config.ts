/**
 * QuDAG MCP-SSE Server Configuration
 *
 * Loads and validates configuration from environment variables and config files.
 */

import * as fs from "fs";
import * as path from "path";

export interface ServerConfig {
  // Server settings
  host: string;
  port: number;
  protocol: "http" | "https";

  // TLS settings
  tls?: {
    cert_path: string;
    key_path: string;
    ca_path?: string;
  };

  // OAuth2 settings
  oauth2?: {
    issuer_url: string;
    audience: string;
    jwks_url: string;
    token_endpoint?: string;
    verify_signature: boolean;
    verify_expiry: boolean;
  };

  // CORS settings
  cors: {
    origins: string[];
    credentials: boolean;
    methods: string[];
    allowed_headers: string[];
  };

  // Security settings
  security: {
    require_auth: boolean;
    rate_limit_requests_per_minute: number;
    rate_limit_per_user: boolean;
    helmet_enabled: boolean;
    csp_enabled: boolean;
  };

  // Redis settings (for distributed deployments)
  redis?: {
    url: string;
    password?: string;
    db: number;
    ttl_seconds: number;
  };

  // Logging settings
  logging: {
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "text";
    audit_enabled: boolean;
  };

  // NAPI core settings
  napi?: {
    vault_path: string;
    config_path: string;
  };
}

export class ConfigManager {
  private config: ServerConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ServerConfig {
    // Default configuration
    const defaultConfig: ServerConfig = {
      host: process.env.QUDAG_HOST || "0.0.0.0",
      port: parseInt(process.env.QUDAG_PORT || "3000", 10),
      protocol: (process.env.QUDAG_PROTOCOL || "https") as "http" | "https",
      cors: {
        origins: (process.env.QUDAG_CORS_ORIGINS || "http://localhost:3000").split(","),
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowed_headers: ["Content-Type", "Authorization"]
      },
      security: {
        require_auth: process.env.QUDAG_REQUIRE_AUTH !== "false",
        rate_limit_requests_per_minute: parseInt(process.env.QUDAG_RATE_LIMIT || "600", 10),
        rate_limit_per_user: process.env.QUDAG_RATE_LIMIT_PER_USER !== "false",
        helmet_enabled: process.env.QUDAG_HELMET_ENABLED !== "false",
        csp_enabled: process.env.QUDAG_CSP_ENABLED !== "false"
      },
      logging: {
        level: (process.env.QUDAG_LOG_LEVEL || "info") as any,
        format: (process.env.QUDAG_LOG_FORMAT || "json") as "json" | "text",
        audit_enabled: process.env.QUDAG_AUDIT_ENABLED !== "false"
      }
    };

    // Load TLS settings
    if (defaultConfig.protocol === "https") {
      const cert_path = process.env.QUDAG_TLS_CERT_PATH;
      const key_path = process.env.QUDAG_TLS_KEY_PATH;

      if (cert_path && key_path) {
        defaultConfig.tls = {
          cert_path,
          key_path,
          ca_path: process.env.QUDAG_TLS_CA_PATH
        };
      }
    }

    // Load OAuth2 settings
    if (process.env.QUDAG_OAUTH2_ISSUER_URL) {
      defaultConfig.oauth2 = {
        issuer_url: process.env.QUDAG_OAUTH2_ISSUER_URL,
        audience: process.env.QUDAG_OAUTH2_AUDIENCE || "qudag-mcp-api",
        jwks_url: process.env.QUDAG_OAUTH2_JWKS_URL || `${process.env.QUDAG_OAUTH2_ISSUER_URL}/.well-known/jwks.json`,
        token_endpoint: process.env.QUDAG_OAUTH2_TOKEN_ENDPOINT,
        verify_signature: process.env.QUDAG_OAUTH2_VERIFY_SIGNATURE !== "false",
        verify_expiry: process.env.QUDAG_OAUTH2_VERIFY_EXPIRY !== "false"
      };
    }

    // Load Redis settings
    if (process.env.QUDAG_REDIS_URL) {
      defaultConfig.redis = {
        url: process.env.QUDAG_REDIS_URL,
        password: process.env.QUDAG_REDIS_PASSWORD,
        db: parseInt(process.env.QUDAG_REDIS_DB || "0", 10),
        ttl_seconds: parseInt(process.env.QUDAG_REDIS_TTL || "3600", 10)
      };
    }

    // Load NAPI settings
    defaultConfig.napi = {
      vault_path: process.env.QUDAG_VAULT_PATH || "./vault",
      config_path: process.env.QUDAG_CONFIG_PATH || "./config"
    };

    return defaultConfig;
  }

  public getConfig(): Readonly<ServerConfig> {
    return Object.freeze({ ...this.config });
  }

  public validate(): void {
    const config = this.config;

    if (config.port < 1 || config.port > 65535) {
      throw new Error("Invalid port number");
    }

    if (config.protocol === "https" && !config.tls) {
      throw new Error("TLS configuration required for HTTPS protocol");
    }

    if (config.tls) {
      if (!fs.existsSync(config.tls.cert_path)) {
        throw new Error(`TLS certificate not found: ${config.tls.cert_path}`);
      }
      if (!fs.existsSync(config.tls.key_path)) {
        throw new Error(`TLS key not found: ${config.tls.key_path}`);
      }
    }

    if (config.security.require_auth && !config.oauth2) {
      console.warn("Warning: Authentication required but OAuth2 not configured");
    }
  }
}

export const configManager = new ConfigManager();
