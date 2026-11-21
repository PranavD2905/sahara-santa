# Git authorship

Commits in this repo must be credited to the human you're working for, never to Claude.

- Before committing, check `git config user.name` and `git config user.email`. If either is empty or is `Claude` / `noreply@anthropic.com`, ask the user for their name and the email verified on their GitHub account, then commit with `git -c user.name="<name>" -c user.email="<email>" commit ...`.
- Don't add `Co-Authored-By: Claude ...`, `Claude-Session: ...`, or "Generated with Claude Code" lines to commit messages or PR descriptions. (`.claude/settings.json` turns off the automatic ones.)
- Before pushing, confirm `git log -1 --format='%an <%ae>'` shows the human author.
- Never rewrite or force-push already-pushed history to fix authorship without asking first.
