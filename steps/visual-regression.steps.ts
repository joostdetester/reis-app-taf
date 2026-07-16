import { expect, Page } from '@playwright/test';
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

// Every page can grow after its own "content is visible" wait already passed
// - confirmed live on Today (its flight/hotel summary line comes from data
// hooks not gated behind the page's own "Laden…" state) and suspected
// elsewhere too (e.g. font-swap-driven text reflow). Applied to the whole
// page rather than a specific element so it catches any such case, not just
// the ones already diagnosed. Not a hard wait - `toPass()` retries with its
// own backoff until two consecutive reads agree.
async function waitForStableHeight(page: Page): Promise<void> {
  let lastHeight: number | null = null;
  await expect(async () => {
    // Rounded - getBoundingClientRect returns sub-pixel floats that can
    // differ by a fraction between two reads of an otherwise-unchanged
    // layout, which would never converge if compared exactly.
    const height = Math.round(
      await page.evaluate(() => document.body.getBoundingClientRect().height),
    );
    // Record before asserting - expect() throws on mismatch, so recording
    // after it would mean a failing comparison never updates lastHeight,
    // comparing against the same (null, on the first attempt) value forever.
    const previous = lastHeight;
    lastHeight = height;
    expect(height).toBe(previous);
  }).toPass({ timeout: 10_000 });
}

Then('the today page matches its visual baseline', async ({ page, world }) => {
  const today = new TodayPage(page);
  await expect(today.dayCards.first()).toBeVisible();
  await waitForStableHeight(page);
  await expect(page).toHaveScreenshot('today-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock, today.countdownPanel, today.allWeather],
    timeout: SCREENSHOT_TIMEOUT,
  });
});

Then('the trip overview page matches its visual baseline', async ({ page, world }) => {
  const trip = new TripOverviewPage(page);
  await expect(trip.destinationGroups.first()).toBeVisible();
  await waitForStableHeight(page);
  await expect(page).toHaveScreenshot('trip-overview-destinations.png', {
    fullPage: true,
    mask: [world.nav.worldClock],
    timeout: SCREENSHOT_TIMEOUT,
  });
});

Then('the hotels page matches its visual baseline', async ({ page, world }) => {
  // Given("the user opens the hotels page") already waits for hotelCards.
  await waitForStableHeight(page);
  await expect(page).toHaveScreenshot('hotels-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock],
    timeout: SCREENSHOT_TIMEOUT,
  });
});

Then('the flights page matches its visual baseline', async ({ page, world }) => {
  const flights = new FlightsPage(page);
  // Given("the user opens the flights page") already waits for flightCards.
  await waitForStableHeight(page);
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
  await waitForStableHeight(page);
  await expect(page).toHaveScreenshot('practical-information-page.png', {
    fullPage: true,
    mask: [world.nav.worldClock, practical.weatherForecastCard, practical.currencyConverterCard],
    timeout: SCREENSHOT_TIMEOUT,
    // Wider than the other pages' implicit default (project's 0.02) on
    // purpose: masked or not, the weather/currency widgets' own *height*
    // still varies with the live call's outcome (a multi-row forecast vs. a
    // one-line error), which can shift everything below them by a
    // meaningful pixel count even though nothing is actually broken. See
    // ai/visual-regression-testing.md's masking section for the full
    // reasoning - this is the accepted trade-off, not a bug.
    maxDiffPixelRatio: 0.12,
  });
});
