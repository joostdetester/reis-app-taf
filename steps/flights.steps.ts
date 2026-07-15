import { expect, Page } from '@playwright/test';
import { Given, Then } from './bdd';
import { NavigationPage } from '../pageobjects/navigation.page';
import { FlightsPage } from '../pageobjects/flights.page';

Given('the user opens the flights page', async ({ page, world }) => {
  const nav = new NavigationPage(page);
  await nav.open('flights');
  world.nav = nav;
  // Flight data loads asynchronously behind a "Laden…" notice - give it a
  // generous timeout rather than relying on the default expect timeout.
  await expect(new FlightsPage(page).flightCards.first()).toBeVisible({ timeout: 20_000 });
});

Then('every flight shows its flight number', async ({ page }) => {
  await forEachFlight(page, async (flights, i) => {
    await expect(flights.flightNumber(i)).not.toBeEmpty();
  });
});

Then('every flight shows its departure and arrival times with time zone', async ({ page }) => {
  await forEachFlight(page, async (flights, i) => {
    await expect(flights.departureTime(i)).toContainText(/\(.+\)/);
    await expect(flights.arrivalTime(i)).toContainText(/\(.+\)/);
  });
});

Then('every flight shows its flight duration', async ({ page }) => {
  await forEachFlight(page, async (flights, i) => {
    await expect(flights.duration(i)).toContainText(/\d+u\s*\d+m/);
  });
});

Then(
  'each flight shows a Flightradar24 link that matches its own flight number',
  async ({ page }) => {
    await forEachFlight(page, async (flights, i) => {
      const numberText = (await flights.flightNumber(i).textContent())?.trim() ?? '';
      const numbers = numberText.split('/').map((n) => n.trim());
      const links = flights.flightStatusLinks(i);
      await expect(links).toHaveCount(numbers.length);
      for (let n = 0; n < numbers.length; n++) {
        const expectedSlug = numbers[n].replace(/\s+/g, '').toLowerCase();
        await expect(links.nth(n)).toHaveAttribute(
          'href',
          `https://www.flightradar24.com/data/flights/${expectedSlug}`,
        );
      }
    });
  },
);

Then(
  'a flight that departs more than a few hours from now shows a "not yet available" placeholder for its gate and terminal',
  async ({ page }) => {
    // Every flight on this trip departs far in the future - the first
    // flight in the list is enough to verify the placeholder.
    const flights = new FlightsPage(page);
    await expect(flights.gate(0)).toContainText('Nog niet beschikbaar');
    await expect(flights.arrivalTerminal(0)).toContainText('Nog niet beschikbaar');
  },
);

Then(
  'each flight shows a route link to Google Maps directions between its departure and arrival locations',
  async ({ page }) => {
    await forEachFlight(page, async (flights, i) => {
      const href = await flights.routeLink(i).getAttribute('href');
      expect(href).toContain('google.com/maps/dir');
    });
  },
);

async function forEachFlight(
  page: Page,
  assertion: (flights: FlightsPage, index: number) => Promise<void>,
): Promise<void> {
  const flights = new FlightsPage(page);
  const count = await flights.flightCards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await assertion(flights, i);
  }
}
