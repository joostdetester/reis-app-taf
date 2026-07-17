// Aggregates raw Allure results (allure-results/*-result.json, from the
// E2E/Accessibility/Security jobs) into a single release-readiness verdict:
// every gated suite must be 100% pass, no exceptions. Writes a standalone
// HTML report (independent of the Allure report) plus a data.json, and
// exits non-zero when not ready - that exit code is what makes the
// release-readiness CI job itself fail, i.e. the actual gate. Run via
// `npm run release:readiness` after the test jobs. See
// ai/release-readiness.md for the policy this encodes.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RESULTS_DIR = process.env.ALLURE_RESULTS_DIR ?? 'allure-results';
const OUT_DIR = process.env.RELEASE_READINESS_OUT_DIR ?? 'release-readiness-report';

// Visual Regression is currently disabled in CI (playwright.config.ts's
// Today-page baseline goes stale on its own with the real calendar date -
// see ai/visual-regression-testing.md) - excluded here rather than silently
// counted as "0/0 passed, ready", so its absence is visible in the report
// instead of being a hidden blind spot.
const GATED_SUITES = ['E2E', 'Accessibility', 'Security'];
const EXCLUDED_SUITES = [
  {
    suite: 'Visual Regression',
    reason:
      'Disabled in CI (visual job has if: false) - the Today page baseline goes stale on its own as the real calendar date advances, unrelated to any actual UI regression. See ai/visual-regression-testing.md.',
  },
];

// @external-api scenarios call a live third-party API directly and are
// already treated as best-effort everywhere else in this project (continue-
// on-error in the E2E job, see ci.yml) - excluded from the E2E count for the
// same reason: an outage there reflects that API's uptime, not this app's
// release readiness.
const EXCLUDED_TAGS = new Set(['external-api']);

const THRESHOLD_LABEL = '100% pass (0 failed/broken)';

async function main() {
  const files = (await readdir(RESULTS_DIR).catch(() => [])).filter((f) =>
    f.endsWith('-result.json'),
  );

  // Playwright retries a failing test up to `retries` times (playwright.config.ts) -
  // each attempt writes its own raw result file sharing the same historyId, so a
  // test that eventually passed must not be double-counted as also-failed here.
  // Keep only the latest attempt (highest `stop` timestamp) per historyId, matching
  // Playwright's own final pass/fail determination.
  const latestByHistoryId = new Map();
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(RESULTS_DIR, file), 'utf-8'));
    const key = raw.historyId ?? raw.fullName ?? file;
    const existing = latestByHistoryId.get(key);
    if (!existing || (raw.stop ?? 0) > (existing.stop ?? 0)) {
      const labels = raw.labels ?? [];
      latestByHistoryId.set(key, {
        status: raw.status,
        stop: raw.stop,
        parentSuite: labels.find((l) => l.name === 'parentSuite')?.value,
        tags: labels.filter((l) => l.name === 'tag').map((l) => l.value),
      });
    }
  }

  const bySuite = {};
  for (const test of latestByHistoryId.values()) {
    const suite = test.parentSuite ?? 'Unknown';
    if (EXCLUDED_SUITES.some((e) => e.suite === suite)) continue;
    if (suite === 'E2E' && test.tags.some((t) => EXCLUDED_TAGS.has(t))) continue;

    bySuite[suite] ??= { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 };
    bySuite[suite].total++;
    const bucket = ['passed', 'failed', 'broken', 'skipped'].includes(test.status)
      ? test.status
      : 'unknown';
    bySuite[suite][bucket]++;
  }

  const suiteResults = GATED_SUITES.map((suite) => {
    const stats = bySuite[suite] ?? {
      total: 0,
      passed: 0,
      failed: 0,
      broken: 0,
      skipped: 0,
      unknown: 0,
    };
    const failures = stats.failed + stats.broken + stats.unknown;
    const ready = stats.total > 0 && failures === 0;
    const passRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 1000) / 10 : 0;
    return { suite, ...stats, failures, ready, passRate };
  });

  const overallReady = suiteResults.every((s) => s.ready);
  const generatedAt = new Date().toISOString();

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'data.json'),
    JSON.stringify({ generatedAt, overallReady, threshold: THRESHOLD_LABEL, suiteResults, excludedSuites: EXCLUDED_SUITES }, null, 2),
  );
  await writeFile(path.join(OUT_DIR, 'index.html'), buildHtmlReport(overallReady, suiteResults, generatedAt));

  console.log(overallReady ? 'READY FOR RELEASE' : 'NOT READY FOR RELEASE');
  for (const s of suiteResults) {
    const status = s.total === 0 ? 'NO RESULTS' : s.ready ? 'OK' : 'FAIL';
    console.log(`  ${s.suite}: ${s.passed}/${s.total} passed (${s.passRate}%) - ${status}`);
  }

  if (!overallReady) {
    console.log('\nOne or more gated suites did not meet the threshold: ' + THRESHOLD_LABEL);
    process.exitCode = 1;
  }
}

