# Sahara Santa: v1 scope

Vocabulary is defined in `GLOSSARY.md`. Decisions with trade-offs are in `docs/adr/`.
Answers you did not change during the design interview were taken as accepted.

## Stack

- Next.js on Vercel (GitHub → Vercel previews, `main` is production)
- Neon Postgres via the Vercel Marketplace
- Better Auth: email + password with email verification and password reset; rate-limited login and reset
- Resend for email (test sender in development; a verified custom domain before real users)
- Vercel Blob for Profile Pictures (direct client upload)
- iTunes Search API for Songs (see ADR 0003)
- Responsive web, laptop-first, then mobile. **Functional-first, basic UI.** Polish (the warm desert theme) comes after the functionality works.

## Accounts and Profile

- A verified email is required to create or join a Group and to upload a Profile Picture.
- Display name is required.
- Profile Picture is optional (initials by default). Instagram-style crop with pan and zoom, stored as a 512×512 WebP, shown as a circle. JPG, PNG or WebP up to 5 MB. EXIF is stripped, and the old file is deleted on replace or account deletion.
- Bio is up to 150 characters of plain text.
- Song is optional and global to the Profile. It is hidden from everyone until the Draw, then only the Santa hears it, and the owner sees their own. Tap to play a 30-second preview, no autoplay, with an "E" badge for explicit tracks.
- Pictures are served only to signed-in users who share a Group with that person.

## Groups

- One Organizer per Group, who participates by default (opt-out possible). Ownership can be transferred.
- The Organizer must transfer ownership or delete the Group before leaving or deleting their account. Deleting a Group needs a typed-name confirmation.
- Limits: 3–50 Members per Group (3 minimum to Draw), 10 Groups created per user, unlimited Groups joined.
- Join via Invite Link or short code. Joining requires sign-in and a verified email. The Organizer can reset the link and remove Members.
- Budget: one min–max range per Group in INR, USD, EUR or GBP (default INR), not enforced.
- Exchange Date is optional until the Draw, required before it, and editable after.
- Lifecycle: Open → Joining Closed (manual, Organizer's choice) → Drawn → Archived (read-only 30 days after the Exchange Date, deleted after 1 year).
- Organizer Overrides: the Organizer can replace a Member's Profile Picture or hide their Bio inside that Group only. The Member sees that an Override is in place. There is no Song override.

## Draw

- Two separate steps: the Organizer closes joining, adds Exclusions, then clicks Draw.
- The Draw is a single loop through all Members that respects Exclusions (ADR 0001). It is blocked with a clear message if Exclusions make it impossible.
- The Organizer never sees Assignments (ADR 0002).
- Reveal: a Member taps "Reveal my person", then can view their receiver's card any time. The card shows picture, name, bio and the song player. A Member can't re-roll their own Assignment.
- Organizer dashboard: Members, Joining toggle, Exclusions editor, Draw, Re-draw, Invite Link reset, ownership transfer, and "revealed / not yet revealed" per Member.
- Re-draw is allowed before the Exchange Date.

## Leaving after the Draw

- Leaving or removal triggers a Patch: the leaver's Santa takes over the leaver's receiver. If the Patch breaks an Exclusion, the Organizer is prompted to Re-draw.
- If a Group drops to 2 Members it still works as a swap, with a warning. At 1 Member the Group returns to pre-Draw and all Assignments are cleared.

## Email

Only three kinds, besides verification and password reset: **Draw done**, **Re-draw**, and **your receiver changed** (sent only to the affected Santa after a Patch). Nothing else is emailed. Date or Budget changes get an in-app notice only.

## Privacy and data

- Account deletion removes the person's data, running a Patch if a Draw is active.
- App-level Assignment privacy only. The FAQ says plainly that the developer can read the database.

## Explicitly out of scope for v1

Wishlists, anonymous chat, reminders, member-joined emails, report buttons, automated image scanning, song override, co-Organizers, public Group discovery, native apps, assignment encryption, and the visual theme.

## Quality bar

- The Draw logic (single loop, Exclusions, Patch) gets thorough unit tests, including property-style tests over random Groups and Exclusion sets, before the features around it.
- A few end-to-end tests cover sign up → join → Draw → Reveal.

## Before launch

- Buy and verify a sending domain in Resend.
- Re-check the iTunes preview terms.
- Write the FAQ, including the privacy statement.
