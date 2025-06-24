/**
 * @description Supabase authentication provider implementation
 * @author CleoClaudeDesktop
 * @created 2025-01-27
 * @lastModified 2025-01-27 by CleoClaudeDesktop - Initial implementation
 */

import {
  createClient,
  SupabaseClient,
  Session,
  User,
} from "@supabase/supabase-js";
import type { AuthProvider, AuthSession, AuthUser } from "../../types/auth";

export class SupabaseAuthProvider implements AuthProvider {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase configuration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file"
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.mapSupabaseSession(data.session);
  }

  async signUp(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.mapSupabaseSession(data.session);
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  getCurrentUser(): AuthUser | null {
    const user = this.supabase.auth.getUser();
    if (!user) return null;

    // This is sync, but getUser() is async, so we need getSession instead
    const session = this.supabase.auth.getSession();
    return session ? this.mapSupabaseUser(session.user) : null;
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.supabase.auth.getSession();

    if (error || !data.session) {
      return null;
    }

    return this.mapSupabaseSession(data.session);
  }

  onAuthStateChange(
    callback: (session: AuthSession | null) => void
  ): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(session ? this.mapSupabaseSession(session) : null);
    });

    // Return unsubscribe function
    return () => {
      data.subscription.unsubscribe();
    };
  }

  async signInWithProvider(
    provider: "google" | "github" | "twitter"
  ): Promise<AuthSession> {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: provider as any, // Supabase has more providers, we're limiting to our interface
    });

    if (error) {
      throw new Error(error.message);
    }

    // OAuth flow redirects, so we don't get immediate session
    // The onAuthStateChange will fire when user returns
    return { user: null };
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email);
    if (error) {
      throw new Error(error.message);
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  private mapSupabaseSession(session: Session | null): AuthSession {
    if (!session) {
      return { user: null };
    }

    return {
      user: this.mapSupabaseUser(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? session.expires_at * 1000 : undefined,
    };
  }

  private mapSupabaseUser(user: User | null): AuthUser | null {
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split("@")[0],
      avatar: user.user_metadata?.avatar_url,
      metadata: {
        ...user.user_metadata,
        emailVerified: user.email_confirmed_at != null,
        phoneVerified: user.phone_confirmed_at != null,
      },
    };
  }
}
