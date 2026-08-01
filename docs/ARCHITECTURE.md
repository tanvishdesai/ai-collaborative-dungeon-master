# Architecture

The application is a Next.js frontend with a Convex backend (functions + database + scheduling). Convex Auth handles sessions. Real-time UI updates come from Convex reactive queries — there is no Socket.IO layer.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) on Vercel |
| Backend | Convex queries / mutations / actions |
| Database | Convex document DB (`frontend/convex/schema.ts`) |
| Auth | `@convex-dev/auth` Password provider |
| AI | Google Gemini (`gemini-2.0-flash`) via Convex Node actions |
| Realtime | Built-in `useQuery` subscriptions |

## Frontend (`frontend/`)

- `app/`: routes (auth, dashboard, rooms, play)
- `components/`: UI and game components
- `hooks/use-auth.tsx`: Convex Auth wrapper
- `convex/`: all backend functions and schema (codegen in `convex/_generated`)

## Convex modules (`frontend/convex/`)

- `auth.ts` / `users.ts`: signup/login and profile
- `rooms.ts` / `characters.ts`: lobby and character creation
- `worldGenerator.ts`: Forgotten Vale seed data
- `gameEngine.ts`: action-resolution state machine
- `ai.ts` + `aiHelpers.ts` + `promptBuilder.ts`: Gemini narration and NPC talk
- `npcs.ts` / `story.ts` / `locations.ts`: supporting queries

## Data flow

1. Players create/join a room and create characters.
2. Host starts the game → world seed + game state init.
3. Players submit actions → `gameEngine.processAction` resolves rules atomically.
4. Narration is scheduled via `ctx.scheduler.runAfter(0, internal.ai.generateNarration)`.
5. Clients subscribed to `story.list` / `gameEngine.get` update automatically.
