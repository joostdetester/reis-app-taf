// Aggregates raw Allure results (allure-results/*-result.json) and the raw
// accessibility scan records (a11y-report-data/*.json) into a single
// release-readiness verdict, and writes a standalone HTML report (plus
// data.json) - independent of the Allure report. Exits non-zero when not
// ready - that exit code is what makes the release-readiness CI job itself
// fail, i.e. the actual gate. Run via `npm run release:readiness` after the
// test jobs. See ai/release-readiness.md for the full policy.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const RESULTS_DIR = process.env.ALLURE_RESULTS_DIR ?? 'allure-results';
const A11Y_DATA_DIR = process.env.A11Y_REPORT_DATA_DIR ?? 'a11y-report-data';
const OUT_DIR = process.env.RELEASE_READINESS_OUT_DIR ?? 'release-readiness-report';

// Visual Regression is currently disabled in CI (playwright.config.ts's
// Today-page baseline goes stale on its own with the real calendar date -
// see ai/visual-regression-testing.md) - excluded here rather than silently
// counted as "0/0 passed, ready", so its absence is visible in the report
// instead of being a hidden blind spot.
const EXCLUDED_SUITES = [
  {
    suite: 'Visual Regression',
    reason:
      'Disabled in CI (visual job has if: false) - the Today page baseline goes stale on its own as the real calendar date advances, unrelated to any actual UI regression. See ai/visual-regression-testing.md.',
  },
];

// Every E2E scenario is expected to carry exactly one of these (see any
// features/*.feature file) - @critical must always pass, @risk-high/
// @risk-low get a small failure allowance instead of the usual 100%. A
// scenario that's missing a risk tag defaults to 'high' (fail-closed: an
// un-tagged scenario counts as risky rather than silently getting the most
// lenient tolerance).
const E2E_RISK_BUCKETS = [
  { key: 'critical', tag: 'critical', label: 'Critical', maxFailures: 0 },
  { key: 'high', tag: 'risk-high', label: 'High risk', maxFailures: 2 },
  { key: 'low', tag: 'risk-low', label: 'Low risk', maxFailures: 5 },
];
const DEFAULT_E2E_RISK = 'high';

// @known-issue:TICKET-ID (e.g. @known-issue:REIS-142) marks a scenario with
// an accepted, ticket-tracked failure - purely a label for traceability, it
// does NOT exempt the failure from its risk bucket's failure count or the
// ready/not-ready verdict (a known issue in @critical, for instance, still
// blocks release - it isn't a free pass, it just says "this one already has
// a ticket"). Every failing E2E scenario shows up in exactly one of two
// tables below the risk-bucket summary: "Known issues" (has the tag, with
// its ticket reference) or "Unknown issues" (doesn't - something new/
// unexpected, needs triage). Previously @external-api scenarios were
// blanket-excluded from the gate entirely; that's gone now - they carry a
// normal risk tag like everything else (see ai/release-readiness.md).
const KNOWN_ISSUE_TAG_PREFIX = 'known-issue:';

// Mirrors pageobjects/_shared/accessibility.ts's own WCAG_TAGS/GATE_IMPACTS/
// SEVERITY_LABELS (critical->Blocker/Critical, serious->Major,
// moderate->Minor, minor->Cosmetic, used directly as the report's column
// headers below) - this is the same policy already documented in
// ai/accessibility-testing.md, just surfaced here with its actual observed
// counts instead of a bare pass/fail.
const A11Y_LEVELS = [
  { level: 'A', gateImpacts: ['critical', 'serious'], thresholdLabel: '0 Blocker/Critical, 0 Major' },
  { level: 'AA', gateImpacts: ['critical'], thresholdLabel: '0 Blocker/Critical' },
  { level: 'AAA', gateImpacts: ['critical'], thresholdLabel: '0 Blocker/Critical' },
];

const SECURITY_THRESHOLD_LABEL = '100% pass (0 failed/broken)';

