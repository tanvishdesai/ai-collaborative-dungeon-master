"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";
import { GuestRoute } from "@/components/auth/guest-route";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await login({ email, password });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <GuestRoute>
      <AuthCard title="Welcome back" subtitle="Log in to run interview and group-discussion practice sessions.">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Log in
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link className="font-semibold text-primary hover:text-primary/80" href="/auth/register">
            Create an account
          </Link>
        </p>
      </AuthCard>
    </GuestRoute>
  );
}
