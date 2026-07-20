---
title: Test Backlog
description: Geplande en gebouwde E2E-testscenario's per functioneel gebied, als basis voor de Gherkin-features en de HTML-voortgangsrapportage.
owner: team-qa
tags: [testing, backlog]
version: 1.0
---

# Test Backlog

Status per scenario:
- ✅ Gebouwd — bestaat al als Gherkin-scenario
- 📝 Gepland — nog te bouwen, geen blokkade
- 🚫 Geblokkeerd — nog te bouwen, wacht op iets buiten deze repo
- ❓ Open vraag — scope/gedrag nog niet vastgesteld

Bron: live-verkenning van `BASE_URL=https://reis-bf84496b20.vercel.app` op 2026-07-15.
Volledige herverificatie van de hele backlog (elk ✅-item hieronder tegen de
werkelijke `features/*.feature`/steps gecontroleerd en met `npm run test:e2e`
opnieuw gedraaid) op 2026-07-20 — vandaar dat vrijwel elk item die datum als
"bevestigd" draagt, ook items die al langer bestonden maar hier nog niet als
zodanig waren bijgewerkt.

## Navigatie (bestaand)

- ✅ Bottom navigation opent elke hoofdsectie (Today → Trip → Hotels → Vluchten → Today) *(bevestigd: 2026-07-20)*
- ✅ Extra-menu opent Foto's en Praktische informatie *(bevestigd: 2026-07-20)*
- ✅ Alle hoofdpagina's bezoeken geeft geen console errors *(bevestigd: 2026-07-20 — één webkit-run flakete hier ooit op, herhaling slaagde meteen; geen reproduceerbare bug)*
- ✅ Today-pagina voldoet aan WCAG A/AA/AAA *(bevestigd: 2026-07-20)*

## Today / Dagweergave (`#/today`)

- ✅ Toont vandaag als kaart met bestemming, datum, weer, strandscore *(bevestigd: 2026-07-20; het "toont ook morgen"-deel valt onder de open vraag hieronder)*
- ✅ Vlucht- en hotelinfo worden correct samengevat op de dagkaart *(bevestigd: 2026-07-20)*
- ✅ Elk dagdeel (ochtend/middag/avond) toont de juiste activiteit *(bevestigd: 2026-07-20)*
- ✅ Notitieveld toont "Geen notitie" wanneer leeg, anders de ingevulde tekst *(bevestigd: 2026-07-20)*
- ✅ "Open locatie in Google Maps"-link bevat de juiste locatiequery *(bevestigd: 2026-07-20)*
- ✅ Klik op vlucht-samenvatting navigeert naar de vluchtdetailpagina *(bevestigd: 2026-07-20)*
- ✅ Klik op hotel-samenvatting navigeert naar de hoteldetailpagina *(bevestigd: 2026-07-20)*
- ✅ Countdown/klokken/eerstvolgende-vlucht bovenaan tonen correcte waarden *(bevestigd: 2026-07-20)*
- ❓ Gedrag vóór de reisstartdatum (toont het "morgen"-kaart pas vanaf reisstart, of altijd vandaag+morgen?) — nader te bepalen, mogelijk afhankelijk van systeemdatum-mocking

## Trip overview / Tijdlijn (`#/trip`)

- ✅ Tijdlijn (default view) toont alle reisdagen chronologisch *(bevestigd: 2026-07-20)*
- ✅ Wisselen naar "Bestemmingen"-view (`?view=destinations`) groepeert per bestemming/regio *(bevestigd: 2026-07-20)*
- ✅ Wisselen naar "Kalender"-view (`?view=calendar`) toont compacte datum→bestemming lijst *(bevestigd: 2026-07-20)*
- ✅ View-keuze blijft behouden na page refresh (query param) *(bevestigd: 2026-07-20)*
- ✅ "Top activiteiten op GetYourGuide"-link per bestemming (Bestemmingen-view) *(bevestigd: 2026-07-20)*
- ✅ Zoekveld filtert de tijdlijn live op een geldige zoekterm (bv. "El Nido") *(bevestigd: 2026-07-20)*
- ❓ Zoekveld bij een zoekterm zonder resultaten — moet nog bevestigd worden of er een expliciete "geen resultaten"-melding hoort te zijn (nu leek de resultatenlijst gewoon leeg)

## Hotels (`#/hotels`)

- ✅ Lijst toont alle geboekte hotels met naam, data, in-/uitchecktijden, adres, telefoon, boekingsnummer *(bevestigd: 2026-07-20)*
- ✅ "Open in Google Maps"-link per hotel correct *(bevestigd: 2026-07-20)*
- ✅ "Bekijk op Booking.com"-link per hotel correct *(bevestigd: 2026-07-20)*
- ❓ Deep-link vanuit Today/Tijdlijn (`?item=<id>`) — nog te bepalen of dit moet scrollen naar/highlighten van het specifieke hotel, of alleen de lijst toont

## Vluchten (`#/transport`)

- ✅ Per vlucht: vluchtnummer, vertrek-/aankomsttijd+tijdzone, duur correct getoond *(bevestigd: 2026-07-20)*
- ✅ Flightradar24-link per vlucht wijst naar het juiste vluchtnummer *(bevestigd: 2026-07-20)*
- ✅ Gate/terminal toont placeholder ("Nog niet beschikbaar") totdat 2 uur van tevoren *(bevestigd: 2026-07-20)*
- ✅ Routelink (Google Maps directions) tussen vertrek- en aankomstlocatie correct *(bevestigd: 2026-07-20)*
- ❓ Tijdzone-correctheid bij vluchten die tijdzones overschrijden — nader te bepalen hoe dit te verifiëren zonder harde datum-afhankelijkheid

