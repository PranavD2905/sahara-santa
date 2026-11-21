#!/bin/sh
# Vercel build command (see vercel.json). Runs on Vercel's build servers,
# where Secret env vars like DATABASE_URL are available (they can't be
# pulled into GitHub Actions). Migrates Production before building;
# Preview only when it has its own database (MIGRATE_PREVIEW_DB=true).
set -e
if [ "$VERCEL_ENV" = "production" ] || [ "$MIGRATE_PREVIEW_DB" = "true" ]; then
  echo "Applying database migrations ($VERCEL_ENV)..."
  npx drizzle-kit migrate
fi
npx next build
