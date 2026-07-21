// Aggregates raw Allure results (allure-results/*-result.json) and the raw
// accessibility scan records (a11y-report-data/*.json) into a single
// release-readiness verdict, and writes a standalone HTML report (plus
// data.json) - independent of the Allure report. Exits non-zero when not
// ready - that exit code is what makes the release-readiness CI job itself
// fail, i.e. the actual gate. Run via `npm run release:readiness` after the
// test jobs. See ai/release-readiness.md for the full policy.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const RESULTS_DIR = process.env.ALLURE_RESULTS_DIR ?? 'allure-results';
const A11Y_DATA_DIR = process.env.A11Y_REPORT_DATA_DIR ?? 'a11y-report-data';
const OUT_DIR = process.env.RELEASE_READINESS_OUT_DIR ?? 'release-readiness-report';
const ALLURE_HISTORY_PATH = path.join(RESULTS_DIR, 'history', 'history.json');
const REIS_APP_REPO_DIR = process.env.REIS_APP_REPO_DIR ?? 'reis-app-repo';
// This repo's own working directory - a full (not shallow) checkout in CI,
// see ci.yml - so its commit history can be walked the same way
// REIS_APP_REPO_DIR's is.
const REIS_APP_TAF_REPO_DIR = process.env.REIS_APP_TAF_REPO_DIR ?? '.';
// GitHub's own record of this workflow's past runs (`gh run list`, fetched
// by ci.yml before this script runs) - see loadCiRunHistory.
const CI_RUN_HISTORY_PATH = process.env.CI_RUN_HISTORY_PATH ?? 'ci-run-history.json';

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
// @risk-low get a failure allowance instead of the usual 100%. A scenario
// that's missing a risk tag defaults to 'high' (fail-closed: an un-tagged
// scenario counts as risky rather than silently getting the most lenient
// tolerance).
//
// maxFailurePercent is a percentage of the *total E2E count across all
// three buckets combined*, not of that bucket's own total - e.g. Low
// risk's 5% is 5% of every E2E scenario, not 5% of just the low-risk ones.
// Rounded up, with a minimum of 1 once the percentage is above 0% (see
// computeMaxFailures below) - a fractional "0.57 failures allowed" isn't
// meaningful, and rounding a small-but-nonzero tolerance down to 0 would
// make High/Low behave exactly like Critical on a small suite, defeating
// the point of having three tiers.
const E2E_RISK_BUCKETS = [
  { key: 'critical', tag: 'critical', label: 'Critical', maxFailurePercent: 0 },
  { key: 'high', tag: 'risk-high', label: 'High risk', maxFailurePercent: 1 },
  { key: 'low', tag: 'risk-low', label: 'Low risk', maxFailurePercent: 5 },
];
const DEFAULT_E2E_RISK = 'high';

function computeMaxFailures(percent, totalE2e) {
  if (percent <= 0) return 0;
  return Math.max(1, Math.ceil((percent / 100) * totalE2e));
}

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
// headers below) for *what* fails a "<Page> meets WCAG level <X>" scenario -
// that severity logic is unchanged, still what Allure/the `accessibility`
// job actually gates on.
//
// maxFailurePercent is a separate, additional readiness check layered on
// top of the scenario gate: a percentage of *that level's own scenario
// count* that its Major/Minor/Cosmetic "violation type" volume may not
// exceed (see computeAccessibilityLevels for exactly what's counted).
// Unlike the E2E buckets, each level's percentage is measured against its
// OWN total, not the combined total across all three levels - AA and AAA
// don't necessarily run the same number of scenarios, and a shared
// denominator would let one level's scenario count dilute another's
// tolerance. Rounded up, with a minimum of 1 once above 0% (see
// computeMaxFailures). Level A stays 0% regardless (baseline conformance
// level, no tolerance for anything, same as @critical in E2E).
//
// Blocker/Critical itself is NEVER eligible for this percentage, at any
// level - a scenario that failed because of a Blocker/Critical finding
// always counts as a hard failure (0 allowed, see HARD_FAILURE_IMPACT
// below), independent of how the volume tolerance works out.
const A11Y_LEVELS = [
  {
    level: 'A',
    gateImpacts: ['critical', 'serious'],
    thresholdLabel: '0 Blocker/Critical, 0 Major',
    maxFailurePercent: 0,
  },
  { level: 'AA', gateImpacts: ['critical'], thresholdLabel: '0 Blocker/Critical', maxFailurePercent: 1 },
  { level: 'AAA', gateImpacts: ['critical'], thresholdLabel: '0 Blocker/Critical', maxFailurePercent: 5 },
];

