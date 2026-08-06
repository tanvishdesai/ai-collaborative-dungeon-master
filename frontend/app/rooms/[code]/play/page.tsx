"use client";

import {
  AlertCircle,
  Compass,
  HelpCircle,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Search,
  Send,
  Skull,
  Sparkles,
  Swords,
  Users,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import { api } from "@/convex/_generated/api";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { authErrorMessage, useAuth } from "@/hooks/use-auth";

const TUTORIAL_SEEN_KEY = "vismrit-ghati-tutorial-seen";

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

  const processAction = useMutation(api.gameEngine.processAction);

  const [actionText, setActionText] = useState("");
  const [outcome, setOutcome] = useState<{ text: string; status: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTraveling, setIsTraveling] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const storyEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLoading =
    roomData === undefined ||
    (roomId && gameState === undefined) ||
    (roomId && storyEntries === undefined);

  // Show the welcome tutorial once, on the player's first visit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(TUTORIAL_SEEN_KEY)) {
      setHelpOpen(true);
    }
  }, []);

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

  function closeTutorial() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
    }
    setHelpOpen(false);
  }

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

  // Quick-action buttons prefill a ready-to-send command so new players never
  // face a blank command box. They fill the input (with a sensible target when
  // one is nearby) and focus it, so the player just presses Act to confirm.
  function fillCommand(text: string) {
    setActionText(text);
    // Focus and place the cursor at the end so the player can complete/edit it.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
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
  const firstMonster = gameState.activeMonsters[0];
  const firstNpc = gameState.activeNpcs[0];
  const firstLocation = connectedLocations?.[0];
  const firstItem = gameState.inventory.party[0];
  const partyItems = gameState.inventory.party;

  const latestSuggestedActions = storyEntries?.length
    ? storyEntries[storyEntries.length - 1].suggestedActions
    : undefined;
  const suggestedActions = latestSuggestedActions?.length
    ? latestSuggestedActions
    : ["Look around"];

  const quickActions = [
    {
      key: "look",
      label: "Look around",
      Icon: Search,
      command: "inspect room",
    },
    {
      key: "attack",
      label: "Attack",
      Icon: Swords,
      command: firstMonster ? `attack ${firstMonster.name}` : "attack ",
    },
    {
      key: "talk",
      label: "Talk",
      Icon: MessageCircle,
      command: firstNpc ? `talk to ${firstNpc.name}` : "talk to ",
    },
    {
      key: "travel",
      label: "Travel",
      Icon: Compass,
      command: firstLocation ? `go to ${firstLocation.name}` : "go to ",
    },
    {
      key: "use",
      label: "Use item",
      Icon: Package,
      command: firstItem ? `use ${firstItem}` : "use ",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Room {roomData.room.code} · {user?.username}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground md:text-3xl">Adventure</h1>
        </div>
        <div className="flex gap-2 self-start">
          <Button variant="secondary" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="h-4 w-4" />
            How to play
          </Button>
          <Button variant="secondary" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
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
                <div key={entry._id} className="rounded-md bg-background/50 px-3 py-2">
                  <ReactMarkdown
                    allowedElements={["p", "strong", "em"]}
                    unwrapDisallowed
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    }}
                  >
                    {entry.entryText}
                  </ReactMarkdown>
                </div>
              ))}
              <div ref={storyEndRef} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/80 p-4 shadow-glow">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Tap a quick action, then press Act — or just type what you want to do.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestedActions.map((command) => (
                <Button
                  key={command}
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  disabled={isSubmitting || isTraveling}
                  onClick={() => fillCommand(command)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {command}
                </Button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {quickActions.map(({ key, label, Icon, command }) => (
                <Button
                  key={key}
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  disabled={isSubmitting || isTraveling}
                  onClick={() => fillCommand(command)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>

            <form onSubmit={onActionSubmit}>
              <label htmlFor="action" className="mb-2 block text-sm font-medium text-muted-foreground">
                Your action
              </label>
              <div className="flex gap-2">
                <input
                  id="action"
                  ref={inputRef}
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  placeholder="inspect room, attack rakshasa prowler, open old sandook..."
                  className="min-h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  disabled={isSubmitting}
                />
                <Button type="submit" disabled={isSubmitting || !actionText.trim()}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Act
                </Button>
              </div>
            </form>
          </div>
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
                  <span className="text-muted-foreground">Health</span>
                  <span className="text-rose-400">
                    {character.currentHealth}/{character.health}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${hpPercent}%` }} />
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
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Your goal</p>
              <p className="mt-0.5 text-xs text-primary">{gameState.currentQuest}</p>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">People nearby</p>
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
                <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Enemies</p>
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
                <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Things here</p>
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

          <div className="rounded-lg border border-border bg-card/80 p-4 shadow-glow">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4 text-accent" />
              Items
            </div>
            {partyItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Your bag is empty.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {partyItems.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    className="rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground/90"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            )}
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
        </aside>
      </div>

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-glow">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground">Namaste, veer! 🙏</h3>
                <p className="mt-1 text-sm text-primary">How to play</p>
              </div>
              <button
                type="button"
                onClick={closeTutorial}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
              <p>
                You have entered <span className="font-semibold">Vismrit Ghati</span>, the Forgotten
                Valley — a living story you and your friends shape together.
              </p>
              <p>
                This is not a game of fixed buttons and rules. You simply say what you want to do, and
                the story responds. There is no wrong move — just play like you are telling a tale.
              </p>
              <div className="rounded-md border border-border bg-background/50 p-3">
                <p className="mb-2 font-semibold text-foreground">Two easy ways to act:</p>
                <ol className="ml-4 list-decimal space-y-1 text-foreground/90">
                  <li>
                    Tap a quick button —{" "}
                    <span className="text-primary">Look around, Attack, Talk, Travel, Use item</span>{" "}
                    — then press <span className="font-semibold">Act</span>.
                  </li>
                  <li>
                    Or type your own action in plain words, like{" "}
                    <span className="italic">&ldquo;inspect the old sandook&rdquo;</span> or{" "}
                    <span className="italic">&ldquo;talk to Devdas&rdquo;</span>.
                  </li>
                </ol>
              </div>
              <p>
                On the right you can see where you are, who and what is nearby, the items in your bag,
                and <span className="font-semibold">your goal</span>. Follow the goal to move the
                story forward.
              </p>
              <p className="text-xs text-muted-foreground">
                Tap <span className="font-semibold">&ldquo;How to play&rdquo;</span> at the top
                anytime to see this again.
              </p>
            </div>

            <Button onClick={closeTutorial} className="mt-5 w-full">
              Begin the adventure
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
