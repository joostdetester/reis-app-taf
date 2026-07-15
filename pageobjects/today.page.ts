import { Locator, Page } from '@playwright/test';
import { DayCardComponent } from './day-card.page';

// The Today page (#/today): a header (countdown/clock/next flight) above
// today's (and tomorrow's) day-card(s).
export class TodayPage {
  constructor(private readonly page: Page) {}

  get dayCards(): Locator {
    return this.page.locator('.day-card');
  }

  dayCard(index: number): DayCardComponent {
    return new DayCardComponent(this.dayCards.nth(index));
  }

  get countdownPanel(): Locator {
    return this.page.locator('.panel.countdown');
  }

  // Either "<N> dagen" before departure, or "Reis gestart" once the trip
  // has started - both are valid outcomes.
  get countdownValue(): Locator {
    return this.countdownPanel.locator('strong');
  }

  get nextFlightPanel(): Locator {
    return this.page.locator('.countdown-highlight');
  }

  get worldClock(): Locator {
    return this.page.locator('.world-clock');
  }

  get readonlyBadge(): Locator {
    return this.page.locator('.readonly-badge');
  }

  get logoutButton(): Locator {
    return this.page.locator('.logout-link');
  }

  // Every "Bewerk" edit button on the page, regardless of which day-card or
  // field it belongs to - used to assert none are shown in read-only mode.
  get editButtons(): Locator {
    return this.page.locator('button.edit');
  }
}
