import { Locator, Page } from '@playwright/test';

export type MainRoute = 'today' | 'trip' | 'hotels' | 'flights' | 'photos' | 'practical';

const ROUTE_PATHS: Record<MainRoute, string> = {
  today: '/#/today',
  trip: '/#/trip',
  hotels: '/#/hotels',
  flights: '/#/transport',
  photos: '/#/photos',
  practical: '/#/practical',
};

// `today`/`trip`/`hotels`/`flights` live in the fixed bottom nav (data-testid
// `bottom-nav-<route>`, where the app's own route segment for `flights` is
// `transport`); `photos`/`practical` are header-menu-only links instead
// (data-testid `menu-<route>`) - confirmed live, neither is in the bottom nav.
const NAV_TESTID: Record<MainRoute, string> = {
  today: 'bottom-nav-today',
  trip: 'bottom-nav-trip',
  hotels: 'bottom-nav-hotels',
  flights: 'bottom-nav-transport',
  photos: 'menu-photos',
  practical: 'menu-practical',
};

export class NavigationPage {
  constructor(private readonly page: Page) {}

  async open(route: MainRoute): Promise<void> {
    await this.page.goto(ROUTE_PATHS[route]);
  }

  async goTo(route: MainRoute): Promise<void> {
    await this.page.getByTestId(NAV_TESTID[route]).click();
  }

  async visitRoute(route: MainRoute): Promise<void> {
    await this.page.goto(ROUTE_PATHS[route]);
  }

  // The app stores the ?token=... query param in localStorage on load, then
  // strips it from the URL (client-side redirect) - confirmed live. `editUrl`
  // already ends in "?token=...", so the today route is appended as a hash
  // fragment (after the query string, per URL syntax). Waits for that
  // redirect to settle before returning, so callers never assert against
  // the transient token URL.
  async openWithToken(editUrl: string): Promise<void> {
    await this.page.goto(`${editUrl}#/today`);
    await this.page.waitForURL((url) => !url.search.includes('token'));
  }

  // `article[data-testid^="day-card-"]` (not just an attribute selector) so
  // this only matches the card root, not the inner elements that share the
  // same `day-card-<id>-...` testid prefix (head/location/date/badge/etc,
  // all non-`article` tags) - confirmed live.
  get todayCard(): Locator {
    return this.page.locator('article[data-testid^="day-card-"]').first();
  }

  get tripToolbar(): Locator {
    return this.page.getByTestId('trip-view-toolbar');
  }

  get hotelsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Overnachtingen' });
  }

  get flightsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Vluchten', exact: true });
  }

  get photosHeading(): Locator {
    return this.page.getByRole('heading', { name: "Foto's", exact: true });
  }

  get practicalHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Praktische informatie' });
  }
}
