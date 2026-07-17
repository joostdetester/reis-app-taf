---
title: Security Testing
description: Scope, OWASP Top 10 mapping, and known gaps for this project's @security test track.
owner: team-qa
tags: [testing, security, ui, owasp]
version: 1.0
---

# Security Testing

Phased strategy, hands-on OWASP Top 10 applied to `reis-app` (tested via
this `reis-app-taf` project). See `ai/test-backlog.md` for the per-scenario
backlog and the strategy artifact linked from the original handoff for the
full 5-phase roadmap.

## Scope

`reis-app` is a small, single-tenant family trip app with a "secret link,
no password" access model (see `reis-app`'s own `SECURITY.md`) - not every
OWASP Top 10 category applies. Each category is assessed deliberately below
rather than silently skipped.

| Category | Relevance | Approach |
| -------- | --------- | -------- |
| A01 Broken Access Control | High | Fixed in `reis-app` (`verify-edit-token`); regression-tested in `features/edit-flow.feature`'s invalid-token scenario. |
| A02 Cryptographic Failures | Medium | `@security` — the edit token must not linger in the visible URL (`features/security.feature`). |
| A03 Injection | Medium | `@security` — XSS smoke test on the trip search field (`features/security.feature`). |
| A04 Insecure Design | Low | N/A — small single-tenant app with no bespoke auth architecture. |
| A05 Security Misconfiguration | Medium | `@security` — response-headers check. Currently only asserts HSTS (the only one present); see Known gaps below. |
| A06 Vulnerable & Outdated Components | High | Phase 3/4 (not yet built): `npm audit` locally and in CI. |
| A07 Identification & Auth Failures | Low | No user accounts, only a link token — overlaps with A01. |
| A08 Software & Data Integrity Failures | Low | No supply chain beyond regular npm dependencies. |
| A09 Security Logging & Monitoring Failures | Low | Hobby project, no monitoring infrastructure. |
| A10 Server-Side Request Forgery | Low | No known server-side fetch of a user-supplied URL — revisit if that changes. |

## What's deliberately out of scope for now

- **XSS on the notes field itself.** The notes field only becomes a stored-
  XSS vector once a saved value is *rendered back* — testing that requires
  actually persisting a payload, which conflicts with the same constraint
  already blocking `ai/test-backlog.md`'s "Opslaan persisteert de wijziging
  correct" item: there's no separate test/staging endpoint, so a write test
  would overwrite real family trip data. The trip search field gives the
  same signal (does the app safely handle arbitrary user input rendered
  live?) without that risk, since it only filters/re-renders client-side and
  never persists anything - that's the scenario built instead.
- **OWASP ZAP baseline scan, manual devtools check, `npm audit`.** Phase 3 —
  deliberately manual/periodic, not CI, and only ever against test/
  acceptance environments, never production with real family data.
- **A `security` CI job.** Phase 4 — this track currently runs the same way
  `@visual`/`@accessibility` do (`npm run test:security`), but isn't wired
  into `.github/workflows/ci.yml` yet.

## Known gap: missing response headers

Confirmed live against `BASE_URL` (2026-07-17): the app's response only
sets `Strict-Transport-Security`. It's missing `Content-Security-Policy`,
`X-Frame-Options` (or a CSP `frame-ancestors` equivalent), and
`X-Content-Type-Options`. `features/security.feature`'s headers scenario
only asserts on HSTS (the one header actually present) rather than encoding
a permanently-failing assertion for the others — this is tracked as a
known, undone fix in `reis-app` (likely a `vercel.json` `headers` block),
not something to silently paper over with a red test. Widen that scenario's
assertions once the fix lands.

## Tags

- `@security` on every security scenario, combined with `@ui`.
- Drives Allure's `Security` parentSuite (`steps/fixtures.ts`, same pattern
  as `Accessibility`/`Visual Regression`) and `npm run test:security` /
  `--grep @security`.
- `npm run test:e2e` explicitly excludes `@security` so these scenarios
  don't also run (and double-count) as part of the main E2E job.
