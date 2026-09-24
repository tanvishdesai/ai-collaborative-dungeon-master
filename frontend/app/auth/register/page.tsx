"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";
import { GuestRoute } from "@/components/auth/guest-route";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useAuth, validateRegistration } from "@/hooks/use-auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateRegistration({ email, username, password });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsPending(true);
    try {
      await register({ email, username, password });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <GuestRoute>
      <AuthCard title="Create your account" subtitle="Track your practice sessions and progress over time.">
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
            id="username"
            label="Username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_]+"
            required
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <p className="-mt-2 text-xs text-muted-foreground">
            At least 8 characters, including one letter and one number.
          </p>
          {error ? (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create account
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="font-semibold text-primary hover:text-primary/80" href="/auth/login">
            Log in
          </Link>
        </p>
      </AuthCard>
    </GuestRoute>
  );
}
