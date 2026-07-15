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
