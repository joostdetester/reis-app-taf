---
title: Testing Guidelines
description: Testing guidelines and best practices for writing reliable tests and handling test data/secrets.
owner: team-qa
tags: [testing, guidelines]
version: 1.0
---

# Testing Guidelines

## General Principles
- Prefer business-level test scenarios over UI implementation details
- Tests must be deterministic and stable
- Avoid flaky tests
- Keep tests readable and maintainable

## Do
- Use data-test-id or role selectors
- Use Page Object Model
- Reuse steps where possible
- Keep step definitions thin
- Validate business outcomes

## Do Not
- Do NOT use hard waits (`page.waitForTimeout`) — enforced by
  `eslint-plugin-playwright`'s `no-wait-for-timeout` rule (`npm run lint`)
- Do NOT assert on implementation details (CSS, internal IDs)
- Do NOT hardcode test data inside steps
- Do NOT duplicate step logic
- Do NOT perform heavy logic in step definitions

## Linting, Formatting & Typechecking
- `npm run lint` / `npm run lint:fix` — ESLint with `eslint-plugin-playwright`,
  catches some of the rules above automatically (see `eslint.config.mjs`).
  Not every guideline here can be linted — the rest still relies on review.
- `npm run typecheck` — `tsc --noEmit`, catches type errors without emitting
  build output.
- `npm run format` — Prettier, for consistent formatting.
- CI runs `lint` and `typecheck` as their own jobs before the `playwright`/
  `accessibility` jobs start — see `repo-structure.md` and the root
  `README.md`'s CI section.

## Test Tags

Cucumber tags drive which project/CI job a scenario runs in - see
`playwright.config.ts` and `.github/workflows/ci.yml` for exactly how each
tag is routed.

- `@accessibility` — the dedicated Accessibility job/report; excluded from
  the E2E job.
- `@smoke` — critical paths; the only tag that runs across every
  cross-browser/mobile-viewport project (`chromium`/`webkit`/`mobile-chrome`/
  `mobile-safari`), not just `chromium`.
- `@mobile` — mobile-viewport-only functional scenarios (`features/mobile-
  layout.feature`); only run on the two mobile projects.
- `@touch` — a `@mobile` scenario that calls `Locator.tap()`, which requires
  a context with `hasTouch:true`; excluded from `chromium`/`webkit` (desktop
  device presets have `hasTouch:false`, so `.tap()` would error there).
- `@external-api` — the scenario calls a live third-party API directly
  (currently: open-meteo weather, the Frankfurter exchange-rate API) with no
  control over its uptime. Runs as a separate, best-effort step in the E2E
  job (`continue-on-error: true`) so an outright outage there doesn't fail
  the whole job the way it has before - tag a scenario with this the moment
  it starts asserting on a live external value rather than the app's own
  data, not just because it happens to touch a page that has one.
- `@visual` — full-page screenshot comparison; only runs on `chromium` and
  `mobile-safari`, and only in its own dedicated `visual` CI job (excluded
  from the E2E job). See `ai/visual-regression-testing.md` — in particular
  for the Windows/Linux baseline mismatch and how to update baselines.

## Test Data
- Use factories or fixtures
- Keep test data configurable per environment
- Do not rely on shared state between tests

## Failure Handling
- Fail fast on critical flows
- Provide clear assertions and error messages

## Secrets
- Never commit real credentials or API keys — use `.env` (gitignored) with
  `.env.example` documenting the required keys.
- CI secrets belong in the pipeline's secret store, not in this repo.