## Foto's (`#/photos`)

- 📝 Lege-staat: dag zonder foto's toont "Nog geen foto's voor deze dag."
- 🚫 Dag mét foto's toont de foto's correct — geblokkeerd: huidige databron heeft (nog) geen enkele dag met foto's, dus niet te verifiëren tot er testdata met foto's is

## Praktische informatie (`#/practical`)

- ✅ Weer-dropdown wisselt van stad en toont bijbehorende 14-daagse voorspelling *(bevestigd: 2026-07-20)*
- ✅ Peso↔Euro-converter: invoer in het ene veld herberekent het andere veld correct *(bevestigd: 2026-07-20)*
- ✅ Getoonde wisselkoers-datum komt overeen met de testdatum *(bevestigd: 2026-07-20)*
- ✅ Statische info-blokken (Nood/Geld/Vervoer/Bereikbaarheid) tonen verwachte content *(bevestigd: 2026-07-20)*

## Bewerkflow (`?token=...`)

- ✅ View-only modus (geen/ongeldige token) toont "ALLEEN-LEZEN"-badge en geen Bewerk-knoppen *(bevestigd: 2026-07-20)*
- ✅ Geldige-token modus toont "Uitloggen"-knop en Bewerk-knoppen per dagdeel/notitie *(bevestigd: 2026-07-20)*
- ✅ Klik op "Bewerk" opent het juiste inline formulier ("<Dagdeel> bewerken") *(bevestigd: 2026-07-20)*
- ✅ "Annuleren" sluit het formulier zonder wijziging door te voeren *(bevestigd: 2026-07-20)*
- 🚫 "Opslaan" persisteert de wijziging correct — geblokkeerd: vereist een los test-/staging-endpoint zodat schrijftests niet de echte gezinsreisdata overschrijven (nog te realiseren in `reis-app`)
- ✅ Ongeldige token wordt geweigerd (blijft read-only) — `reis-app` valideert de token nu server-side (nieuwe `verify-edit-token` Edge Function) voordat de UI Bewerk-knoppen toont, i.p.v. alleen te checken of er een token aanwezig is; scenario "An invalid edit token keeps the app read-only" toegevoegd aan `features/edit-flow.feature`. Schrijven zelf was al veilig (`save-edit` valideerde de token-hash al) — zie `reis-app`'s `SECURITY.md`. *(bevestigd: 2026-07-20)*

## Toegankelijkheid (`@accessibility`)

Zie `ai/accessibility-testing.md` voor scope/WCAG-niveaus en `ai/release-readiness.md`
voor hoe de release-readiness gate hierop gaat.

- ✅ `color-contrast-enhanced` (AAA, 7:1) op Flights/Hotels (`--muted:#64757f`
  op `#fffcf6`, 4.66:1) en Trip overview's tijdlijn-thema (`--lx-muted:#6d7781`
  op `#fcfbf7`, 4.4:1) — opgelost in `reis-app` (`--muted` → `#47535c`,
  `--lx-muted` → `#495359`); live geverifieerd met axe tegen productie
  (`vercel --prod`, 2026-07-20).
- ✅ `select-name` (Blocker/Critical) op Praktische informatie (weer-stad
  `<select>` had geen toegankelijke naam) — `aria-label` toegevoegd in
  dezelfde `reis-app`-commit.
- ✅ `nested-interactive` op Today/Trip overview (hotel-/vlucht-link genest
  in de klikbare dagkaart-header) — `DayCard` herstructureerd: de header is
  nu een gewone div met een echte `<button>` (titel/datum/weer) plus de
  links als broertjes, niet als kinderen. Zelfde commit.

## Security (`@security`)

Zie `ai/security-testing.md` voor scope en OWASP-mapping.

- ✅ Edit-token blijft niet zichtbaar in de adresbalk (ook niet na een reload) *(bevestigd: 2026-07-20)*
- ✅ Zoekveld verwerkt een script-injection payload veilig (geen dialog, geen match) *(bevestigd: 2026-07-20)*
- ✅ App-response zet Strict-Transport-Security *(bevestigd: 2026-07-20)*
- 📝 App-response zet Content-Security-Policy / X-Frame-Options / X-Content-Type-Options — **blokkade opgeheven**: `reis-app` zet deze headers nu (`vercel.json`, commit "Add security response headers"), live geverifieerd met `curl -sI` tegen productie op 2026-07-20 (alle 3 aanwezig). Er bestaat alleen nog geen Gherkin-scenario dat dit assert — `features/security.feature`'s OWASP A05-scenario checkt nu alleen STS, moet uitgebreid worden.
- 📝 `npm audit` / `npm outdated` op beide repo's (handmatig, fase 3)
- 📝 OWASP ZAP baseline-scan tegen test-/acceptance-omgeving (handmatig, fase 3, nooit tegen productie)
- ✅ `security`-job in CI (`npm run test:security` + `npm audit --audit-level=high`), eigen Allure-suite naast E2E/Accessibility/Visual Regression *(bevestigd: 2026-07-20)*

## Buiten scope (voorlopig)

- API-niveau tests — deze backlog is UI/E2E-gericht; `API_BASE_URL` is nu nog een placeholder (jsonplaceholder.typicode.com)
