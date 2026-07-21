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
  reference, risk level, status, and a success-rate trend (see below). If it
  starts passing again, it still shows up here (status "Now passing - remove
  tag?") - a nudge to remove the now-stale tag along with whatever fixed it.
- **Unknown issues** - failing with no `@known-issue` tag - something new
  or unexpected. Same shape, no ticket column, since there isn't one yet.
  Once triaged and filed, add the tag and it moves to Known issues on the
  next run.

E2E-only for now (not Accessibility/Security) - extend
`scripts/check-release-readiness.mjs`'s known-issue handling to those
sections too if that's ever needed there.

#### Success-rate trend

Purely informational context alongside the hard pass/fail count above, not
part of the gate itself - a scenario that's actually flaky (sometimes
passes, sometimes fails) reads very differently from one that's been
consistently broken for weeks, and the plain "Still failing" / "Now passing"
status alone doesn't distinguish the two. Shown on both Known and Unknown
issues (same underlying data either way - an unknown issue just doesn't
have a ticket reference yet).

Each row shows a success rate (e.g. "85% (17/20)") and current
pass streak, sourced from the *same* per-test run history Allure's own Trend
widget uses - fetched from the previously published report before this
script runs (`ci.yml`'s "Fetch previous report history" step in the
`release-readiness` job). Allure retains at most the last 20 runs per test,
which is why the denominator is "20", not the scenario's full lifetime - a
run older than that has already rolled off.

That fetched history is always one run stale - it's only refreshed by the
`test-summary` job's own `allure generate`, which runs *after*
`release-readiness` in the same workflow (see `ci.yml`). Rather than always
showing a trend that's missing the run currently being computed, this run's
own result is prepended directly from its own Allure results (already
available in this job, no fetch needed) before the success rate/streak are
computed.

