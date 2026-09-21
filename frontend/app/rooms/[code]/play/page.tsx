"use client";

import {
  AlertCircle,
  Award,
  Briefcase,
  Code2,
  Flame,
  Gauge,
  Loader2,
  LogOut,
  Megaphone,
  MessagesSquare,
  Send,
  Sparkles,
  StopCircle,
  UserCog,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useAuth } from "@/hooks/use-auth";

const AVATAR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  hr: UserCog,
  tech: Code2,
  stress: Flame,
  mod: Megaphone,
};
const AVATAR_COLORS: Record<string, string> = {
  hr: "from-sky-500 to-blue-600",
  tech: "from-emerald-500 to-teal-600",
  stress: "from-rose-500 to-red-600",
  mod: "from-violet-500 to-indigo-600",
};

const DIFFICULTY_LABEL = ["", "Warm-up", "Standard", "Probing"];

export default function PlayPage() {
  return (
    <ProtectedRoute>
      <Room />
    </ProtectedRoute>
  );
}

function Room() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { logout, user } = useAuth();
  const code = params.code?.toUpperCase() ?? "";

  const data = useQuery(api.sessions.getByCode, code ? { code } : "skip");
  const sessionId = data?.session._id;

  const state = useQuery(api.sessionEngine.get, sessionId ? { sessionId } : "skip");
  const transcript = useQuery(api.transcript.list, sessionId ? { sessionId } : "skip");
  const personas = useQuery(api.personas.list, sessionId ? { sessionId } : "skip");
  const reports = useQuery(api.reports.list, sessionId ? { sessionId } : "skip");
  const myProfile = useQuery(api.profiles.getMine, sessionId ? { sessionId } : "skip");

  const submitAnswer = useMutation(api.sessionEngine.submitAnswer);
  const endSession = useMutation(api.sessionEngine.endSession);

  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const isLoading = data === undefined || (sessionId && state === undefined);

  useEffect(() => {
    if (data && data.session.status === "waiting") {
      router.replace(`/rooms/${data.session.code}`);
    }
  }, [data, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript?.length, state?.phase]);

  const personaByName = useMemo(() => {
    const m = new Map<string, Doc<"personas">>();
    personas?.forEach((p) => m.set(p.name, p));
    return m;
  }, [personas]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading session...
      </main>
    );
  }

  if (!data || !state) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <p>Could not load this session.</p>
          </div>
        </div>
      </main>
    );
  }

  const mode = data.session.mode;
  const isInterview = mode === "panel_interview";
  const seat = data.currentUserSeat;
  const isHost = data.currentUserRole === "HOST";
  const showReport = state.phase === "complete" || data.session.status === "completed";
  const finishing =
    state.phase === "generating" && state.questionIndex >= state.totalQuestions;

  const canAnswer =
    !showReport &&
    state.phase === "awaiting_answer" &&
    ((isInterview && seat === "candidate") || (!isInterview && seat === "discussant"));

  async function send() {
    const text = answer.trim();
    if (!text || !sessionId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitAnswer({ sessionId, answerText: text });
      setAnswer("");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  }

  const progressPct = Math.round(
    (Math.min(state.questionIndex, state.totalQuestions) / state.totalQuestions) * 100,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {isInterview ? <Briefcase className="h-3.5 w-3.5" /> : <MessagesSquare className="h-3.5 w-3.5" />}
            {isInterview ? "Panel Interview" : "Group Discussion"} · {code}
          </div>
          <h1 className="mt-1 text-xl font-semibold text-foreground md:text-2xl">
            {isInterview ? data.session.targetRole : data.session.topic || "Group Discussion"}
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start">
          {isHost && !showReport && (
            <Button
              variant="danger"
              onClick={() => sessionId && endSession({ sessionId }).catch(() => {})}
            >
              <StopCircle className="h-4 w-4" />
              End &amp; get report
            </Button>
          )}
          <Button variant="ghost" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {showReport ? (
        <ReportView
          reports={reports}
          myUserId={user?.id}
          isInterview={isInterview}
          onExit={() => router.push("/")}
        />
      ) : (
        <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_320px]">
          <section className="flex min-h-[60vh] flex-col rounded-xl border border-border bg-card/70 shadow-glow">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="h-4 w-4 text-accent" />
                {isInterview ? "Interview" : "Discussion"} transcript
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {isInterview ? "Question" : "Round"}{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(state.questionIndex + 1, state.totalQuestions)}
                  </span>{" "}
                  / {state.totalQuestions}
                </span>
                <span className="flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" />
                  {DIFFICULTY_LABEL[state.difficultyLevel] ?? "Standard"}
                </span>
              </div>
            </div>

            <div className="h-1.5 w-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="scroll-slim flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {transcript?.map((t) => (
                <TranscriptBubble
                  key={t._id}
                  entry={t}
                  isMine={t.kind === "answer" && t.speakerName === myProfile?.displayName}
                  persona={personaByName.get(t.speakerName)}
                />
              ))}
              {(state.phase === "generating" || finishing) && (
                <ThinkingBubble finishing={finishing} />
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t border-border p-4">
              {error && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              {canAnswer ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={3}
                    autoFocus
                    placeholder={
                      isInterview
                        ? "Type your answer as you would speak it in a real interview..."
                        : "Add your point to the discussion..."
                    }
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                    disabled={submitting}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ctrl/⌘ + Enter to send</span>
                    <Button onClick={send} disabled={submitting || !answer.trim()}>
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send answer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-background/50 px-4 py-3 text-center text-sm text-muted-foreground">
                  {state.phase === "generating"
                    ? "The panel is preparing the next question..."
                    : isInterview && seat !== "candidate"
                      ? "You are observing this interview."
                      : "Waiting for the next prompt..."}
                </div>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card/70 p-4 shadow-glow">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" />
                {isInterview ? "Your panel" : "Moderator"}
              </h2>
              <div className="space-y-2">
                {personas?.map((p) => {
                  const Icon = AVATAR_ICONS[p.avatar] ?? UserCog;
                  const active = state.currentPersonaId === p._id;
                  return (
                    <div
                      key={p._id}
                      className={`flex items-center gap-3 rounded-lg border p-2.5 transition ${
                        active ? "border-primary bg-primary/10" : "border-border bg-background/40"
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white ${
                          AVATAR_COLORS[p.avatar] ?? "from-slate-500 to-slate-700"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.personaRole}</p>
                      </div>
                      {active && (
                        <span className="ml-auto text-[10px] font-semibold uppercase text-primary">
                          Speaking
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card/70 p-4 shadow-glow">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-accent" />
                Participants
              </h2>
              <ul className="space-y-1.5 text-sm">
                {data.players.map((pl) => (
                  <li key={pl._id} className="flex items-center justify-between">
                    <span className="text-foreground/90">
                      {pl.profile?.displayName ?? pl.user?.username}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {pl.seat === "candidate"
                        ? "Candidate"
                        : pl.seat === "discussant"
                          ? "Participant"
                          : "Observer"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function TranscriptBubble({
  entry,
  isMine,
  persona,
}: {
  entry: Doc<"transcript">;
  isMine: boolean;
  persona?: Doc<"personas">;
}) {
  if (entry.kind === "system") {
    return (
      <div className="flex justify-center">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {entry.text}
        </span>
      </div>
    );
  }

  const isAnswer = entry.kind === "answer";
  const Icon = persona ? AVATAR_ICONS[persona.avatar] ?? UserCog : UserCog;
  const color = persona ? AVATAR_COLORS[persona.avatar] ?? "from-slate-500 to-slate-700" : "";

  if (isAnswer) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isMine
              ? "rounded-br-sm bg-primary/15 text-foreground"
              : "rounded-bl-sm bg-muted text-foreground"
          }`}
        >
          <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{entry.speakerName}</p>
          <p className="whitespace-pre-wrap">{entry.text}</p>
        </div>
      </div>
    );
  }

  // question / moderator
  return (
    <div className="flex justify-start gap-3">
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white ${
          color || "from-violet-500 to-indigo-600"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-background/60 px-4 py-2.5">
        <p className="mb-1 text-xs font-semibold text-primary">
          {entry.speakerName}
          {entry.speakerRole ? <span className="text-muted-foreground"> · {entry.speakerRole}</span> : null}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entry.text}</p>
      </div>
    </div>
  );
}

function ThinkingBubble({ finishing }: { finishing: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {finishing ? "Evaluating your performance and preparing your report..." : "The panel is thinking..."}
    </div>
  );
}

function ReportView({
  reports,
  myUserId,
  isInterview,
  onExit,
}: {
  reports: Doc<"feedbackReports">[] | undefined;
  myUserId?: string;
  isInterview: boolean;
  onExit: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (reports === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card/60 p-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading your report...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/60 p-10 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p>Generating your feedback report... this takes a few seconds.</p>
      </div>
    );
  }

  const mine = reports.find((r) => r.userId === myUserId);
  const active =
    reports.find((r) => r._id === selected) ?? mine ?? reports[0];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {reports.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {reports.map((r) => (
            <button
              key={r._id}
              onClick={() => setSelected(r._id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                active._id === r._id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.participantName}
              {r.userId === myUserId ? " (you)" : ""}
            </button>
          ))}
        </div>
      )}

      <ReportCard report={active} isInterview={isInterview} />

      <div className="flex justify-center gap-3">
        <Button onClick={onExit}>Back to dashboard</Button>
      </div>
    </div>
  );
}

function ReportCard({
  report,
  isInterview,
}: {
  report: Doc<"feedbackReports">;
  isInterview: boolean;
}) {
  const scoreColor =
    report.overallScore >= 75
      ? "text-accent"
      : report.overallScore >= 50
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="rounded-xl border border-border bg-card/80 p-6 shadow-glow">
      <div className="flex flex-col gap-6 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <Award className="h-4 w-4" />
            Feedback report
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">{report.participantName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isInterview ? "Panel interview" : "Group discussion"} performance
          </p>
        </div>
        <div className="text-center">
          <p className={`text-5xl font-bold ${scoreColor}`}>{report.overallScore}</p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Overall / 100</p>
        </div>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-foreground/90">{report.summary}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Competency scores</h3>
          <div className="space-y-3">
            {report.competencies.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-foreground/90">{c.name}</span>
                  <span className="font-semibold text-foreground">{c.score}/5</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(c.score / 5) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.justification}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-accent">Strengths</h3>
            {report.strengths.length ? (
              <ul className="space-y-1.5 text-sm text-foreground/90">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-amber-400">What to improve</h3>
            {report.improvements.length ? (
              <ul className="space-y-1.5 text-sm text-foreground/90">
                {report.improvements.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-400">→</span>
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Objective metrics (computed by the engine)
        </p>
        <div className="flex flex-wrap gap-2">
          <Metric label="Answers given" value={String(report.metrics.questionsAnswered)} />
          <Metric
            label="Competencies covered"
            value={`${report.metrics.competenciesCovered}/${report.metrics.totalCompetencies}`}
          />
          <Metric label="Avg. answer length" value={`${report.metrics.avgAnswerWords} words`} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <p className="text-sm font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
