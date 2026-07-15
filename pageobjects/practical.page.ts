import { Locator, Page } from '@playwright/test';

// The Practical information page (#/practical): weather-by-city, a
// Peso<->Euro converter, and static info blocks (Nood/Geld/Vervoer/
// Bereikbaarheid).
export class PracticalPage {
  constructor(private readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByText('Praktische informatie');
  }

  get citySelect(): Locator {
    return this.page.locator('.select-pill');
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
    return this.page.locator('.list-card').first().locator('div[style*="text-align: center"]');
  }

  private get converterCard(): Locator {
    return this.page.locator('.list-card', { hasText: 'Peso ↔ Euro' });
  }

  get pesoInput(): Locator {
    return this.converterCard.locator('.row', { hasText: 'Peso' }).locator('input');
  }

  get euroInput(): Locator {
    return this.converterCard.locator('.row', { hasText: 'Euro' }).locator('input');
  }

  get exchangeRateText(): Locator {
    return this.converterCard.locator('p.muted');
  }

  infoBlock(heading: string): Locator {
    return this.page
      .locator('.list-card')
      .filter({ has: this.page.locator('h3', { hasText: heading }) });
  }

  infoBlockBody(heading: string): Locator {
    return this.infoBlock(heading).locator('.value');
  }
}
