/**
 * @description Firebase authentication provider implementation
 * @author CleoClaudeDesktop
 * @created 2025-01-27
 * @lastModified 2025-01-27 by CleoClaudeDesktop - Initial implementation
 */

import { initializeApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  GithubAuthProvider,
  TwitterAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";
import type { Auth, User } from "firebase/auth";
import type { AuthProvider, AuthSession, AuthUser } from "../../types/auth";

export class FirebaseAuthProvider implements AuthProvider {
  private app: FirebaseApp;
  private auth: Auth;

  constructor() {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    // Validate config
    if (!firebaseConfig.apiKey || !firebaseConfig.authDomain) {
      throw new Error(
        "Missing Firebase configuration. Please set VITE_FIREBASE_API_KEY and VITE_FIREBASE_AUTH_DOMAIN in your .env file"
      );
    }

    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    try {
      const credential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return this.mapFirebaseUser(credential.user);
    } catch (error) {
      throw new Error((error as Error).message || "Failed to sign in");
    }
  }

  async signUp(email: string, password: string): Promise<AuthSession> {
    try {
      const credential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return this.mapFirebaseUser(credential.user);
    } catch (error) {
      throw new Error((error as Error).message || "Failed to sign up");
    }
  }

  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(this.auth);
    } catch (error: any) {
      throw new Error(error.message || "Failed to sign out");
    }
  }

  getCurrentUser(): AuthUser | null {
    const user = this.auth.currentUser;
    return user ? this.mapFirebaseUserToAuthUser(user) : null;
  }

  async getSession(): Promise<AuthSession | null> {
    const user = this.auth.currentUser;
    if (!user) return null;

    const token = await user.getIdToken();
    return {
      user: this.mapFirebaseUserToAuthUser(user),
      accessToken: token,
      expiresAt: Date.now() + 3600000, // Firebase tokens expire in 1 hour
    };
  }

  onAuthStateChange(
    callback: (session: AuthSession | null) => void
  ): () => void {
    const unsubscribe = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        const session = await this.mapFirebaseUser(user);
        callback(session);
      } else {
        callback(null);
      }
    });

    return unsubscribe;
  }

  async signInWithProvider(
    provider: "google" | "github" | "twitter"
  ): Promise<AuthSession> {
    let authProvider;

    switch (provider) {
      case "google":
        authProvider = new GoogleAuthProvider();
        break;
      case "github":
        authProvider = new GithubAuthProvider();
        break;
      case "twitter":
        authProvider = new TwitterAuthProvider();
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    try {
      const credential = await signInWithPopup(this.auth, authProvider);
      return this.mapFirebaseUser(credential.user);
    } catch (error: any) {
      throw new Error(error.message || "Failed to sign in with provider");
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      throw new Error(error.message || "Failed to send password reset email");
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error("No user is currently signed in");
    }

    try {
      await firebaseUpdatePassword(user, newPassword);
    } catch (error: any) {
      throw new Error(error.message || "Failed to update password");
    }
  }

  private async mapFirebaseUser(user: User): Promise<AuthSession> {
    const token = await user.getIdToken();

    return {
      user: this.mapFirebaseUserToAuthUser(user),
      accessToken: token,
      expiresAt: Date.now() + 3600000, // 1 hour
    };
  }

  private mapFirebaseUserToAuthUser(user: User): AuthUser {
    return {
      id: user.uid,
      email: user.email || undefined,
      name: user.displayName || user.email?.split("@")[0] || "User",
      avatar: user.photoURL || undefined,
      metadata: {
        emailVerified: user.emailVerified,
        phoneNumber: user.phoneNumber,
        providerId: user.providerId,
        createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime,
      },
    };
  }
}
