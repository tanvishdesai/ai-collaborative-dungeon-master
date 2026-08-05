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
npx convex env set AI_PROVIDER nvidia --prod          # or gemini
npx convex env set NVIDIA_API_KEY "<key>" --prod
npx convex env set GEMINI_API_KEY "<key>" --prod      # optional fallback
npx convex env set NVIDIA_MODEL "z-ai/glm-5.2" --prod
npx convex env set SITE_URL "https://your-vercel-domain.vercel.app" --prod
```

`AI_PROVIDER` picks the primary model host. If that call fails (e.g. Gemini rate limit), the other provider is tried automatically when its key is present.

Convex Auth JWT keys (`JWT_PRIVATE_KEY`, `JWKS`) are managed per deployment via `npx @convex-dev/auth` (run against prod if needed).

## Local development

```bash
cd frontend
npm install
npx convex dev --once   # or keep watching
npm run dev:all         # convex + next together
```

Dashboard: https://dashboard.convex.dev/t/tanvishdesai-05/ai-collaborative-dungeon-master
