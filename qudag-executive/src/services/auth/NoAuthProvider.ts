/**
 * @description No-auth provider for development and testing
 * @author CleoClaudeDesktop
 * @created 2025-01-27
 * @lastModified 2025-01-27 by CleoClaudeDesktop - Initial implementation
 */

import type { AuthProvider, AuthSession, AuthUser } from "../../types/auth";

export class NoAuthProvider implements AuthProvider {
  private currentUser: AuthUser | null = null;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();

  constructor() {
    // Auto-login with a mock user in development
    this.currentUser = {
      id: "dev-user-123",
      email: "dev@qudag.ai",
      name: "Development User",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=dev-user",
      metadata: {
        role: "admin",
        environment: "development",
      },
    };
  }

  async signIn(email: string, _password: string): Promise<AuthSession> {
    // Mock sign in - always succeeds in dev mode
    const user: AuthUser = {
      id: `user-${Date.now()}`,
      email,
      name: email.split("@")[0],
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      metadata: {
        role: "user",
        signedInAt: new Date().toISOString(),
      },
    };

    this.currentUser = user;
    const session = { user, accessToken: "mock-token" };
    this.notifyListeners(session);

    return session;
  }

  async signUp(email: string, password: string): Promise<AuthSession> {
    // Same as sign in for mock provider
    return this.signIn(email, password);
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    this.notifyListeners(null);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  async getSession(): Promise<AuthSession | null> {
    if (!this.currentUser) return null;
    return {
      user: this.currentUser,
      accessToken: "mock-token",
      expiresAt: Date.now() + 3600000, // 1 hour from now
    };
  }

  onAuthStateChange(
    callback: (session: AuthSession | null) => void
  ): () => void {
    this.listeners.add(callback);
    // Immediately call with current state
    callback(
      this.currentUser ?
        { user: this.currentUser, accessToken: "mock-token" }
      : null
    );

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(session: AuthSession | null): void {
    this.listeners.forEach((listener) => listener(session));
  }

  // Optional methods - not implemented for mock
  async signInWithProvider(
    provider: "google" | "github" | "twitter"
  ): Promise<AuthSession> {
    // Mock social login
    return this.signIn(`${provider}.user@example.com`, "social-login");
  }

  async resetPassword(email: string): Promise<void> {
    console.log(
      `[NoAuth] Password reset requested for ${email} - no action needed in dev mode`
    );
  }

  async updatePassword(_newPassword: string): Promise<void> {
    console.log(`[NoAuth] Password updated - no action needed in dev mode`);
  }
}
