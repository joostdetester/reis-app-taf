---
title: Visual Regression Testing
description: Screenshot-based visual regression coverage for this project's Playwright BDD UI suite - scope, the Windows/Linux baseline mismatch, and how to update baselines.
owner: team-qa
tags: [testing, visual-regression, ui, screenshots]
version: 1.0
---

# Visual Regression Testing

## Scope
Full-page screenshot comparisons (`expect(page).toHaveScreenshot()`) for a
handful of representative pages, on `chromium` and `mobile-safari` only (not
`webkit`/`mobile-chrome`) — one desktop viewport and one real mobile device
profile, kept deliberately narrow so the number of baselines to maintain
doesn't multiply across all four cross-browser/mobile-viewport projects. See
`features/visual-regression.feature` and `steps/visual-regression.steps.ts`.

Pages covered: Today, Trip overview (destinations view), Hotels, Flights,
Practical information. Not covered: Photos (Google-auth-gated, harder to get
into a reliable resting state) and the edit-flow/inline-edit-form states
(more about interaction than a resting visual state) - add these the same
way if they need coverage later.

## The platform baseline problem
Playwright screenshots are OS-font-rendering-dependent: the exact same page
renders with slightly different anti-aliasing on Windows vs Linux vs macOS.
CI runs on `ubuntu-latest`, so **a baseline generated on a developer's
Windows or Mac machine will never match what CI compares against** - every
comparison would show a diff that has nothing to do with an actual UI
change.

`playwright.config.ts` keys the snapshot path on `{platform}`
(`visual-snapshots/{projectName}/{platform}/{arg}{ext}`), so a Windows-
generated baseline lands in its own `win32/` subfolder instead of silently
overwriting or conflicting with the Linux one CI actually uses - but that
just avoids corruption, it doesn't make local Windows baselines useful for
CI. **Only `linux` baselines should ever be committed.**

## Updating baselines
Use the "Update Visual Baselines" GitHub Actions workflow
(`.github/workflows/update-visual-baselines.yml`, manually triggered via
`workflow_dispatch` - pick the branch to run against) rather than generating
them locally:

1. Run the workflow (Actions tab → "Update Visual Baselines" → Run workflow →
   pick the branch).
2. Download the `visual-snapshots-<branch>` artifact it produces.
3. Review the images - this is the actual point of visual regression testing;
   don't skip straight to committing.
4. Replace your local `visual-snapshots/` with the downloaded contents and
   commit, only once you've confirmed the changes are intentional.

The workflow deliberately does not auto-commit the result, so a human always
reviews the actual pixels before a new baseline is accepted.

If you have Docker available locally and want a faster loop than round-
tripping through Actions, run `npm run test:visual:update` inside the
official Playwright image matching the pinned `@playwright/test` version in
`package.json` (e.g. `mcr.microsoft.com/playwright:v1.58.2-noble` - check
https://mcr.microsoft.com/artifact/mar/playwright/tags for the tag matching
both that version and `ubuntu-latest`'s current Ubuntu release), mounting the
repo into the container. This produces the same `linux` baselines the CI
workflow does, just without needing a GitHub Actions round trip.

## Masking dynamic content
Any page region that's inherently live/dynamic gets masked (a solid box
drawn over it before comparison) rather than excluded from the scenario
entirely, via the `mask` option on `toHaveScreenshot()`:

- `NavigationPage.worldClock` - part of the shared Hero header (rendered
  outside `<Routes>`, so on every page, not just Today), live local time.
- `TodayPage.countdownPanel` / `TodayPage.allWeather` - Today-specific: the
  countdown to departure, and every day-card's live weather+beach-score.
- `FlightsPage.allGates` / `FlightsPage.allArrivalTerminals` - these switch
  from a "not yet available" placeholder to a real value as departure
  approaches (see `features/flights.feature`), so they're time-dependent
  content, not just live-API content.
- `PracticalPage.weatherForecastCard` / `PracticalPage.currencyConverterCard`
  - masked as whole cards, not just their changing text, because their
    *height* also varies with the live call's outcome (a multi-row forecast
    vs. a one-line error) - masking only the text inside would still leave
    the page's overall layout unstable across runs. This is a known residual
    risk for this one page: an unusually long weather-API outage that
    changes the widget's height could still shift content below it. Accepted
    as a rare, cheap-to-re-baseline edge case rather than engineering around
    it (e.g. by scoping the screenshot to exclude both widgets entirely).

When adding a new visual scenario for a page with any live/time-dependent
region, mask it the same way rather than hardcoding a wait that happens to
produce today's specific content.

## Tags
- `@visual` on every visual-regression scenario, combined with `@ui`.
- Drives both project routing (`playwright.config.ts`: only `chromium` and
  `mobile-safari` include `@visual` in what they run) and CI job selection
  (`npm run test:visual` / the `visual` job) - `npm run test:e2e` explicitly
  excludes it so these scenarios don't also run (and double-count failures)
  as part of the main E2E job.
- Unlike `@external-api`, a `@visual` failure is **not** treated as
  best-effort/continue-on-error - it's a deliberate gate. A failure means
  the UI changed, and a human needs to look at the diff and decide whether
  that was intentional (update the baseline) or a real regression (fix the
  code).
