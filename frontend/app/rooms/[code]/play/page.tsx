"use client";

import {
  AlertCircle,
  Compass,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Send,
  Skull,
  Sparkles,
  Swords,
  Users,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useAuth } from "@/hooks/use-auth";

export default function PlayPage() {
  return (
    <ProtectedRoute>
      <GamePlay />
    </ProtectedRoute>
  );
}

function GamePlay() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { logout, user } = useAuth();
  const roomCode = params.code?.toUpperCase() ?? "";

  const roomData = useQuery(api.rooms.getByCode, roomCode ? { code: roomCode } : "skip");
  const roomId = roomData?.room._id;

  const gameState = useQuery(api.gameEngine.get, roomId ? { roomId } : "skip");
  const storyEntries = useQuery(api.story.list, roomId ? { roomId } : "skip");
  const character = useQuery(
    api.characters.getMine,
    roomId ? { roomId } : "skip",
  );
  const connectedLocations = useQuery(
    api.locations.listConnected,
    roomId ? { roomId } : "skip",
  );
  const npcs = useQuery(api.npcs.list, roomId ? { roomId } : "skip");

  const processAction = useMutation(api.gameEngine.processAction);
  const talkToNpc = useAction(api.ai.talkToNpc);

  const [actionText, setActionText] = useState("");
  const [outcome, setOutcome] = useState<{ text: string; status: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTraveling, setIsTraveling] = useState(false);
  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [selectedNpcId, setSelectedNpcId] = useState<Id<"npcs"> | "">("");
  const [npcMessage, setNpcMessage] = useState("");
  const [npcReply, setNpcReply] = useState<string | null>(null);
  const [npcPending, setNpcPending] = useState(false);

  const storyEndRef = useRef<HTMLDivElement>(null);

  const isLoading =
    roomData === undefined ||
    (roomId && gameState === undefined) ||
    (roomId && storyEntries === undefined);

  useEffect(() => {
    if (roomData && roomData.room.status === "waiting") {
      router.replace(`/rooms/${roomData.room.code}`);
    }
  }, [roomData, router]);

  useEffect(() => {
    storyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [storyEntries?.length]);

  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(() => setOutcome(null), 8000);
    return () => clearTimeout(timer);
  }, [outcome]);

  async function submitAction(text: string) {
    if (!roomId || !text.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const result = await processAction({ roomId, actionText: text.trim() });
      setOutcome({ text: result.outcome, status: result.resolvedStatus });
      setActionText("");
    } catch (err) {
      setActionError(authErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onActionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAction(actionText);
  }

  async function travelTo(locationName: string) {
    if (!roomId || isTraveling) return;
    setIsTraveling(true);
    setActionError(null);
    try {
      const result = await processAction({
        roomId,
        actionText: `go to ${locationName}`,
      });
      setOutcome({ text: result.outcome, status: result.resolvedStatus });
    } catch (err) {
      setActionError(authErrorMessage(err));
    } finally {
      setIsTraveling(false);
    }
  }

  async function onNpcTalk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || !selectedNpcId || !npcMessage.trim()) return;
    setNpcPending(true);
    setNpcReply(null);
    try {
      const result = await talkToNpc({
        roomId,
        npcId: selectedNpcId as Id<"npcs">,
        message: npcMessage.trim(),
      });
      setNpcReply(result.dialogue ?? "The NPC remains silent.");
      setNpcMessage("");
    } catch (err) {
      setNpcReply(authErrorMessage(err));
    } finally {
      setNpcPending(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading adventure...
      </main>
    );
  }

  if (!roomData || !gameState || !character) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-6 text-red-100">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <p>Could not load the game. Make sure the adventure has started and you have a character.</p>
          </div>
        </div>
      </main>
    );
  }

  const hpPercent = Math.round((character.currentHealth / character.health) * 100);
  const mpPercent = Math.round((character.currentMana / character.mana) * 100);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Room {roomData.room.code} · {user?.username}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground md:text-3xl">Adventure</h1>
        </div>
        <Button variant="secondary" onClick={logout} className="self-start">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </header>

      {(outcome || actionError) && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            actionError
              ? "border-red-400/40 bg-red-500/10 text-red-100"
              : outcome?.status === "success"
                ? "border-accent/40 bg-accent/10 text-foreground"
                : "border-amber-400/40 bg-amber-500/10 text-amber-100"
          }`}
        >
          {actionError ?? outcome?.text}
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card/80 p-4 shadow-glow">
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent" />
              Story
            </div>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2 text-sm leading-relaxed text-foreground/90">
              {storyEntries?.map((entry) => (
                <p key={entry._id} className="rounded-md bg-background/50 px-3 py-2">
                  {entry.entryText}
                </p>
              ))}
              <div ref={storyEndRef} />
            </div>
          </div>

          <form onSubmit={onActionSubmit} className="rounded-lg border border-border bg-card/80 p-4 shadow-glow">
            <label htmlFor="action" className="mb-2 block text-sm font-medium text-muted-foreground">
              Your action
            </label>
            <div className="flex gap-2">
              <input
                id="action"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="inspect room, attack gnoll hunter, open moldy chest..."
                className="min-h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                disabled={isSubmitting}
              />
              <Button type="submit" disabled={isSubmitting || !actionText.trim()}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Act
              </Button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-card/80 p-4 shadow-glow">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">{character.characterName}</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {character.characterClass} · Level {character.level}
            </p>
            <div className="space-y-2 text-xs">
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-muted-foreground">HP</span>
                  <span className="text-rose-400">
                    {character.currentHealth}/{character.health}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${hpPercent}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-muted-foreground">MP</span>
                  <span className="text-blue-400">
                    {character.currentMana}/{character.mana}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${mpPercent}%` }} />
                </div>
              </div>
              <p className="pt-1 text-amber-400 font-semibold">{character.gold} gold</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/80 p-4 shadow-glow">
            <div className="mb-2 flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-accent" />
              <span className="font-semibold">{gameState.currentLocation}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {gameState.currentTime} · {gameState.weather}
            </p>
            <p className="mt-2 text-xs text-primary">{gameState.currentQuest}</p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">NPCs</p>
                {gameState.activeNpcs.length === 0 ? (
                  <p className="text-muted-foreground">None nearby</p>
                ) : (
                  <ul className="space-y-1">
                    {gameState.activeNpcs.map((npc) => (
                      <li key={npc.name} className="text-foreground/90">
                        {npc.name} ({npc.status})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Monsters</p>
                {gameState.activeMonsters.length === 0 ? (
                  <p className="text-muted-foreground">None nearby</p>
                ) : (
                  <ul className="space-y-1">
                    {gameState.activeMonsters.map((m) => (
                      <li key={m.name} className="flex items-center gap-1 text-red-300">
                        <Skull className="h-3 w-3" />
                        {m.name} ({m.health}/{m.maxHealth} HP)
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Objects</p>
                {gameState.objects.length === 0 ? (
                  <p className="text-muted-foreground">Nothing notable</p>
                ) : (
                  <ul className="space-y-1">
                    {gameState.objects.map((obj) => (
                      <li key={obj.name} className="text-foreground/90">
                        {obj.name} ({obj.status})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {connectedLocations && connectedLocations.length > 0 && (
            <div className="rounded-lg border border-border bg-card/80 p-4 shadow-glow">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Compass className="h-4 w-4 text-primary" />
                Travel
              </div>
              <div className="flex flex-wrap gap-2">
                {connectedLocations.map((loc) => (
                  <Button
                    key={loc.id}
                    variant="secondary"
                    className="text-xs"
                    disabled={isTraveling || isSubmitting}
                    onClick={() => travelTo(loc.name)}
                  >
                    {isTraveling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Swords className="h-3 w-3" />}
                    {loc.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={() => setNpcModalOpen(true)}>
            <MessageCircle className="h-4 w-4" />
            Talk to NPC (AI)
          </Button>
        </aside>
      </div>

      {npcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-glow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Talk to NPC</h3>
              <button
                type="button"
                onClick={() => {
                  setNpcModalOpen(false);
                  setNpcReply(null);
                }}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onNpcTalk} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                NPC
                <select
                  value={selectedNpcId}
                  onChange={(e) => setSelectedNpcId(e.target.value as Id<"npcs"> | "")}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select an NPC...</option>
                  {npcs?.map((npc) => (
                    <option key={npc._id} value={npc._id}>
                      {npc.name} ({npc.profession})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Message
                <textarea
                  value={npcMessage}
                  onChange={(e) => setNpcMessage(e.target.value)}
                  rows={3}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
                  placeholder="What do you say?"
                  required
                />
              </label>
              {npcReply && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm italic">
                  {npcReply}
                </div>
              )}
              <Button type="submit" disabled={npcPending}>
                {npcPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
