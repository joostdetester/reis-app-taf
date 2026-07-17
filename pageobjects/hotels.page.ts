import { Locator, Page } from '@playwright/test';

// The Hotels page (#/hotels): a list of hotel-card entries (data-testid
// `hotel-card-<accommodationId>`), one per booked accommodation.
export class HotelsPage {
  constructor(private readonly page: Page) {}

  get pageContent(): Locator {
    return this.page.getByTestId('page-hotels');
  }

  get hotelCards(): Locator {
    return this.page.locator('[data-testid^="hotel-card-"]');
  }

  hotelCard(index: number): Locator {
    return this.hotelCards.nth(index);
  }

  name(index: number): Locator {
    return this.hotelCard(index).getByRole('heading', { level: 3 });
  }

  stayDates(index: number): Locator {
    return this.hotelCard(index).locator('[data-testid^="hotel-stay-dates-"]');
  }

  checkInOut(index: number): Locator {
    return this.hotelCard(index).locator('[data-testid^="hotel-checkinout-"]');
  }

  address(index: number): Locator {
    return this.hotelCard(index).locator(
      '[data-testid^="field-accommodations-address-"][data-testid$="-value"]',
    );
  }

  phone(index: number): Locator {
    return this.hotelCard(index).locator(
      '[data-testid^="field-accommodations-phone-"][data-testid$="-value"]',
    );
  }

  bookingNumber(index: number): Locator {
    return this.hotelCard(index).locator(
      '[data-testid^="field-accommodations-booking_reference-"][data-testid$="-value"]',
    );
  }

  mapsLink(index: number): Locator {
    return this.hotelCard(index).locator('[data-testid^="hotel-maps-link-"]');
  }

  bookingLink(index: number): Locator {
    return this.hotelCard(index).locator('[data-testid^="hotel-booking-link-"]');
  }
}
