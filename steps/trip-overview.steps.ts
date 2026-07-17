import { expect } from '@playwright/test';
import { Given, When, Then } from './bdd';
import { NavigationPage } from '../pageobjects/navigation.page';
import { TripOverviewPage } from '../pageobjects/trip-overview.page';

Given('the user opens the trip overview page', async ({ page, world }) => {
  const nav = new NavigationPage(page);
  await nav.open('trip');
  world.nav = nav;
});

Then('the timeline view is shown by default', async ({ page }) => {
  const trip = new TripOverviewPage(page);
  await expect(trip.viewChip('timeline')).toHaveClass(/active/);
  await expect(trip.dayCards.first()).toBeVisible();
});

Then('the trip days are listed in chronological order', async ({ page }) => {
  const dateTexts = await new TripOverviewPage(page).dayDates.allTextContents();
  expect(dateTexts.length).toBeGreaterThan(0);
  const values = dateTexts.map(parseDutchDayDate);
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  }
});

When('the user switches to the destinations view', async ({ page }) => {
  await new TripOverviewPage(page).switchTo('destinations');
});

Then('the trip days are grouped per destination', async ({ page }) => {
  const trip = new TripOverviewPage(page);
  await expect(trip.destinationGroups.first()).toBeVisible();
  const groupCount = await trip.destinationGroups.count();
  expect(groupCount).toBeGreaterThan(0);
  // Grouped by destination, not per day - no individual day-cards here.
  await expect(trip.dayCards).toHaveCount(0);
  await expect(trip.destinationHeading(0)).not.toBeEmpty();
});

When('the user switches to the calendar view', async ({ page }) => {
  await new TripOverviewPage(page).switchTo('calendar');
});

Then('a compact list of dates and destinations is shown', async ({ page }) => {
  const trip = new TripOverviewPage(page);
  await expect(trip.calendarEntries.first()).toBeVisible();
  // Compact list, not the full day-card layout (parts/notes/etc).
  await expect(trip.dayCards).toHaveCount(0);
  const entryCount = await trip.calendarEntries.count();
  expect(entryCount).toBeGreaterThan(0);
  await expect(trip.calendarEntries.first()).toContainText(/\d{2}-\d{2}/);
});

When('the user refreshes the page', async ({ page }) => {
  await page.reload();
});

Then('the destinations view is still shown', async ({ page }) => {
  await expect(new TripOverviewPage(page).viewChip('destinations')).toHaveClass(/active/);
});

Then(
  'each destination shows a "Top activities on GetYourGuide" link for that destination',
  async ({ page }) => {
    const trip = new TripOverviewPage(page);
    // The destination groups render asynchronously after the view-switch
    // click - wait for the first one rather than counting immediately,
    // same guard the sibling "grouped per destination" step already uses.
    await expect(trip.destinationGroups.first()).toBeVisible();
    const count = await trip.destinationGroups.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const heading = (await trip.destinationHeading(i).textContent())?.trim() ?? '';
      const link = trip.destinationActivitiesLink(i);
      await expect(link).toBeVisible();
      await expect(link).toContainText(heading);
      const href = await link.getAttribute('href');
      expect(href).toContain('getyourguide.com');
    }
  },
);

When('the user searches for {string}', async ({ page }, term: string) => {
  await new TripOverviewPage(page).searchFor(term);
});

Then(
  'only the days matching {string} remain visible in the timeline',
  async ({ page }, term: string) => {
    const trip = new TripOverviewPage(page);
    await expect(trip.dayCards.first()).toBeVisible();
    const count = await trip.dayCards.count();
    expect(count).toBeGreaterThan(0);
    const matcher = new RegExp(escapeRegExp(term), 'i');
    for (let i = 0; i < count; i++) {
      await expect(trip.dayCards.nth(i)).toContainText(matcher);
    }
  },
);

// Dutch day dates are rendered without a year, e.g. "donderdag 23 juli".
// month * 31 + day is monotonically increasing across month boundaries
// (since day never exceeds 31), which is all chronological-order
// comparison needs - no full calendar parsing required.
const DUTCH_MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  maart: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  augustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

function parseDutchDayDate(text: string): number {
  const match = text.trim().match(/(\d{1,2})\s+(\p{L}+)$/u);
  if (!match) {
    throw new Error(`Could not parse day-card date: "${text}"`);
  }
  const day = Number(match[1]);
  const month = DUTCH_MONTHS[match[2].toLowerCase()];
  if (month === undefined) {
    throw new Error(`Unknown Dutch month in day-card date: "${text}"`);
  }
  return month * 31 + day;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
