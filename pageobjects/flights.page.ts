import { Locator, Page } from '@playwright/test';

// The Flights page (#/transport): a list of flight-card entries
// (data-testid `flight-card-<transportItemId>`), one per flight leg. Data
// loads asynchronously behind a "Laden…" notice - callers should wait for
// flightCards to be visible before asserting on them.
export class FlightsPage {
  constructor(private readonly page: Page) {}

  get pageContent(): Locator {
    return this.page.getByTestId('page-transport');
  }

  get flightCards(): Locator {
    return this.page.locator('[data-testid^="flight-card-"]');
  }

  flightCard(index: number): Locator {
    return this.flightCards.nth(index);
  }

  // Every flight's gate/terminal at once (not scoped to one card) - these
  // switch from a "not yet available" placeholder to a real value as
  // departure approaches (see the flights.feature scenario for that logic),
  // so a visual baseline treats them as inherently time-dependent content.
  get allGates(): Locator {
    return this.page.locator(
      '[data-testid^="field-transport_items-departure_gate-"][data-testid$="-value"]',
    );
  }

  get allArrivalTerminals(): Locator {
    return this.page.locator(
      '[data-testid^="field-transport_items-arrival_terminal-"][data-testid$="-value"]',
    );
  }

  flightNumber(index: number): Locator {
    return this.flightCard(index).locator(
      '[data-testid^="field-transport_items-booking_reference-"][data-testid$="-value"]',
    );
  }

  departureTime(index: number): Locator {
    return this.flightCard(index).locator(
      '[data-testid^="flight-time-departure_time-"][data-testid$="-value"]',
    );
  }

  arrivalTime(index: number): Locator {
    return this.flightCard(index).locator(
      '[data-testid^="flight-time-arrival_time-"][data-testid$="-value"]',
    );
  }

  duration(index: number): Locator {
    return this.flightCard(index).locator(
      '[data-testid^="flight-duration-"][data-testid$="-value"]',
    );
  }

  gate(index: number): Locator {
    return this.flightCard(index).locator(
      '[data-testid^="field-transport_items-departure_gate-"][data-testid$="-value"]',
    );
  }

  arrivalTerminal(index: number): Locator {
    return this.flightCard(index).locator(
      '[data-testid^="field-transport_items-arrival_terminal-"][data-testid$="-value"]',
    );
  }

  flightStatusLinks(index: number): Locator {
    return this.flightCard(index).locator('[data-testid^="flight-status-link-"]');
  }

  routeLink(index: number): Locator {
    return this.flightCard(index).locator('[data-testid^="flight-route-link-"]');
  }
}
