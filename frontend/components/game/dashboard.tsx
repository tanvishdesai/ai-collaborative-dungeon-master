"use client";

import Link from "next/link";
import {
  AlertCircle,
  Briefcase,
  Gauge,
  Loader2,
  LogIn,
  LogOut,
  MessagesSquare,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useAuth } from "@/hooks/use-auth";
import { TARGET_ROLES, DIFFICULTIES } from "@/convex/lib/rolePresets";

type Mode = "panel_interview" | "group_discussion";

export function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const createSession = useMutation(api.sessions.create);

  const [mode, setMode] = useState<Mode>("panel_interview");
  const [targetRole, setTargetRole] = useState<string>(TARGET_ROLES[0]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState(6);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    if (mode === "group_discussion" && !topic.trim()) {
      setError("Please enter a discussion topic.");
      return;
    }
    setIsCreating(true);
    try {
      const payload = await createSession({
        mode,
        targetRole: mode === "panel_interview" ? targetRole : "General",
        topic: topic.trim(),
        difficulty: mode === "panel_interview" ? difficulty : "medium",
        questionCount,
      });
      const code = payload.session.code;
      window.sessionStorage.setItem("session-create-success", code);
      router.push(`/rooms/${code}`);
    } catch (err) {
      setError(authErrorMessage(err));
      setIsCreating(false);
    }
  }

  const isInterview = mode === "panel_interview";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-4 w-4" />
            Abhyaas · Placement Practice
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Practice that feels like the real thing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Rehearse a panel interview or a group discussion with an AI panel that remembers and
            probes your answers — then get a scored feedback report. Signed in as{" "}
            <span className="font-medium text-foreground">{user?.username}</span>.
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-muted px-4 text-sm font-semibold text-foreground transition hover:bg-muted/70"
            href="/rooms/join"
          >
            <LogIn className="h-4 w-4" />
            Join with code
          </Link>
          <Button variant="ghost" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          active={isInterview}
          onClick={() => setMode("panel_interview")}
          Icon={Briefcase}
          title="Panel Interview"
          desc="Face a panel of AI interviewers (HR, Tech Lead, Senior Manager). They follow up on your answers and ramp up difficulty."
        />
        <ModeCard
          active={!isInterview}
          onClick={() => setMode("group_discussion")}
          Icon={MessagesSquare}
          title="Group Discussion"
          desc="Invite peers, get a topic, and practise a moderated GD. Everyone receives an individual scored report."
        />
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-6 shadow-glow">
        <h2 className="text-lg font-semibold text-foreground">
          Set up your {isInterview ? "interview" : "discussion"}
        </h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {isInterview ? (
            <Field label="Target role" Icon={Target}>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                {TARGET_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Discussion topic" Icon={MessagesSquare}>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Is remote work here to stay?"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </Field>
          )}

          {isInterview && (
            <Field label="Difficulty" Icon={Gauge}>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition ${
                      difficulty === d
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {isInterview && (
            <Field label="Interview focus (optional)" Icon={Target}>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. React & system design"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </Field>
          )}

          <Field label={isInterview ? "Number of questions" : "Number of rounds"} Icon={Sparkles}>
            <input
              type="number"
              min={3}
              max={12}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>
        </div>

        {error && (
          <div className="mt-5 flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {isInterview
              ? "You'll be the candidate. Others who join can observe live."
              : "Invite at least one more person — a GD needs multiple participants."}
          </p>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isCreating ? "Creating..." : "Create session"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function ModeCard({
  active,
  onClick,
  Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition ${
        active
          ? "border-primary bg-primary/10 shadow-glow"
          : "border-border bg-card/60 hover:border-border/80 hover:bg-card"
      }`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-lg ${
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function Field({
  label,
  Icon,
  children,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      {children}
    </label>
  );
}
