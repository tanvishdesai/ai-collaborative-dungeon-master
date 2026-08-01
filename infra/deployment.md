# Deployment Notes

## Frontend (Vercel)

Deploy the `frontend/` directory.

Required environment variables on Vercel:

- `NEXT_PUBLIC_CONVEX_URL` — production Convex deployment URL
- `NEXT_PUBLIC_CONVEX_SITE_URL` — Convex HTTP actions URL (`.convex.site`)

## Backend (Convex)

From `frontend/`:

```bash
npx convex deploy
```

Set production env vars:

```bash
npx convex env set GEMINI_API_KEY "<key>" --prod
npx convex env set SITE_URL "https://your-vercel-domain.vercel.app" --prod
```

Convex Auth JWT keys (`JWT_PRIVATE_KEY`, `JWKS`) are managed per deployment via `npx @convex-dev/auth` (run against prod if needed).

## Local development

```bash
cd frontend
npm install
npx convex dev --once   # or keep watching
npm run dev:all         # convex + next together
```

Dashboard: https://dashboard.convex.dev/t/tanvishdesai-05/ai-collaborative-dungeon-master
