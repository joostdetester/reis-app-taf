import { defineConfig } from '@playwright/test';
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
});
