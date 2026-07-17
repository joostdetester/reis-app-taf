---
title: Release Readiness
description: The release-readiness CI gate - what it checks, its threshold, and how to read the published report.
owner: team-qa
tags: [testing, ci, release]
version: 1.0
---

# Release Readiness

A single go/no-go verdict, aggregated from the E2E, Accessibility and
Security Allure results, published as its own report alongside the main
Allure report - see `scripts/check-release-readiness.mjs`.

## Threshold

**100% pass required in every gated suite - 0 failed/broken results.** No
percentage tolerance. This doesn't add a new bar on top of what already
gates CI: E2E/Accessibility/Security already fail their own job on any
failure. The gate's value is aggregating those three separate pass/fail
signals into one explicit, reviewable verdict (with counts, not just a
checkmark) rather than requiring someone to check three job statuses
individually.

## Gated suites

- **E2E** - excluding `@external-api` scenarios (live third-party API calls,
  already treated as best-effort/continue-on-error everywhere else in this
  project - an outage there reflects that API's uptime, not this app's
  readiness).
- **Accessibility**
- **Security**

## Excluded

- **Visual Regression** - currently disabled in CI (`visual` job has
  `if: false`, see `ai/visual-regression-testing.md`). Excluded from the
  count entirely rather than silently treated as a passing "0/0" - the
  published report always lists it under "Excluded from this gate" with the
  reason, so its absence is visible rather than a hidden blind spot.
  Re-include it in `GATED_SUITES`
  (`scripts/check-release-readiness.mjs`) once that job is re-enabled.

## How it fails

`release-readiness` is a hard gate, same as `visual`/`security`: the CI job
itself fails (non-zero exit from `npm run release:readiness`) when any
gated suite isn't at 100% pass, or has no results at all (fail-closed - a
suite that never ran, e.g. because `lint`/`typecheck` failed upstream, is
"not ready", not silently skipped).

## Report

Published to the same GitHub Pages site as the Allure report, under
`<branch>/release-readiness/` - linked from the Pages landing page and the
`test-summary` job's step summary, same mechanism as the accessibility HTML
report. Deliberately folded into `test-summary`'s existing single Pages
deploy rather than deploying separately - see the note above `test-summary`
in `ci.yml` about PR-triggered deploys racing and wiping the real published
site; a second deploy target would risk the same failure mode.

Retries: Playwright retries a failing test (`playwright.config.ts`); each
attempt writes its own raw Allure result sharing the same `historyId` - the
script keeps only the latest attempt per test, matching Playwright's own
final pass/fail determination, so a test that failed then passed on retry
is correctly counted as passed, not double-counted as also-failed.
