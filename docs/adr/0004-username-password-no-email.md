# Accounts are username + password; the app sends no email

Sahara Santa is for one friend group, so we dropped email entirely: no verification, no reset links, no invite or Draw emails. That removes the need for an email provider and a verified sending domain. Friends sign up with a username and password (Better Auth username plugin), join through the invite link or code shared on WhatsApp, and see Draw news in the app ("Reveal my person"). A forgotten password is reset by the Group's Organizer, who sets a temporary password for a Member of their own Group.

## Consequences

- Better Auth still requires an `email` column, so each account stores an internal placeholder `<username>@users.sahara-santa.invalid`. The `.invalid` TLD is reserved, so it can never be delivered to or belong to anyone.
- An Organizer can take over a Member's account by resetting its password. That is acceptable among friends, and the Member notices because they are signed out everywhere.
- Re-adding email later means collecting real addresses and re-enabling verification.

Supersedes the email parts of `docs/V1-SCOPE.md` as originally decided.
