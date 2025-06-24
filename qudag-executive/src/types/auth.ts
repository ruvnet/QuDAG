/**
 * @description Authentication types and interfaces for multi-provider auth system
 * @author CleoClaudeDesktop
 * @created 2025-01-27
 * @lastModified 2025-01-27 by CleoClaudeDesktop - Initial auth abstraction
 */

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthSession {
  user: AuthUser | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface AuthError {
  code: string;
  message: string;
}

/**
 * Common interface that all auth providers must implement
 * This ensures we can swap providers without changing component code
 */
export interface AuthProvider {
  // Core auth methods
  signIn(email: string, password: string): Promise<AuthSession>;
  signUp(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;

  // Session management
  getCurrentUser(): AuthUser | null;
  getSession(): Promise<AuthSession | null>;

  // Real-time auth state
  onAuthStateChange(
    callback: (session: AuthSession | null) => void
  ): () => void;

  // Optional: Social login support
  signInWithProvider?(
    provider: "google" | "github" | "twitter"
  ): Promise<AuthSession>;

  // Optional: Password reset
  resetPassword?(email: string): Promise<void>;
  updatePassword?(newPassword: string): Promise<void>;
}

export type AuthProviderType = "none" | "supabase" | "firebase";
