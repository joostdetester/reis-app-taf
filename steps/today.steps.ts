import { expect } from '@playwright/test';
import { Given, When, Then } from './bdd';
import { TodayPage } from '../pageobjects/today.page';
import { FlightsPage } from '../pageobjects/flights.page';
import { HotelsPage } from '../pageobjects/hotels.page';

// "Given the user opens the today page" is defined once in
// navigation.steps.ts and reused here.

Then('the day card for today shows the destination', async ({ page }) => {
  await expect(new TodayPage(page).dayCard(0).title).not.toBeEmpty();
});

Then('the day card for today shows the date', async ({ page }) => {
  await expect(new TodayPage(page).dayCard(0).date).not.toBeEmpty();
});

Then('the day card for today shows a weather forecast', async ({ page }) => {
  await expect(new TodayPage(page).dayCard(0).weather).toContainText(/\d+°/);
});

Then('the day card for today shows a beach score', async ({ page }) => {
  await expect(new TodayPage(page).dayCard(0).weather).toContainText(/🏖️\s*[\d.]+\/10/);
});

Then(
  "the day card shows a summary of that day's flight, when a flight is scheduled",
  async ({ page }) => {
    const today = new TodayPage(page);
    const index = await firstCardIndexWith(today, 'flight');
    await expect(today.dayCard(index).flightSummary).toContainText('✈️');
  },
);

Then(
  "the day card shows a summary of that day's hotel, when a hotel is booked",
  async ({ page }) => {
    const today = new TodayPage(page);
    const index = await firstCardIndexWith(today, 'hotel');
    await expect(today.dayCard(index).hotelSummary).toContainText('🏨');
  },
);

Then('the morning part of the day shows its planned activity', async ({ page }) => {
  await expect(new TodayPage(page).dayCard(0).part('Ochtend')).not.toBeEmpty();
});

Then('the afternoon part of the day shows its planned activity', async ({ page }) => {
  await expect(new TodayPage(page).dayCard(0).part('Middag')).not.toBeEmpty();
});

Then('the evening part of the day shows its planned activity', async ({ page }) => {
  await expect(new TodayPage(page).dayCard(0).part('Avond')).not.toBeEmpty();
});

// Today's own day card (index 0) currently has an empty note - recorded
// here so the Then step below checks the same card.
When("today's day card has no note entered", async ({ world }) => {
  world.dayCardIndexWithoutNote = 0;
});

Then('the note field shows the placeholder text "Geen notitie"', async ({ page, world }) => {
  const index = world.dayCardIndexWithoutNote ?? 0;
  await expect(new TodayPage(page).dayCard(index).noteValue).toHaveText('Geen notitie');
});

Then(
  'the "Open location in Google Maps" link for today\'s card contains the destination as a search query',
  async ({ page }) => {
    const card = new TodayPage(page).dayCard(0);
    const destination = (await card.title.textContent())?.trim() ?? '';
    const href = await card.mapLink.getAttribute('href');
    expect(href).toContain(encodeURIComponent(destination));
  },
);

Given("today's day card shows a flight summary", async ({ page }) => {
  await firstCardIndexWith(new TodayPage(page), 'flight');
});

When('the user clicks the flight summary', async ({ page, world }) => {
  const today = new TodayPage(page);
  const index = await firstCardIndexWith(today, 'flight');
  const summaryText = (await today.dayCard(index).flightSummary.textContent()) ?? '';
  world.clickedFlightNumber = extractFlightNumber(summaryText);
  await today.dayCard(index).flightSummary.click();
});

Then("the flights page opens showing that flight's details", async ({ page, world }) => {
  await expect(page).toHaveURL(/#\/transport\?item=/);
  const flights = new FlightsPage(page);
  await expect(flights.flightCards.first()).toBeVisible({ timeout: 20_000 });
  await expect(flights.pageContent).toContainText(world.clickedFlightNumber);
});

Given("today's day card shows a hotel summary", async ({ page }) => {
  await firstCardIndexWith(new TodayPage(page), 'hotel');
});

When('the user clicks the hotel summary', async ({ page, world }) => {
  const today = new TodayPage(page);
  const index = await firstCardIndexWith(today, 'hotel');
  const summaryText = (await today.dayCard(index).hotelSummary.textContent()) ?? '';
  world.clickedHotelName = extractHotelName(summaryText);
  await today.dayCard(index).hotelSummary.click();
});

Then("the hotels page opens showing that hotel's details", async ({ page, world }) => {
  await expect(page).toHaveURL(/#\/hotels\?item=/);
  const hotels = new HotelsPage(page);
  await expect(hotels.pageContent).toContainText(world.clickedHotelName);
});

Then(
  'the header shows a countdown to the trip or shows that the trip has started',
  async ({ page }) => {
    await expect(new TodayPage(page).countdownValue).toHaveText(/^(\d+\s*dagen?|Reis gestart)$/i);
  },
);

Then('the header shows the current time', async ({ page }) => {
  await expect(new TodayPage(page).worldClock).toContainText(/\d{2}:\d{2}/);
});

Then('the header shows the next upcoming flight, when one is scheduled', async ({ page }) => {
  const nextFlightPanel = new TodayPage(page).nextFlightPanel;
  if (await nextFlightPanel.count()) {
    await expect(nextFlightPanel).toContainText(/\d{2}:\d{2}/);
  }
});

// Returns the index of the first visible day card that has a flight/hotel
// summary, or -1 if none do - used because today's and tomorrow's cards
// don't always both have a flight and a hotel on the same day.
//
// Flight/hotel summaries are fetched and merged into the card asynchronously
// after the card itself first renders, so a single count() can race a card
// that hasn't finished loading yet - expect.poll() retries until either a
// summary shows up or the timeout is reached, instead of taking one snapshot.
async function firstCardIndexWith(today: TodayPage, kind: 'flight' | 'hotel'): Promise<number> {
  await expect.poll(() => computeCardIndexWith(today, kind), { timeout: 10_000 }).not.toBe(-1);
  return computeCardIndexWith(today, kind);
}

async function computeCardIndexWith(today: TodayPage, kind: 'flight' | 'hotel'): Promise<number> {
  const count = await today.dayCards.count();
  for (let i = 0; i < count; i++) {
    const card = today.dayCard(i);
    const locator = kind === 'flight' ? card.flightSummary : card.hotelSummary;
    if (await locator.count()) {
      return i;
    }
  }
  return -1;
}

// Flight summary text looks like "✈️ Internationale vlucht · Oman Air ·
// WY172 · Amsterdam (AMS) → Muscat (MCT) · 23 jul, ..." - the flight number
// is always the 3rd " · "-separated segment.
function extractFlightNumber(summaryText: string): string {
  const segments = summaryText.split('·').map((segment) => segment.trim());
  return segments[2] ?? '';
}

// Hotel summary text looks like "🏨 Resorts World Condo · inchecken ..." -
// the hotel name is the part before the first " · ", minus the emoji.
function extractHotelName(summaryText: string): string {
  const [namePart] = summaryText.split('·');
  return namePart.replace(/^🏨\s*/, '').trim();
}
