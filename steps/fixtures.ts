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

      // Accessibility/visual/security scenarios also carry @ui (they
      // exercise UI pages), but they must not land in the same "ui"
      // epic/feature bucket as ordinary E2E tests - checked before the
      // generic typeTags lookup so they win regardless of tag order on the
      // Feature line.
      const typeTags = new Set(['api', 'ui', 'db', 'e2e', 'accessibility', 'visual', 'security']);
      const type = tags.includes('accessibility')
        ? 'accessibility'
        : tags.includes('visual')
          ? 'visual'
          : tags.includes('security')
            ? 'security'
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

      // Top-level Suites grouping: Accessibility vs Visual Regression vs
      // Security vs E2E, so each test type shows as its own branch instead
      // of one flat list of per-feature suites.
      const parentSuite = tags.includes('accessibility')
        ? 'Accessibility'
        : tags.includes('visual')
          ? 'Visual Regression'
          : tags.includes('security')
            ? 'Security'
            : 'E2E';
      await safeAllure(() => allure.parentSuite(parentSuite));

      // One folder per browser/device project under each parentSuite - most
      // scenarios only run on `chromium` (the cross-browser/mobile-viewport
      // projects only add @smoke + @accessibility), so the browser goes at
      // the `suite` level and the feature name one level deeper as
      // `subSuite`; putting the feature name at `suite` instead would mean
      // most browser folders contain just one or two entries.
      await safeAllure(() => allure.suite(projectDisplayName(testInfo.project.name)));

      const suiteName = suiteNameFromFile(testInfo.file);
      if (suiteName && suiteName.toLowerCase() !== parentSuite.toLowerCase()) {
        await safeAllure(() => allure.subSuite(suiteName));
      } else {
        // suiteName is redundant with parentSuite - accessibility.feature and
        // visual-regression.feature are each the only feature file carrying
        // their tag, so their filename-derived name always just repeats the
        // parentSuite. Fall back to whatever sits between the Feature title
        // and the test's own title in testInfo.titlePath instead - for a
        // Scenario Outline (accessibility's case) that's the outline's own
        // title (e.g. "Today page meets WCAG level <level>"), genuinely more
        // specific than the Feature name. When nothing's left after
        // filtering (a flat scenario with no extra nesting, e.g. every
        // visual-regression.feature scenario), this sets subSuite to '' -
        // allure-playwright's reporter only checks *presence* of the
        // subSuite label (not its value) before falling back to the same
        // redundant Feature-name text itself, so an empty label still
        // suppresses that fallback. Confirmed live: this still renders an
        // extra (blank-named) tree level rather than none at all - a minor
        // cosmetic wrinkle, but a clearly better one than the exact-text
        // duplication this replaces.
        const inner = testInfo.titlePath
          .slice(1, -1)
          .filter((segment) => segment.toLowerCase() !== parentSuite.toLowerCase());
        await safeAllure(() => allure.subSuite(inner.join(' > ')));
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
