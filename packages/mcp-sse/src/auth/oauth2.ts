/**
 * OAuth2 Token Validation and Bearer Token Extraction
 *
 * Implements OAuth2/OIDC token validation with JWT signature verification,
 * expiry checks, and audience validation.
 */

import * as jwt from "jsonwebtoken";
import axios from "axios";
import { ServerConfig } from "../config";

export interface TokenPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  scope?: string;
  client_id?: string;
  user_id?: string;
  email?: string;
  roles?: string[];
}

export interface AuthContext {
  user_id: string;
  email?: string;
  roles: string[];
  scopes: string[];
  authenticated: boolean;
  token_exp: number;
}

export class OAuth2Manager {
  private jwksCache: Map<string, any> = new Map();
  private jwksCacheTTL: number = 3600000; // 1 hour
  private jwksCacheTime: number = 0;
  private config: ServerConfig["oauth2"];

  constructor(oauth2Config?: ServerConfig["oauth2"]) {
    this.config = oauth2Config;
  }

  /**
   * Extract Bearer token from Authorization header
   */
  public extractBearerToken(authHeader?: string): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * Validate OAuth2 token
   */
  public async validateToken(token: string): Promise<AuthContext> {
    if (!this.config) {
      throw new Error("OAuth2 not configured");
    }

    try {
      // Decode token without verification first to get header
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === "string") {
        throw new Error("Invalid token format");
      }

      // Get JWKS
      const publicKey = await this.getPublicKey(decoded.header.kid);

      // Verify token
      const verified = jwt.verify(token, publicKey, {
        algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
        issuer: this.config.issuer_url,
        audience: this.config.audience,
        ignoreExpiration: !this.config.verify_expiry
      }) as TokenPayload;

      // Create auth context
      const authContext: AuthContext = {
        user_id: verified.sub,
        email: verified.email,
        roles: verified.roles || [],
        scopes: (verified.scope || "").split(" ").filter(s => s),
        authenticated: true,
        token_exp: verified.exp
      };

      return authContext;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Token validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get public key from JWKS endpoint
   */
  private async getPublicKey(kid?: string): Promise<string> {
    if (!this.config) {
      throw new Error("OAuth2 not configured");
    }

    // Try to get from cache
    if (this.jwksCache.has(kid || "")) {
      return this.jwksCache.get(kid || "");
    }

    // Fetch JWKS if cache expired
    if (Date.now() - this.jwksCacheTime > this.jwksCacheTTL) {
      await this.refreshJWKS();
    }

    const key = this.jwksCache.get(kid || "");
    if (!key) {
      throw new Error(`Public key not found: ${kid}`);
    }

    return key;
  }

  /**
   * Refresh JWKS from issuer
   */
  private async refreshJWKS(): Promise<void> {
    if (!this.config) {
      throw new Error("OAuth2 not configured");
    }

    try {
      const response = await axios.get(this.config.jwks_url);
      const jwks = response.data;

      this.jwksCache.clear();

      for (const key of jwks.keys) {
        if (key.kty === "RSA" || key.kty === "EC" || key.kty === "OKP") {
          const publicKeyJWK = {
            kty: key.kty,
            n: key.n,
            e: key.e,
            x: key.x,
            y: key.y,
            crv: key.crv,
            k: key.k
          };

          const publicKey = this.jwkToPem(publicKeyJWK);
          this.jwksCache.set(key.kid || "default", publicKey);
        }
      }

      this.jwksCacheTime = Date.now();
    } catch (error) {
      throw new Error(`Failed to fetch JWKS: ${error}`);
    }
  }

  /**
   * Convert JWK to PEM format (simplified)
   */
  private jwkToPem(jwk: any): string {
    // In production, use jsonwebtoken's built-in JWK support
    // or use a library like jwk-to-pem
    // For now, return the JWK as-is for verification
    return jwk;
  }

  /**
   * Check if token is still valid
   */
  public isTokenValid(authContext: AuthContext): boolean {
    return authContext.authenticated && authContext.token_exp > Math.floor(Date.now() / 1000);
  }

  /**
   * Check if user has required scope
   */
  public hasScope(authContext: AuthContext, requiredScope: string): boolean {
    return authContext.scopes.includes(requiredScope);
  }

  /**
   * Check if user has any of required scopes
   */
  public hasSomeScope(authContext: AuthContext, requiredScopes: string[]): boolean {
    return requiredScopes.some(scope => authContext.scopes.includes(scope));
  }

  /**
   * Check if user has all required scopes
   */
  public hasAllScopes(authContext: AuthContext, requiredScopes: string[]): boolean {
    return requiredScopes.every(scope => authContext.scopes.includes(scope));
  }
}

export const createOAuth2Manager = (config?: ServerConfig["oauth2"]): OAuth2Manager => {
  return new OAuth2Manager(config);
};
