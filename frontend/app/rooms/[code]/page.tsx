"use client";

import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  LogOut,
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
import CharacterCreation, { AVATARS } from "@/components/game/character-creation";

function getAvatarColor(username: string) {
  const colors = [
    "from-pink-500 to-rose-500",
    "from-purple-500 to-indigo-500",
    "from-blue-500 to-cyan-500",
    "from-green-500 to-teal-500",
    "from-yellow-500 to-amber-500",
    "from-orange-500 to-red-500",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(username: string) {
  if (!username) return "?";
  return username.slice(0, 2).toUpperCase();
}

export default function WaitingRoomPage() {
  return (
    <ProtectedRoute>
      <WaitingRoom />
    </ProtectedRoute>
  );
}

function WaitingRoom() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { logout, user } = useAuth();
  const roomCode = params.code?.toUpperCase() ?? "";

  const roomData = useQuery(api.rooms.getByCode, roomCode ? { code: roomCode } : "skip");

  const toggleReadyMutation = useMutation(api.rooms.toggleReady);
  const startGameMutation = useMutation(api.rooms.startGame);
  const kickPlayerMutation = useMutation(api.rooms.kickPlayer);
  const transferHostMutation = useMutation(api.rooms.transferHost);
  const deleteRoomMutation = useMutation(api.rooms.deleteRoom);
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  const isLoading = roomData === undefined;

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  useEffect(() => {
    if (!roomData) return;

    if (roomData.room.status === "playing") {
      router.replace(`/rooms/${roomData.room.code}/play`);
      return;
    }

    const createdCode = window.sessionStorage.getItem("room-create-success");
    const joinedCode = window.sessionStorage.getItem("room-join-success");
    if (createdCode === roomData.room.code) {
      setNotice(`Room ${roomData.room.code} created successfully.`);
      window.sessionStorage.removeItem("room-create-success");
    }
    if (joinedCode === roomData.room.code) {
      setNotice(`Joined room ${roomData.room.code}.`);
      window.sessionStorage.removeItem("room-join-success");
    }
  }, [roomData, router]);

  async function copyRoomCode() {
    if (!roomData) return;
    await navigator.clipboard.writeText(roomData.room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function performAction(actionFn: () => Promise<unknown>, errorMessage: string) {
    if (isActionPending) return;
    setIsActionPending(true);
    setError(null);
    try {
      await actionFn();
    } catch (err) {
      setError(authErrorMessage(err) || errorMessage);
    } finally {
      setIsActionPending(false);
    }
  }

  const isHost = roomData?.currentUserRole === "HOST";
  const myPlayerInfo = useMemo(
    () => roomData?.players.find((p) => p.user?.id === user?.id),
    [roomData?.players, user?.id],
  );
  const isReady = myPlayerInfo?.isReady ?? false;
  const myCharacter = myPlayerInfo?.character;
  const hasCreatedCharacter = !!myCharacter;

  const canStartGame =
    roomData &&
    roomData.players.every((p) => {
      const hasChar = !!p.character;
      const playerReady = p.role === "HOST" || p.isReady;
      return hasChar && playerReady;
    });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
            Signed in as {user?.username}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground md:text-4xl">Waiting Room</h1>
        </div>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </header>

      {isLoading && (
        <section className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card/80 p-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading room...
          </div>
        </section>
      )}

      {!isLoading && roomData === null && (
        <section className="rounded-lg border border-red-400/40 bg-red-500/10 p-5 text-red-100">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-300" />
            <p>Could not load the room. You may have been removed or the room no longer exists.</p>
          </div>
        </section>
      )}

      {!isLoading && error && (
        <section className="rounded-lg border border-red-400/40 bg-red-500/10 p-5 text-red-100">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-300" />
            <p>{error}</p>
          </div>
        </section>
      )}

      {!isLoading && roomData && (
        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="flex flex-col gap-5">
            {notice && (
              <div className="flex items-center gap-3 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
                <Check className="h-4 w-4 text-accent" />
                <span>{notice}</span>
              </div>
            )}

            {!hasCreatedCharacter ? (
              <CharacterCreation roomCode={roomData.room.code} onCreated={() => setNotice("Character created!")} />
            ) : (
              <div className="rounded-lg border border-border bg-card/80 p-5 shadow-glow">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Room Code</p>
                    <p className="mt-3 font-mono text-5xl font-semibold tracking-normal text-primary">
                      {roomData.room.code}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={copyRoomCode}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy Room Code"}
                  </Button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-border bg-background/60 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Crown className="h-4 w-4 text-primary" />
                      Host
                    </div>
                    <p className="text-lg font-semibold">{roomData.host?.username ?? "Unknown"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{roomData.host?.email}</p>
                  </div>
                  <div className="rounded-md border border-border bg-background/60 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4 text-accent" />
                      Connected Players
                    </div>
                    <p className="text-lg font-semibold">
                      {roomData.players.filter((player) => player.isConnected).length}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">Waiting for the party to gather.</p>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-4">
                  <div className="flex flex-wrap gap-4">
                    {isHost ? (
                      <>
                        <Button
                          onClick={() =>
                            performAction(
                              () => startGameMutation({ code: roomData.room.code }),
                              "Failed to start game.",
                            )
                          }
                          disabled={isActionPending || !canStartGame}
                          className="bg-accent hover:bg-accent/80 font-bold"
                        >
                          {isActionPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          Start Game
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            performAction(async () => {
                              await deleteRoomMutation({ code: roomData.room.code });
                              router.push("/");
                            }, "Failed to delete room.")
                          }
                          disabled={isActionPending}
                          className="border-red-900/50 text-red-400 hover:bg-red-500/10 hover:border-red-900 font-semibold"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Room
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() =>
                            performAction(
                              () => toggleReadyMutation({ code: roomData.room.code }),
                              "Failed to toggle ready status.",
                            )
                          }
                          disabled={isActionPending}
                          variant={isReady ? "secondary" : "primary"}
                          className="font-bold"
                        >
                          {isReady ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {isReady ? "Set Not Ready" : "Set Ready"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            performAction(async () => {
                              const result = await leaveRoomMutation({ code: roomData.room.code });
                              if (result.roomDeleted) {
                                router.push("/rooms/join");
                              } else {
                                router.push("/rooms/join");
                              }
                            }, "Failed to leave room.")
                          }
                          disabled={isActionPending}
                        >
                          <LogOut className="h-4 w-4" />
                          Leave Room
                        </Button>
                      </>
                    )}
                  </div>
                  {isHost && !canStartGame && (
                    <p className="text-xs text-amber-400 font-medium animate-pulse">
                      Start Game is disabled until all players have created characters and clicked Ready.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-lg border border-border bg-card/80 p-5 flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">Players ({roomData.players.length})</h2>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[75vh]">
              {roomData.players.map((player) => {
                const isPlayerHost = player.role === "HOST";
                const char = player.character;
                const charAvatar = char ? AVATARS.find((av) => av.id === char.avatar) : null;
                const AvatarIcon = charAvatar ? charAvatar.Icon : null;
                const username = player.user?.username ?? "Unknown";
                const initials = getInitials(username);
                const avatarGrad = charAvatar ? charAvatar.gradient : getAvatarColor(username);

                return (
                  <div key={player._id} className="rounded-md border border-border bg-background/60 p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${avatarGrad}`}
                          >
                            {AvatarIcon ? <AvatarIcon className="h-5 w-5 text-white" /> : initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-sm sm:text-base text-foreground">
                                {char ? char.characterName : username}
                              </span>
                              {char && (
                                <span className="text-xs text-muted-foreground">({username})</span>
                              )}
                              {isPlayerHost && <Crown className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                {player.role}
                              </p>
                              {char && (
                                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                  {char.characterClass} (Lv.{char.level})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 font-semibold text-[10px] sm:text-xs ${
                                player.isReady ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {player.isReady ? "Ready" : "Not Ready"}
                            </span>
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  player.isConnected
                                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                    : "bg-muted-foreground"
                                }`}
                                aria-hidden="true"
                              />
                              <span className="hidden sm:inline">
                                {player.isConnected ? "Connected" : "Disconnected"}
                              </span>
                            </span>
                          </div>

                          {isHost && player.user?.id !== user?.id && username && (
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                className="h-7 px-2 inline-flex items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground hover:text-amber-400 hover:bg-muted/80 disabled:opacity-50 transition font-semibold"
                                title="Transfer Host"
                                disabled={isActionPending}
                                onClick={() =>
                                  performAction(
                                    () =>
                                      transferHostMutation({
                                        code: roomData.room.code,
                                        username,
                                      }),
                                    "Failed to transfer host.",
                                  )
                                }
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                                Host
                              </button>
                              <button
                                className="h-7 px-2 inline-flex items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground hover:text-red-400 hover:bg-muted/80 disabled:opacity-50 transition font-semibold"
                                title="Kick Player"
                                disabled={isActionPending}
                                onClick={() =>
                                  performAction(
                                    () =>
                                      kickPlayerMutation({
                                        code: roomData.room.code,
                                        username,
                                      }),
                                    "Failed to kick player.",
                                  )
                                }
                              >
                                <UserMinus className="h-3.5 w-3.5 mr-1" />
                                Kick
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] sm:text-xs">
                        <span className="flex items-center gap-1">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              char ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                            }`}
                          />
                          <span className="text-muted-foreground">
                            {char ? "Created" : "Creating..."}
                          </span>
                        </span>

                        {char && (
                          <span className="text-muted-foreground">
                            HP: <span className="text-rose-400 font-semibold">{char.currentHealth}</span> | Gold:{" "}
                            <span className="text-amber-400 font-semibold">{char.gold}g</span>
                          </span>
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
