import { Locator, Page } from '@playwright/test';

// The Hotels page (#/hotels): a list of .list-card entries, one per booked
// accommodation.
export class HotelsPage {
  constructor(private readonly page: Page) {}

  get pageContent(): Locator {
    return this.page.locator('main');
  }

  get hotelCards(): Locator {
    return this.page.locator('.grid.cols > .list-card');
  }

  hotelCard(index: number): Locator {
    return this.hotelCards.nth(index);
  }

  name(index: number): Locator {
    return this.hotelCard(index).locator('h3');
  }

  stayDates(index: number): Locator {
    return this.hotelCard(index).locator('.muted').first();
  }

  checkInOut(index: number): Locator {
    return this.hotelCard(index).locator('p.muted');
  }

  address(index: number): Locator {
    return this.hotelCard(index).locator('.row', { hasText: 'Adres' }).locator('.value');
  }

  phone(index: number): Locator {
    return this.hotelCard(index).locator('.row', { hasText: 'Telefoon' }).locator('.value');
  }

  bookingNumber(index: number): Locator {
    return this.hotelCard(index).locator('.row', { hasText: 'Boekingsnummer' }).locator('.value');
  }

  mapsLink(index: number): Locator {
    return this.hotelCard(index).getByRole('link', { name: 'Open in Google Maps' });
  }

  bookingLink(index: number): Locator {
    return this.hotelCard(index).getByRole('link', { name: 'Bekijk op Booking.com' });
  }
}
