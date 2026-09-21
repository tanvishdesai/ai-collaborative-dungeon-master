"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, DoorOpen, Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useAuth } from "@/hooks/use-auth";

const CODE_PATTERN = /^[A-Za-z0-9]{6}$/;

export default function JoinPage() {
  return (
    <ProtectedRoute>
      <JoinForm />
    </ProtectedRoute>
  );
}

function JoinForm() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const joinSession = useMutation(api.sessions.join);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem("session-error");
    if (stored) {
      setError(stored);
      window.sessionStorage.removeItem("session-error");
    }
  }, []);

  const normalized = useMemo(() => code.trim().toUpperCase(), [code]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!CODE_PATTERN.test(normalized)) {
      setError("Enter a valid 6-character code.");
      return;
    }
    setIsJoining(true);
    try {
      const payload = await joinSession({ code: normalized });
      router.push(`/rooms/${payload.session.code}`);
    } catch (err) {
      setError(authErrorMessage(err));
      setIsJoining(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Signed in as {user?.username}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Join a session</h1>
        </div>
        <Button variant="ghost" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </header>

      <section className="flex flex-1 items-center justify-center">
        <form
          className="grid w-full max-w-md gap-5 rounded-xl border border-border bg-card/80 p-6 shadow-glow"
          onSubmit={onSubmit}
        >
          <label className="grid gap-2 text-sm font-medium" htmlFor="code">
            Session code
            <input
              id="code"
              className="min-h-12 rounded-lg border border-border bg-background px-3 font-mono text-lg uppercase tracking-[0.3em] outline-none transition placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary"
              maxLength={6}
              minLength={6}
              pattern="[A-Za-z0-9]{6}"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </label>

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <Button type="submit" disabled={isJoining}>
            {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
            {isJoining ? "Joining..." : "Join session"}
          </Button>
        </form>
      </section>
    </main>
  );
}
