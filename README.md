# Abhyaas — AI Placement Practice

A real-time, multi-participant practice simulator for **campus placement panel interviews** and
**group discussions**, guided by AI personas that remember and probe your answers — and produce a
scored feedback report. Built on **Next.js + Convex**.

> **Why:** the two rounds that decide placements — panel interviews and group discussions — are the
> ones students can't practise realistically, because both need multiple participants and existing
> AI tools are single-player. See [`docs/PROJECT_REDEFINITION.md`](docs/PROJECT_REDEFINITION.md) for
> the full problem statement, stakeholders, objectives, literature survey, and evaluation plan.

## Features

- **Panel Interview mode** — one candidate faces a panel of AI interviewers (HR Manager, Technical
  Lead, Senior Manager) that ask role-specific questions, **follow up on your earlier answers**, and
  escalate difficulty as the session progresses. Peers can join to observe live.
- **Group Discussion mode** — multiple participants discuss a topic under an AI moderator; each gets
  an individual scored report.
- **Scored feedback report** — per-competency scores (1–5) with justifications, strengths, areas to
  improve, and **objective engine-computed metrics** (answers given, competency coverage, average
  answer length) that a pure-LLM tool can't produce.
- Real-time multiplayer via Convex reactive queries (no Socket.IO).
- Convex Auth (email + password).

## Architecture in one line

A **deterministic session engine** owns all state and flow (whose turn, which stage, difficulty,
scoring); the **LLM is confined to writing questions, prompts, and feedback prose** and never mutates
canonical state — so outputs stay consistent and objectively measurable. Details:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend:** Convex (schema, queries, mutations, actions, scheduling)
- **Auth:** `@convex-dev/auth` Password provider
- **AI:** Google Gemini (with Groq / NVIDIA fallbacks) inside Convex Node actions

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

Set the AI key on the Convex deployment (not only in `.env.local`):

```bash
cd frontend
npx convex env set GEMINI_API_KEY "<your-key>"
```

## Test account

A shared test login exists on both the dev and prod deployments:

- **Email:** `test@example.com`
- **Password:** `TestPass123`

## Deploy

See [`infra/deployment.md`](infra/deployment.md).
