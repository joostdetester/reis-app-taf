import { expect } from '@playwright/test';
import { Then } from './bdd';
import { TodayPage } from '../pageobjects/today.page';
import { TripOverviewPage } from '../pageobjects/trip-overview.page';
import { FlightsPage } from '../pageobjects/flights.page';
import { PracticalPage } from '../pageobjects/practical.page';

Then('the today page matches its visual baseline', async ({ page, world }) => {
  const today = new TodayPage(page);
  await expect(today.dayCards.first()).toBeVisible();
  await expect(page).toHaveScreenshot('today-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock, today.countdownPanel, today.allWeather],
  });
});

Then('the trip overview page matches its visual baseline', async ({ page, world }) => {
  const trip = new TripOverviewPage(page);
  await expect(trip.destinationGroups.first()).toBeVisible();
  await expect(page).toHaveScreenshot('trip-overview-destinations.png', {
    fullPage: true,
    mask: [world.nav.worldClock],
  });
});

Then('the hotels page matches its visual baseline', async ({ page, world }) => {
  // Given("the user opens the hotels page") already waits for hotelCards.
  await expect(page).toHaveScreenshot('hotels-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock],
  });
});

Then('the flights page matches its visual baseline', async ({ page, world }) => {
  const flights = new FlightsPage(page);
  // Given("the user opens the flights page") already waits for flightCards.
  await expect(page).toHaveScreenshot('flights-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock, flights.allGates, flights.allArrivalTerminals],
  });
});

Then('the practical information page matches its visual baseline', async ({ page, world }) => {
  const practical = new PracticalPage(page);
  // Given("the user opens the practical information page") + And("...has
  // finished loading") already waited for the page and weather widget to
  // settle.
  await expect(page).toHaveScreenshot('practical-information-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock, practical.weatherForecastCard, practical.currencyConverterCard],
  });
});
