---
title: Improvement Checklist
description: Openstaande verbeteringen voor deze TAF-repo, één voor één af te vinken.
owner: team-qa
tags: [testing, backlog, checklist]
version: 1.0
---

# Improvement Checklist

Verzameld op 2026-07-17 door een repo-doorlichting (feature files, CI-workflow,
`ai/test-backlog.md`, `ai/security-testing.md`, de release-readiness- en
visual-regression-scripts). Volgorde = voorgestelde prioriteit, niet verplicht.
Vink af en voeg een datum/commit-referentie toe zodra iets is opgepakt.

## Al erkend als schuld in de repo (hoogste prioriteit)

- [ ] **Visual Regression weer aanzetten in CI.** De `visual`-job staat op
      `if: false` in `.github/workflows/ci.yml` omdat de Today-pagina's
      daycard-layout meeloopt met de echte kalenderdatum (baseline wordt
      elke dag stil ongeldig). Fix: klok pinnen voor dat scenario
      (`page.clock.setFixedTime`, zie `ai/visual-regression-testing.md`),
      dan de job weer aanzetten zodat hij ook weer meetelt in
      `release-readiness`.
- [x] **Security headers laten fixen in reis-app.** ~~CSP, X-Frame-Options en
      X-Content-Type-Options ontbreken echt~~ — opgelost in reis-app
      (`vercel.json`, commit "Add security response headers", 2026-07-20),
      live geverifieerd met `curl -sI` tegen productie (alle 3 aanwezig).
      **Nog open:** het scenario in `features/security.feature` (OWASP A05)
      checkt nog alleen Strict-Transport-Security — uitbreiden om CSP/
      X-Frame-Options/X-Content-Type-Options ook echt te asserten staat nog
      niet gebouwd, zie `ai/test-backlog.md`.
- [ ] **"Opslaan" persisteert de wijziging" testen.** Nu geblokkeerd omdat
      write-tests anders de echte gezinsreisdata overschrijven — vereist
      een los test-/staging-endpoint in reis-app. Grootste functionele
      blinde vlek in `features/edit-flow.feature`.
- [ ] **API-niveau testlaag opzetten.** `API_BASE_URL` wijst nog naar een
      placeholder (`jsonplaceholder.typicode.com`) — zodra reis-app een
      eigen API/Edge Functions blootgeeft, is dat nu 0% gedekt. Zie
      "Buiten scope" in `ai/test-backlog.md`.
- [x] **`ai/test-backlog.md` verversen.** Gedaan op 2026-07-20: elk 📝-item
      gecontroleerd tegen de werkelijke `features/*.feature`-bestanden en met
      `npm run test:e2e` herbevestigd. Bijna alle secties bleken al volledig
      gebouwd (Today, Trip overview, Hotels, Vluchten, Praktische informatie,
      grotendeels Bewerkflow) — alleen de bijwerking was blijven liggen.
      Elk ✅-item draagt nu een `(bevestigd: <datum>)`-tag. Foto's
      leeg-staat-scenario ook gebouwd; "met foto's"-scenario blijft
      geblokkeerd (geen testdata).

## Architecturale hiaten

- [ ] **Firefox toevoegen aan de browser-matrix.** `playwright.config.ts`
      dekt nu chromium/webkit/mobile-chrome/mobile-safari, geen Firefox.
      Alleen relevant als reis-app doelbewust Firefox-compatibel moet zijn.
- [ ] **Dependabot/Renovate instellen.** `npm audit --audit-level=high` in
      de security-CI-job laat moderate findings structureel liggen zonder
      dat iemand ze ooit terugziet — een geautomatiseerde dependency-PR-flow
      dekt dat beter dan handmatig `npm outdated`.
- [ ] **Tests toevoegen voor de rapport-scripts zelf.**
      `scripts/check-release-readiness.mjs` is nu de harde release-gate,
      `scripts/dedupe-allure-subsuite.mjs` bepaalt hoe het gepubliceerde
      report eruitziet — geen van beide heeft eigen tests. Een bug daarin
      kan een fail stil laten verdwijnen of de gate stil laten doorlopen.
- [ ] **Performance/Core Web Vitals-track overwegen (Lighthouse).** Met een
      foto-feature en mobile-first gebruik ontbreekt hier nu elke dekking.

## Handmatige/fase-3 items uit ai/security-testing.md (nog niet geautomatiseerd)

- [ ] `npm outdated` periodiek handmatig checken op beide repo's.
- [ ] OWASP ZAP baseline-scan tegen test-/acceptance-omgeving (nooit tegen
      productie).
