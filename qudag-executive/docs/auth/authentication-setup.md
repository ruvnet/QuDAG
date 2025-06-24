---
created: 2025-01-27T10:00:00Z
updated: 2025-01-27T10:00:00Z
updatedBy: CleoClaudeDesktop
version: 1.0.0
---

# Authentication Setup Guide

This guide explains how to configure and use the multi-provider authentication system in the QuDAG Executive Intelligence Center.

## Overview

The authentication system supports three modes:

1. **No Auth** (Development/Testing)
2. **Supabase Auth** (Production-ready)
3. **Firebase Auth** (Production-ready)

You can switch between providers using a single environment variable without changing any application code.

## Configuration

### 1. Environment Variables

All authentication configuration is done through environment variables in your `.env` file:

```env
# ===================================================
# AUTHENTICATION CONFIGURATION
# ===================================================
# Choose ONE of: none | supabase | firebase
VITE_AUTH_PROVIDER=none

# ---------------------------------------------------
# SUPABASE AUTH (only needed if VITE_AUTH_PROVIDER=supabase)
# ---------------------------------------------------
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# ---------------------------------------------------
# FIREBASE AUTH (only needed if VITE_AUTH_PROVIDER=firebase)
# ---------------------------------------------------
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 2. Provider-Specific Setup

#### No Auth (Development)

- Set `VITE_AUTH_PROVIDER=none`
- No additional configuration needed
- Auto-logs in with a mock user
- Perfect for local development and testing

#### Supabase Auth

1. Create a Supabase project at https://supabase.com
2. Get your project URL and anon key from the project settings
3. Set the environment variables:
   ```env
   VITE_AUTH_PROVIDER=supabase
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Install the Supabase client: `npm install @supabase/supabase-js`

#### Firebase Auth

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication and configure sign-in methods
3. Get your config from Project Settings > General > Your apps > Web app
4. Set the environment variables:
   ```env
   VITE_AUTH_PROVIDER=firebase
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```
5. Install Firebase: `npm install firebase`

## Usage in Components

### 1. Wrap Your App

```tsx
import { AuthContextProvider } from "./services/auth";

function App() {
  return <AuthContextProvider>{/* Your app components */}</AuthContextProvider>;
}
```

### 2. Use the Auth Hook

```tsx
import { useAuth } from "./services/auth";

function MyComponent() {
  const { user, loading, error, signIn, signOut, isAuthEnabled } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user && isAuthEnabled) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          signIn(formData.get("email"), formData.get("password"));
        }}
      >
        <input name="email" type="email" required />
        <input name="password" type="password" required />
        <button type="submit">Sign In</button>
      </form>
    );
  }

  return (
    <div>
      <p>Welcome, {user?.name || user?.email}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### 3. Protected Routes

```tsx
function ProtectedRoute({ children }) {
  const { user, loading, isAuthEnabled } = useAuth();

  if (loading) return <LoadingScreen />;

  // If auth is disabled, allow access
  if (!isAuthEnabled) return children;

  // If auth is enabled but no user, redirect to login
  if (!user) return <Navigate to="/login" />;

  return children;
}
```

## API Reference

### useAuth Hook

```typescript
interface AuthContextValue {
  // State
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  // Methods
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithProvider: (
    provider: "google" | "github" | "twitter"
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;

  // Info
  providerType: string;
  isAuthEnabled: boolean;
}
```

### AuthUser Type

```typescript
interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}
```

## Switching Providers

To switch authentication providers:

1. Update `VITE_AUTH_PROVIDER` in your `.env` file
2. Add the required environment variables for the new provider
3. Install the provider's SDK if needed
4. Restart your development server

That's it! Your app will use the new provider without any code changes.

## Security Notes

1. **Never commit `.env` files** with real credentials to version control
2. **Use environment variables** in your deployment platform
3. **Enable appropriate security rules** in Supabase/Firebase
4. **Validate user permissions** on the backend, not just frontend

## Troubleshooting

### "Missing configuration" errors

- Ensure all required environment variables are set for your chosen provider
- Check for typos in variable names (they must start with `VITE_`)

### Authentication not working

- Check browser console for errors
- Verify your Supabase/Firebase project is properly configured
- Ensure you've enabled the authentication methods you're trying to use

### Social login redirects

- Configure redirect URLs in your provider's dashboard
- Add your local development URL (e.g., `http://localhost:5173`)

## Best Practices

1. **Start with No Auth** during development
2. **Test with real providers** before deploying
3. **Handle errors gracefully** - show user-friendly messages
4. **Log authentication events** for debugging
5. **Implement proper loading states** during auth operations

---

> **Update 2025-01-27 10:00 by CleoClaudeDesktop**: Initial authentication documentation created
