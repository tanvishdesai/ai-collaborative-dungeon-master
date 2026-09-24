"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AuthUser, LoginPayload, RegisterPayload } from "@/types/auth";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Convex Auth's Password provider throws plain Errors (not ConvexError) for
// these cases, so only their raw, internal message text reaches the client.
const KNOWN_AUTH_ERRORS: [RegExp, string][] = [
  [/InvalidAccountId|InvalidSecret|Invalid credentials|Invalid password/i, "Incorrect email or password."],
  [/already exists/i, "An account with this email already exists. Try logging in instead."],
  [/username is already taken/i, "That username is already taken. Please choose another."],
  [/TooManyFailedAttempts/i, "Too many attempts. Please wait a moment and try again."],
  [/password/i, "Password must be at least 8 characters and include a letter and a number."],
  [/email/i, "Please enter a valid email address."],
  [/username/i, "Username must be 3-32 characters using only letters, numbers, or underscores."],
  [/network|failed to fetch/i, "Network error — check your connection and try again."],
];

export function authErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // ConvexError carries the thrown message in `.data` — the most reliable
    // source when it survives the auth round-trip.
    const data = (error as { data?: unknown }).data;
    if (typeof data === "string" && data.trim()) return data;

    // Convex often prefixes the client message with request-id/server noise;
    // an "Uncaught ConvexError: <msg>" fragment is the real message.
    const convexMatch = error.message.match(/Uncaught ConvexError:\s*(.+?)(?:\s+at |\n|$)/);
    if (convexMatch) return convexMatch[1].trim();

    const match = KNOWN_AUTH_ERRORS.find(([pattern]) => pattern.test(error.message));
    if (match) return match[1];
  }
  return "Something went wrong. Please try again.";
}

// Client-side registration validation mirroring the server rules in
// convex/auth.ts, so users get an instant, specific message instead of a
// vague server error after a round-trip. Returns null when valid.
export function validateRegistration({
  email,
  username,
  password,
}: RegisterPayload): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return "Please enter a valid email address.";
  }
  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
    return "Username must be between 3 and 32 characters.";
  }
  if (!/^[A-Za-z0-9_]+$/.test(trimmedUsername)) {
    return "Username can only contain letters, numbers, and underscores (no spaces or symbols).";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const me = useQuery(api.users.me);

  const status: AuthStatus = isLoading
    ? "loading"
    : isAuthenticated
      ? "authenticated"
      : "unauthenticated";

  const user = useMemo<AuthUser | null>(() => {
    if (!me) return null;
    return {
      id: me.id,
      email: me.email,
      username: me.username,
      is_active: me.isActive,
      is_admin: me.isAdmin,
    };
  }, [me]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      await signIn("password", {
        email: payload.email,
        password: payload.password,
        flow: "signIn",
      });
      router.push("/");
    },
    [router, signIn],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await signIn("password", {
        email: payload.email,
        username: payload.username,
        password: payload.password,
        flow: "signUp",
      });
      router.push("/");
    },
    [router, signIn],
  );

  const logout = useCallback(async () => {
    await signOut();
    router.push("/auth/login");
  }, [router, signOut]);

  const value = useMemo(
    () => ({ user, status, login, register, logout }),
    [login, logout, register, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}
