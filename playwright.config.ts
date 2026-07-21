import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import dotenv from 'dotenv';

// Load .env before anything below (including config/project.config.ts, which
// is imported later via steps/fixtures.ts) reads process.env.
dotenv.config();

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.ts'],
});

const isDebug = !!process.env.PWDEBUG;

export default defineConfig({
  testDir,
  // Fetches the deployed app's version.json and writes Allure's
  // environment.properties before any test runs — see config/version-tracking.ts.
  globalSetup: require.resolve('./global-setup'),
  timeout: 90_000,
  // The today/practical-information weather assertions depend on a live
  // third-party call (open-meteo.com) made straight from the browser. Widening
  // the assertion timeout only helps when that call is slow - confirmed live
  // that when the call fails outright (network blip, rate limit) the app
  // renders no `.day-weather` element at all, so the assertion fails
  // immediately with "element(s) not found" regardless of timeout. Retrying
  // on CI reloads the page and re-issues the call, which resolves transient
  // failures without masking a real regression (a genuine bug reproduces on
  // the retry too).
  retries: process.env.CI ? 2 : 0,
  // playwright-bdd generates spec files into a gitignored, regenerated-every-
  // run directory (see `testDir` above), so the *default* snapshot location
  // (next to the test file) would never get committed. Snapshots live at the
  // project root instead, keyed by project + OS (`{platform}`) - screenshots
  // are OS-font-rendering-dependent, so a baseline generated on Windows will
  // never match CI's ubuntu-latest. See ai/visual-regression-testing.md for
  // how to generate/update baselines against the same OS as CI.
  snapshotPathTemplate: 'visual-snapshots/{projectName}/{platform}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // Small cushion against anti-aliasing jitter between otherwise-identical
      // renders on the same OS/browser - not meant to absorb real UI changes.
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: process.env.BASE_URL ?? 'https://playwright.dev',
    headless: !isDebug,
    viewport:
      process.env.WINDOW_FULLSCREEN || (process.env.WINDOW_POSITION && process.env.WINDOW_SIZE)
        ? null
        : undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        ...(process.env.WINDOW_POSITION && process.env.WINDOW_SIZE
          ? [
              `--window-position=${process.env.WINDOW_POSITION}`,
              `--window-size=${process.env.WINDOW_SIZE}`,
            ]
          : []),
        ...(process.env.WINDOW_FULLSCREEN ? ['--start-maximized'] : []),
      ],
    },
  },
  reporter: [['list'], ['allure-playwright']],
  // Cross-browser + mobile-viewport coverage. `chromium` stays the
  // full-suite default (unlisted `grep` matches everything); the other
  // projects only run @smoke, plus @accessibility for the two mobile
  // projects so the existing a11y scans - including WCAG's Target Size
  // (tap-target) criterion - get exercised on a real mobile viewport, not
  // just desktop. `webkit` covers desktop Safari's rendering engine, `firefox`
  // covers Gecko.
  //
  // This works by intersection, not replacement: npm's test:e2e/test:a11y
  // scripts pass --grep/--grep-invert @accessibility on the CLI, and
  // Playwright ANDs that with each project's own `grep` below (confirmed in
  // playwright/lib/runner/loadUtils.js - project-level grep filters first,
  // then the CLI grep filters again on top). So webkit naturally runs zero
  // accessibility tests (its @smoke set has no @accessibility overlap),
  // while the mobile projects' (@smoke|@accessibility|@mobile) set collapses
  // to just @accessibility under test:a11y's CLI grep, and @smoke/@mobile
  // under test:e2e's CLI grep-invert - no CI script changes needed.
  //
  // `@mobile` (features/mobile-layout.feature) is the dedicated mobile-
  // viewport functional coverage - only meaningful on the two mobile
  // projects. `@touch` marks the one scenario among those that calls
  // Locator.tap(), which Playwright only allows on a context with
  // hasTouch:true - desktop Chrome/Safari/Firefox device presets set
  // hasTouch:false, so chromium excludes it via grepInvert (webkit/firefox
  // already exclude it too, since their grep only matches @smoke).
  projects: [
    // No device preset here (unlike the projects below): 'Desktop Chrome'
    // sets a fixed viewport, which would override the WINDOW_FULLSCREEN /
    // WINDOW_POSITION+SIZE viewport:null branch above and break local headed
    // debugging. Omitting `use` keeps this project identical to today's
    // single-project setup (browserName defaults to chromium).
    { name: 'chromium', grepInvert: /@touch/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@smoke/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@smoke/ },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      grep: /@smoke|@accessibility|@mobile/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
      // @visual only runs here and on chromium (not mobile-chrome/webkit) -
      // see ai/visual-regression-testing.md for why this browser/viewport was
      // picked over the other mobile project.
      grep: /@smoke|@accessibility|@mobile|@visual/,
    },
  ],
});