Expanding "Last N runs" on a row shows the full breakdown per run, split
into two column groups (the second one, reis-app's own, tinted a light blue
so it's visually obvious which side of the trace a column belongs to):

- **Run / reis-app-taf version / CI run** - this repo's own side. `Run` is
  the test's own timestamp. `reis-app-taf version` is "the newest commit at
  or before this timestamp" (`git log` in the job's own checkout, which
  needs `fetch-depth: 0` in `ci.yml` - the default shallow clone only has
  the one commit currently checked out). `CI run` (e.g. `#103`, linking to
  the Actions run) is that exact commit's own workflow run, from `gh run
  list` (fetched by `ci.yml`'s "Fetch CI run history" step) - matched by
  commit, not by nearest timestamp, so it can't land on a neighboring run.
- **reis-app run / reis-app version / reis-app CI run** - same idea, one
  step removed: `reis-app version` is resolved the same "newest commit at
  or before this timestamp" way, just against reis-app's own git history
  instead (the `Checkout reis-app` step above). `reis-app run` and
  `reis-app CI run` are *that* commit's own run in reis-app's separate CI
  workflow (`gh run list -R joostdetester/reis-app`, fetched by `ci.yml`'s
  "Fetch reis-app CI run history" step) - reis-app's CI and its deploy are
  two different things (deploy is still manual, `vercel --prod`), so this
  is "reis-app's tests ran for this commit", not "this commit went live".

Every one of the six falls back to "unknown" if the underlying fetch failed
(e.g. a non-full clone, or either `gh run list` step erroring) or that exact
commit never triggered its own run (e.g. an intermediate commit from a
multi-commit push - only the push's last commit gets its own run).

The report's own header repeats this same pair, but for the run "now"
(this run's own reis-app-taf commit/CI run, and whichever reis-app commit
was newest as of generation time) rather than per historical row - same
resolution, same visual split.

The "CI run" link goes to that run's own Actions log, which GitHub keeps
indefinitely. The *report* itself is a different story: the published Allure/
accessibility/release-readiness reports normally live at one shared,
continuously-overwritten path per branch (`<branch>/`), so by the time you
come back to an older run, its own report has already been replaced by
whatever ran most recently. `test-summary` (`ci.yml`) also publishes each
run's own complete report permanently under `<branch>/runs/<run number>/`,
linked from that run's own job summary - kept for the same 20-run window as
this trend table (older run archives get pruned each deploy), so the two
stay in sync.

If a streak of consecutive passes is currently active, the row also names
which reis-app commit was live when that streak started (e.g. "8 in a row,
since reis-app 6df5e9f") - useful for spotting "this got fixed around
version X" at a glance. This is an **approximation**: reis-app deploys are
manual (`vercel --prod`, see reis-app's README), not triggered automatically
per commit, so "the newest reis-app commit at or before this run's
timestamp" (resolved via a full clone of reis-app checked out alongside this
repo in CI, see `ci.yml`) is the best available proxy for "what was live at
the time" - not a guarantee that commit had actually been deployed yet.

Degrades gracefully rather than failing the gate: a scenario with no
history yet (the very first time it fails, or the branch's first-ever
run) shows "No history yet" instead of a rate; if reis-app's checkout step
ever fails, versions just show as "unknown" instead of blocking anything.

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

What's new is a second, independent readiness check layered on top: a cap
on the *volume* of Major/Minor/Cosmetic violation types found, as a
percentage of that level's own scenario count:

| Level | Max Major/Minor/Cosmetic volume allowed |
| --- | --- |
| A | 0% |
| AA | 1% |
| AAA | 5% |

### Violation types, already deduplicated by axe - and per level, not combined

The count going into this check is `severityCounts.serious + moderate +
minor` from the raw axe scan data (`a11y-report-data/`) - Major/Minor/
Cosmetic violations found, summed across every scan at that level. This is
already a *type* count, not an element count: axe's own `violations` array
has at most one entry per rule per scan (a rule flagging 83 elements on
one page is one entry with 83 `nodes`, not 83 entries), so no extra
dedup step is needed on top of it - it was never counting elements in the
first place. The same rule recurring on a different page, or in a
different browser project's scan of the same page, does count again there
- it's a real, separate occurrence.

The percentage is of **that level's own scenario count**, not the
combined total across all three levels (unlike the E2E buckets) - AA and
AAA don't necessarily run the same number of scenarios, and a shared
denominator would let one level's count dilute another's tolerance.
Rounded up, with a minimum of 1 once the percentage is above 0%
(`computeMaxFailures`, shared with the E2E calculation).

This check is independent of, and *in addition to*, the scenario gate
above - a level can have every individual scenario pass (Major/Minor/
Cosmetic don't gate AA/AAA scenarios, see the table above) and still be
reported not-ready here, once its accumulated Major/Minor/Cosmetic volume
crosses that level's own ceiling. That's intentional: it's what makes the
AA/AAA percentage actually reachable and meaningful rather than a number
that never applies to anything (see "Blocker/Critical is never eligible"
below for why a scenario-failure-based version of this tolerance didn't
work for AA/AAA at all). It also means a page can accumulate a real,
worth-fixing backlog of lower-severity findings without every single CI
run turning red the moment any exist - the cap only trips once that
backlog gets disproportionately large relative to that level's own
scenario count.

### Blocker/Critical is never eligible for the percentage

Blocker/Critical findings are never counted toward the percentage above,
at any level - they're covered by the **unchanged scenario gate**
instead: a scenario that failed because its scan found a Blocker/Critical
violation always counts as a hard failure, a fixed 0 allowed, no
percentage, regardless of how the Major/Minor/Cosmetic volume check
above turns out. `check-release-readiness.mjs` cross-references each
failing scenario against its raw axe scan record to confirm a Blocker/
Critical violation was actually present. Missing raw data for a failing
scenario is treated as a hard failure too - fail-closed, the report never
silently grants tolerance it can't actually verify.

Level A's own percentage stays a hard 0% regardless of any of this - a
foundational-accessibility regression is always release-blocking,
whether it's Blocker/Critical (via the scenario gate) or Major (via the
volume check).

The report shows, per level: how many `<Page> meets WCAG level <X>`
scenarios passed and how many failed on a hard Blocker/Critical finding
(from Allure - this is what actually gates the `accessibility` job, in
the "Scenario gate" column group), the full Blocker/Critical/Major/Minor/
Cosmetic violation-type breakdown, their sum ("Non-critical total"), and
the volume tolerance ("Max allowed") in the separate "Violations found"
column group - so a level can show "OK" while still surfacing
non-blocking findings, not just a checkmark with no detail, and the two
independent readiness checks stay visually distinct rather than reading
as one blended number.

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
