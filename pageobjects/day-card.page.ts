import { Locator } from '@playwright/test';

// One "day-card" (.day-card article) as rendered on both the Today page
// (#/today) and the Trip timeline (#/trip) - same component, confirmed live
// on both routes. Constructed from an already-scoped Locator (one specific
// card), not from `page`, so callers control which card (by index) this
// wraps - see TodayPage.dayCard() / TripOverviewPage.dayCard().
export class DayCardComponent {
  constructor(private readonly root: Locator) {}

  get title(): Locator {
    return this.root.locator('.day-title');
  }

  get date(): Locator {
    return this.root.locator('.day-date');
  }

  // Weather and beach score are rendered as a single combined element
  // (e.g. "☀️ 44° / 36° · 🏖️ 8/10") - confirmed live, there is no separate
  // beach-score element to target.
  get weather(): Locator {
    return this.root.locator('.day-weather');
  }

  get flightSummary(): Locator {
    return this.root.locator('.day-transport');
  }

  get hotelSummary(): Locator {
    return this.root.locator('.day-hotel');
  }

  get mapLink(): Locator {
    return this.root.locator('.map-link');
  }

  // `kicker` is the Dutch label rendered on the card itself, e.g. "Ochtend".
  part(kicker: string): Locator {
    return this.root.locator('.part', { hasText: kicker }).locator('b');
  }

  editButtonForPart(kicker: string): Locator {
    return this.root.locator('.part', { hasText: kicker }).locator('button.edit');
  }

  get noteValue(): Locator {
    return this.root.locator('.row', { hasText: 'Notitie' }).locator('.value');
  }

  get noteEditButton(): Locator {
    return this.root.locator('.row', { hasText: 'Notitie' }).locator('button.edit');
  }
}
