import { Locator, Page } from '@playwright/test';

// The Practical information page (#/practical): weather-by-city, a
// Peso<->Euro converter, and static info blocks (Nood/Geld/Vervoer/
// Bereikbaarheid).
export class PracticalPage {
  constructor(private readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Praktische informatie' });
  }

  get citySelect(): Locator {
    return this.page.getByTestId('weather-forecast-destination');
  }

  get cityOptions(): Locator {
    return this.citySelect.locator('option');
  }

  selectedCity(): Promise<string> {
    return this.citySelect.inputValue();
  }

  // Selects whichever city is currently the second <option> in the live
  // dropdown and returns its label - avoids hardcoding a specific city.
  // The option list can still be populating right after navigation, so wait
  // for a 2nd option to be attached rather than taking a single snapshot.
  async selectSecondCity(): Promise<string> {
    await this.cityOptions.nth(1).waitFor({ state: 'attached' });
    const labels = await this.cityOptions.allTextContents();
    const second = labels[1]?.trim();
    if (!second) {
      throw new Error('Expected at least 2 city options in the weather selector');
    }
    await this.citySelect.selectOption({ index: 1 });
    return second;
  }

  get forecastDays(): Locator {
    return this.page.locator('[data-testid^="weather-forecast-day-"]');
  }

  get pesoInput(): Locator {
    return this.page.getByTestId('currency-converter-php');
  }

  get euroInput(): Locator {
    return this.page.getByTestId('currency-converter-eur');
  }

  get exchangeRateText(): Locator {
    return this.page.getByTestId('currency-converter-rate');
  }

  // Practical-info blocks (Nood/Geld/Vervoer/Bereikbaarheid) are seeded
  // content, keyed by DB id rather than a fixed slug the tests can rely on -
  // the heading text is the only stable handle here, so this deliberately
  // stays a content lookup rather than a testid lookup.
  infoBlock(heading: string): Locator {
    return this.page.getByTestId('page-practical').locator('.list-card', {
      has: this.page.getByRole('heading', { level: 3, name: heading }),
    });
  }

  infoBlockBody(heading: string): Locator {
    return this.infoBlock(heading).locator('[data-testid$="-value"]');
  }
}
