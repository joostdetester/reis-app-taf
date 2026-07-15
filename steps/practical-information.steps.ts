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

When('the user selects a different city in the weather selector', async ({ page, world }) => {
  world.selectedCity = await new PracticalPage(page).selectSecondCity();
});

Then('the 14-day weather forecast for that city is shown', async ({ page, world }) => {
  const practical = new PracticalPage(page);
  await expect(practical.forecastDays).toHaveCount(14);
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
    const today = new Date().toISOString().slice(0, 10);
    expect(match![1]).toBe(today);
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
