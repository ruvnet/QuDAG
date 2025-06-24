/**
 * @description Barrel export for authentication services
 * @author CleoClaudeDesktop
 * @created 2025-01-27
 * @lastModified 2025-01-27 by CleoClaudeDesktop - Initial exports
 */

// Export auth types
export type {
  AuthUser,
  AuthSession,
  AuthError,
  AuthProvider,
  AuthProviderType,
} from "../../types/auth";

// Export factory functions
export {
  createAuthProvider,
  getAuthProviderType,
  isAuthEnabled,
} from "./AuthProviderFactory";

// Export auth hook and provider component
export {
  AuthProvider as AuthContextProvider,
  useAuth,
} from "../../hooks/useAuth";