async function main() {
  const latestByHistoryId = await loadLatestAllureResults();

  const { buckets: e2eBuckets, knownIssues, unknownIssues } = computeE2eBuckets(latestByHistoryId);
  const accessibilityLevels = await computeAccessibilityLevels(latestByHistoryId);
  const security = computeSecurity(latestByHistoryId);

  const overallReady =
    e2eBuckets.every((b) => b.ready) && accessibilityLevels.every((l) => l.ready) && security.ready;
  const generatedAt = new Date().toISOString();

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'data.json'),
    JSON.stringify(
      {
        generatedAt,
        overallReady,
        e2eBuckets,
        knownIssues,
        unknownIssues,
        accessibilityLevels,
        security,
        excludedSuites: EXCLUDED_SUITES,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(OUT_DIR, 'index.html'),
    buildHtmlReport(overallReady, e2eBuckets, knownIssues, unknownIssues, accessibilityLevels, security, generatedAt),
  );

  console.log(overallReady ? 'READY FOR RELEASE' : 'NOT READY FOR RELEASE');
  console.log('E2E (by risk):');
  for (const b of e2eBuckets) {
    console.log(
      `  ${b.label}: ${b.passed}/${b.total} passed, ${b.failures} failing (max ${b.maxFailures} allowed) - ${b.ready ? 'OK' : 'FAIL'}`,
    );
  }
  if (knownIssues.length) {
    console.log('Known issues (still count toward the failure counts above):');
    for (const k of knownIssues) {
      console.log(`  [${k.ticket}] ${k.name} (${k.riskLabel}) - ${k.status}`);
    }
  }
  if (unknownIssues.length) {
    console.log('Unknown issues (unexpected failures, no @known-issue tag yet):');
    for (const u of unknownIssues) {
      console.log(`  ${u.name} (${u.riskLabel})`);
    }
  }
  console.log('Accessibility (by WCAG level):');
  for (const l of accessibilityLevels) {
    console.log(
      `  ${l.level}: ${l.passed}/${l.total} scenarios passed, threshold ${l.thresholdLabel} - severity counts ${JSON.stringify(l.severityCounts)} - ${l.ready ? 'OK' : 'FAIL'}`,
    );
  }
  console.log(
    `Security: ${security.passed}/${security.total} passed - ${security.ready ? 'OK' : 'FAIL'}`,
  );

  if (!overallReady) {
    console.log('\nOne or more gated thresholds were not met - see ai/release-readiness.md.');
    process.exitCode = 1;
  }
}

// Playwright retries a failing test up to `retries` times (playwright.config.ts) -
// each attempt writes its own raw result file sharing the same historyId, so a
// test that eventually passed must not be double-counted as also-failed. Keep
// only the latest attempt (highest `stop` timestamp) per historyId, matching
// Playwright's own final pass/fail determination.
async function loadLatestAllureResults() {
  const files = (await readdir(RESULTS_DIR).catch(() => [])).filter((f) =>
    f.endsWith('-result.json'),
  );
  const latestByHistoryId = new Map();
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(RESULTS_DIR, file), 'utf-8'));
    const key = raw.historyId ?? raw.fullName ?? file;
    const existing = latestByHistoryId.get(key);
    if (!existing || (raw.stop ?? 0) > (existing.stop ?? 0)) {
      const labels = raw.labels ?? [];
      latestByHistoryId.set(key, {
        name: raw.name,
        status: raw.status,
        stop: raw.stop,
        parentSuite: labels.find((l) => l.name === 'parentSuite')?.value,
        tags: labels.filter((l) => l.name === 'tag').map((l) => l.value),
      });
    }
  }
  return latestByHistoryId;
}

function isFailure(status) {
  return status !== 'passed' && status !== 'skipped';
}

function knownIssueTicket(tags) {
  const tag = tags.find((t) => t.startsWith(KNOWN_ISSUE_TAG_PREFIX));
  return tag ? tag.slice(KNOWN_ISSUE_TAG_PREFIX.length) : null;
}

function computeE2eBuckets(latestByHistoryId) {
  const counts = Object.fromEntries(
    E2E_RISK_BUCKETS.map((b) => [b.key, { total: 0, passed: 0, failures: 0 }]),
  );
  const knownIssues = [];
  const unknownIssues = [];

  for (const test of latestByHistoryId.values()) {
    if (test.parentSuite !== 'E2E') continue;

    const bucket = E2E_RISK_BUCKETS.find((b) => test.tags.includes(b.tag));
    const key = bucket?.key ?? DEFAULT_E2E_RISK;
    const riskLabel = bucket?.label ?? 'High risk';
    const ticket = knownIssueTicket(test.tags);

    counts[key].total++;
    if (test.status === 'passed') {
      counts[key].passed++;
      // A @known-issue scenario that's now passing means the underlying
      // problem may be fixed - surfaced so the tag gets cleaned up rather
      // than silently staying on a scenario that no longer needs it.
      if (ticket) knownIssues.push({ name: test.name, ticket, riskLabel, status: 'passing' });
    } else if (isFailure(test.status)) {
      counts[key].failures++;
      if (ticket) {
        knownIssues.push({ name: test.name, ticket, riskLabel, status: 'failing' });
      } else {
        unknownIssues.push({ name: test.name, riskLabel, status: 'failing' });
      }
    }
  }

  const buckets = E2E_RISK_BUCKETS.map((b) => {
    const c = counts[b.key];
    return { ...b, ...c, ready: c.failures <= b.maxFailures };
  });
  return { buckets, knownIssues, unknownIssues };
}

