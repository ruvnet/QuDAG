/**
 * @description Factory for creating the appropriate auth provider based on configuration
 * @author CleoClaudeDesktop
 * @created 2025-01-27
 * @lastModified 2025-01-27 by CleoClaudeDesktop - Initial implementation
 */

import type { AuthProvider, AuthProviderType } from "../../types/auth";
import { NoAuthProvider } from "./NoAuthProvider";
import { SupabaseAuthProvider } from "./SupabaseAuthProvider";
import { FirebaseAuthProvider } from "./FirebaseAuthProvider";

/**
 * Creates an auth provider instance based on the environment configuration
 * @returns {AuthProvider} The configured auth provider instance
 * @throws {Error} If the auth provider type is invalid
 */
export function createAuthProvider(): AuthProvider {
  const providerType = (import.meta.env.VITE_AUTH_PROVIDER ||
    "none") as AuthProviderType;

  console.log(`[Auth] Initializing auth provider: ${providerType}`);

  switch (providerType) {
    case "none":
      return new NoAuthProvider();

    case "supabase":
      return new SupabaseAuthProvider();

    case "firebase":
      return new FirebaseAuthProvider();

    default:
      throw new Error(
        `Invalid auth provider: ${providerType}. ` +
          `Please set VITE_AUTH_PROVIDER to one of: none, supabase, firebase`
      );
  }
}

/**
 * Get the current auth provider type from environment
 */
export function getAuthProviderType(): AuthProviderType {
  return (import.meta.env.VITE_AUTH_PROVIDER || "none") as AuthProviderType;
}

/**
 * Check if authentication is enabled (not using 'none' provider)
 */
export function isAuthEnabled(): boolean {
  return getAuthProviderType() !== "none";
}
