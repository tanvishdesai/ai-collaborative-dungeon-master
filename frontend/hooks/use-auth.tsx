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

export function authErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const data = (error as { data?: string }).data;
    if (typeof data === "string") return data;
    return error.message;
  }
  return "Something went wrong.";
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
