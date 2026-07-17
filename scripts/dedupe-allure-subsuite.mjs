// Strips a redundant/empty `subSuite` label from Allure's raw result files
// before `allure generate` runs. Needed because allure-playwright's own
// reporter (dist/index.js, onTestEnd) unconditionally fills SUB_SUITE from
// the BDD Feature-level describe block whenever a test's result doesn't
// already have that label - no reporter option disables it. For a
// single-feature parentSuite (Accessibility/Visual Regression/Security),
// that lands back on the same text as parentSuite one level down: a
// redundant extra folder in the report ("Security" nested inside
// "Security"), or a literal "<Empty>" folder if steps/fixtures.ts had set
// subSuite to '' instead to preempt it. Removing the label here - after the
// reporter has already written it, before the report is generated from
// those files - is the only point in the pipeline where it can actually be
// suppressed: confirmed via allure-report/data/suites.json that this
// collapses the tree to parentSuite > suite > test, no third level.
//
// Run via `npm run allure:generate` (already wired in) or manually against
// any allure-results directory: `node scripts/dedupe-allure-subsuite.mjs [dir]`.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RESULTS_DIR = process.argv[2] ?? 'allure-results';

async function main() {
  const files = await readdir(RESULTS_DIR).catch(() => []);
  const resultFiles = files.filter((f) => f.endsWith('-result.json'));

  let strippedCount = 0;
  for (const file of resultFiles) {
    const filePath = path.join(RESULTS_DIR, file);
    const result = JSON.parse(await readFile(filePath, 'utf-8'));
    const labels = result.labels ?? [];
    const parentSuite = labels.find((l) => l.name === 'parentSuite');
    if (!parentSuite) continue;

    const filtered = labels.filter(
      (l) =>
        !(
          l.name === 'subSuite' &&
          (l.value === '' || l.value.toLowerCase() === parentSuite.value.toLowerCase())
        ),
    );
    if (filtered.length !== labels.length) {
      result.labels = filtered;
      await writeFile(filePath, JSON.stringify(result));
      strippedCount++;
    }
  }

  if (strippedCount) {
    console.log(`Stripped redundant subSuite from ${strippedCount} Allure result(s).`);
  }
}

main();
