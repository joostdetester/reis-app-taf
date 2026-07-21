import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { projectConfig } from './project.config';
import { trackedThirdPartyVersions } from './tracked-third-party-versions';

const LAST_KNOWN_VERSIONS_PATH = path.join(__dirname, 'last-known-versions.json');
const ENVIRONMENT_PROPERTIES_PATH = path.join(process.cwd(), 'allure-results', 'environment.properties');

interface VersionRecord {
  version: string | null;
  commit?: string;
}

type VersionMap = Record<string, VersionRecord>;

async function fetchAppVersion(): Promise<VersionRecord> {
  try {
    const response = await fetch(new URL('/version.json', projectConfig.baseUrl), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    return { version: json.version ?? 'unknown', commit: json.commit ?? 'unknown' };
  } catch (error) {
    console.warn(`[version-tracking] Kon ${projectConfig.baseUrl}/version.json niet ophalen: ${(error as Error).message}`);
    return { version: 'unknown' };
  }
}

// Same CalVer format reis-app's scripts/write-version.mjs uses for its own
// version.json, so the two read consistently side by side in the widget.
function formatCalVer(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
}

// This repo's own version/commit/CI run - distinct from `reis-app`'s (the
// SUT), which tracks what was deployed and tested *against*. Without this,
// the Allure report's Environment widget only shows what reis-app version
// was tested, not which reis-app-taf commit/run produced the report - so it
// can't be traced back to its own source without cross-referencing GitHub
// Actions. `version` is this run's own timestamp (same CalVer shape as
// reis-app.version, so a same-day re-run of the same commit still reads as
// distinct) - not the branch name, which is already its own separate
// "Branch" field (see ci.yml's "Write Allure environment info" step).
// `commit` is the plain short hash, same style as
// check-release-readiness.mjs's trend table, rather than this file's
// previous "<hash> (<committer date>)" - keeps the two reports reading the
// same way. GITHUB_SHA/GITHUB_RUN_NUMBER are always set by the Actions
// runner; commit falls back to `git` directly for local runs (run number
// has no local equivalent, so it's just omitted there).
function resolveTafGitInfo(): VersionRecord & { ciRun?: string } {
  const commit = process.env.GITHUB_SHA ?? tryGit(['rev-parse', 'HEAD']);
  return {
    version: formatCalVer(new Date()),
    commit: commit ? commit.slice(0, 7) : undefined,
    ciRun: process.env.GITHUB_RUN_NUMBER ? `#${process.env.GITHUB_RUN_NUMBER}` : undefined,
  };
}

function tryGit(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
}

function readLastKnownVersions(): VersionMap | undefined {
  if (!existsSync(LAST_KNOWN_VERSIONS_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(LAST_KNOWN_VERSIONS_PATH, 'utf8'));
  } catch (error) {
    console.warn(`[version-tracking] Kon last-known-versions.json niet lezen: ${(error as Error).message}`);
    return undefined;
  }
}

function toPropertyLines(current: VersionMap, previous: VersionMap | undefined): string[] {
  const lines: string[] = [];

  for (const [key, record] of Object.entries(current)) {
    lines.push(`${key}.version=${record.version ?? '(geen API-versie — zie tracked-third-party-versions.ts)'}`);
    if (record.commit) lines.push(`${key}.commit=${record.commit}`);

    // "unknown" means this run couldn't reach the source (e.g. version.json
    // temporarily unreachable) - that's not a real version change, so don't
    // flag it and don't let it clobber the persisted baseline (see
    // buildVersionsToPersist below).
    const previousVersion = previous?.[key]?.version;
    const bothKnown = previousVersion !== undefined && previousVersion !== 'unknown' && record.version !== 'unknown';
    if (bothKnown && previousVersion !== record.version) {
      lines.push(`${key}.version.changed=${previousVersion ?? '(onbekend)'} -> ${record.version ?? '(onbekend)'}`);
    }
  }

  return lines;
}

function buildVersionsToPersist(current: VersionMap, previous: VersionMap | undefined): VersionMap {
  const toPersist: VersionMap = {};
  for (const [key, record] of Object.entries(current)) {
    toPersist[key] = record.version === 'unknown' && previous?.[key] ? previous[key] : record;
  }
  return toPersist;
}

/**
 * Fetches the deployed app's version and combines it with the tracked
 * third-party versions, writes Allure's environment.properties (so the
 * report's Environment widget shows what was tested against), flags any
 * version that differs from the last recorded run, and persists the current
 * versions as the new baseline for the next comparison.
 */
export async function writeVersionEnvironment(): Promise<void> {
  const appVersion = await fetchAppVersion();

  const current: VersionMap = {
    'reis-app': appVersion,
    ...Object.fromEntries(
      Object.entries(trackedThirdPartyVersions).map(([key, entry]) => [key, { version: entry.version }]),
    ),
  };

  const previous = readLastKnownVersions();
  const lines = toPropertyLines(current, previous);

  // reis-app-taf's own commit/branch changes on every run by definition, so
  // it's deliberately kept out of the current/previous diffing above (which
  // would otherwise flag a ".version.changed" - and a last-known-versions.json
  // commit - on every single run) - just a plain, always-fresh property line.
  const tafInfo = resolveTafGitInfo();
  lines.push(`reis-app-taf.version=${tafInfo.version}`);
  if (tafInfo.commit) lines.push(`reis-app-taf.commit=${tafInfo.commit}`);
  if (tafInfo.ciRun) lines.push(`reis-app-taf.ci-run=${tafInfo.ciRun}`);

  mkdirSync(path.dirname(ENVIRONMENT_PROPERTIES_PATH), { recursive: true });
  writeFileSync(ENVIRONMENT_PROPERTIES_PATH, lines.join('\n') + '\n');
  writeFileSync(LAST_KNOWN_VERSIONS_PATH, JSON.stringify(buildVersionsToPersist(current, previous), null, 2) + '\n');

  const changes = lines.filter((line) => line.includes('.version.changed='));
  if (changes.length) {
    console.warn(
      `[version-tracking] Versiewijziging(en) gedetecteerd:\n${changes.map((l) => `  ${l}`).join('\n')}\n` +
        `[version-tracking] config/last-known-versions.json is bijgewerkt — commit dit bestand mee.`,
    );
  }
}
