import { test as base } from 'playwright-bdd';
import { allure } from 'allure-playwright';
import { projectConfig } from '../config/project.config';
import { createWorld, World } from './world';

type BddFixtures = {
  config: typeof projectConfig;
  world: World;
};

export const test = base.extend<BddFixtures & { _allureMeta: void }>({
  _allureMeta: [
    async ({}, use, testInfo) => {
      const tags = testInfo.tags.map(normalizeTag).filter(Boolean);

      if (tags.length) {
        await safeAllure(() => allure.tags(...tags));
      }

      // Accessibility scenarios also carry @ui (they exercise UI pages), but
      // they must not land in the same "ui" epic/feature bucket as ordinary
      // E2E tests - checked before the generic typeTags lookup so it wins
      // regardless of tag order on the Feature line.
      const typeTags = new Set(['api', 'ui', 'db', 'e2e', 'accessibility']);
      const type = tags.includes('accessibility')
        ? 'accessibility'
        : tags.find((t) => typeTags.has(t));
      if (type) {
        await safeAllure(() => allure.feature(type));
        await safeAllure(() => allure.label('type', type));
      }

      if (tags.includes('critical')) {
        await safeAllure(() => allure.severity('critical'));
      } else if (tags.includes('smoke')) {
        await safeAllure(() => allure.severity('normal'));
      }

      // Top-level Suites grouping: Accessibility vs E2E, so the two test
      // types show as separate branches instead of one flat list of
      // per-feature suites.
      const parentSuite = tags.includes('accessibility') ? 'Accessibility' : 'E2E';
      await safeAllure(() => allure.parentSuite(parentSuite));

      // One folder per browser/device project under each parentSuite - most
      // scenarios only run on `chromium` (the cross-browser/mobile-viewport
      // projects only add @smoke + @accessibility), so the browser goes at
      // the `suite` level and the feature name one level deeper as
      // `subSuite`; putting the feature name at `suite` instead would mean
      // most browser folders contain just one or two entries.
      await safeAllure(() => allure.suite(projectDisplayName(testInfo.project.name)));

      // Skipped when it would just repeat the parentSuite - accessibility.feature
      // is the only feature file carrying @accessibility, so its subSuite name
      // ("accessibility") always matches parentSuite ("Accessibility") and adds
      // a redundant extra folder with nothing else in it.
      const suiteName = suiteNameFromFile(testInfo.file);
      if (suiteName && suiteName.toLowerCase() !== parentSuite.toLowerCase()) {
        await safeAllure(() => allure.subSuite(suiteName));
      }

      await use();
    },
    { auto: true },
  ],
  config: async ({}, use) => {
    await use(projectConfig);
  },
  world: async ({}, use) => {
    await use(createWorld());
  },
});

async function safeAllure(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // Allure calls should never fail the test run (e.g. when running without the Allure reporter).
  }
}

const PROJECT_DISPLAY_NAMES: Record<string, string> = {
  chromium: 'Chromium',
  webkit: 'WebKit',
  'mobile-chrome': 'Mobile Chrome',
  'mobile-safari': 'Mobile Safari',
};

function projectDisplayName(projectName: string): string {
  return PROJECT_DISPLAY_NAMES[projectName] ?? projectName;
}

function normalizeTag(tag: string): string {
  const trimmed = (tag ?? '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

// playwright-bdd generates one spec file per feature file, so Allure's
// default "suite" label (the spec file's path) reads like
// "features/shopping-cart.feature.spec.js" - turn that into "shopping cart"
// instead: drop the features/ prefix and .feature.spec.<ext> suffix, and
// swap hyphens for spaces.
function suiteNameFromFile(file: string): string | undefined {
  const normalized = file.split(/[\\/]/).join('/');
  const match = normalized.match(/features\/(.+)\.feature\.spec\.\w+$/);
  return match?.[1].replace(/-/g, ' ');
}
