"use client";

import {
  AlertCircle,
  ArrowLeftRight,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  LogOut,
  MessagesSquare,
  Play,
  Trash2,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useAuth } from "@/hooks/use-auth";
import ProfileSetup, { AVATARS } from "@/components/game/profile-setup";

function seatLabel(mode: string, seat: string | null | undefined) {
  if (seat === "candidate") return "Candidate";
  if (seat === "discussant") return "Participant";
  if (seat === "observer") return "Observer";
  return mode === "panel_interview" ? "Observer" : "Participant";
}

export default function LobbyPage() {
  return (
    <ProtectedRoute>
      <Lobby />
    </ProtectedRoute>
  );
}

function Lobby() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { logout, user } = useAuth();
  const code = params.code?.toUpperCase() ?? "";

  const data = useQuery(api.sessions.getByCode, code ? { code } : "skip");

  const toggleReady = useMutation(api.sessions.toggleReady);
  const startSession = useMutation(api.sessions.start);
  const kickPlayer = useMutation(api.sessions.kickPlayer);
  const transferHost = useMutation(api.sessions.transferHost);
  const deleteSession = useMutation(api.sessions.deleteSession);
  const leave = useMutation(api.sessions.leave);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  const isLoading = data === undefined;

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notice]);

  useEffect(() => {
    if (!data) return;
    if (data.session.status !== "waiting") {
      router.replace(`/rooms/${data.session.code}/play`);
      return;
    }
    const created = window.sessionStorage.getItem("session-create-success");
    if (created === data.session.code) {
      setNotice(
        data.session.mode === "group_discussion"
          ? `Session created. Share code ${data.session.code} to invite participants.`
          : "Session created. Set up your profile and start when ready.",
      );
      window.sessionStorage.removeItem("session-create-success");
    }
  }, [data, router]);

  async function copyCode() {
    if (!data) return;
    await navigator.clipboard.writeText(data.session.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function run(fn: () => Promise<unknown>, fallback: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(authErrorMessage(err) || fallback);
    } finally {
      setPending(false);
    }
  }

  const isHost = data?.currentUserRole === "HOST";
  const me = useMemo(
    () => data?.players.find((p) => p.user?.id === user?.id),
    [data?.players, user?.id],
  );
  const hasProfile = !!me?.profile;
  const isReady = me?.isReady ?? false;

  const canStart =
    data &&
    data.players.every((p) => !!p.profile && (p.role === "HOST" || p.isReady)) &&
    (data.session.mode === "panel_interview" ||
      data.players.filter((p) => p.seat === "discussant").length >= 2);

  const mode = data?.session.mode ?? "panel_interview";
  const isInterview = mode === "panel_interview";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            {isInterview ? <Briefcase className="h-4 w-4" /> : <MessagesSquare className="h-4 w-4" />}
            {isInterview ? "Panel Interview" : "Group Discussion"} · Lobby
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {data?.session.mode === "group_discussion"
              ? data?.session.topic || "Group Discussion"
              : data?.session.targetRole || "Interview"}
          </h1>
        </div>
        <Button variant="ghost" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </header>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card/60 p-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          Loading session...
        </div>
      )}

      {!isLoading && data === null && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <p>Could not load this session. It may have ended or you were removed.</p>
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {!isLoading && data && (
        <section className="grid flex-1 gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="flex flex-col gap-5">
            {notice && (
              <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
                <Check className="h-4 w-4 text-accent" />
                {notice}
              </div>
            )}

            {!hasProfile ? (
              <ProfileSetup
                sessionCode={data.session.code}
                defaultRole={isInterview ? data.session.targetRole : undefined}
                isCandidate={data.currentUserSeat === "candidate"}
                onCreated={() => setNotice("Profile saved.")}
              />
            ) : isInterview ? (
              /* ── Panel Interview: no invite code, just details + start ── */
              <div className="rounded-xl border border-border bg-card/80 p-6 shadow-glow">
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Detail label="Format" value="Panel Interview" />
                  <Detail label="Role" value={data.session.targetRole} />
                  <Detail label="Difficulty" value={data.session.difficulty} className="capitalize" />
                  <Detail label="Questions" value={String(data.session.questionCount)} />
                  <Detail label="Your role" value={seatLabel(mode, data.currentUserSeat)} />
                </dl>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {isHost ? (
                    <>
                      <Button
                        onClick={() =>
                          run(() => startSession({ code: data.session.code }), "Failed to start.")
                        }
                        disabled={pending || !canStart}
                      >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Start interview
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() =>
                          run(async () => {
                            await deleteSession({ code: data.session.code });
                            router.push("/");
                          }, "Failed to delete.")
                        }
                        disabled={pending}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant={isReady ? "secondary" : "primary"}
                        onClick={() =>
                          run(() => toggleReady({ code: data.session.code }), "Failed to update.")
                        }
                        disabled={pending}
                      >
                        {isReady ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {isReady ? "Not ready" : "I'm ready"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          run(async () => {
                            await leave({ code: data.session.code });
                            router.push("/");
                          }, "Failed to leave.")
                        }
                        disabled={pending}
                      >
                        <LogOut className="h-4 w-4" />
                        Leave
                      </Button>
                    </>
                  )}

                  {/* Code tucked away — only useful for inviting observers */}
                  <details className="ml-auto">
                    <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                      Invite an observer
                    </summary>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tracking-widest text-primary">
                        {data.session.code}
                      </span>
                      <button
                        type="button"
                        onClick={copyCode}
                        className="rounded border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            ) : (
              /* ── Group Discussion: invite code is central ── */
              <div className="rounded-xl border border-border bg-card/80 p-6 shadow-glow">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Invite code — share this with participants
                    </p>
                    <p className="mt-2 font-mono text-5xl font-bold tracking-widest text-primary">
                      {data.session.code}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={copyCode}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy code"}
                  </Button>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Detail label="Format" value="Group Discussion" />
                  <Detail label="Topic" value={data.session.topic || "—"} />
                  <Detail label="Difficulty" value={data.session.difficulty} className="capitalize" />
                  <Detail label="Rounds" value={String(data.session.questionCount)} />
                  <Detail label="Your role" value={seatLabel(mode, data.currentUserSeat)} />
                </dl>

                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3">
                    {isHost ? (
                      <>
                        <Button
                          onClick={() =>
                            run(() => startSession({ code: data.session.code }), "Failed to start.")
                          }
                          disabled={pending || !canStart}
                        >
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          Start discussion
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            run(async () => {
                              await deleteSession({ code: data.session.code });
                              router.push("/");
                            }, "Failed to delete.")
                          }
                          disabled={pending}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant={isReady ? "secondary" : "primary"}
                          onClick={() =>
                            run(() => toggleReady({ code: data.session.code }), "Failed to update.")
                          }
                          disabled={pending}
                        >
                          {isReady ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {isReady ? "Not ready" : "I'm ready"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            run(async () => {
                              await leave({ code: data.session.code });
                              router.push("/");
                            }, "Failed to leave.")
                          }
                          disabled={pending}
                        >
                          <LogOut className="h-4 w-4" />
                          Leave
                        </Button>
                      </>
                    )}
                  </div>
                  {isHost && !canStart && (
                    <p className="text-xs font-medium text-amber-400">
                      Need at least 2 participants, each with a profile and ready status.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4 rounded-xl border border-border bg-card/80 p-5">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">Participants ({data.players.length})</h2>
            </div>
            <div className="scroll-slim flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
              {data.players.map((p) => {
                const av = p.profile ? AVATARS.find((a) => a.id === p.profile!.avatar) : null;
                const Icon = av?.Icon;
                const name = p.profile?.displayName ?? p.user?.username ?? "Unknown";
                return (
                  <div key={p._id} className="rounded-lg border border-border bg-background/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white ${
                            av?.gradient ?? "from-slate-500 to-slate-700"
                          }`}
                        >
                          {Icon ? <Icon className="h-5 w-5" /> : name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground">{name}</span>
                            {p.role === "HOST" && (
                              <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            )}
                          </div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {seatLabel(mode, p.seat)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            p.isReady || p.role === "HOST"
                              ? "bg-accent/15 text-accent"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.role === "HOST" ? "Host" : p.isReady ? "Ready" : "Not ready"}
                        </span>
                        {isHost && p.user?.id !== user?.id && (
                          <div className="flex gap-1.5">
                            <button
                              title="Make host"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () =>
                                    transferHost({ code: data.session.code, username: p.user!.username }),
                                  "Failed.",
                                )
                              }
                              className="rounded-md border border-border bg-muted p-1.5 text-muted-foreground transition hover:text-amber-400 disabled:opacity-50"
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Remove"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () =>
                                    kickPlayer({ code: data.session.code, username: p.user!.username }),
                                  "Failed.",
                                )
                              }
                              className="rounded-md border border-border bg-muted p-1.5 text-muted-foreground transition hover:text-red-400 disabled:opacity-50"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm font-medium text-foreground ${className ?? ""}`}>{value}</dd>
    </div>
  );
}
