import { Locator, Page } from '@playwright/test';

// The Flights page (#/transport): a list of .list-card entries, one per
// flight leg. Data loads asynchronously behind a "Laden…" notice - callers
// should wait for flightCards to be visible before asserting on them.
export class FlightsPage {
  constructor(private readonly page: Page) {}

  get pageContent(): Locator {
    return this.page.locator('main');
  }

  get flightCards(): Locator {
    return this.page.locator('main .grid > .list-card');
  }

  flightCard(index: number): Locator {
    return this.flightCards.nth(index);
  }

  flightNumber(index: number): Locator {
    return this.flightCard(index).locator('.row', { hasText: 'Vluchtnummer' }).locator('.value');
  }

  departureTime(index: number): Locator {
    return this.flightCard(index).locator('.row', { hasText: 'Vertrektijd' }).locator('.value');
  }

  arrivalTime(index: number): Locator {
    return this.flightCard(index).locator('.row', { hasText: 'Aankomsttijd' }).locator('.value');
  }

  duration(index: number): Locator {
    return this.flightCard(index).locator('.row', { hasText: 'Vluchtduur' }).locator('.value');
  }

  gate(index: number): Locator {
    return this.flightCard(index).locator('.row', { hasText: 'Gate' }).locator('.value');
  }

  arrivalTerminal(index: number): Locator {
    return this.flightCard(index)
      .locator('.row', { hasText: 'Aankomstterminal' })
      .locator('.value');
  }

  flightStatusLinks(index: number): Locator {
    return this.flightCard(index).locator('.row', { hasText: 'Vluchtstatus' }).getByRole('link');
  }

  routeLink(index: number): Locator {
    return this.flightCard(index).getByRole('link', { name: 'route' });
  }
}
