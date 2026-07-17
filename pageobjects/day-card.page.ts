import { Locator } from '@playwright/test';

// One "day-card" (article[data-testid^="day-card-"]) as rendered on both the
// Today page (#/today) and the Trip timeline (#/trip) - same component,
// confirmed live on both routes. Constructed from an already-scoped Locator
// (one specific card), not from `page`, so callers control which card (by
// index) this wraps - see TodayPage.dayCard() / TripOverviewPage.dayCard().
//
// The card's own testid embeds the day's DB id (`day-card-<dayId>`), which
// this component never sees directly (only a scoped Locator). Inner elements
// are targeted with `[data-testid$="-<suffix>"]` instead, which is unambiguous
// as long as it's scoped under `root` (confirmed live: each suffix below
// occurs at most once per card).
const PART_FIELD: Record<string, string> = {
  Ochtend: 'morning_text',
  Middag: 'afternoon_text',
  Avond: 'evening_text',
};

export class DayCardComponent {
  constructor(private readonly root: Locator) {}

  get title(): Locator {
    return this.root.locator('[data-testid$="-location"]');
  }

  get date(): Locator {
    return this.root.locator('[data-testid$="-date"]');
  }

  // Weather and beach score are rendered as a single combined element
  // (e.g. "☀️ 44° / 36° · 🏖️ 8/10") - confirmed live, there is no separate
  // beach-score element to target.
  get weather(): Locator {
    return this.root.getByTestId('day-weather');
  }

  // A day can have more than one transport leg (e.g. an overstap day) - this
  // intentionally returns all of them, matching the previous `.day-transport`
  // behavior.
  get flightSummary(): Locator {
    return this.root.locator('[data-testid^="day-card-transport-"]');
  }

  get hotelSummary(): Locator {
    return this.root.getByTestId('day-card-hotel');
  }

  get mapLink(): Locator {
    return this.root.locator('[data-testid$="-map-link"]');
  }

  // `kicker` is the Dutch label rendered on the card itself, e.g. "Ochtend".
  private partField(kicker: string): string {
    const field = PART_FIELD[kicker];
    if (!field) {
      throw new Error(`Unknown day-part kicker "${kicker}"`);
    }
    return field;
  }

  part(kicker: string): Locator {
    const field = this.partField(kicker);
    return this.root.locator(`[data-testid^="day-part-${field}-"][data-testid$="-value"]`);
  }

  editButtonForPart(kicker: string): Locator {
    const field = this.partField(kicker);
    return this.root.locator(`[data-testid^="day-part-${field}-"][data-testid$="-edit"]`);
  }

  get noteValue(): Locator {
    return this.root.locator('[data-testid^="field-trip_days-notes-"][data-testid$="-value"]');
  }

  get noteEditButton(): Locator {
    return this.root.locator('[data-testid^="field-trip_days-notes-"][data-testid$="-edit"]');
  }
}
