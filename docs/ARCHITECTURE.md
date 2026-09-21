# Architecture

A Next.js frontend with a Convex backend (functions + database + scheduling). Convex Auth handles
sessions. Real-time UI updates come from Convex reactive queries — there is no Socket.IO layer.

## The core idea

The system is a **hybrid**: a deterministic engine owns authoritative state and flow, and the LLM is
confined to producing natural-language questions, prompts, and feedback. The LLM **never** decides
whose turn it is, advances a stage, or mutates canonical state — that removes the state-hallucination
failure mode of pure-LLM interactive systems and makes every session objectively measurable.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) on Vercel |
| Backend | Convex queries / mutations / actions |
| Database | Convex document DB (`frontend/convex/schema.ts`) |
| Auth | `@convex-dev/auth` Password provider |
| AI | Google Gemini (+ Groq / NVIDIA fallbacks) via Convex Node actions |
| Realtime | Built-in `useQuery` subscriptions |

## Frontend (`frontend/`)

- `app/` — routes: `auth/`, `/` (dashboard), `rooms/[code]` (lobby), `rooms/[code]/play` (session + report), `rooms/join`
- `components/game/` — `dashboard` (create/join), `profile-setup`
- `hooks/use-auth.tsx` — Convex Auth wrapper
- `convex/` — all backend functions and schema (codegen in `convex/_generated`)

## Convex modules (`frontend/convex/`)

- `auth.ts` / `users.ts` — signup/login and profile
- `sessions.ts` — session lifecycle: create, join, ready, start, host controls
- `profiles.ts` — per-session participant profile (name, target role, experience, background)
- `personas.ts` — the AI interviewer panel / GD moderator (seeded per session)
- `scenarioSeeder.ts` — seeds personas from `lib/rolePresets` when a session starts
- `sessionEngine.ts` — **deterministic engine**: turn/stage advance, difficulty escalation, scoring
  triggers, report persistence, finalization
- `ai.ts` + `aiHelpers.ts` + `promptBuilder.ts` — LLM question/prompt and feedback-report generation
- `transcript.ts` / `reports.ts` — read models for the live transcript and feedback reports
- `lib/rolePresets.ts` — target roles, personas, rubrics, difficulty presets

## Data model (key tables)

`sessions`, `participants`, `profiles`, `personas`, `personaMemories` (per-participant memory that
lets an interviewer probe earlier answers), `sessionState`, `transcript`, `responses`,
`feedbackReports`. See `schema.ts`.

## Data flow

1. Host creates a session (mode, role/topic, difficulty, question count) and participants join.
2. Everyone sets up a profile; host starts → `scenarioSeeder.seedPersonas` + `sessionEngine.initializeSession`.
3. `ai.generateQuestion` (scheduled action) builds a prompt from the persona, the candidate profile,
   the recent transcript, and the persona's memory → the LLM returns the next question →
   `sessionEngine.applyGeneratedQuestion` writes it and opens the turn.
4. A participant calls `sessionEngine.submitAnswer`. The engine records the answer, stores it in the
   persona's memory, then **deterministically** advances (next question / next round / finish),
   escalates difficulty, and schedules the next AI step.
5. On completion, `ai.generateFeedback` scores each participant against the rubric and writes a
   `feedbackReports` row; `sessionEngine.finalizeSession` marks the session complete.
6. Clients subscribed to `transcript.list` / `sessionEngine.get` / `reports.list` update automatically.
