# reis-app-taf

Playwright + Cucumber (BDD) test-automation project for a single system under
test, scaffolded via `/new-project`. See `ai/` for the guidelines this
project should follow (style, testing practices, accessibility approach).

## Setup

```
npm install
npx playwright install
copy .env.example .env
```

Fill in `BASE_URL` and `API_BASE_URL` in `.env` for the system under test.

## Run tests

```
npm run bdd            # generate specs from features + run everything, with Allure reporting
npm run bdd:headed     # same, with a visible browser
npm run test:e2e       # everything except @accessibility — what CI's Playwright job runs
npm run test:a11y      # only @accessibility — what CI's Accessibility job runs
```

## View the Allure report

```
npm run allure:generate
npm run allure:open
```

### What version was tested?

A `globalSetup` (`global-setup.ts` → `config/version-tracking.ts`) runs before
every test and fetches `{BASE_URL}/version.json` — a file the reis-app repo
generates at build time containing its `package.json` version and git commit
(see that repo's README). Combined with the versions of tracked third-party
integrations (`config/tracked-third-party-versions.ts` — currently the
Open-Meteo weather API; GetYourGuide is an outbound link only, so it has no
version), this is written to `allure-results/environment.properties`, which
Allure shows in the report's **Environment** widget on the overview page.

Each run compares the fetched versions against `config/last-known-versions.json`
(committed to this repo). When a version differs from last time, the report
also gets a `*.version.changed=<old> -> <new>` line and the console prints a
warning. **After a run reports a change, commit the updated
`config/last-known-versions.json`** so the next run compares against it.

If `version.json` can't be reached (e.g. not deployed yet, or a network
blip), the report shows `unknown` for that run instead of failing the suite —
this is reporting metadata, not a test assertion.

## Linting, formatting, cleanup

```
npm run lint            # ESLint (eslint-plugin-playwright), catches some ai/testing-guidelines.md rules
npm run lint:fix
npm run typecheck        # tsc --noEmit
npm run format           # Prettier
npm run clean             # remove test-results/, allure-results/, allure-report/, playwright-report/, .features-gen/
```

A VS Code debug config for stepping through tests is in `.vscode/launch.json`.

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main` or
`acceptance`, as four jobs:

- `lint` and `typecheck` — cheap static checks, run in parallel.
- `playwright` — `npm run test:e2e` (everything except `@accessibility`).
  Only starts once `lint`/`typecheck` are green.
- `accessibility` — `npm run test:a11y` (only `@accessibility`). Also gated
  on `lint`/`typecheck`.

It only becomes active once this project has its own GitHub remote (e.g.
after `/extract-project`) — nothing to do locally. See
`ai/repo-structure.md` for the `main`/`acceptance` branch and GitHub
Environment model; set the real `BASE_URL`/`API_BASE_URL` per environment
(Settings > Environments > test / acceptance) rather than relying on the
demo defaults in `config/project.config.ts`.

## Structure

- `features/` — Gherkin feature files, tagged by type (`@api`, `@ui`, `@e2e`, `@db`).
- `steps/` — step definitions, one `*.steps.ts` per feature file, calling page objects.
- `pageobjects/` — one file per screen/component; selectors and actions only,
  no assertions. `pageobjects/_shared/` holds cross-page helpers (e.g. the
  accessibility scan used by `features/accessibility.feature`).
- `config/project.config.ts` — environment-driven configuration (base URLs).
- `steps/bdd.ts`, `steps/fixtures.ts`, `steps/world.ts` — Cucumber/Playwright
  wiring; see `ai/playwright-bdd-style.md` for the conventions behind them.
- `ai/` — guidelines this project follows (style, testing practices,
  accessibility, project context).
- `.github/workflows/ci.yml` — CI pipeline, see above.
