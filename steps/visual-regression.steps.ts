import { expect, Locator } from '@playwright/test';
import { Then } from './bdd';
import { TodayPage } from '../pageobjects/today.page';
import { TripOverviewPage } from '../pageobjects/trip-overview.page';
import { FlightsPage } from '../pageobjects/flights.page';
import { PracticalPage } from '../pageobjects/practical.page';

// toHaveScreenshot() takes repeated shots until two consecutive ones match
// (or this timeout elapses) - confirmed live that the default 5s can run out
// before that happens, failing even a first-time baseline generation with no
// real visual issue involved. Generous but not the same 20s used elsewhere
// for genuinely slow live-API content, since this is just render/layout
// settling, not a network call.
const SCREENSHOT_TIMEOUT = 15_000;

// TodayPage only gates its own "Laden…" placeholder on useTripDays() - the
// flight/hotel summary line inside each day-card comes from separate,
// uncoordinated data hooks that can resolve a moment later, growing the
// page's height after the cards are already visible. Confirmed live on CI:
// a baseline taken right after dayCards.first() became visible didn't match
// a later run where that line had finished rendering. Waits for the total
// rendered height across all matched elements to stop changing between two
// checks - not a hard wait, `toPass()` retries with its own backoff.
async function waitForStableHeight(locator: Locator): Promise<void> {
  let lastTotal: number | null = null;
  await expect(async () => {
    const heights = await locator.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().height),
    );
    // Rounded - getBoundingClientRect returns sub-pixel floats that can
    // differ by a fraction between two reads of an otherwise-unchanged
    // layout, which would never converge if compared exactly.
    const total = Math.round(heights.reduce((sum, h) => sum + h, 0));
    // Record before asserting - expect() throws on mismatch, so recording
    // after it would mean a failing comparison never updates lastTotal,
    // comparing against the same (null, on the first attempt) value forever.
    const previous = lastTotal;
    lastTotal = total;
    expect(total).toBe(previous);
  }).toPass({ timeout: 10_000 });
}

Then('the today page matches its visual baseline', async ({ page, world }) => {
  const today = new TodayPage(page);
  await expect(today.dayCards.first()).toBeVisible();
  await waitForStableHeight(today.dayCards);
  await expect(page).toHaveScreenshot('today-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock, today.countdownPanel, today.allWeather],
    timeout: SCREENSHOT_TIMEOUT,
  });
});

Then('the trip overview page matches its visual baseline', async ({ page, world }) => {
  const trip = new TripOverviewPage(page);
  await expect(trip.destinationGroups.first()).toBeVisible();
  await expect(page).toHaveScreenshot('trip-overview-destinations.png', {
    fullPage: true,
    mask: [world.nav.worldClock],
    timeout: SCREENSHOT_TIMEOUT,
  });
});

Then('the hotels page matches its visual baseline', async ({ page, world }) => {
  // Given("the user opens the hotels page") already waits for hotelCards.
  await expect(page).toHaveScreenshot('hotels-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock],
    timeout: SCREENSHOT_TIMEOUT,
  });
});

Then('the flights page matches its visual baseline', async ({ page, world }) => {
  const flights = new FlightsPage(page);
  // Given("the user opens the flights page") already waits for flightCards.
  await expect(page).toHaveScreenshot('flights-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock, flights.allGates, flights.allArrivalTerminals],
    timeout: SCREENSHOT_TIMEOUT,
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
    timeout: SCREENSHOT_TIMEOUT,
  });
});
