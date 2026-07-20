---
title: Release Readiness
description: The release-readiness CI gate - what it checks, its thresholds per suite, and how to read the published report.
owner: team-qa
tags: [testing, ci, release]
version: 3.0
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
| `@critical` | Critical | 0% |
| `@risk-high` | High | 1% |
| `@risk-low` | Low | 5% |

Each percentage is of the **total E2E count across all three buckets
combined**, not of that bucket's own total - e.g. Low risk's 5% is 5% of
every E2E scenario, not 5% of just the low-risk ones. Rounded up, with a
minimum of 1 once the percentage is above 0% (`computeMaxFailures` in
`scripts/check-release-readiness.mjs`) - a fractional "0.57 failures
allowed" isn't meaningful, and rounding a small-but-nonzero tolerance down
to 0 would make High/Low behave exactly like Critical on today's suite
size, defeating the point of having three tiers. The report shows both the
resulting number and the percentage it came from (e.g. "3 (5% of 57)"), so
the actual tolerance is never a mystery number.

A scenario with none of these tags defaults to **High** (fail-closed - an
untagged scenario counts as risky rather than silently getting the most
lenient tolerance). Always tag a new E2E scenario explicitly rather than
relying on that default.

`@external-api` scenarios (live third-party API calls, already best-effort/
continue-on-error in the E2E job) carry a normal risk tag like everything
else - they're no longer blanket-excluded (that used to hide a real,
recurring weather-API failure from this report entirely, with no
indication anywhere that it had been filtered out). Use `@known-issue`
below once one of them actually has an accepted, tracked failure.

Guideline for tagging a new scenario: **Critical** = the app is unusable or
shows wrong trip-critical information without it (e.g. core page navigation,
the Today page's destination/flight/hotel/activity summary, an access-
control boundary). **High** = a real feature breaks but the app is still
usable (e.g. a secondary view mode, a currency conversion, opening an edit
form). **Low** = a nice-to-have breaks (an external link, cosmetic
placeholder text, a persistence convenience, an external-API call).

### `@known-issue:TICKET-ID`

Marks a scenario with an accepted, ticket-tracked failure - e.g.
`@known-issue:REIS-142`. This is purely a label for traceability, **not an
exemption**: a known-issue failure still counts fully toward its risk
bucket's failure total and the ready/not-ready verdict. A known issue in
`@critical` (0 allowed) still blocks release - tagging something doesn't
excuse it, it just means there's already a ticket for it.

Every failing E2E scenario shows up in exactly one table below the risk-
bucket summary:

- **Known issues** - has a `@known-issue:TICKET-ID` tag. Shows the ticket
  reference, risk level, and status. If it starts passing again, it still
  shows up here (status "Now passing - remove tag?") - a nudge to remove
  the now-stale tag along with whatever fixed it.
- **Unknown issues** - failing with no `@known-issue` tag - something new
  or unexpected. Same shape, no ticket column, since there isn't one yet.
  Once triaged and filed, add the tag and it moves to Known issues on the
  next run.

E2E-only for now (not Accessibility/Security) - extend
`scripts/check-release-readiness.mjs`'s known-issue handling to those
sections too if that's ever needed there.

## Accessibility - by WCAG level

What makes an individual `<Page> meets WCAG level <X>` scenario fail is
unchanged - still the same per-level severity gate documented in
`ai/accessibility-testing.md` (`pageobjects/_shared/accessibility.ts`'s
`GATE_IMPACTS`):

| Level | A scenario fails when it finds |
| --- | --- |
| A | any Blocker/Critical, or any Major |
| AA | any Blocker/Critical (Major allowed) |
| AAA | any Blocker/Critical (Major allowed) |

What's new is the tolerance for *how many* scenarios are allowed to fail
before the level itself is not-ready, same percentage model as E2E above:

| Level | Max failing scenarios allowed |
| --- | --- |
| A | 0% |
| AA | 1% |
| AAA | 5% |

Each percentage is of the **total Accessibility scenario count across all
three levels combined**, not of that level's own total - the same
combined-total basis E2E uses, for the same reason (a handful of scenarios
per level would otherwise round every nonzero percentage down to the same
number). Rounded up, with a minimum of 1 once the percentage is above 0%
(`computeMaxFailures`, shared with the E2E calculation).

### Blocker/Critical is never eligible for the percentage

The percentage above only ever applies to a failure that did **not**
involve a Blocker/Critical finding. A Blocker/Critical finding is always a
hard, zero-tolerance release-blocker, at every level, no matter how few
scenarios it affects - the percentage exists to tolerate a small amount of
lower-severity noise, not to let a rare-enough critical accessibility bug
through. `check-release-readiness.mjs` cross-references each failing
scenario against its raw axe scan record (`a11y-report-data/`) to tell the
two apart: a "hard" failure (Blocker/Critical present) always counts
against a fixed 0, a "soft" failure (failed on a lower gating severity
alone) counts against the level's percentage. Missing raw data for a
failing scenario is treated as hard too - fail-closed, the report never
silently grants tolerance it can't actually verify.

In practice, today, this makes AA and AAA's 1%/5% ceiling currently
unreachable: their `GATE_IMPACTS` gate on Blocker/Critical *only* (see the
table above), so every AA/AAA failure is by construction a hard one - there
is currently no way for either level to fail on Major/Minor/Cosmetic alone.
Both levels report "0 other allowed" today as a result, identical in
practice to Level A's fixed 0%, even though their configured percentage is
nonzero. That's intentional, not a bug: the 1%/5% is a ceiling for once/if
AA and AAA are ever tightened to also gate on Major (see
`ai/accessibility-testing.md`'s note on that) - it starts applying to real
Major-only failures automatically, with no further change needed here,
the moment that happens. Level A's own percentage stays a hard 0%
regardless of this split - a foundational-accessibility regression is
always release-blocking, whether it's Blocker/Critical or Major.

The report shows, per level: how many `<Page> meets WCAG level <X>`
scenarios passed (from Allure - this is what actually gates the
`accessibility` job), the hard-vs-soft failure allowance (e.g. "0
Blocker/Critical (never tolerated)" / "1 other (1% of 54)"), plus the full
Blocker/Critical/Major/Minor/Cosmetic severity-count breakdown (from the
raw axe scan data in `a11y-report-data/`, uploaded as its own CI artifact)
- so a level can show "OK" while still surfacing non-blocking findings
(e.g. AAA passing with a couple of Major findings that don't gate it), not
just a checkmark with no detail.

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

The `release-readiness` job itself also shows a URL badge in the Actions
UI (via its own `environment:` block, `release-readiness-<branch>` -
distinct from `test-summary`'s `github-pages-<branch>` so the two don't
collide), pointing at the same `<branch>/release-readiness/` URL. Caveat:
this job runs *before* `test-summary` actually deploys, so at the moment
it finishes, that link still shows the *previous* run's report for a few
seconds until `test-summary` (later in the same workflow run) publishes
this run's - not stale in any lasting way, just not instant.

Retries: Playwright retries a failing test (`playwright.config.ts`); each
attempt writes its own raw Allure result sharing the same `historyId` - the
script keeps only the latest attempt per test, matching Playwright's own
final pass/fail determination, so a test that failed then passed on retry
is correctly counted as passed, not double-counted as also-failed.
