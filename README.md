# AI Collaborative Dungeon Master

A real-time multiplayer fantasy storytelling game guided by an AI Dungeon Master (Google Gemini), built on **Next.js + Convex**.

## Features

- Real-time multiplayer lobbies via Convex reactive queries (no Socket.IO)
- AI Dungeon Master narration with Gemini (`gemini-2.0-flash`)
- Seeded Vismrit Ghati (the Forgotten Valley) — an Indian mythological world of 6 locations, NPCs, buildings, and objects
- Character classes, combat, travel, inventory, and NPC conversation
- Convex Auth (email + password)

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend:** Convex (schema, mutations, actions, scheduling)
- **Auth:** `@convex-dev/auth` Password provider
- **AI:** `@google/genai` inside Convex Node actions

## Local development

```bash
npm install
cd frontend
npx convex dev --once   # links/pushes to your Convex deployment
npm run dev:all         # Convex watcher + Next.js on :3000
```

Environment (created by Convex CLI in `frontend/.env.local`):

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `CONVEX_DEPLOYMENT`

Set the Gemini key on the Convex deployment (not only in `.env.local`):

```bash
cd frontend
npx convex env set GEMINI_API_KEY "<your-key>"
```

## Test account

A shared test login exists on both the dev and prod deployments:

- **Email:** `test@example.com`
- **Password:** `TestPass123`

## Deploy

See [`infra/deployment.md`](infra/deployment.md). Architecture overview: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
