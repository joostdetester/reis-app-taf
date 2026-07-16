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

## Navigatie (bestaand)

- ✅ Bottom navigation opent elke hoofdsectie (Today → Trip → Hotels → Vluchten → Today)
- ✅ Extra-menu opent Foto's en Praktische informatie
- ✅ Alle hoofdpagina's bezoeken geeft geen console errors
- ✅ Today-pagina voldoet aan WCAG A/AA/AAA

## Today / Dagweergave (`#/today`)

> ⚠️ Technische schuld: het bestaande `pageobjects` Today-object gebruikt een `.day-card`-locator die niet in de live DOM is aangetroffen. Eerst verifiëren/repareren voordat onderstaande scenario's gebouwd worden.

- 📝 Toont vandaag (en morgen) als kaart met bestemming, datum, weer, strandscore
- 📝 Vlucht- en hotelinfo worden correct samengevat op de dagkaart
- 📝 Elk dagdeel (ochtend/middag/avond) toont de juiste activiteit
- 📝 Notitieveld toont "Geen notitie" wanneer leeg, anders de ingevulde tekst
- 📝 "Open locatie in Google Maps"-link bevat de juiste locatiequery
- 📝 Klik op vlucht-samenvatting navigeert naar `#/transport?item=<id>`
- 📝 Klik op hotel-samenvatting navigeert naar `#/hotels?item=<id>`
- 📝 Countdown/klokken/eerstvolgende-vlucht bovenaan tonen correcte waarden
- ❓ Gedrag vóór de reisstartdatum (toont het "morgen"-kaart pas vanaf reisstart, of altijd vandaag+morgen?) — nader te bepalen, mogelijk afhankelijk van systeemdatum-mocking

## Trip overview / Tijdlijn (`#/trip`)

- 📝 Tijdlijn (default view) toont alle reisdagen chronologisch
- 📝 Wisselen naar "Bestemmingen"-view (`?view=destinations`) groepeert per bestemming/regio
- 📝 Wisselen naar "Kalender"-view (`?view=calendar`) toont compacte datum→bestemming lijst
- 📝 View-keuze blijft behouden na page refresh (query param)
- 📝 "Top activiteiten op GetYourGuide"-link per bestemming (Bestemmingen-view)
- 📝 Zoekveld filtert de tijdlijn live op een geldige zoekterm (bv. "El Nido")
- ❓ Zoekveld bij een zoekterm zonder resultaten — moet nog bevestigd worden of er een expliciete "geen resultaten"-melding hoort te zijn (nu leek de resultatenlijst gewoon leeg)

## Hotels (`#/hotels`)

- 📝 Lijst toont alle geboekte hotels met naam, data, in-/uitchecktijden, adres, telefoon, boekingsnummer
- 📝 "Open in Google Maps"-link per hotel correct
- 📝 "Bekijk op Booking.com"-link per hotel correct
- ❓ Deep-link vanuit Today/Tijdlijn (`?item=<id>`) — nog te bepalen of dit moet scrollen naar/highlighten van het specifieke hotel, of alleen de lijst toont

## Vluchten (`#/transport`)

- 📝 Per vlucht: vluchtnummer, vertrek-/aankomsttijd+tijdzone, duur correct getoond
- 📝 Flightradar24-link per vlucht wijst naar het juiste vluchtnummer (bevestigd aanwezig, bv. `flightradar24.com/data/flights/wy172`)
- 📝 Gate/terminal toont placeholder ("Nog niet beschikbaar") totdat 2 uur van tevoren
- 📝 Routelink (Google Maps directions) tussen vertrek- en aankomstlocatie correct
- ❓ Tijdzone-correctheid bij vluchten die tijdzones overschrijden — nader te bepalen hoe dit te verifiëren zonder harde datum-afhankelijkheid

## Foto's (`#/photos`)

- 📝 Lege-staat: dag zonder foto's toont "Nog geen foto's voor deze dag."
- 🚫 Dag mét foto's toont de foto's correct — geblokkeerd: huidige databron heeft (nog) geen enkele dag met foto's, dus niet te verifiëren tot er testdata met foto's is

## Praktische informatie (`#/practical`)

- 📝 Weer-dropdown wisselt van stad en toont bijbehorende 14-daagse voorspelling
- 📝 Peso↔Euro-converter: invoer in het ene veld herberekent het andere veld correct
- 📝 Getoonde wisselkoers-datum komt overeen met de testdatum
- 📝 Statische info-blokken (Nood/Geld/Vervoer/Bereikbaarheid) tonen verwachte content

## Bewerkflow (`?token=...`)

- 📝 View-only modus (geen/ongeldige token) toont "ALLEEN-LEZEN"-badge en geen Bewerk-knoppen
- 📝 Geldige-token modus toont "Uitloggen"-knop en Bewerk-knoppen per dagdeel/notitie
- 📝 Klik op "Bewerk" opent het juiste inline formulier ("<Dagdeel> bewerken")
- 📝 "Annuleren" sluit het formulier zonder wijziging door te voeren
- 🚫 "Opslaan" persisteert de wijziging correct — geblokkeerd: vereist een los test-/staging-endpoint zodat schrijftests niet de echte gezinsreisdata overschrijven (nog te realiseren in `reis-app`)
- ✅ Ongeldige token wordt geweigerd (blijft read-only) — `reis-app` valideert de token nu server-side (nieuwe `verify-edit-token` Edge Function) voordat de UI Bewerk-knoppen toont, i.p.v. alleen te checken of er een token aanwezig is; scenario "An invalid edit token keeps the app read-only" toegevoegd aan `features/edit-flow.feature`. Schrijven zelf was al veilig (`save-edit` valideerde de token-hash al) — zie `reis-app`'s `SECURITY.md`.

## Buiten scope (voorlopig)

- Security-testing (headers, dependency-audit, OWASP ZAP) — bewust uitgesteld, zie eerdere afspraak; het access-control-issue bij de bewerkflow (hierboven) is als eerste, concrete uitzondering al opgepakt
- API-niveau tests — deze backlog is UI/E2E-gericht; `API_BASE_URL` is nu nog een placeholder (jsonplaceholder.typicode.com)
