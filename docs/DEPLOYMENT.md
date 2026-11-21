# Deployment and email setup

How it works once set up:

| Event | What runs (`.github/workflows/ci-cd.yml`) |
| --- | --- |
| Any PR or push to `main` | Lint, typecheck, tests, build |
| PR from this repo | Vercel **Preview** deploy; the URL appears in the job summary |
| Merge/push to `main` | Production DB migrations, then Vercel **Production** deploy |

Vercel's own Git auto-deploy is turned off (`vercel.json` → `git.deploymentEnabled: false`), so nothing deploys unless the checks pass.

Do the steps in order. Each takes a few minutes.

---

## 1. Create the Vercel project

1. Go to <https://vercel.com/new>, import `PranavD2905/sahara-santa`, and keep the defaults (framework: Next.js).
   The first deploy may fail because of missing env vars. That's fine.
2. Install the CLI and link this folder, which prints the IDs you need in step 4:
   ```bash
   npm i -g vercel
   vercel login
   vercel link          # choose the sahara-santa project
   cat .vercel/project.json   # → "orgId" and "projectId"
   ```

## 2. Database: Neon

1. In the Vercel project, open **Storage → Marketplace → Neon → Add** and connect it to the project.
   This sets `DATABASE_URL` for Production and Preview.
2. Recommended: in the Neon integration settings, enable **a separate branch for Preview deployments**, so PRs never touch production data.
   Once Preview has its own database, set the GitHub repo variable `MIGRATE_PREVIEW_DB` to `true` (see step 4) so previews get migrated too.

## 3. Pictures: Vercel Blob (private)

**Storage → Create → Blob**, choose **Private** access, and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`.

## 4. GitHub secrets for the workflow

1. Create a token at <https://vercel.com/account/tokens> (scope: your team or account).
2. In GitHub, open **Repo → Settings → Secrets and variables → Actions → New repository secret** and add:

   | Secret | Value |
   | --- | --- |
   | `VERCEL_TOKEN` | the token from step 1 |
   | `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
   | `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |

3. Optional: on the **Variables** tab, add `MIGRATE_PREVIEW_DB` = `true`, but only after step 2.2.
4. Optional but recommended: under **Settings → Branches**, add a rule for `main` that requires the **Lint, typecheck, test, build** check to pass.

## 5. Email (Resend): verification, password reset, invites, Draw

All emails are already wired up:

- **Create account:** verification email via Better Auth `emailVerification.sendVerificationEmail`. Users can't sign in until they verify.
- **Forgot password:** reset email via Better Auth `emailAndPassword.sendResetPassword`.
- **Invite by email:** sent by the Organizer from the Group or Invite page.
- **Draw, Re-draw, and "your person changed":** sent automatically.

They all go through `src/lib/email.ts`, which uses Resend. To turn them on:

1. Sign up at <https://resend.com>.
2. **Domains → Add Domain**: use a domain you own, ideally a subdomain such as `mail.yourdomain.com`.
   Add the DNS records Resend shows (SPF, DKIM, and optionally DMARC) at your registrar, then wait for **Verified**.
   Without a verified domain, Resend only delivers to the email you signed up with.
3. **API Keys → Create API Key** with "Sending access" restricted to that domain, then copy the key (`re_…`).
4. Add the env vars below in step 6.

## 6. Vercel environment variables

Go to **Project → Settings → Environment Variables**:

| Name | Production | Preview | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | set by Neon | set by Neon | step 2 |
| `BLOB_READ_WRITE_TOKEN` | set by Blob | set by Blob | step 3 |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | a **different** random value | signs sessions |
| `BETTER_AUTH_URL` | `https://your-domain` | **leave unset** | previews then use their own URL for auth and email links |
| `RESEND_API_KEY` | `re_…` | `re_…` (optional) | without it, emails are only logged |
| `EMAIL_FROM` | `Sahara Santa <noreply@mail.yourdomain.com>` | same | must be on the verified domain |

Changing env vars only affects new deployments, so redeploy afterwards: push to `main`, or re-run the workflow.

## 7. First production deploy

Merge the PR into `main`. The workflow runs the checks, then `drizzle-kit migrate` against the production database, then deploys.
To check it worked: sign up on the live site, get the verification email, sign in, create a Group, and send yourself an invite.

## Troubleshooting

- **Workflow says "Project not found":** check `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`, and that the token can access that team.
- **No emails arrive:** check Resend → **Logs**. "Domain not verified" means fix the DNS records; also check `EMAIL_FROM` uses that domain.
- **Verification link goes to the wrong site:** check `BETTER_AUTH_URL` for Production.
- **Pictures fail to upload:** the Blob store must be **Private** and connected to the project (`BLOB_READ_WRITE_TOKEN`).
