import { expect, Locator, Page } from '@playwright/test';
import { allure } from 'allure-playwright';
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
// the ones already diagnosed. Not a hard wait - polls until two consecutive
// reads agree.
//
// Deliberately `page.waitForFunction()` rather than `expect(...).toPass()`:
// toPass() only retries when its callback throws, so an expect().toBe()
// inside it would throw on the very first read (nothing to compare the
// initial height against yet) on every single run. That's harmless - toPass()
// swallows it and retries - but Playwright still records it as a failed
// "Expect toBe" step, which shows up as a red error in the Allure report on
// an otherwise-passing test. Confirmed live: exactly this ("Expected: null,
// Received: <height>") on a passing hotels-page run. waitForFunction() polls
// its predicate in-browser instead, with no equivalent failed-attempt trail.
async function waitForStableHeight(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      // Rounded - getBoundingClientRect returns sub-pixel floats that can
      // differ by a fraction between two reads of an otherwise-unchanged
      // layout, which would never converge if compared exactly.
      const height = Math.round(document.body.getBoundingClientRect().height);
      const w = window as unknown as { __lastStableHeightCheck?: number };
      const stable = w.__lastStableHeightCheck === height;
      w.__lastStableHeightCheck = height;
      return stable;
    },
    undefined,
    { timeout: 10_000, polling: 200 },
  );
}

// toHaveScreenshot() only attaches the actual/expected/diff images when the
// comparison fails - a passing run attaches nothing, so the Allure report
// has no screenshot to review even though the check ran. Take and attach one
// explicitly so passing visual-regression entries are still visually
// reviewable in the report, not just a green checkmark.
async function attachScreenshot(
  page: Page,
  name: string,
  options: { mask?: Locator[] },
): Promise<void> {
  try {
    const screenshot = await page.screenshot({ fullPage: true, mask: options.mask });
    await allure.attachment(name, screenshot, 'image/png');
  } catch {
    // Allure attachment should never fail the test run (e.g. when running without the Allure reporter).
  }
}

async function matchVisualBaseline(
  page: Page,
  name: string,
  options: { mask?: Locator[]; maxDiffPixelRatio?: number },
): Promise<void> {
  await waitForStableHeight(page);
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    mask: options.mask,
    timeout: SCREENSHOT_TIMEOUT,
    maxDiffPixelRatio: options.maxDiffPixelRatio,
  });
  await attachScreenshot(page, name, { mask: options.mask });
}

Then('the today page matches its visual baseline', async ({ page, world }) => {
  const today = new TodayPage(page);
  await expect(today.dayCards.first()).toBeVisible();
  await matchVisualBaseline(page, 'today-page.png', {
    mask: [world.nav.worldClock, today.countdownPanel, today.allWeather],
  });
});

Then('the trip overview page matches its visual baseline', async ({ page, world }) => {
  const trip = new TripOverviewPage(page);
  await expect(trip.destinationGroups.first()).toBeVisible();
  await matchVisualBaseline(page, 'trip-overview-destinations.png', {
    mask: [world.nav.worldClock],
  });
});

Then('the hotels page matches its visual baseline', async ({ page, world }) => {
  // Given("the user opens the hotels page") already waits for hotelCards.
  await matchVisualBaseline(page, 'hotels-page.png', {
    mask: [world.nav.worldClock],
  });
});

Then('the flights page matches its visual baseline', async ({ page, world }) => {
  const flights = new FlightsPage(page);
  // Given("the user opens the flights page") already waits for flightCards.
  await matchVisualBaseline(page, 'flights-page.png', {
    mask: [world.nav.worldClock, flights.allGates, flights.allArrivalTerminals],
  });
});

Then('the practical information page matches its visual baseline', async ({ page, world }) => {
  const practical = new PracticalPage(page);
  // Given("the user opens the practical information page") + And("...has
  // finished loading") already waited for the page and weather widget to
  // settle.
  await matchVisualBaseline(page, 'practical-information-page.png', {
    mask: [world.nav.worldClock, practical.weatherForecastCard, practical.currencyConverterCard],
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
