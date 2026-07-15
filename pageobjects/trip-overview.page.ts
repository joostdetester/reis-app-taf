import { Locator, Page } from '@playwright/test';
import { DayCardComponent } from './day-card.page';

export type TripView = 'timeline' | 'destinations' | 'calendar';

// Dutch labels used by the in-page view-switcher chips (.toolbar .chip),
// confirmed live - distinct from the emoji-prefixed links in the page
// header, which navigate to the same views but aren't the "view switcher
// component" itself.
const VIEW_LABELS: Record<TripView, string> = {
  timeline: 'Tijdlijn',
  destinations: 'Bestemmingen',
  calendar: 'Kalender',
};

// The Trip overview page (#/trip), covering all three views: timeline
// (default, one .day-card per day), destinations (.list-card groups) and
// calendar (a compact .calendar-grid of date -> destination links).
export class TripOverviewPage {
  constructor(private readonly page: Page) {}

  get toolbar(): Locator {
    return this.page.locator('.toolbar');
  }

  viewChip(view: TripView): Locator {
    return this.toolbar.getByRole('button', { name: VIEW_LABELS[view], exact: true });
  }

  async switchTo(view: TripView): Promise<void> {
    await this.viewChip(view).click();
  }

  get searchInput(): Locator {
    return this.page.locator('input.search');
  }

  async searchFor(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  // Timeline view
  get dayCards(): Locator {
    return this.page.locator('main .day-card');
  }

  dayCard(index: number): DayCardComponent {
    return new DayCardComponent(this.dayCards.nth(index));
  }

  get dayDates(): Locator {
    return this.dayCards.locator('.day-date');
  }

  // Destinations view
  get destinationGroups(): Locator {
    return this.page.locator('.list-card');
  }

  destinationHeading(index: number): Locator {
    return this.destinationGroups.nth(index).locator('h3');
  }

  destinationActivitiesLink(index: number): Locator {
    return this.destinationGroups.nth(index).getByRole('link', { name: /Top activiteiten/ });
  }

  // Calendar view
  get calendarEntries(): Locator {
    return this.page.locator('.calendar-grid a');
  }
}
