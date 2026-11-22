# Sahara Santa

Secret Santa web app: sign up, join a Group by invite link, and let the Draw assign who gives to whom.
Scope: `docs/V1-SCOPE.md` · Vocabulary: `GLOSSARY.md` · Decisions: `docs/adr/`.

Stack: Next.js 16 · Neon Postgres + Drizzle · Better Auth (username + password, no email) · Vercel Blob (private).

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

There is no email: sign up with a username. Without `BLOB_READ_WRITE_TOKEN`, pictures go to `./.data/uploads`.

The global music slot is `public/audio/background.mp3`. This file is pending. It will loop on all screens except Reveal. If the browser blocks autoplay, the first click or tap starts the music. "Socha Hai" uses `public/audio/reveal-song.mp3` and starts as the chosen card begins to flip.

A picture and bio are required to complete a profile. An organizer-provided group picture also qualifies for that group. After users save their profile, the app returns them to their destination. Draw requires a picture for every participant. Cards use the organizer's group picture or the user's profile picture.

Signed-in screens check for changes every three seconds and update without a page reload. Updates pause during form edits, confirmations, and Reveal. Hidden or offline tabs pause these requests.

## Deploy (Vercel)

1. Import the repo in Vercel; add Neon from the Marketplace (sets `DATABASE_URL`).
2. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (production URL); add a private Blob store (sets `BLOB_READ_WRITE_TOKEN`). Full guide: `docs/DEPLOYMENT.md`.
3. Run `npm run db:migrate` against the Neon URL once.

## Checks

`npm test` (Draw logic + DB integration on PGlite) · `npm run typecheck` · `npm run lint` · `npm run build`

## Contributors

- **Pranav Deshpande** ([@PranavD2905](https://github.com/PranavD2905)): domain model, Draw logic, auth, Groups, deployment.
- **Vedansh Vaidya**: frontend, including the tarot Reveal experience (`feature/frontend`, PR #5).
