You are running unattended in a scheduled CI job, once per day, with no
human present to answer questions. Make reasonable calls yourself rather
than asking - there is no one to ask.

## Task

Audit `ai/test-backlog.md` and `ai/improvement-checklist.md` against the
actual state of this repo, and update anything that's out of date.

For every unchecked item (`📝`/`❓`/`🚫` in test-backlog.md, `- [ ]` in
improvement-checklist.md):

1. Work out what the item is actually claiming ("scenario X exists and
   passes", "job Y is enabled", "file Z has tests", etc).
2. Check the real repo state: `features/*.feature` and `steps/*.steps.ts`
   for scenario coverage, `.github/workflows/ci.yml` for job state (e.g.
   `if: false`), `scripts/` for test coverage of the scripts themselves,
   etc. Don't just read file names - read enough content to confirm a
   scenario genuinely covers what the backlog item describes, the way a
   careful human reviewer would.
3. If genuinely resolved, run whatever local check actually confirms it
   (e.g. `npm run test:e2e -- --grep "<scenario>"`, `npm run typecheck`)
   before marking it done - don't flip a checkbox on file existence alone.
4. Update the item in place, following the exact conventions already used
   in that file (✅/`[x]`, a `*(bevestigd: YYYY-MM-DD)*` or `(bevestigd:
   YYYY-MM-DD)` date tag matching today's date, a short note on what
   confirmed it - mirror the style of nearby already-updated entries
   rather than inventing a new format). Leave genuinely still-open items
   alone. If an item is unclear or you're not confident, leave it as-is
   rather than guessing.

## Strict scope - read this carefully

- You may read anything in the repo for context.
- You may run read-only or local-only commands to verify claims (test
  runs, typecheck, lint, grep, git log/show) - never anything that
  deploys, pushes to a remote other than your own new branch, or mutates
  shared state (no `vercel --prod`, no pushing to `main`/`acceptance`, no
  modifying GitHub environments/secrets, no touching the `reis-app` repo).
- You may only **write** to `ai/test-backlog.md` and
  `ai/improvement-checklist.md`. Do not modify any other file, including
  test/feature/step files, even if you spot an unrelated bug or
  improvement while reading them - note it in the PR description instead
  if it seems worth flagging, but don't fix it in this run.
- Never run `git push --force`, `git reset --hard`, or any other
  destructive/history-rewriting command.
- Never merge a pull request. Never push directly to `main` or
  `acceptance` - only ever to a new branch you create for this run.

## If there's nothing to update

If your audit finds no item that can honestly be flipped, make no commits
and do not open a pull request. A no-op day is a normal, expected outcome
- don't manufacture a change just to have something to show.

## If there is something to update

1. Create a new branch off `main`, named
   `docs/daily-backlog-audit-YYYY-MM-DD` (today's date).
2. Commit only `ai/test-backlog.md` and/or `ai/improvement-checklist.md`.
   Write a commit message explaining specifically what you verified and
   how (not just "update backlog").
3. Push the branch and open a pull request against `main` with `gh pr
   create`, summarizing what changed and how you confirmed it, in the
   same voice/detail level as this repo's other PR descriptions. Do
   **not** merge it.
