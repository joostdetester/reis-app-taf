import { Locator, Page } from '@playwright/test';
import { DayCardComponent } from './day-card.page';

// The Today page (#/today): a header (countdown/clock/next flight) above
// today's (and tomorrow's) day-card(s).
export class TodayPage {
  constructor(private readonly page: Page) {}

  // See NavigationPage.todayCard for why the tag is part of the selector.
  get dayCards(): Locator {
    return this.page.locator('article[data-testid^="day-card-"]');
  }

  dayCard(index: number): DayCardComponent {
    return new DayCardComponent(this.dayCards.nth(index));
  }

  // Every day-card's weather+beach-score element at once (there can be more
  // than one card - today and tomorrow) - `getByTestId` on the unscoped page
  // matches all of them, not just the first.
  get allWeather(): Locator {
    return this.page.getByTestId('day-weather');
  }

  get countdownPanel(): Locator {
    return this.page.getByTestId('countdown');
  }

  // Either "<N> dagen" before departure, or "Reis gestart" once the trip
  // has started - both are valid outcomes.
  get countdownValue(): Locator {
    return this.page.getByTestId('countdown-value');
  }

  get nextFlightPanel(): Locator {
    return this.page.getByTestId('countdown-next-flight');
  }

  get worldClock(): Locator {
    return this.page.getByTestId('world-clock');
  }

  get readonlyBadge(): Locator {
    return this.page.getByTestId('readonly-badge');
  }

  get logoutButton(): Locator {
    return this.page.getByTestId('logout-button');
  }

  // Every "Bewerk" edit button on the page, regardless of which day-card or
  // field it belongs to - every one of the app's edit-button testids ends in
  // `-edit` (day-part-<field>-<dayId>-edit, field-<table>-<field>-<id>-edit,
  // flight-time-<field>-<id>-edit) - confirmed live. Used to assert none are
  // shown in read-only mode.
  get editButtons(): Locator {
    return this.page.locator('[data-testid$="-edit"]');
  }
}
