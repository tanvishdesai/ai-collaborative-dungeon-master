"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  FileText,
  Loader2,
  MessagesSquare,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/hooks/use-auth";

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminGuard />
    </ProtectedRoute>
  );
}

function AdminGuard() {
  const { user } = useAuth();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading…
      </main>
    );
  }

  if (!user.is_admin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <ShieldAlert className="h-10 w-10 text-red-400" />
        <h1 className="text-xl font-semibold text-foreground">Admin access required</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your account ({user.email}) is not an administrator. If you believe this is a
          mistake, add your email to the <code>ADMIN_EMAILS</code> Convex environment variable.
        </p>
        <Link href="/" className="text-sm font-semibold text-primary hover:text-primary/80">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const data = useQuery(api.admin.overview);
  const [selectedSession, setSelectedSession] = useState<Id<"sessions"> | null>(null);

  if (data === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading admin data…
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-border pb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Admin panel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Site-wide overview of all users, sessions, responses, and feedback reports.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard Icon={Users} label="Users" value={data.totals.users} />
        <StatCard Icon={MessagesSquare} label="Sessions" value={data.totals.sessions} />
        <StatCard Icon={FileText} label="Responses" value={data.totals.responses} />
        <StatCard Icon={BarChart3} label="Reports" value={data.totals.reports} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Users ({data.users.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Username</Th>
                <Th>Email</Th>
                <Th>Joined</Th>
                <Th className="text-center">Active</Th>
                <Th className="text-right">Hosted</Th>
                <Th className="text-right">Responses</Th>
                <Th className="text-right">Reports</Th>
                <Th className="text-right">Avg score</Th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 last:border-0">
                  <Td className="font-medium text-foreground">{u.username}</Td>
                  <Td className="text-muted-foreground">{u.email}</Td>
                  <Td className="text-muted-foreground">{fmtDate(u.createdAt)}</Td>
                  <Td className="text-center">
                    {u.isActive ? (
                      <span className="text-emerald-400">●</span>
                    ) : (
                      <span className="text-red-400">●</span>
                    )}
                  </Td>
                  <Td className="text-right">{u.sessionsHosted}</Td>
                  <Td className="text-right">{u.responses}</Td>
                  <Td className="text-right">{u.reports}</Td>
                  <Td className="text-right">{u.avgScore ?? "—"}</Td>
                </tr>
              ))}
              {data.users.length === 0 && (
                <tr>
                  <Td className="text-muted-foreground" colSpan={8}>
                    No users yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Sessions ({data.sessions.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Code</Th>
                <Th>Mode</Th>
                <Th>Host</Th>
                <Th>Role / Topic</Th>
                <Th className="text-center">Status</Th>
                <Th className="text-right">People</Th>
                <Th className="text-right">Reports</Th>
                <Th>Created</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id} className="border-b border-border/50 last:border-0">
                  <Td className="font-mono font-medium text-foreground">{s.code}</Td>
                  <Td className="text-muted-foreground">
                    {s.mode === "panel_interview" ? "Interview" : "Group disc."}
                  </Td>
                  <Td className="text-muted-foreground">{s.host}</Td>
                  <Td className="max-w-[220px] truncate text-muted-foreground">
                    {s.mode === "panel_interview" ? s.targetRole : s.topic || "—"}
                  </Td>
                  <Td className="text-center">
                    <StatusBadge status={s.status} />
                  </Td>
                  <Td className="text-right">{s.participants}</Td>
                  <Td className="text-right">{s.reports}</Td>
                  <Td className="text-muted-foreground">{fmtDate(s.createdAt)}</Td>
                  <Td className="text-right">
                    <button
                      onClick={() => setSelectedSession(s.id)}
                      className="font-semibold text-primary hover:text-primary/80"
                    >
                      View
                    </button>
                  </Td>
                </tr>
              ))}
              {data.sessions.length === 0 && (
                <tr>
                  <Td className="text-muted-foreground" colSpan={9}>
                    No sessions yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSession && (
        <SessionDetail
          sessionId={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </main>
  );
}

function SessionDetail({
  sessionId,
  onClose,
}: {
  sessionId: Id<"sessions">;
  onClose: () => void;
}) {
  const detail = useQuery(api.admin.sessionDetail, { sessionId });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-border bg-card p-6 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Session detail</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {detail === undefined ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading…
          </div>
        ) : detail === null ? (
          <p className="py-8 text-muted-foreground">Session not found.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid gap-1 text-sm">
              <p>
                <span className="font-mono font-semibold text-foreground">
                  {detail.session.code}
                </span>{" "}
                · {detail.session.mode === "panel_interview" ? "Interview" : "Group discussion"} ·{" "}
                {detail.session.status} · hosted by {detail.session.host}
              </p>
              <p className="text-muted-foreground">
                {detail.session.mode === "panel_interview"
                  ? `Role: ${detail.session.targetRole} · Difficulty: ${detail.session.difficulty}`
                  : `Topic: ${detail.session.topic || "—"}`}{" "}
                · {fmtDate(detail.session.createdAt)}
              </p>
            </div>

            <DetailBlock title={`Participants (${detail.players.length})`}>
              <ul className="grid gap-1 text-sm">
                {detail.players.map((p, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{p.username}</span> — {p.role} /{" "}
                    {p.seat} ({p.email})
                  </li>
                ))}
              </ul>
            </DetailBlock>

            <DetailBlock title={`Reports (${detail.reports.length})`}>
              {detail.reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reports generated.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {detail.reports.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border bg-background/50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{r.participantName}</span>
                        <span className="text-lg font-bold text-primary">{r.overallScore}/100</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{r.summary}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase text-emerald-400">Strengths</p>
                          <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                            {r.strengths.map((s, j) => (
                              <li key={j}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-amber-400">Improvements</p>
                          <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                            {r.improvements.map((s, j) => (
                              <li key={j}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.competencies.map((c, j) => (
                          <span
                            key={j}
                            className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-foreground"
                            title={c.justification}
                          >
                            {c.name}: {c.score}/5
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DetailBlock>

            <DetailBlock title={`Responses (${detail.responses.length})`}>
              {detail.responses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No responses recorded.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {detail.responses.map((r, i) => (
                    <div key={i} className="rounded-lg border border-border bg-background/50 p-3 text-sm">
                      <p className="font-medium text-foreground">Q: {r.questionText}</p>
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground">{r.participantName}:</span>{" "}
                        {r.answerText}{" "}
                        <span className="text-xs">({r.wordCount} words)</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </DetailBlock>

            <DetailBlock title={`Transcript (${detail.transcript.length})`}>
              {detail.transcript.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transcript.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background/50 p-3">
                  {detail.transcript.map((t, i) => (
                    <p key={i} className="mb-2 text-sm last:mb-0">
                      <span className="font-semibold text-foreground">
                        {t.speakerName}
                        {t.speakerRole ? ` (${t.speakerRole})` : ""}:
                      </span>{" "}
                      <span className="text-muted-foreground">{t.text}</span>
                    </p>
                  ))}
                </div>
              )}
            </DetailBlock>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    waiting: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    completed: "border-border bg-muted/40 text-muted-foreground",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${
        styles[status] ?? styles.completed
      }`}
    >
      {status}
    </span>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-semibold ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`px-3 py-2.5 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
