import { Locator, Page } from '@playwright/test';
import { DayCardComponent } from './day-card.page';

export type TripView = 'timeline' | 'destinations' | 'calendar';

// The view-switcher chips carry their own data-testid (`trip-view-<view>`) -
// distinct from the emoji-prefixed links in the page header, which navigate
// to the same views but aren't the "view switcher component" itself.
const VIEW_TESTID: Record<TripView, string> = {
  timeline: 'trip-view-timeline',
  destinations: 'trip-view-destinations',
  calendar: 'trip-view-calendar',
};

// The Trip overview page (#/trip), covering all three views: timeline
// (default, one day-card per day), destinations (destination-block groups)
// and calendar (a compact grid of date -> destination links, one per
// calendar-day-<date> entry).
export class TripOverviewPage {
  constructor(private readonly page: Page) {}

  get toolbar(): Locator {
    return this.page.getByTestId('trip-view-toolbar');
  }

  viewChip(view: TripView): Locator {
    return this.page.getByTestId(VIEW_TESTID[view]);
  }

  async switchTo(view: TripView): Promise<void> {
    await this.viewChip(view).click();
  }

  get searchInput(): Locator {
    return this.page.getByTestId('trip-search');
  }

  async searchFor(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  // Timeline view
  get dayCards(): Locator {
    return this.page.getByTestId('page-trip').locator('article[data-testid^="day-card-"]');
  }

  dayCard(index: number): DayCardComponent {
    return new DayCardComponent(this.dayCards.nth(index));
  }

  get dayDates(): Locator {
    return this.dayCards.locator('[data-testid$="-date"]');
  }

  // Destinations view
  get destinationGroups(): Locator {
    return this.page.locator('[data-testid^="destination-block-"]');
  }

  destinationHeading(index: number): Locator {
    return this.destinationGroups.nth(index).getByRole('heading', { level: 3 });
  }

  destinationActivitiesLink(index: number): Locator {
    return this.destinationGroups.nth(index).getByRole('link', { name: /Top activiteiten/ });
  }

  // Calendar view
  get calendarEntries(): Locator {
    return this.page.locator('[data-testid^="calendar-day-"]');
  }
}