function computeSecurity(latestByHistoryId) {
  const stats = { total: 0, passed: 0, failures: 0 };
  for (const test of latestByHistoryId.values()) {
    if (test.parentSuite !== 'Security') continue;
    stats.total++;
    if (test.status === 'passed') stats.passed++;
    else if (isFailure(test.status)) stats.failures++;
  }
  return { ...stats, thresholdLabel: SECURITY_THRESHOLD_LABEL, ready: stats.total > 0 && stats.failures === 0 };
}

// Two data sources, cross-checked: Allure pass/fail per "<Page> meets WCAG
// level <X>" scenario (authoritative - this is what actually gates the
// accessibility job), and a11y-report-data's raw axe violations per scan
// (for the severity-count breakdown - the Allure result alone doesn't say
// *why* a level failed, just that it did).
async function computeAccessibilityLevels(latestByHistoryId) {
  const scenarioCounts = Object.fromEntries(
    A11Y_LEVELS.map((l) => [l.level, { total: 0, passed: 0, failures: 0 }]),
  );
  for (const test of latestByHistoryId.values()) {
    if (test.parentSuite !== 'Accessibility') continue;
    const match = /meets WCAG level (A|AA|AAA)\b/i.exec(test.name ?? '');
    if (!match) continue;
    const level = match[1].toUpperCase();
    if (!scenarioCounts[level]) continue;
    scenarioCounts[level].total++;
    if (test.status === 'passed') scenarioCounts[level].passed++;
    else if (isFailure(test.status)) scenarioCounts[level].failures++;
  }

  const severityCounts = Object.fromEntries(
    A11Y_LEVELS.map((l) => [l.level, { critical: 0, serious: 0, moderate: 0, minor: 0 }]),
  );
  const dataFiles = (await readdir(A11Y_DATA_DIR).catch(() => [])).filter((f) =>
    f.endsWith('.json'),
  );
  for (const file of dataFiles) {
    const record = JSON.parse(await readFile(path.join(A11Y_DATA_DIR, file), 'utf-8'));
    if (!severityCounts[record.level]) continue;
    for (const violation of record.violations ?? []) {
      const impact = violation.impact;
      if (severityCounts[record.level][impact] !== undefined) {
        severityCounts[record.level][impact]++;
      }
    }
  }

  return A11Y_LEVELS.map((l) => {
    const c = scenarioCounts[l.level];
    return {
      level: l.level,
      thresholdLabel: l.thresholdLabel,
      ...c,
      ready: c.total > 0 && c.failures === 0,
      severityCounts: severityCounts[l.level],
    };
  });
}

