# Sahara Santa

Secret Santa web app: sign up, join a Group by invite link, and let the Draw assign who gives to whom.
Scope: `docs/V1-SCOPE.md` · Vocabulary: `GLOSSARY.md` · Decisions: `docs/adr/`.

Stack: Next.js 16 · Neon Postgres + Drizzle · Better Auth (email + password, verified) · Resend · Vercel Blob (private) · iTunes previews.

## Run locally (no accounts needed)

```bash
npm install
npm run db:local          # terminal 1: PGlite as a Postgres server on :5433
cp .env.example .env.local
# .env.local: DATABASE_URL=postgres://postgres@localhost:5433/postgres
#             BETTER_AUTH_SECRET=$(openssl rand -base64 32)
DATABASE_URL=postgres://postgres@localhost:5433/postgres npm run db:migrate
npm run dev               # terminal 2
```

Without `RESEND_API_KEY`, emails (verification, Draw) print in the dev server console. Without `BLOB_READ_WRITE_TOKEN`, pictures go to `./.data/uploads`.

## Deploy (Vercel)

1. Import the repo in Vercel; add Neon from the Marketplace (sets `DATABASE_URL`).
2. Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (production URL), `RESEND_API_KEY`, `EMAIL_FROM` (verified domain); add a private Blob store (sets `BLOB_READ_WRITE_TOKEN`).
3. Run `npm run db:migrate` against the Neon URL once.

## Checks

`npm test` (Draw logic + DB integration on PGlite) · `npm run typecheck` · `npm run lint` · `npm run build`