// A scenario that failed because its scan found a Blocker/Critical
// violation always counts as a hard failure - 0 tolerance, at every level,
// never subject to the violation-type-volume percentage above.
const HARD_FAILURE_IMPACT = 'critical';

const SECURITY_THRESHOLD_LABEL = '100% pass (0 failed/broken)';

async function main() {
  const generatedAt = new Date().toISOString();
  const latestByHistoryId = await loadLatestAllureResults();
  const allureHistory = await loadAllureHistory();
  const reisAppTimeline = loadCommitTimeline(REIS_APP_REPO_DIR);
  const reisAppTafTimeline = loadCommitTimeline(REIS_APP_TAF_REPO_DIR);
  const ciRunHistory = await loadCiRunHistory();

  const {
    buckets: e2eBuckets,
    knownIssues,
    unknownIssues,
    totalE2e,
  } = computeE2eBuckets(latestByHistoryId, allureHistory, reisAppTimeline, reisAppTafTimeline, ciRunHistory);
  const { levels: accessibilityLevels, totalA11y } = await computeAccessibilityLevels(latestByHistoryId);
  const security = computeSecurity(latestByHistoryId);

  const overallReady =
    e2eBuckets.every((b) => b.ready) && accessibilityLevels.every((l) => l.ready) && security.ready;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, 'data.json'),
    JSON.stringify(
      {
        generatedAt,
        overallReady,
        totalE2e,
        e2eBuckets,
        knownIssues,
        unknownIssues,
        totalA11y,
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
    buildHtmlReport(
      overallReady,
      totalE2e,
      e2eBuckets,
      knownIssues,
      unknownIssues,
      totalA11y,
      accessibilityLevels,
      security,
      generatedAt,
    ),
  );

  console.log(overallReady ? 'READY FOR RELEASE' : 'NOT READY FOR RELEASE');
  console.log(`E2E (by risk, ${totalE2e} total across all buckets):`);
  for (const b of e2eBuckets) {
    console.log(
      `  ${b.label}: ${b.passed}/${b.total} passed, ${b.failures} failing (max ${b.maxFailures} allowed - ${b.maxFailurePercent}% of ${totalE2e}) - ${b.ready ? 'OK' : 'FAIL'}`,
    );
  }
  if (knownIssues.length) {
    console.log('Known issues (still count toward the failure counts above):');
    for (const k of knownIssues) {
      console.log(`  [${k.ticket}] ${k.name} (${k.riskLabel}) - ${k.status}${formatTrendLogLabel(k.trend)}`);
    }
  }
  if (unknownIssues.length) {
    console.log('Unknown issues (unexpected failures, no @known-issue tag yet):');
    for (const u of unknownIssues) {
      console.log(`  ${u.name} (${u.riskLabel})${formatTrendLogLabel(u.trend)}`);
    }
  }
  console.log(`Accessibility (by WCAG level, ${totalA11y} scenarios across all levels):`);
  for (const l of accessibilityLevels) {
    console.log(
      `  ${l.level}: ${l.passed}/${l.total} scenarios passed, ${l.hardFailures} Blocker/Critical scenario failures - always 0 allowed, ${l.nonCriticalTypes} non-critical violation types found - max ${l.maxAllowedTypes} allowed (${l.maxFailurePercent}% of ${l.total} scenarios), threshold ${l.thresholdLabel} - severity counts ${JSON.stringify(l.severityCounts)} - ${l.ready ? 'OK' : 'FAIL'}`,
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
        start: raw.start,
        stop: raw.stop,
        historyId: raw.historyId,
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

// Same per-test run history Allure's own Trend widget reads (fetched from
// the previously published report by ci.yml, before this script runs) -
// Allure retains at most the last 20 runs per historyId, newest first.
// Missing entirely (e.g. this branch's very first run) just means no known
// issue gets trend stats - not a hard failure.
async function loadAllureHistory() {
  try {
    return JSON.parse(await readFile(ALLURE_HISTORY_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

// Shared by both reis-app (REIS_APP_REPO_DIR, a separate checkout) and this
// repo itself (REIS_APP_TAF_REPO_DIR, the job's own checkout - needs
// fetch-depth: 0 in ci.yml, unlike the default shallow clone). Returns
// commits oldest-first with their committer-date timestamp, or null if the
// checkout isn't present/isn't a full clone (e.g. a best-effort CI step
// failed, or a local run with no REIS_APP_REPO_DIR).
function loadCommitTimeline(repoDir) {
  try {
    const output = execFileSync('git', ['log', '--format=%H %cI'], {
      cwd: repoDir,
      encoding: 'utf-8',
    });
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const spaceIndex = line.indexOf(' ');
        return {
          hash: line.slice(0, spaceIndex),
          timestampMs: new Date(line.slice(spaceIndex + 1)).getTime(),
        };
      })
      .sort((a, b) => a.timestampMs - b.timestampMs);
  } catch {
    return null;
  }
}

// The newest commit at or before the given timestamp - an approximation of
// "what was checked out/live at the time", not a guarantee: for reis-app in
// particular, deploys are manual (`vercel --prod`), not triggered
// automatically per commit, so a commit's own timestamp isn't necessarily
// when it actually went live. See ai/release-readiness.md.
function resolveCommitAt(timeline, timestampMs) {
  if (!timeline?.length) return null;
  let result = null;
  for (const commit of timeline) {
    if (commit.timestampMs <= timestampMs) result = commit;
    else break;
  }
  return result ? result.hash.slice(0, 7) : null;
}

// GitHub's own record of this workflow's past runs on this branch (`gh run
// list`, fetched by ci.yml as CI_RUN_HISTORY_PATH before this script runs) -
// unlike a self-maintained log, every historical run is already present, no
// warm-up period needed for old trend rows to resolve. Sorted oldest-first,
// same shape as loadCommitTimeline's output. Missing/invalid just means the
// fetch step failed or this ran outside CI - the CI-run column then shows
// "unknown" everywhere rather than failing the gate over it.
async function loadCiRunHistory() {
  try {
    const raw = JSON.parse(await readFile(CI_RUN_HISTORY_PATH, 'utf-8'));
    if (!Array.isArray(raw)) return [];
    const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
    const repo = process.env.GITHUB_REPOSITORY;
    return raw
      .map((run) => ({
        runNumber: run.number,
        runUrl: repo && run.databaseId ? `${serverUrl}/${repo}/actions/runs/${run.databaseId}` : null,
        commit: typeof run.headSha === 'string' ? run.headSha.slice(0, 7) : null,
        createdAtMs: new Date(run.createdAt).getTime(),
      }))
      .sort((a, b) => a.createdAtMs - b.createdAtMs);
  } catch {
    return [];
  }
}

// A test's own timestamp always falls sometime after its own CI run started
// (`createdAt`) and before that run finished - by a few minutes at most,
// given this workflow's job durations. Generous on purpose to tolerate CI
// queueing delays without starting to misattribute an earlier run.
const CI_RUN_MATCH_WINDOW_MS = 30 * 60 * 1000;

// The most recent CI run that had already started at or before the given
// test timestamp - i.e. the run that was actually in progress when this
// test ran - but only if it's close enough to plausibly be that run.
// Returns null (rendered as "unknown") when nothing plausible is on record,
// e.g. `gh run list`'s own --limit cutting off before this test's time.
function resolveRunAt(ciRunHistory, timestampMs) {
  let result = null;
  for (const run of ciRunHistory) {
    if (run.createdAtMs > timestampMs) break;
    result = run;
  }
  if (!result) return null;
  return timestampMs - result.createdAtMs <= CI_RUN_MATCH_WINDOW_MS ? result : null;
}

// Success rate, current pass streak, and (if reis-app's history is
// available) the streak's starting reis-app version, for a single known
// issue - purely additional context alongside the hard pass/fail count
// already gating the release, not itself part of the gate.
function buildIssueTrend(test, allureHistory, reisAppTimeline, reisAppTafTimeline, ciRunHistory) {
  const entry = test.historyId ? allureHistory?.[test.historyId] : undefined;
  const publishedItems = entry?.items ?? []; // newest-first, per Allure's own ordering

  // Allure's own history.json for this branch is only refreshed by the Test
  // Summary job, which (see ci.yml) always runs *after* this one in the
  // same workflow run - so publishedItems never yet contains this run's own
  // result. Prepend it directly from this run's own data rather than always
  // showing a trend that's one run behind.
  const currentTimestamp = test.start ?? test.stop;
  const alreadyPublished =
    currentTimestamp != null && publishedItems.some((item) => item.time?.start === currentTimestamp);
  const rawItems =
    currentTimestamp != null && !alreadyPublished
      ? [{ status: test.status, time: { start: currentTimestamp } }, ...publishedItems]
      : publishedItems;
  if (!rawItems.length) return null;

  // Cap back to Allure's own 20-run retention window now that the prepend
  // above may have pushed it to 21.
  const items = rawItems.slice(0, 20);
  const total = items.length;
  const passed = items.filter((item) => item.status === 'passed').length;

  let streak = 0;
  for (const item of items) {
    if (item.status !== 'passed') break;
    streak++;
  }
  const streakSinceVersion =
    streak > 0 ? resolveCommitAt(reisAppTimeline, items[streak - 1].time.start) : null;

  const runs = items.map((item) => {
    const run = resolveRunAt(ciRunHistory, item.time.start);
    return {
      timestampMs: item.time.start,
      status: item.status,
      reisAppVersion: resolveCommitAt(reisAppTimeline, item.time.start),
      tafCommit: resolveCommitAt(reisAppTafTimeline, item.time.start),
      tafRunNumber: run?.runNumber ?? null,
      tafRunUrl: run?.runUrl ?? null,
    };
  });

  return {
    total,
    passed,
    successRatePercent: Math.round((passed / total) * 100),
    streak,
    streakSinceVersion,
    runs,
  };
}

function formatTrendLogLabel(trend) {
  if (!trend) return '';
  const since = trend.streakSinceVersion ? ` since reis-app ${trend.streakSinceVersion}` : '';
  return ` - success rate ${trend.successRatePercent}% (${trend.passed}/${trend.total}), streak ${trend.streak}${since}`;
}

function computeE2eBuckets(latestByHistoryId, allureHistory, reisAppTimeline, reisAppTafTimeline, ciRunHistory) {
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
      if (ticket) {
        knownIssues.push({
          name: test.name,
          ticket,
          riskLabel,
          status: 'passing',
          trend: buildIssueTrend(test, allureHistory, reisAppTimeline, reisAppTafTimeline, ciRunHistory),
        });
      }
    } else if (isFailure(test.status)) {
      counts[key].failures++;
      if (ticket) {
        knownIssues.push({
          name: test.name,
          ticket,
          riskLabel,
          status: 'failing',
          trend: buildIssueTrend(test, allureHistory, reisAppTimeline, reisAppTafTimeline, ciRunHistory),
        });
      } else {
        unknownIssues.push({
          name: test.name,
          riskLabel,
          status: 'failing',
          trend: buildIssueTrend(test, allureHistory, reisAppTimeline, reisAppTafTimeline, ciRunHistory),
        });
      }
    }
  }

  const totalE2e = Object.values(counts).reduce((sum, c) => sum + c.total, 0);
  const buckets = E2E_RISK_BUCKETS.map((b) => {
    const c = counts[b.key];
    const maxFailures = computeMaxFailures(b.maxFailurePercent, totalE2e);
    return { ...b, ...c, maxFailures, ready: c.failures <= maxFailures };
  });
  return { buckets, knownIssues, unknownIssues, totalE2e };
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

// scanAccessibility()'s title -> "page" derivation (see
// pageobjects/_shared/accessibility.ts's writeReportRecord), mirrored here
// so a failing Allure scenario can be matched back to its raw a11y-report-
// data record(s) by the same (page, level) key.
function pageNameFromScenario(name) {
  return (name ?? '').replace(/\s+meets WCAG level \S+$/i, '');
}

// Two data sources, cross-checked: Allure pass/fail per "<Page> meets WCAG
// level <X>" scenario (authoritative - this is what actually gates the
// accessibility job), and a11y-report-data's raw axe violations per scan
// (for the severity-count breakdown, and to tell a hard Blocker/Critical
// failure apart from a soft lower-severity one - the Allure result alone
// doesn't say *why* a level failed, just that it did).
async function computeAccessibilityLevels(latestByHistoryId) {
  const scenarioCounts = Object.fromEntries(
    A11Y_LEVELS.map((l) => [l.level, { total: 0, passed: 0, failures: 0 }]),
  );
  const failingScenarios = [];
  for (const test of latestByHistoryId.values()) {
    if (test.parentSuite !== 'Accessibility') continue;
    const match = /meets WCAG level (A|AA|AAA)\b/i.exec(test.name ?? '');
    if (!match) continue;
    const level = match[1].toUpperCase();
    if (!scenarioCounts[level]) continue;
    scenarioCounts[level].total++;
    if (test.status === 'passed') scenarioCounts[level].passed++;
    else if (isFailure(test.status)) {
      scenarioCounts[level].failures++;
      failingScenarios.push({ level, page: pageNameFromScenario(test.name) });
    }
  }

  // Per scan, axe's `violations` array already has at most one entry per
  // rule - a rule flagging 6 elements on one page is one entry with 6
  // `nodes`, not 6 entries - so this is already a violation-*type* count,
  // not an element count, with no extra dedup needed. A rule recurring on
  // 2 different pages (or 2 scans of the same page, e.g. across browser
  // projects) counts twice - once per scan it actually appears in.
  const severityCounts = Object.fromEntries(
    A11Y_LEVELS.map((l) => [l.level, { critical: 0, serious: 0, moderate: 0, minor: 0 }]),
  );
  const recordsByPageLevel = new Map();
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
    const key = `${record.page} ${record.level}`;
    if (!recordsByPageLevel.has(key)) recordsByPageLevel.set(key, []);
    recordsByPageLevel.get(key).push(record);
  }

  // A failing scenario always counts as a hard failure (0 tolerance) when
  // its scan actually found a Blocker/Critical violation - which, given
  // GATE_IMPACTS, is the only way AA/AAA ever fail a scenario at all, and
  // one of two ways Level A can. Missing raw data for a failing scenario is
  // treated as hard too - fail-closed, never silently grant tolerance we
  // can't actually verify.
  const hardFailures = Object.fromEntries(A11Y_LEVELS.map((l) => [l.level, 0]));
  for (const { level, page } of failingScenarios) {
    const records = recordsByPageLevel.get(`${page} ${level}`) ?? [];
    const hasHardImpact = records.some((r) =>
      (r.violations ?? []).some((v) => v.impact === HARD_FAILURE_IMPACT),
    );
    if (hasHardImpact || records.length === 0) hardFailures[level]++;
  }

  const totalA11y = Object.values(scenarioCounts).reduce((sum, c) => sum + c.total, 0);
  const levels = A11Y_LEVELS.map((l) => {
    const c = scenarioCounts[l.level];
    const s = severityCounts[l.level];
    const nonCriticalTypes = s.serious + s.moderate + s.minor;
    // Each level's own scenario count, not the combined total across all
    // three levels - see A11Y_LEVELS' comment on why.
    const maxAllowedTypes = computeMaxFailures(l.maxFailurePercent, c.total);
    const hard = hardFailures[l.level];
    return {
      level: l.level,
      thresholdLabel: l.thresholdLabel,
      maxFailurePercent: l.maxFailurePercent,
      ...c,
      hardFailures: hard,
      nonCriticalTypes,
      maxAllowedTypes,
      ready: c.total > 0 && hard === 0 && nonCriticalTypes <= maxAllowedTypes,
      severityCounts: s,
    };
  });
  return { levels, totalA11y };
}

function buildHtmlReport(
  overallReady,
  totalE2e,
  e2eBuckets,
  knownIssues,
  unknownIssues,
  totalA11y,
  accessibilityLevels,
  security,
  generatedAt,
) {
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
    <h2>E2E - by risk level <span class="muted">(${totalE2e} total across all buckets)</span></h2>
    <table class="suite-table">
      <thead>
        <tr><th>Risk</th><th>Total</th><th>Passed</th><th>Failed</th><th>Max allowed</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${e2eBuckets.map((b) => renderE2eRow(b, totalE2e)).join('\n')}
      </tbody>
    </table>
    ${unknownIssues.length ? renderUnknownIssues(unknownIssues) : ''}
    ${knownIssues.length ? renderKnownIssues(knownIssues) : ''}
  </section>

  <section class="group">
    <h2>Accessibility - by WCAG level <span class="muted">(${totalA11y} scenarios across all levels)</span></h2>
    <table class="suite-table a11y-table">
      <thead>
        <tr>
          <th rowspan="2">Level</th>
          <th rowspan="2">Threshold</th>
          <th colspan="2" class="group-header">Scenario gate <span class="muted">(hard block - GATE_IMPACTS, unchanged)</span></th>
          <th colspan="6" class="group-header group-divider">Violations found <span class="muted">(every distinct violation type axe found at this level - "Non-critical total" and "Max allowed" drive Status too)</span></th>
          <th rowspan="2">Status</th>
        </tr>
        <tr>
          <th>Scenarios</th>
          <th>Hard block</th>
          <th class="group-divider">Blocker/Critical</th>
          <th>Major</th>
          <th>Minor</th>
          <th>Cosmetic</th>
          <th>Non-critical total</th>
          <th>Max allowed</th>
        </tr>
      </thead>
      <tbody>
        ${accessibilityLevels.map((l) => renderA11yRow(l)).join('\n')}
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

  <footer class="footer">Generated <span data-ts="${new Date(generatedAt).getTime()}">${escapeHtml(generatedAt)}</span></footer>
</div>
<script>${TIMESTAMP_SCRIPT}</script>
</body>
</html>`;
}

function renderE2eRow(b, totalE2e) {
  const noResults = b.total === 0;
  const statusClass = noResults ? 'fail' : b.ready ? 'pass' : 'fail';
  const statusLabel = noResults ? 'No results' : b.ready ? 'OK' : 'Fail';
  return `
      <tr class="${statusClass}">
        <td>${escapeHtml(b.label)}</td>
        <td>${b.total}</td>
        <td>${b.passed}</td>
        <td>${b.failures}</td>
        <td>${b.maxFailures} <span class="muted">(${b.maxFailurePercent}% of ${totalE2e})</span></td>
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
        <td>${l.hardFailures} <span class="muted">(never tolerated)</span></td>
        <td class="group-divider">${l.severityCounts.critical}</td>
        <td>${l.severityCounts.serious}</td>
        <td>${l.severityCounts.moderate}</td>
        <td>${l.severityCounts.minor}</td>
        <td>${l.nonCriticalTypes}</td>
        <td>${l.maxAllowedTypes} <span class="muted">(${l.maxFailurePercent}% of ${l.total})</span></td>
        <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
      </tr>`;
}

function renderKnownIssues(knownIssues) {
  return `
    <div class="issue-table">
      <h3>Known issues <span class="muted">(still count toward Failed above)</span></h3>
      <table class="suite-table">
        <thead>
          <tr><th>Ticket</th><th>Scenario</th><th>Risk</th><th>Success rate</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${knownIssues.map(renderKnownIssueRow).join('\n')}
        </tbody>
      </table>
    </div>`;
}

function renderKnownIssueRow(k) {
  const isStale = k.status === 'passing';
  const row = `
      <tr class="${isStale ? 'stale' : 'known'}">
        <td><code>${escapeHtml(k.ticket)}</code></td>
        <td>${escapeHtml(k.name)}</td>
        <td>${escapeHtml(k.riskLabel)}</td>
        <td>${renderIssueTrendSummary(k.trend)}</td>
        <td><span class="badge badge-${isStale ? 'stale' : 'known'}">${isStale ? 'Now passing - remove tag?' : 'Still failing'}</span></td>
      </tr>`;
  const details = k.trend ? renderIssueTrendDetails(k.trend) : '';
  return details ? `${row}\n      <tr class="${isStale ? 'stale' : 'known'}"><td colspan="5">${details}</td></tr>` : row;
}

// "Success rate" summary cell - a run history of at most Allure's own
// retention window (20 runs), not the full lifetime of the scenario, so
// this reads as "recently" rather than an all-time statistic that never
// meaningfully changes once a ticket's been open a while.
function renderIssueTrendSummary(trend) {
  if (!trend) return '<span class="muted">No history yet</span>';
  const since = trend.streakSinceVersion
    ? `, since reis-app <code>${escapeHtml(trend.streakSinceVersion)}</code>`
    : '';
  const streakLabel = trend.streak > 0 ? `${trend.streak} in a row${since}` : 'currently failing';
  return `${trend.successRatePercent}% <span class="muted">(${trend.passed}/${trend.total})</span><br /><span class="muted">${streakLabel}</span>`;
}

function renderIssueTrendDetails(trend) {
  const rows = trend.runs
    .map(
      (run) => `
          <tr>
            <td data-ts="${run.timestampMs}">${escapeHtml(new Date(run.timestampMs).toISOString())}</td>
            <td>${run.tafCommit ? `<code>${escapeHtml(run.tafCommit)}</code>` : '<span class="muted">unknown</span>'}</td>
            <td>${run.tafRunNumber && run.tafRunUrl ? `<a href="${escapeHtml(run.tafRunUrl)}">#${run.tafRunNumber}</a>` : '<span class="muted">unknown</span>'}</td>
            <td><span class="badge badge-${run.status === 'passed' ? 'pass' : 'fail'}">${run.status === 'passed' ? 'Passed' : 'Failed'}</span></td>
            <td>${run.reisAppVersion ? `<code>${escapeHtml(run.reisAppVersion)}</code>` : '<span class="muted">unknown</span>'}</td>
          </tr>`,
    )
    .join('\n');
  return `
    <details class="trend-details">
      <summary>Last ${trend.runs.length} runs</summary>
      <p class="muted trend-note">The "CI run" link always works (GitHub keeps run logs indefinitely), but each
      run's own report snapshot - linked from that run's own job summary - is only kept for the last 20 runs;
      older rows above may show a live CI log with no report to go with it any more.</p>
      <table class="suite-table trend-table">
        <thead><tr><th>Run</th><th>reis-app-taf version</th><th>CI run</th><th>Status</th><th>reis-app version</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

function renderUnknownIssues(unknownIssues) {
  return `
    <div class="issue-table">
      <h3>Unknown issues <span class="muted">(no @known-issue tag - needs triage)</span></h3>
      <table class="suite-table">
        <thead>
          <tr><th>Scenario</th><th>Risk</th><th>Success rate</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${unknownIssues.map(renderUnknownIssueRow).join('\n')}
        </tbody>
      </table>
    </div>`;
}

function renderUnknownIssueRow(u) {
  const row = `
      <tr class="fail">
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.riskLabel)}</td>
        <td>${renderIssueTrendSummary(u.trend)}</td>
        <td><span class="badge badge-fail">Failing</span></td>
      </tr>`;
  const details = u.trend ? renderIssueTrendDetails(u.trend) : '';
  return details ? `${row}\n      <tr class="fail"><td colspan="4">${details}</td></tr>` : row;
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
.muted { color: var(--muted); }
.group h2 .muted { font-size: 13px; font-weight: 400; }
td .muted { font-size: 12px; }
.suite-table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.suite-table th, .suite-table td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--line); font-size: 14px; }
.suite-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.suite-table tr:last-child td { border-bottom: none; }
.suite-table tr.fail td:first-child { border-left: 4px solid var(--fail); }
.suite-table tr.pass td:first-child { border-left: 4px solid var(--pass); }
.a11y-table .group-header { text-align: center; }
.a11y-table .group-header .muted { display: block; text-transform: none; letter-spacing: normal; font-weight: 400; font-size: 11px; margin-top: 2px; }
.a11y-table .group-divider { border-left: 2px solid var(--line); }
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
.trend-details { font-size: 13px; }
.trend-details summary { cursor: pointer; color: var(--muted); }
.trend-note { margin: 8px 0 0; font-size: 12px; }
.trend-table { margin-top: 8px; box-shadow: none; }
.trend-table th, .trend-table td { padding: 6px 10px; font-size: 12px; }
.excluded { margin-top: 24px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 20px; }
.excluded h2 { margin: 0 0 8px; font-size: 16px; }
.excluded ul { margin: 0; padding-left: 20px; color: var(--muted); font-size: 14px; }
.footer { margin-top: 24px; font-size: 12px; color: var(--muted); text-align: center; }
`;

// Every timestamp is embedded as a raw epoch-ms `data-ts` attribute and
// formatted here, in the viewer's browser, rather than pre-formatted to a
// fixed "UTC" string at generation time (this script runs on a UTC CI
// runner). Allure's own HTML report formats its timestamps the same way -
// client-side, in the viewer's local timezone - so this keeps the two
// reports showing the same wall-clock time instead of one reading UTC and
// the other reading whatever timezone the viewer happens to be in.
const TIMESTAMP_SCRIPT = `
document.querySelectorAll('[data-ts]').forEach((el) => {
  const ms = Number(el.getAttribute('data-ts'));
  if (Number.isFinite(ms)) el.textContent = new Date(ms).toLocaleString();
});
`;

main();