function buildHtmlReport(overallReady, e2eBuckets, knownIssues, unknownIssues, accessibilityLevels, security, generatedAt) {
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
    <p class="lede">Each section below is judged against its own threshold - see ai/release-readiness.md.</p>
  </header>

  <section class="group">
    <h2>E2E - by risk level</h2>
    <table class="suite-table">
      <thead>
        <tr><th>Risk</th><th>Total</th><th>Passed</th><th>Failed</th><th>Max allowed</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${e2eBuckets.map(renderE2eRow).join('\n')}
      </tbody>
    </table>
    ${unknownIssues.length ? renderUnknownIssues(unknownIssues) : ''}
    ${knownIssues.length ? renderKnownIssues(knownIssues) : ''}
  </section>

  <section class="group">
    <h2>Accessibility - by WCAG level</h2>
    <table class="suite-table">
      <thead>
        <tr><th>Level</th><th>Threshold</th><th>Scenarios</th><th>Blocker/Critical</th><th>Major</th><th>Minor</th><th>Cosmetic</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${accessibilityLevels.map(renderA11yRow).join('\n')}
      </tbody>
    </table>
  </section>

  <section class="group">
    <h2>Security</h2>
    <table class="suite-table">
      <thead>
        <tr><th>Total</th><th>Passed</th><th>Failed</th><th>Threshold</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr class="${security.ready ? 'pass' : 'fail'}">
          <td>${security.total}</td>
          <td>${security.passed}</td>
          <td>${security.failures}</td>
          <td>${escapeHtml(security.thresholdLabel)}</td>
          <td><span class="badge badge-${security.ready ? 'pass' : 'fail'}">${security.total === 0 ? 'No results' : security.ready ? 'OK' : 'Fail'}</span></td>
        </tr>
      </tbody>
    </table>
  </section>

  ${EXCLUDED_SUITES.length ? renderExcluded() : ''}

  <footer class="footer">Generated ${escapeHtml(generatedAt)}</footer>
</div>
</body>
</html>`;
}

function renderE2eRow(b) {
  const noResults = b.total === 0;
  const statusClass = noResults ? 'fail' : b.ready ? 'pass' : 'fail';
  const statusLabel = noResults ? 'No results' : b.ready ? 'OK' : 'Fail';
  return `
      <tr class="${statusClass}">
        <td>${escapeHtml(b.label)}</td>
        <td>${b.total}</td>
        <td>${b.passed}</td>
        <td>${b.failures}</td>
        <td>${b.maxFailures}</td>
        <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
      </tr>`;
}

function renderA11yRow(l) {
  const noResults = l.total === 0;
  const statusClass = noResults ? 'fail' : l.ready ? 'pass' : 'fail';
  const statusLabel = noResults ? 'No results' : l.ready ? 'OK' : 'Fail';
  return `
      <tr class="${statusClass}">
        <td>${escapeHtml(l.level)}</td>
        <td>${escapeHtml(l.thresholdLabel)}</td>
        <td>${l.passed}/${l.total}</td>
        <td>${l.severityCounts.critical}</td>
        <td>${l.severityCounts.serious}</td>
        <td>${l.severityCounts.moderate}</td>
        <td>${l.severityCounts.minor}</td>
        <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
      </tr>`;
}

function renderKnownIssues(knownIssues) {
  return `
    <div class="issue-table">
      <h3>Known issues <span class="muted">(still count toward Failed above)</span></h3>
      <table class="suite-table">
        <thead>
          <tr><th>Ticket</th><th>Scenario</th><th>Risk</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${knownIssues.map(renderKnownIssueRow).join('\n')}
        </tbody>
      </table>
    </div>`;
}

function renderKnownIssueRow(k) {
  const isStale = k.status === 'passing';
  return `
      <tr class="${isStale ? 'stale' : 'known'}">
        <td><code>${escapeHtml(k.ticket)}</code></td>
        <td>${escapeHtml(k.name)}</td>
        <td>${escapeHtml(k.riskLabel)}</td>
        <td><span class="badge badge-${isStale ? 'stale' : 'known'}">${isStale ? 'Now passing - remove tag?' : 'Still failing'}</span></td>
      </tr>`;
}

function renderUnknownIssues(unknownIssues) {
  return `
    <div class="issue-table">
      <h3>Unknown issues <span class="muted">(no @known-issue tag - needs triage)</span></h3>
      <table class="suite-table">
        <thead>
          <tr><th>Scenario</th><th>Risk</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${unknownIssues.map(renderUnknownIssueRow).join('\n')}
        </tbody>
      </table>
    </div>`;
}

function renderUnknownIssueRow(u) {
  return `
      <tr class="fail">
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.riskLabel)}</td>
        <td><span class="badge badge-fail">Failing</span></td>
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
  --warn: #9a6b1f;
  --warn-bg: #faf0dc;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--text);
  background: linear-gradient(180deg, #eef4fb 0%, var(--bg) 100%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.wrap { max-width: 1000px; margin: 0 auto; padding: 32px 20px 56px; }
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
.group { margin-top: 28px; }
.group h2 { font-size: 16px; margin: 0 0 10px; }
.suite-table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.suite-table th, .suite-table td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--line); font-size: 14px; }
.suite-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.suite-table tr:last-child td { border-bottom: none; }
.suite-table tr.fail td:first-child { border-left: 4px solid var(--fail); }
.suite-table tr.pass td:first-child { border-left: 4px solid var(--pass); }
.badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.badge-pass { background: var(--pass-bg); color: var(--pass); }
.badge-fail { background: var(--fail-bg); color: var(--fail); }
.badge-known { background: var(--warn-bg); color: var(--warn); }
.badge-stale { background: var(--warn-bg); color: var(--warn); }
.issue-table { margin-top: 14px; }
.issue-table h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 8px; }
.issue-table h3 .muted { text-transform: none; letter-spacing: normal; font-weight: 400; }
.issue-table tr.known td:first-child, .issue-table tr.stale td:first-child { border-left: 4px solid var(--warn); }
.issue-table code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; background: var(--bg); border-radius: 4px; padding: 2px 6px; font-size: 12px; }
.excluded { margin-top: 24px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
.excluded h2 { margin: 0 0 8px; font-size: 16px; }
.excluded ul { margin: 0; padding-left: 20px; color: var(--muted); font-size: 14px; }
.footer { margin-top: 24px; font-size: 12px; color: var(--muted); text-align: center; }
`;

main();
