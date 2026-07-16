import { expect, test, Locator, Page } from '@playwright/test';
import { Given, When, Then } from './bdd';
import { NavigationPage } from '../pageobjects/navigation.page';
import { PracticalPage } from '../pageobjects/practical.page';

// The displayed rate is rounded to 2 decimals, but the app's internal rate
// has more precision - a converted value computed from the rounded, displayed
// rate can be a few cents off from what the app itself shows (confirmed
// live). This tolerance absorbs that display-rounding gap while still
// catching a genuinely wrong conversion (wrong operation, wrong field, a
// stale/zero rate, etc.), which would be off by far more than this.
const CONVERSION_TOLERANCE = 0.5;

Given('the user opens the practical information page', async ({ page, world }) => {
  const nav = new NavigationPage(page);
  await nav.open('practical');
  world.nav = nav;
});

// The page shows a brief "Laden…" placeholder before its real content (which
// is considerably taller) mounts, and the nested weather forecast widget has
// its own, separate loading state that resolves later still (its own live
// open-meteo call) - needed as an explicit step rather than folded into the
// Given above, for scenarios that measure page height/layout and would
// otherwise race either of those two swaps.
Given('the practical information page has finished loading', async ({ page, world }) => {
  await world.nav.practicalHeading.waitFor({ state: 'visible' });
  await expect(new PracticalPage(page).forecastDays).toHaveCount(14, { timeout: 20_000 });
});

When('the user selects a different city in the weather selector', async ({ page, world }) => {
  world.selectedCity = await new PracticalPage(page).selectSecondCity();
});

Then('the 14-day weather forecast for that city is shown', async ({ page, world }) => {
  const practical = new PracticalPage(page);
  // The forecast comes from a live third-party API (open-meteo.com) called
  // straight from the browser after the city is selected - it shows "Laden…"
  // until that call resolves. Locally it resolves in ~200ms, but on CI
  // runners it has been observed still loading past Playwright's default 5s
  // assertion timeout (confirmed via a CI failure's page snapshot showing
  // "Laden…" at the 5s mark, not an error state) - so this assertion gets a
  // longer, explicit timeout rather than failing on live-API latency.
  await expect(practical.forecastDays).toHaveCount(14, { timeout: 20_000 });
  await expect(practical.citySelect).toHaveValue(world.selectedCity);
});

When('the user enters an amount in the Peso field', async ({ page, world }) => {
  world.pesoAmount = 1000;
  await new PracticalPage(page).pesoInput.fill(String(world.pesoAmount));
});

Then('the Euro field shows the correctly converted amount', async ({ page, world }) => {
  const practical = new PracticalPage(page);
  const rate = await readExchangeRate(practical);
  const expected = world.pesoAmount / rate;
  await assertCloseTo(practical.euroInput, expected);
});

When('the user enters an amount in the Euro field', async ({ page, world }) => {
  world.euroAmount = 100;
  await new PracticalPage(page).euroInput.fill(String(world.euroAmount));
});

Then('the Peso field shows the correctly converted amount', async ({ page, world }) => {
  const practical = new PracticalPage(page);
  const rate = await readExchangeRate(practical);
  const expected = world.euroAmount * rate;
  await assertCloseTo(practical.pesoInput, expected);
});

Then(
  "the exchange rate date shown next to the converter matches today's date",
  async ({ page }) => {
    const rateText = (await new PracticalPage(page).exchangeRateText.textContent()) ?? '';
    // The rate comes from a third-party API that isn't always available - the
    // app itself falls back to an indicative rate with no date in that case
    // (confirmed live: "... (indicatief, kon actuele koers niet ophalen)").
    // There's no date to check against in that state, so skip rather than
    // fail on an upstream outage outside this app's control.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      !rateText.includes('actueel'),
      `Exchange rate is not currently live, nothing to check: "${rateText}"`,
    );
    const match = rateText.match(/(\d{4}-\d{2}-\d{2})/);
    expect(match, `Expected an exchange-rate date in "${rateText}"`).not.toBeNull();
    // The live rate's date comes from the third-party FX API's own daily
    // publish cycle, not this test's clock - confirmed on CI (stable across
    // all 3 attempts, so not a flaky race) that the API can still be serving
    // yesterday's dated rate for a while after UTC midnight, presumably
    // because its daily refresh runs later than that. Accepting either date
    // still catches a genuinely stale/broken rate (anything older than
    // yesterday), just not this one-day publish lag outside the app's control.
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const acceptableDates = [now, yesterday].map((d) => d.toISOString().slice(0, 10));
    expect(acceptableDates).toContain(match![1]);
  },
);

Then('the emergency information block is shown', async ({ page }) => {
  await assertInfoBlock(page, 'Nood');
});

Then('the money information block is shown', async ({ page }) => {
  await assertInfoBlock(page, 'Geld');
});

Then('the transport information block is shown', async ({ page }) => {
  await assertInfoBlock(page, 'Vervoer');
});

Then('the getting-there information block is shown', async ({ page }) => {
  await assertInfoBlock(page, 'Bereikbaarheid');
});

async function assertInfoBlock(page: Page, heading: string): Promise<void> {
  const practical = new PracticalPage(page);
  await expect(practical.infoBlock(heading)).toBeVisible();
  await expect(practical.infoBlockBody(heading)).not.toBeEmpty();
}

// Reads the live "Koers: 1 EUR ≈ 70.36 PHP (actueel, ...)" rate from the
// page so the expected converted value is always computed from the
// currently displayed rate, never hardcoded.
async function readExchangeRate(practical: PracticalPage): Promise<number> {
  const text = (await practical.exchangeRateText.textContent()) ?? '';
  const match = text.match(/([\d.]+)\s*PHP/);
  if (!match) {
    throw new Error(`Could not find exchange rate in "${text}"`);
  }
  return Number(match[1]);
}

// Compares the input's live value to the expected converted amount within
// CONVERSION_TOLERANCE, retrying (via toPass()) since the field updates
// asynchronously after the other field is filled.
async function assertCloseTo(input: Locator, expected: number): Promise<void> {
  await expect(async () => {
    const actual = Number(await input.inputValue());
    expect(Math.abs(actual - expected)).toBeLessThan(CONVERSION_TOLERANCE);
  }).toPass({ timeout: 5_000 });
}
