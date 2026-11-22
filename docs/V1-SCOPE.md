# Sahara Santa: v1 scope

Vocabulary is defined in `GLOSSARY.md`. Decisions with trade-offs are in `docs/adr/`.
Answers you did not change during the design interview were taken as accepted.

## Stack

- Next.js on Vercel (GitHub → Vercel previews, `main` is production)
- Neon Postgres via the Vercel Marketplace
- Better Auth: **username + password**, no email at all (ADR 0004); rate-limited sign-in and sign-up
- Vercel Blob for Profile Pictures (direct client upload)
- Global music slot (`public/audio/background.mp3`, file pending), paused on Reveal. "Socha Hai" (`public/audio/reveal-song.mp3`) starts as the chosen card begins to flip. Recorded card effects accompany the animation.
- Responsive web, laptop-first, then mobile. **Functional-first, basic UI.** Polish (the warm desert theme) comes after the functionality works.

## Accounts and Profile

- Sign up with a display name, a username (3–30 letters, numbers, dots or underscores; case-insensitive) and a password (8+ characters). No email, no verification.
- Forgotten password: the Group's Organizer sets a temporary password for that Member in Group Settings (signs them out everywhere).
- A picture is required for profile completion and Draw. An organizer-provided group picture qualifies for that group. The uploader supports crop and zoom, with storage as a 512×512 WebP. JPG, PNG or WebP up to 5 MB. EXIF is stripped, and the old file is deleted on replace or account deletion.
- Bio is required and contains 1–150 characters of plain text. Users must complete their profile before they enter groups.
- Pictures are served only to signed-in users who share a Group with that person.

## Groups

- One Organizer per Group, who participates by default (opt-out possible). Ownership can be transferred.
- The Organizer must transfer ownership or delete the Group before leaving or deleting their account. Deleting a Group needs a typed-name confirmation.
- Limits: 3–50 Members per Group (3 minimum to Draw), 10 Groups created per user, unlimited Groups joined.
- Every participant needs a profile picture or an organizer-provided group picture before Draw or Re-draw. Reveal cards use that picture.
- Signed-in screens update automatically within three seconds of a change. Form edits, confirmations, hidden tabs, and Reveal pause automatic updates.
- Join via Invite Link or short code. Joining requires signing in. The Organizer can reset the link and remove Members.
- Budget: one min–max range per Group in INR, USD, EUR or GBP (default INR), not enforced.
- Exchange Date is optional until the Draw, required before it, and editable after.
- Lifecycle: Open → Joining Closed (manual, Organizer's choice) → Drawn → Archived (read-only 30 days after the Exchange Date, deleted after 1 year).
- Organizer Overrides: the Organizer can replace a Member's Profile Picture or hide their Bio inside that Group only. The Member sees that an Override is in place.

## Draw

- Two separate steps: the Organizer closes joining, adds Exclusions, then clicks Draw.
- The Draw is a single loop through all Members that respects Exclusions (ADR 0001). It is blocked with a clear message if Exclusions make it impossible.
- The Organizer never sees Assignments (ADR 0002).
- Reveal: a Member taps "Reveal my person", then can view their receiver's card any time. The card shows picture, name and bio, with a chime as it flips. A Member can't re-roll their own Assignment.
- Organizer dashboard: Members, Joining toggle, Exclusions editor, Draw, Re-draw, Invite Link reset, ownership transfer, and "revealed / not yet revealed" per Member.
- Re-draw is allowed before the Exchange Date.

## Leaving after the Draw

- Leaving or removal triggers a Patch: the leaver's Santa takes over the leaver's receiver. If the Patch breaks an Exclusion, the Organizer is prompted to Re-draw.
- If a Group drops to 2 Members it still works as a swap, with a warning. At 1 Member the Group returns to pre-Draw and all Assignments are cleared.

## Email

None (ADR 0004). Invites are shared as a link or code (e.g. on WhatsApp). Draw, Re-draw and "your person changed" show in the app as "Reveal my person". The Organizer tells the Group when the Draw is done.

## Privacy and data

- Account deletion removes the person's data, running a Patch if a Draw is active.
- App-level Assignment privacy only. The FAQ says plainly that the developer can read the database.

## Explicitly out of scope for v1

Wishlists, anonymous chat, reminders, member-joined emails, report buttons, automated image scanning, per-person songs, co-Organizers, public Group discovery, native apps, assignment encryption, and the visual theme.

## Quality bar

- The Draw logic (single loop, Exclusions, Patch) gets thorough unit tests, including property-style tests over random Groups and Exclusion sets, before the features around it.
- A few end-to-end tests cover sign up → join → Draw → Reveal.

## Before launch

- Add the background track at `public/audio/background.mp3`.
- Write the FAQ, including the privacy statement.
