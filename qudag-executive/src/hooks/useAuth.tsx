/**
 * @description Authentication context provider for multi-provider auth
 * @author CleoClaudeDesktop
 * @created 2025-01-27
 * @lastModified 2025-01-27 by CleoClaudeDesktop - Initial implementation
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import type { AuthSession, AuthUser, AuthProvider } from "../types/auth";
import {
  createAuthProvider,
  getAuthProviderType,
} from "../services/auth/AuthProviderFactory";

interface AuthContextValue {
  // Auth state
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithProvider: (
    provider: "google" | "github" | "twitter"
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;

  // Provider info
  providerType: string;
  isAuthEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create auth provider instance (only once)
  const authProvider = useMemo(() => createAuthProvider(), []);
  const providerType = getAuthProviderType();
  const isAuthEnabled = providerType !== "none";

  // Initialize auth state
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      try {
        // Get initial session
        const currentSession = await authProvider.getSession();
        setSession(currentSession);

        // Listen for auth state changes
        unsubscribe = authProvider.onAuthStateChange((newSession) => {
          setSession(newSession);
        });
      } catch (err) {
        console.error("[Auth] Failed to initialize:", err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [authProvider]);

  // Auth methods
  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const newSession = await authProvider.signIn(email, password);
      setSession(newSession);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    }
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    try {
      const newSession = await authProvider.signUp(email, password);
      setSession(newSession);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await authProvider.signOut();
      setSession(null);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    }
  };

  const signInWithProvider = async (
    provider: "google" | "github" | "twitter"
  ) => {
    setError(null);
    try {
      if (!authProvider.signInWithProvider) {
        throw new Error("Social login not supported by current auth provider");
      }
      const newSession = await authProvider.signInWithProvider(provider);
      setSession(newSession);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      if (!authProvider.resetPassword) {
        throw new Error(
          "Password reset not supported by current auth provider"
        );
      }
      await authProvider.resetPassword(email);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    }
  };

  const updatePassword = async (newPassword: string) => {
    setError(null);
    try {
      if (!authProvider.updatePassword) {
        throw new Error(
          "Password update not supported by current auth provider"
        );
      }
      await authProvider.updatePassword(newPassword);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user || null,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      signInWithProvider,
      resetPassword,
      updatePassword,
      providerType,
      isAuthEnabled,
    }),
    [session, loading, error, providerType, isAuthEnabled]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication context
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
