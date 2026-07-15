import { expect, Page } from '@playwright/test';
import { Given, Then } from './bdd';
import { NavigationPage } from '../pageobjects/navigation.page';
import { HotelsPage } from '../pageobjects/hotels.page';

Given('the user opens the hotels page', async ({ page, world }) => {
  const nav = new NavigationPage(page);
  await nav.open('hotels');
  world.nav = nav;
  await expect(new HotelsPage(page).hotelCards.first()).toBeVisible();
});

Then('every hotel shows its name', async ({ page }) => {
  await forEachHotel(page, async (hotels, i) => {
    await expect(hotels.name(i)).not.toBeEmpty();
  });
});

Then('every hotel shows its stay dates', async ({ page }) => {
  await forEachHotel(page, async (hotels, i) => {
    await expect(hotels.stayDates(i)).not.toBeEmpty();
  });
});

Then('every hotel shows its check-in and check-out times', async ({ page }) => {
  await forEachHotel(page, async (hotels, i) => {
    await expect(hotels.checkInOut(i)).toContainText(/Inchecken/);
    await expect(hotels.checkInOut(i)).toContainText(/Uitchecken/);
  });
});

Then('every hotel shows its address', async ({ page }) => {
  await forEachHotel(page, async (hotels, i) => {
    await expect(hotels.address(i)).not.toBeEmpty();
  });
});

Then('every hotel shows its phone number', async ({ page }) => {
  await forEachHotel(page, async (hotels, i) => {
    await expect(hotels.phone(i)).not.toBeEmpty();
  });
});

Then('every hotel shows its booking number', async ({ page }) => {
  await forEachHotel(page, async (hotels, i) => {
    await expect(hotels.bookingNumber(i)).not.toBeEmpty();
  });
});

Then('each hotel shows an "Open in Google Maps" link for its address', async ({ page }) => {
  await forEachHotel(page, async (hotels, i) => {
    const href = await hotels.mapsLink(i).getAttribute('href');
    expect(href).toContain('google.com/maps');
  });
});

Then('each hotel shows a "View on Booking.com" link', async ({ page }) => {
  await forEachHotel(page, async (hotels, i) => {
    const href = await hotels.bookingLink(i).getAttribute('href');
    expect(href).toContain('booking.com');
  });
});

async function forEachHotel(
  page: Page,
  assertion: (hotels: HotelsPage, index: number) => Promise<void>,
): Promise<void> {
  const hotels = new HotelsPage(page);
  const count = await hotels.hotelCards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await assertion(hotels, i);
  }
}
