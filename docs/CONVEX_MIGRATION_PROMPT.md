# Migration Prompt: FastAPI/Postgres/Socket.IO → Convex + Next.js (TypeScript)

Paste this entire document into a fresh Cursor agent chat as your first message. It is written to be self-contained — the agent should not need to guess at intent. Where it must still read the existing source (the exact game-logic algorithms), that's called out explicitly with file paths.

---

## 0. Ground rules for the agent

1. **Work in the phases below, in order.** Do not jump ahead. After each phase, run the verification step listed for it before starting the next phase.
2. **Do not delete `backend/` until Phase 11.** It is your reference implementation for exact behavior. Read the relevant backend file before porting each piece of logic — don't rely only on the summaries below for anything you're about to write code from; the summaries tell you *what to look for and why*, the source file is the ground truth for exact values/formulas.
3. **This is a port with deliberate, called-out deviations, not a bug-for-bug clone.** Section 9 ("Do not carry these over") lists specific bugs and dead code in the current implementation. Do not reproduce them — fix them the way that section describes.
4. **After every phase**, run `npx convex dev` (or check the existing dev process's output) and `npm run typecheck` in `frontend/` and fix errors before moving on. Long autonomous runs on a weak model compound errors — stop and fix at each checkpoint rather than plowing through.
5. **If a decision point isn't covered by this doc, stop and ask** rather than guessing — especially anything touching auth, money/gold logic, or destructive schema changes.
6. **Frontend framework does not change** — it's Next.js today and stays Next.js. Only the backend changes: FastAPI + PostgreSQL + Socket.IO → Convex (functions + reactive database + built-in scheduling). The frontend's data-fetching and real-time layer gets rewritten to use `convex/react` hooks instead of `fetch()` + `socket.io-client`.

---

## 1. Why, and what maps to what

| Current | New | Why |
|---|---|---|
| FastAPI routes (`backend/app/api/routes/*.py`) | Convex `query`/`mutation`/`action` functions (`convex/*.ts`) | Convex functions are the entire backend — no separate server process, no Render. |
| PostgreSQL + SQLAlchemy + Alembic | Convex's built-in document database + `convex/schema.ts` | Convex schema changes deploy without a separate migration tool; it's schema-on-write with generated TS types. |
| Socket.IO (`backend/app/socket/server.py`, `frontend/socket/client.ts`) | Convex's reactive `useQuery` | Convex queries are live by default — any client subscribed to a query re-renders automatically when the underlying data changes. This **deletes** the need for all 15 `notify_*` socket-emit functions and all manual reconnect/room-subscribe logic. This is the single biggest simplification in this migration. |
| Hand-rolled JWT + refresh-token-rotation + bcrypt (`backend/app/utils/auth.py`, `auth_service.py`, `middleware.py`) | **Convex Auth** (`@convex-dev/auth`) with the Password provider | Don't hand-roll crypto/session logic in a new codebase when the platform ships a maintained auth system built for it. This is the one part of the port that is a genuine rewrite of *approach*, not just language — see Phase 2. |
| Google Gemini call via `google-genai` Python SDK (`backend/app/ai/gemini_service.py`) | Google Gemini call via `@google/genai` npm SDK, inside a Convex `action` (the only Convex function type allowed to do non-deterministic I/O like external HTTP calls) | Same model, same API, different language binding. |
| Render (backend hosting) + Supabase (Postgres) | Convex (hosts both the "backend" functions and the database — one deploy target) | Removes two infra pieces (and the free-tier cold-start problem entirely) and replaces them with one. |
| Vercel (frontend hosting) | Unchanged | Next.js still deploys to Vercel exactly as today. |

---

## 2. Target repo layout

```
ai-collaborative-dungeon-master/
├── convex/
│   ├── schema.ts
│   ├── auth.ts                 # Convex Auth config
│   ├── auth.config.ts
│   ├── http.ts                 # only if Convex Auth needs HTTP routes for OAuth (not needed for Password-only)
│   ├── rooms.ts                # room CRUD, join/leave/kick/transfer/ready/start
│   ├── characters.ts           # character creation/read
│   ├── gameEngine.ts           # the action-resolution state machine (mutation)
│   ├── worldGenerator.ts       # world seed mutation
│   ├── npcs.ts                 # npc list/detail/talk
│   ├── story.ts                # story history queries
│   ├── ai.ts                   # Gemini narration + npc-talk actions ("use node")
│   ├── promptBuilder.ts        # pure TS functions building the Gemini prompt strings
│   └── lib/
│       └── classPresets.ts     # the single shared CLASS_STARTING_STATS table (see Phase 9)
├── frontend/                   # unchanged framework, rewritten data layer
│   ├── app/
│   │   └── rooms/[code]/
│   │       ├── page.tsx        # waiting room (ported)
│   │       └── play/page.tsx   # NEW — the in-game screen (doesn't exist today, see Phase 10)
│   └── ...
└── backend/                    # keep until Phase 11, then delete
```

---

## 3. Phase 1 — Convex + Auth scaffolding

1. From the repo root: `cd frontend && npm install convex @convex-dev/auth`
2. Run `npx convex dev` inside `frontend/` (or wherever you choose to root the Convex project — conventionally it lives inside the Next.js app directory since Convex's codegen writes to `convex/_generated`). This creates the Convex project, prompts for login, and creates `convex/` with a starter schema.
3. Run the Convex Auth setup: `npx @convex-dev/auth`. This scaffolds `convex/auth.ts`, `convex/auth.config.ts`, wires environment variables (`JWT_PRIVATE_KEY`, `JWKS`, etc. — auto-generated, don't hand-write these), and adds the necessary Next.js middleware. **Consult the currently-installed `@convex-dev/auth` package's own README/docs during this step** (`node_modules/@convex-dev/auth/README.md` or its published docs) — the exact CLI prompts and generated file shape can change between versions and you should follow what the installed version actually asks for, not a hardcoded transcript.
4. Configure the Password provider (not OAuth/magic-link) — the current app is email+password only, no social login, no email verification (confirmed: `User.is_verified` exists as a column but is never set `true` anywhere in the current code — there is no verification flow to port).

**Verify**: `npx convex dev` runs clean, `convex/_generated` exists, a placeholder Convex Auth sign-in works against a throwaway test user before you build anything else on top of it.

---

## 4. Phase 2 — Schema (`convex/schema.ts`)

Write this schema. `_creationTime` is automatic on every Convex document — **do not** add manual `createdAt`/`updatedAt` fields; only add an explicit timestamp field where the current code needs a *specific business timestamp* that isn't "when was this row created" (there are none here — every `created_at`/`updated_at` in the current models is exactly row-creation or row-update time, which `_creationTime` and Convex's mutation model already give you for free).

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const monster = v.object({
  name: v.string(),
  health: v.number(),
  maxHealth: v.number(),
  damage: v.number(),
  defense: v.number(),
  xp: v.number(),
  gold: v.number(),
});

const sceneNpc = v.object({
  name: v.string(),
  type: v.string(),
  health: v.number(),
  status: v.string(), // "friendly" | "hostile" | "neutral"
  dialogue: v.string(),
});

const sceneObject = v.object({
  name: v.string(),
  type: v.string(), // "chest" | "gate" | "wall" | "usable"
  status: v.string(), // "open" | "closed" | "locked" | "destroyed" | "intact" | "active"
  items: v.optional(v.array(v.string())),
  gold: v.optional(v.number()),
  requires: v.optional(v.string()),
  leadsTo: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,

  // Extends Convex Auth's built-in `users` table with the app-specific fields
  // that don't come from the auth provider. Convex Auth's own `users` table
  // already has an `email` field; `username` and `isActive` are ours.
  users: defineTable({
    ...authTables.users.validator.fields,
    username: v.string(),
    isActive: v.boolean(),
  })
    .index("email", ["email"])
    .index("by_username", ["username"]),

  rooms: defineTable({
    code: v.string(),
    hostUserId: v.id("users"),
    status: v.union(v.literal("waiting"), v.literal("playing")),
  }).index("by_code", ["code"]),

  roomPlayers: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    role: v.union(v.literal("HOST"), v.literal("PLAYER")),
    isConnected: v.boolean(),
    isReady: v.boolean(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_user", ["roomId", "userId"]),

  characters: defineTable({
    userId: v.id("users"),
    roomId: v.id("rooms"),
    characterName: v.string(),
    characterClass: v.union(
      v.literal("Warrior"), v.literal("Mage"), v.literal("Archer"),
      v.literal("Rogue"), v.literal("Healer"),
    ),
    avatar: v.string(),
    level: v.number(),
    experience: v.number(),
    health: v.number(),
    mana: v.number(),
    strength: v.number(),
    intelligence: v.number(),
    agility: v.number(),
    defense: v.number(),
    luck: v.number(),
    currentHealth: v.number(),
    currentMana: v.number(),
    gold: v.number(),
    readyForGame: v.boolean(),
  })
    .index("by_room_and_user", ["roomId", "userId"])
    .index("by_room_and_name", ["roomId", "characterName"]),

  gameStates: defineTable({
    roomId: v.id("rooms"),
    currentLocationId: v.optional(v.id("locations")),
    currentLocation: v.string(),
    currentTime: v.string(),
    weather: v.string(),
    currentQuest: v.string(),
    activeNpcs: v.array(sceneNpc),
    activeMonsters: v.array(monster),
    objects: v.array(sceneObject),
    inventory: v.object({
      party: v.array(v.string()),
    }),
    worldFlags: v.object({
      visitedLocations: v.array(v.string()),
      completedQuests: v.array(v.string()),
      killedMonsters: v.array(v.string()),
      openedChests: v.array(v.string()),
      destroyedObjects: v.array(v.string()),
      npcRelationships: v.record(v.string(), v.number()),
    }),
    turnIndex: v.number(),
    turnStage: v.union(v.literal("player"), v.literal("enemy"), v.literal("world")),
  }).index("by_room", ["roomId"]),

  gameEvents: defineTable({
    roomId: v.id("rooms"),
    eventType: v.string(),
    details: v.any(), // shape genuinely varies per event_type in the source app — keep loose here
  }).index("by_room", ["roomId"]),

  playerActions: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    actionText: v.string(),
    resolvedStatus: v.union(v.literal("success"), v.literal("failed"), v.literal("rejected")),
    outcome: v.string(),
  }).index("by_room", ["roomId"]),

  storyHistory: defineTable({
    roomId: v.id("rooms"),
    entryText: v.string(),
  }).index("by_room", ["roomId"]),

  npcs: defineTable({
    roomId: v.id("rooms"),
    locationId: v.optional(v.id("locations")),
    name: v.string(),
    race: v.string(),
    profession: v.string(),
    personality: v.string(),
    mood: v.string(),
    inventory: v.any(),
    relationships: v.record(v.string(), v.number()), // characterName -> 0-100
    dailySchedule: v.string(),
    goals: v.string(),
  }).index("by_room", ["roomId"]),

  npcMemories: defineTable({
    npcId: v.id("npcs"),
    characterName: v.string(),
    playerMessage: v.string(),
    npcResponse: v.string(),
  }).index("by_npc", ["npcId"]).index("by_npc_and_character", ["npcId", "characterName"]),

  biomes: defineTable({
    name: v.string(),
    description: v.string(),
  }).index("by_name", ["name"]),

  regions: defineTable({
    roomId: v.id("rooms"),
    name: v.string(),
    description: v.string(),
  }).index("by_room", ["roomId"]),

  locations: defineTable({
    roomId: v.id("rooms"),
    regionId: v.optional(v.id("regions")),
    biomeId: v.optional(v.id("biomes")),
    name: v.string(),
    description: v.string(),
    biome: v.string(),
    connectedLocations: v.array(v.id("locations")), // real Convex IDs, not stringified UUIDs — see Phase 9
    npcList: v.array(v.object({ name: v.string(), dialogue: v.string() })), // display-only flavor text
    monsterList: v.array(monster),
    lootTable: v.object({ gold: v.number(), items: v.array(v.string()) }),
    weather: v.string(),
    dangerLevel: v.number(),
  }).index("by_room", ["roomId"]),

  buildings: defineTable({
    locationId: v.id("locations"),
    name: v.string(),
    type: v.string(),
    description: v.string(),
    npcList: v.array(v.object({ name: v.string(), dialogue: v.string() })),
    inventory: v.any(), // items/drinks/blessings + prices, shape varies per building type
  }).index("by_location", ["locationId"]),

  worldObjects: defineTable({
    locationId: v.id("locations"),
    name: v.string(),
    type: v.string(),
    status: v.string(),
    details: v.any(),
  }).index("by_location", ["locationId"]),
});
```

**Note on `connectedLocations`**: the original stores stringified UUIDs in a JSON array with no referential integrity. Here it's `v.array(v.id("locations"))` — real document references. This is an intentional improvement, not a literal port — do it this way.

**Verify**: `npx convex dev` accepts the schema with no errors.

---

## 5. Phase 3 — Auth (Convex Auth, not a literal port)

**Do not port** `backend/app/utils/auth.py`, `backend/app/services/auth_service.py`, `backend/app/middleware.py`, or the `refresh_tokens` table. Convex Auth's Password provider replaces all of it: password hashing, session issuance, session refresh/rotation, and logout are handled by the library.

What you still need to write, on top of Convex Auth:

- A `users:completeSignup` (or similar) mutation/callback that, right after Convex Auth creates the base user record, also sets `username` (validate: 3-32 chars, `^[A-Za-z0-9_]+$`, must be unique — check `by_username` index) and `isActive: true`. Convex Auth's Password provider supports a `profile()` callback for exactly this — pass extra fields through it at sign-up time.
- Uniqueness conflict handling: the original returns 409 with a message naming which field (email vs. username) collided — replicate that as a thrown `ConvexError` with a clear message; the frontend should catch and display it the same way it catches `ApiError` today.
- `GET /auth/me` → a `users:me` query returning the current authenticated user's profile (id, email, username, isActive).
- There is **no email verification flow** to port — `is_verified` in the old schema was dead (never set). Don't add a `isVerified` field or any verification logic; it doesn't exist in the current product.

**Frontend**: replace `frontend/hooks/use-auth.tsx`'s manual token-in-React-state + cookie-refresh-on-mount logic with Convex Auth's `useAuthActions()` (`signIn`, `signOut`) and `useConvexAuth()` (`isAuthenticated`, `isLoading`) from `@convex-dev/auth/react`. Delete `frontend/services/auth.ts` (its three fetch-wrapper functions become direct calls to Convex Auth's `signIn("password", { email, password, flow: "signIn" })` / `flow: "signUp"` / `signOut()`). Delete `REFRESH_COOKIE_NAME` handling entirely — Convex Auth manages its own session persistence.

**Verify**: register a new user, log out, log back in, refresh the page and confirm the session persists (Convex Auth handles this itself — you're verifying the wiring, not reimplementing persistence).

---

## 6. Phase 4 — Room system (`convex/rooms.ts`)

Read `backend/app/services/room_service.py` and `backend/app/api/routes/rooms.py` in full before writing this — the inventory below tells you *what* each function must do; the source has the exact edge-case ordering (e.g., which check happens before which) that you should preserve.

Port these as Convex functions, each replacing one REST endpoint:

| Old | New |
|---|---|
| `POST /rooms` | `rooms:create` mutation |
| `POST /rooms/join` | `rooms:join` mutation |
| `GET /rooms/{code}` | `rooms:getByCode` query |
| `POST /rooms/{code}/ready` | `rooms:toggleReady` mutation |
| `POST /rooms/{code}/start` | `rooms:startGame` mutation (calls the world-seed mutation from Phase 5, then game-init from Phase 6) |
| `POST /rooms/{code}/kick` | `rooms:kickPlayer` mutation |
| `POST /rooms/{code}/transfer-host` | `rooms:transferHost` mutation |
| `DELETE /rooms/{code}` | `rooms:deleteRoom` mutation |
| `POST /rooms/{code}/leave` | `rooms:leaveRoom` mutation |

Behavior to preserve exactly:
- Room code: 6 chars from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (uppercase letters + digits, minus `0`, `O`, `1`, `I` to avoid visual ambiguity). Generate and check `by_code` for a collision; Convex mutations are transactional per-call, so you don't need the original's retry-on-`IntegrityError` loop — a single collision check-then-insert inside one mutation is atomic. Still cap attempts (e.g. 10) and throw if you somehow can't find a free code, as a sanity backstop.
- Max 6 players per room (`roomPlayers` count for a room).
- `startGame` requires: caller is host; every player has a character; every non-host player has `isReady: true`. Throw a `ConvexError` naming which player is missing what, matching the original's specific messages.
- `leaveRoom`: if the leaving player is the host, the **entire room is deleted** (delete the room doc + all its `roomPlayers`, `characters`, etc. — Convex doesn't have DB-level `ON DELETE CASCADE`, so you must delete child documents explicitly in the mutation; query and delete `roomPlayers`/`characters`/`gameStates`/`gameEvents`/`playerActions`/`storyHistory`/`npcs`/`npcMemories`/`regions`/`locations`/`buildings`/`worldObjects` by `roomId` before deleting the room). If a non-host leaves, just delete their `roomPlayers` row.
- `deleteRoom`/host-leaving must do the same full cascade-delete described above.
- **The "character" join is not a foreign key** in the original (it's a viewonly match on `(roomId, userId)`) — in Convex, when you need "this room player's character," just query `characters` by the `by_room_and_user` index with the same `(roomId, userId)` pair. Don't add a `characterId` field to `roomPlayers`; keep the same loose match-by-tuple semantics, it's simpler here too.
- Real-time updates: **delete every `notify_*` socket call.** Any component that today listens for `room:players_updated` etc. should instead just call `useQuery(api.rooms.getByCode, { code })` — it will automatically re-render when any mutation changes the room's players. No manual event wiring needed anywhere in this phase.

**Verify**: two browser sessions (or two profiles), one creates a room, the other joins by code — the first session's player list updates without a page refresh, with zero custom code making that happen (that's Convex reactivity working, not something you wrote).

---

## 7. Phase 5 — World generation (`convex/worldGenerator.ts`)

Read `backend/app/game_engine/world_generator.py` for the exact seed data (names, stats, descriptions, prices) — it's fully hardcoded, no procedural randomness despite the class name, so this is a straightforward data-seeding mutation, not an algorithm port.

Port `WorldGenerator.generate_world(session, room_id)` as a mutation `worldGenerator:generateWorld({ roomId })`:
1. Seed the 6 global `biomes` rows if they don't exist yet (check `by_name` — these are shared across all rooms, seed once ever, not once per room).
2. Create one `regions` row for this room ("The Forgotten Vale").
3. Create the 6 `locations` rows (Stoneford Village / Whispering Forest / Silver River / Spine Mountain / Cryptic Dungeon / Shadowfang Castle) with their exact biome/danger/weather/monster/loot values from the source file.
4. Set `connectedLocations` as real `Id<"locations">[]` per the adjacency graph in the source (Village↔Forest, Village↔Mountain, Forest↔River, Forest↔Castle, River↔Dungeon).
5. Seed the 5 persistent `npcs` rows (Barman Ted, Merchant Alaric, Priestess Alara, Wizard Elidor, Herbalist Aerith) with their exact personality/mood/inventory/schedule/goals text and empty `relationships: {}`.
6. Seed the 3 `buildings` rows (Merchant's Guild, Rusty Anchor Tavern, Plains Altar Temple) with their inventories/prices.
7. Seed the 2 `worldObjects` rows (iron gate in the dungeon requiring "crypt key"; moldy chest in the forest).
8. Return the Stoneford Village location's `Id<"locations">` as the start location, for `startGame` (Phase 4) to pass into game initialization (Phase 6).

**Verify**: after `startGame`, query `locations` for the room and confirm 6 rows exist with correct connectivity; query `npcs` and confirm 5 rows.

---

## 8. Phase 6 — Game engine (`convex/gameEngine.ts`)

This is the core logic and the part most worth reading the source for directly: `backend/app/game_engine/game_engine.py`. Below is a behavioral summary to work from, but treat the source file as authoritative for exact damage formulas, message strings, and event-type names.

### `initializeGame({ roomId, startLocationId, startLocationName, startLocationDesc, startWeather, startNpcs, startMonsters, startObjects })` mutation
- No-op if a `gameStates` row already exists for the room (return it).
- Otherwise create the `gameStates` row with the passed-in start data, plus default `worldFlags` (`visitedLocations: [startLocationName]`, everything else empty), `inventory.party: []`, `turnIndex: 0`, `turnStage: "player"`.
- Insert the initial `storyHistory` row (the location's description text) and a `"Game Started"` `gameEvents` row.
- **This must always be called with real arguments from `worldGenerator` (Phase 5/7) — there is no hardcoded default dungeon to fall back to in the port.** See Phase 9 for why.

### `processAction({ roomId, userId, actionText })` mutation — the action-resolution state machine
1. Load the room, verify `status === "playing"`; load the `gameStates` row (if missing, **throw** — do not silently re-initialize with defaults, see Phase 9); load the acting player's `characters` row (throw if none or if `currentHealth <= 0`).
2. **Normalize** the action text: lowercase, trim, strip a leading `"i "` / `"we "` / `"the party "`, strip trailing punctuation (`.`/`!`/`?`).
3. **Match the normalized text against these verb groups, in this exact precedence order** (first match wins — this ordering matters, e.g. "attack" must be checked before "use" or a phrase like "use sword to attack" would misfire... though in practice these are simple `startswith` checks in the source, so just preserve the same order):
   1. `inspect` / `look at` / `look around` / `search` — no target or target ∈ {room, area, around, surroundings} → describe the whole scene (list monsters/npcs/objects from `gameState`). Otherwise try to match target against `objects`, then `activeNpcs`, then `activeMonsters` (in that priority) by substring match on name (and NPC `type`), and describe status/HP.
   2. `open ` — match target against `objects`. If `type === "chest"`: if already open, fail; else set `status: "open"`, push items into `inventory.party`, add `gold` to the character, record the chest name into `worldFlags.openedChests`. If `type === "gate"`: requires an item name in `inventory.party` (`requires` field) — if present, consume it, open the gate, unlock `leadsTo`; else fail with "locked, need X".
   3. `attack ` / `fight ` / `kill ` — match against `activeMonsters` first, then `activeNpcs`. **Monster**: `damage = max(1, character.strength + randomInt(1,6) - monster.defense)`, subtract from monster health. If monster dies: remove it from `activeMonsters`, record its name in `worldFlags.killedMonsters`, grant `xp`/`gold` to the character, check level-up (`experience >= level * 100` → level+1, +20 max health/full heal, +10 max mana/full mana, +2 strength, +1 defense, subtract the threshold from experience), and — **only for a monster literally named "goblin warrior"** — also grant a "king's key" item (this is a one-off hardcoded drop tied to the legacy dungeon's quest chain; see Phase 9 on whether to keep it, since "goblin warrior" doesn't exist in the new world_generator's monster roster at all — it's dead in practice, drop it). **NPC**: attacking a friendly NPC lowers `worldFlags.npcRelationships[npcName]` by 20 (floor 0); below 10 flips the NPC's scene status to "hostile".
   4. `talk to ` / `speak to ` / `talk ` / `speak ` — match against `activeNpcs`. Hostile NPCs refuse. Otherwise return their `dialogue` string as the outcome.
   5. `go to ` / `move to ` / `travel to ` / `go ` / `move ` — **always use the DB-driven path** (query `locations` by `roomId`, match target against location names, verify the destination is in the current location's `connectedLocations`, then copy the destination's `weather`/`npcList`/`monsterList` and its `worldObjects` rows into `gameState`'s `weather`/`activeNpcs`/`activeMonsters`/`objects`, add the destination to `worldFlags.visitedLocations`). **Do not port the hardcoded "Dungeon Entrance / Goblin Camp / Hidden Cave / Treasure Chamber" branch or `_load_location_details`** — see Phase 9, this path is unreachable in the real app and doesn't correspond to the actual seeded world at all.
   6. `destroy ` / `break ` / `smash ` — match against `objects`; generically works on any object whose current status isn't already "destroyed" (the source hardcodes this to only work on something literally named "crumbly wall", which again is part of the legacy dungeon — generalize this to work on any `objects` entry rather than a hardcoded name, since the new world has no "crumbly wall").
   7. `use ` / `drink ` / `give ` / `equip ` — this one *is* full of hardcoded item names in the source (`health potion`, `steel sword`, `iron shield`, `amulet of protection`, giving a potion to "Aerith" specifically). Port these item behaviors as generic effects keyed by item name rather than by string-matching giant if/elif chains where possible, but the actual item names/effects (potion heals 50, sword +4 strength, shield +3 defense, amulet +5 defense, Aerith's potion-for-amulet quest exchange) should be preserved since these items really do exist in the new world's loot tables too (moldy chest → health potion; Spine Mountain loot → steel sword; Cryptic Dungeon loot → crypt key; etc. — cross-check every hardcoded item name against `worldGenerator.ts`'s actual loot tables and keep the ones that still exist, drop item interactions for names that were only ever part of the legacy dungeon).
   8. `revive` (exact match) — full heal cheat/debug command. Confirm with the person you're porting for whether to keep this before removing it; it looks like a debug convenience, not a real game feature, but it's cheap to keep.
   9. Anything else → `resolvedStatus: "rejected"` with the generic "I don't understand that action" message.
4. Insert a `playerActions` row with the resolution.
5. **If resolved (`success` or `failed`, not `rejected`)**, run three more phases in the same mutation call (this whole thing is one atomic turn):
   - **Enemy phase**: if `activeMonsters` is non-empty, the *first* monster in the array attacks: `damage = max(1, monster.damage - character.defense)`, subtract from character's `currentHealth` (floor 0). Insert a `"Combat Started"` `gameEvents` row. If health hits 0, insert a `"Player Died"` event.
   - **World phase**: 30% chance to randomly change `weather` to one of Clear/Foggy/Rainy/Stormy. Advance `currentTime` (Morning → Afternoon → Night → next day's Morning). Re-evaluate `currentQuest` — **this quest-chain string-matching in the source (`"Open the Stone Gate"` → `"Defeat the Goblin Warrior..."` → etc.) is entirely part of the legacy hardcoded dungeon and does not correspond to anything in the new world. Do not port this quest chain as-is.** Instead, use a simple, generalizable quest model for the new world: e.g. `currentQuest` starts as something like `"Explore <start location>"` and advances based on generic milestones (all monsters in current location defeated, a specific named object opened, etc.) — design this fresh rather than translating dead string-matching logic. Flag this specific piece to the person you're building for as "redesigned, not ported" since the source logic doesn't transfer.
   - **Reset phase**: `turnStage = "player"`, `turnIndex += 1`.
6. Return the updated `gameStates` row.

### Trigger AI narration from the client, not from inside `processAction`
In the current backend, the HTTP route inlines a call to Gemini after the engine resolves (originally blocking, later fixed to run as a background task — see the earlier fix already applied in `backend/app/api/routes/game.py`, which you should read for why this matters). In Convex, replicate that same "don't block the player" principle using **Convex's scheduler**: after `processAction` commits, call `ctx.scheduler.runAfter(0, internal.ai.generateNarration, { roomId, userId })` to fire the Gemini action asynchronously. The mutation returns immediately with the resolved game state; the frontend's `useQuery` on `storyHistory` will reactively update a moment later when the scheduled action writes the AI's narration — no socket event needed, no manual "push" required, this is the reactive-query pattern replacing `notify_story_generated` entirely.

**Verify**: submit an action via a test script/console, confirm `playerActions`/`gameEvents`/`gameStates` update synchronously, and `storyHistory` gets a new AI-generated row a moment later without any additional client code polling for it.

---

## 9. Do not carry these over (bugs and dead code in the current app)

Found while inventorying the codebase — port around these, don't reproduce them:

1. **Two parallel, inconsistent world/quest systems.** `game_engine.py`'s `initialize_game` default arguments (a hardcoded "Dungeon Entrance / Goblin Camp / Hidden Cave / Treasure Chamber" 4-room dungeon) and its `_load_location_details` method are a **separate, legacy system** from the real one (`world_generator.py`'s 6-location seeded world). In the actual app, `RoomService.start_game` always calls `world_generator` first and passes its real location data into `initialize_game`, so the legacy hardcoded dungeon is normally unreachable. **However**, `GameEngine.process_action`'s "auto-initialize if GameState is somehow missing" fallback calls `initialize_game(session, room_id)` with **no arguments**, which *would* silently drop a player into the wrong, legacy dungeon instead of the real seeded world if that fallback ever fired. Port only the real (world_generator-driven) system; make the "GameState missing" case in `processAction` throw an error instead of silently falling back to anything, since it should never legitimately happen once a room has started.
2. **`backend/app/ai/test_ai_dm.py`** currently tests the legacy hardcoded dungeon (its assertions check for "iron key" and gold==150 from opening a "wooden chest" that only exists in the legacy defaults) — it is not actually testing the real game flow. Don't use it as a behavioral reference for the real world system; write new smoke tests against the real `worldGenerator`-seeded world instead.
3. **Duplicated class stats table.** `backend/app/api/routes/rooms.py`'s inline `CLASS_STARTING_STATS` dict and `frontend/components/game/character-creation.tsx`'s `CLASS_PRESETS` are two hand-kept-in-sync copies of the same data. In the ported app, both frontend and "backend" are TypeScript in the same deploy — put this table once in `convex/lib/classPresets.ts` and import it from both the character-creation mutation and the frontend UI. Exact values (preserve precisely):
   ```typescript
   export const CLASS_STARTING_STATS = {
     Warrior: { health: 140, mana: 20,  strength: 16, intelligence: 6,  agility: 8,  defense: 12, luck: 8,  gold: 100 },
     Mage:    { health: 80,  mana: 150, strength: 6,  intelligence: 18, agility: 9,  defense: 6,  luck: 10, gold: 120 },
     Archer:  { health: 100, mana: 40,  strength: 10, intelligence: 10, agility: 16, defense: 8,  luck: 14, gold: 90  },
     Rogue:   { health: 90,  mana: 30,  strength: 9,  intelligence: 8,  agility: 18, defense: 7,  luck: 16, gold: 150 },
     Healer:  { health: 110, mana: 100, strength: 8,  intelligence: 12, agility: 10, defense: 9,  luck: 14, gold: 110 },
   } as const;
   ```
4. **The "goblin warrior" special drop** (attacking and killing a monster literally named "goblin warrior" grants a "king's key") only makes sense in the legacy dungeon's monster roster — the new `worldGenerator` world has no monster by that name. Drop this special case.
5. **`backend/app/services/game_service.py`** (`GameService.build_action_prompt`) is dead code — nothing calls it. Don't port it.
6. **`GameHistoryResponse` schema** (`backend/app/schemas/game.py`) is defined but no route returns it — don't port a corresponding query unless the frontend rebuild (Phase 10) actually needs a combined actions+events+story feed, in which case build it fresh to match what the new UI needs.
7. **Duplicate/uncertain socket event names.** The waiting-room page listens for both `room:character_created` and bare `character_created` (and the same doubled pattern for `character_updated`), suggesting the original author wasn't sure what the server emitted. This entire category of problem disappears with Convex's reactive queries — there are no event names to get right or wrong.
8. **Dead frontend types**: `frontend/types/game.ts`'s `PartyMember` and `StoryEntry` interfaces are unused placeholders. Design real types for the new in-game UI (Phase 10) rather than reusing these names blindly — check whether their shape actually matches what you need.
9. **`AuthenticationStateMiddleware`** and the whole custom-JWT decode-on-every-request pattern is superseded entirely by Convex Auth (Phase 3) — nothing to port.

---

## 10. Phase 7 — NPC system (`convex/npcs.ts`, `convex/ai.ts`)

Read `backend/app/api/routes/npc_routes.py` for the exact prompt text and response schema.

- `npcs:list({ roomId })` query — all `npcs` for the room, ordered by name.
- `npcs:get({ npcId })` query — one NPC plus its last 20 `npcMemories` (chronological).
- `ai:talkToNpc({ roomId, npcId, message })` — must be an **action** (calls Gemini), not a mutation, since actions are Convex's only function type allowed to make external HTTP calls. Structure: the action reads what it needs via `ctx.runQuery`, calls Gemini with the same structured-output schema as the source (`dialogue`, `emotion`, `reactionType`, `relationshipChange: -15..15`, `rumor` — note: `rumor` is generated but never used anywhere in the original either; keep persisting it this time into the `npcMemories` row or a new field instead of discarding it, since there's no reason to throw away data you're already paying to generate), then calls `ctx.runMutation` to: clamp and update `npc.relationships[characterName]` (0-100), update `npc.mood`, insert a new `npcMemories` row, insert a `storyHistory` row summarizing the exchange. On Gemini failure (2 attempts, same retry-once pattern as `convex/ai.ts`'s narration action below), fall back to the canned neutral line from the source.
- Keep the two NPC systems conceptually separate as documented in the inventory: `npcs` table = real, chat-able, mutable. `locations.npcList`/`buildings.npcList` = static flavor-text arrays, never touched by the talk action.

---

## 11. Phase 8 — Gemini narration action (`convex/ai.ts`, `convex/promptBuilder.ts`)

Port `backend/app/ai/gemini_service.py` and `backend/app/ai/prompt_builder.py`:

- `promptBuilder.ts`: pure function `renderDungeonMasterPrompt(input): string` — same template structure as the Python `DungeonMasterPrompt.render()` (location/time/weather/quest header, players, party inventory, active NPCs/monsters/objects, world flags, recent events, story history, last action + engine outcome, the same "DO NOT CALCULATE GAME RULES" instruction block). Straightforward string-template port, no logic to redesign.
- `ai.ts`: an **internal action** `generateNarration({ roomId, userId })` (the scheduled function referenced in Phase 6):
  1. `ctx.runQuery` to gather context: the `gameStates` row, the latest `playerActions` row, last 10 `gameEvents`, last 15 `storyHistory` entries, all `characters` in the room — mirror `context_service.py`'s queries exactly (same limits: 10 events, 15 story entries).
  2. Build the fallback narration string exactly as the source does (deterministic sentence built from the action/outcome/events — this is what displays if Gemini fails, so it needs to actually make sense on its own).
  3. Call `@google/genai`'s equivalent of the async client: `ai.models.generateContent({ model: "gemini-2.0-flash", contents: promptText, config: { responseMimeType: "application/json", responseSchema: <same schema>, temperature: 0.7 } })`. Wrap in a timeout (the Python side now uses `asyncio.wait_for(..., 20)` — use `Promise.race` with a 20s timeout here for parity) and retry once on failure, no artificial delay between attempts (this was a deliberate recent fix on the Python side — don't reintroduce a `sleep`).
  4. On success, `ctx.runMutation` to insert the `storyHistory` row with the AI's story text.
  5. On exhausted failure, insert the deterministic fallback narration instead, so the player always gets *something*.
- **`GEMINI_API_KEY`** goes into Convex's environment variables (`npx convex env set GEMINI_API_KEY ...`), not a `.env` file read by the function — Convex actions read `process.env` the same way, but the value is managed via the Convex dashboard/CLI, not a local dotenv.

**Verify**: trigger an action, confirm `storyHistory` gets an AI-written entry within a couple of seconds; then set a garbage API key via `npx convex env set` and confirm the fallback narration path fires instead of the whole action throwing unhandled.

---

## 12. Phase 9 — Frontend data-layer rewrite

Every page/component that currently calls `services/*.ts` (raw `fetch`) or listens to `socket/client.ts` gets rewritten to use `convex/react`'s `useQuery(api.x.y, args)` / `useMutation(api.x.y)` / `useAction(api.x.y)`.

- Delete `frontend/services/api.ts`, `auth.ts`, `characters.ts`, `rooms.ts` and `frontend/socket/client.ts` entirely.
- `frontend/app/providers.tsx`: replace `QueryClientProvider` (TanStack Query — confirmed unused for actual queries anywhere in the current app, only used for two `useMutation` calls on the auth forms, which Convex Auth's own hooks replace anyway) with `ConvexAuthNextjsProvider` (or `ConvexProvider` wrapping `ConvexAuthProvider`, per whatever `@convex-dev/auth`'s current Next.js integration docs specify).
- `frontend/app/rooms/[code]/page.tsx` (waiting room): replace the `fetchRoom` + manual socket-listener `useEffect` block with a single `useQuery(api.rooms.getByCode, { code })` — delete every `socket.on(...)` handler, they're no longer needed. Mutations (ready toggle, kick, transfer, start, leave, delete) become `useMutation` calls.
- `frontend/components/game/character-creation.tsx`: submit becomes a `useMutation(api.characters.create)` call; import `CLASS_STARTING_STATS` from the shared `convex/lib/classPresets.ts` instead of keeping a local `CLASS_PRESETS` copy (see Phase 9's dedup note above).

---

## 13. Phase 10 — Build the missing in-game screen (new work, not a port)

**Important**: the current frontend has *no gameplay UI at all*. `rooms/[code]/page.tsx` only handles the waiting-room/lobby flow; once `room.status === "playing"` it shows a static "Game in Progress" placeholder box and nothing else. There is no action-input box, no story feed, no NPC-talk UI, no map/travel UI, no inventory/quest display anywhere in the current app, despite the backend fully supporting all of it. A straight "port" of the frontend as it exists today would produce an equally unplayable app on the new stack. **Build this now, since you're already touching every page.**

Create `frontend/app/rooms/[code]/play/page.tsx`, shown once `room.status === "playing"`. Minimum viable scope:
- **Story feed**: `useQuery(api.story.list, { roomId })`, rendered newest-at-bottom, auto-scrolling — this is the reactive payoff of the whole migration, it updates live as `generateNarration` (Phase 8) writes new rows, no polling, no socket code.
- **Action input**: a text box + submit calling `useMutation(api.gameEngine.processAction)` with the room/character/action text. Disable while a submission is in flight; show the immediate engine outcome (returned synchronously from the mutation) even before the AI narration arrives a moment later via the reactive story feed.
- **Scene panel**: render `gameState.activeNpcs` / `activeMonsters` / `objects` from `useQuery(api.gameStates.get, { roomId })` so players can see what's actually inspectable/attackable without guessing.
- **NPC talk**: a simple modal/panel per NPC in `activeNpcs`/`npcs:list`, textbox → `useAction(api.ai.talkToNpc)`, rendering `npcMemories` history reactively.
- **Character HUD**: HP/MP/gold/level bar from `useQuery(api.characters.get, { roomId })`.
- **Travel**: a list of `connectedLocations` for the current location with a "travel here" button that submits `"go to <name>"` through the same `processAction` mutation (no separate travel endpoint needed — the engine already handles "go to" as an action).

Keep this intentionally minimal/functional first — polish later. The point of this phase is that the ported app is actually playable end to end, not just architecturally migrated.

---

## 14. Phase 11 — Cleanup and deployment

1. Confirm parity: create a room, start a game, submit a handful of actions covering each verb group (inspect/open/attack/talk/go/destroy/use), talk to an NPC, confirm level-up fires, confirm a player death fires, confirm the AI narration and fallback-on-failure both work.
2. Delete `backend/` entirely, and the root `package.json`'s workspace reference to it.
3. Update `docs/ARCHITECTURE.md` and `infra/deployment.md` to describe the Convex + Next.js/Vercel architecture (remove all Render/Supabase/Alembic/Socket.IO references).
4. Deploy: `npx convex deploy` (production Convex deployment) + existing Vercel project for the frontend, pointed at the production Convex deployment URL via `NEXT_PUBLIC_CONVEX_URL`.
5. Cancel/downgrade the Render service and Supabase project once the new stack is confirmed working in production — don't leave them running as an unused cost.

---

## Appendix — quick reference while porting

- Combat damage (player→monster): `max(1, character.strength + randomInt(1,6) - monster.defense)`
- Combat damage (monster→player, "enemy phase"): `max(1, monster.damage - character.defense)`
- Level-up threshold: `experience >= level * 100`; on level up: `level += 1`, `experience -= level_before * 100`, `health += 20` (and fully heal), `mana += 10` (and fully restore), `strength += 2`, `defense += 1`.
- NPC relationship range: 0–100, default 50 if unset; attacking an NPC: `-20` (floor 0), below 10 → hostile.
- Weather pool: `["Clear", "Foggy", "Rainy", "Stormy"]`, 30% chance to change per resolved turn.
- Time cycle: `Morning → Afternoon → Night → (day+1) Morning`.