function buildHtmlReport(overallReady, suiteResults, generatedAt) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Release Readiness</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="hero ${overallReady ? 'ready' : 'not-ready'}">
    <p class="eyebrow">Release Readiness Gate</p>
    <h1>${overallReady ? '✅ Ready for release' : '❌ Not ready for release'}</h1>
    <p class="lede">Threshold: ${escapeHtml(THRESHOLD_LABEL)} in every gated suite below.</p>
  </header>

  <table class="suite-table">
    <thead>
      <tr><th>Suite</th><th>Total</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Pass rate</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${suiteResults.map(renderSuiteRow).join('\n')}
    </tbody>
  </table>

  ${EXCLUDED_SUITES.length ? renderExcluded() : ''}

  <footer class="footer">Generated ${escapeHtml(generatedAt)}</footer>
</div>
</body>
</html>`;
}

function renderSuiteRow(s) {
  const noResults = s.total === 0;
  const statusClass = noResults ? 'fail' : s.ready ? 'pass' : 'fail';
  const statusLabel = noResults ? 'No results' : s.ready ? 'OK' : 'Fail';
  return `
      <tr class="${statusClass}">
        <td>${escapeHtml(s.suite)}</td>
        <td>${s.total}</td>
        <td>${s.passed}</td>
        <td>${s.failures}</td>
        <td>${s.skipped}</td>
        <td>${s.passRate}%</td>
        <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
      </tr>`;
}

function renderExcluded() {
  return `
  <section class="excluded">
    <h2>Excluded from this gate</h2>
    <ul>
      ${EXCLUDED_SUITES.map((e) => `<li><strong>${escapeHtml(e.suite)}</strong> - ${escapeHtml(e.reason)}</li>`).join('')}
    </ul>
  </section>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
:root {
  color-scheme: light;
  --bg: #f4f7fb;
  --panel: #ffffff;
  --text: #132238;
  --muted: #5b6b84;
  --line: #d9e2ef;
  --pass: #157347;
  --pass-bg: #e8f7ee;
  --fail: #991b1b;
  --fail-bg: #fee2e2;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--text);
  background: linear-gradient(180deg, #eef4fb 0%, var(--bg) 100%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.wrap { max-width: 900px; margin: 0 auto; padding: 32px 20px 56px; }
.hero {
  background: var(--panel);
  border: 1px solid var(--line);
  border-left: 6px solid var(--fail);
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 12px 32px rgba(19, 34, 56, 0.08);
}
.hero.ready { border-left-color: var(--pass); }
.eyebrow { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 6px 0 12px; font-size: 28px; }
.lede { margin: 0; color: var(--muted); }
.suite-table { width: 100%; border-collapse: collapse; margin-top: 24px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.suite-table th, .suite-table td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.suite-table th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.suite-table tr:last-child td { border-bottom: none; }
.suite-table tr.fail td:first-child { border-left: 4px solid var(--fail); }
.suite-table tr.pass td:first-child { border-left: 4px solid var(--pass); }
.badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.badge-pass { background: var(--pass-bg); color: var(--pass); }
.badge-fail { background: var(--fail-bg); color: var(--fail); }
.excluded { margin-top: 24px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
.excluded h2 { margin: 0 0 8px; font-size: 16px; }
.excluded ul { margin: 0; padding-left: 20px; color: var(--muted); font-size: 14px; }
.footer { margin-top: 24px; font-size: 12px; color: var(--muted); text-align: center; }
`;

main();
