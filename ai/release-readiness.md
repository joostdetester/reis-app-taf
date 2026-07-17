---
title: Release Readiness
description: The release-readiness CI gate - what it checks, its thresholds per suite, and how to read the published report.
owner: team-qa
tags: [testing, ci, release]
version: 2.0
---

# Release Readiness

A single go/no-go verdict, aggregated from the E2E, Accessibility and
Security Allure results (plus Accessibility's raw axe scan data), published
as its own report alongside the main Allure report - see
`scripts/check-release-readiness.mjs`.

Each of the three gated areas below is judged against its own threshold,
not one blanket "100% pass" - E2E's threshold is risk-based, Accessibility's
mirrors its existing per-WCAG-level severity gate, and only Security stays
at a flat 100%.

## E2E - by risk level

Every E2E scenario carries exactly one risk tag (see any `features/*.feature`
file):

| Tag | Risk level | Max failures allowed |
| --- | --- | --- |
| `@critical` | Critical | 0 |
| `@risk-high` | High | 2 |
| `@risk-low` | Low | 5 |

A scenario with none of these tags defaults to **High** (fail-closed - an
untagged scenario counts as risky rather than silently getting the most
lenient tolerance). Always tag a new E2E scenario explicitly rather than
relying on that default.

`@external-api` scenarios (live third-party API calls, already best-effort/
continue-on-error in the E2E job) are excluded entirely, not risk-tagged -
an outage there reflects that API's uptime, not this app's readiness.

Guideline for tagging a new scenario: **Critical** = the app is unusable or
shows wrong trip-critical information without it (e.g. core page navigation,
the Today page's destination/flight/hotel/activity summary, an access-
control boundary). **High** = a real feature breaks but the app is still
usable (e.g. a secondary view mode, a currency conversion, opening an edit
form). **Low** = a nice-to-have breaks (an external link, cosmetic
placeholder text, a persistence convenience).

## Accessibility - by WCAG level

Mirrors the same per-level gate already documented in
`ai/accessibility-testing.md` (`pageobjects/_shared/accessibility.ts`'s
`GATE_IMPACTS`) - this doesn't introduce a new policy, it surfaces the
existing one with its actual counts instead of a bare pass/fail:

| Level | Threshold |
| --- | --- |
| A | 0 Blocker/Critical, 0 Major |
| AA | 0 Blocker/Critical (Major allowed) |
| AAA | 0 Blocker/Critical (Major allowed) |

The report shows, per level: how many `<Page> meets WCAG level <X>`
scenarios passed (from Allure - this is what actually gates the
`accessibility` job), plus the full Blocker/Critical/Major/Minor/Cosmetic
severity-count breakdown (from the raw axe scan data in
`a11y-report-data/`, uploaded as its own CI artifact) - so a level can show
"OK" while still surfacing non-blocking findings (e.g. AAA passing with a
couple of Major findings that don't gate it), not just a checkmark with no
detail.

## Security

Flat **100% pass required - 0 failed/broken**. No risk tiers: a security
regression or a dependency-audit finding is always release-blocking,
regardless of "how risky" the specific scenario seems.

## Excluded

- **Visual Regression** - currently disabled in CI (`visual` job has
  `if: false`, see `ai/visual-regression-testing.md`). Excluded entirely
  rather than silently treated as a passing "0/0" - the published report
  always lists it under "Excluded from this gate" with the reason, so its
  absence is visible rather than a hidden blind spot. Re-add it to
  `scripts/check-release-readiness.mjs` once that job is re-enabled.

## How it fails

`release-readiness` is a hard gate, same as `visual`/`security`: the CI job
itself fails (non-zero exit from `npm run release:readiness`) when any
threshold above isn't met, or a section has no results at all (fail-closed -
e.g. because `lint`/`typecheck` failed upstream and skipped the jobs this
one depends on).

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
