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

const NAV_LINK_NAMES: Record<MainRoute, RegExp> = {
  today: /Vandaag/,
  trip: /Reis/,
  hotels: /Hotels/,
  flights: /Vluchten/,
  photos: /Foto's/,
  practical: /Praktisch/,
};

export class NavigationPage {
  constructor(private readonly page: Page) {}

  async open(route: MainRoute): Promise<void> {
    await this.page.goto(ROUTE_PATHS[route]);
  }

  async goTo(route: MainRoute): Promise<void> {
    await this.page.getByRole('link', { name: NAV_LINK_NAMES[route] }).click();
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

  get todayCard(): Locator {
    return this.page.locator('.day-card').first();
  }

  get tripToolbar(): Locator {
    return this.page.locator('.toolbar');
  }

  get hotelsHeading(): Locator {
    return this.page.getByText('Overnachtingen');
  }

  get flightsHeading(): Locator {
    return this.page.getByText('Vluchten', { exact: true }).first();
  }

  get photosHeading(): Locator {
    return this.page.getByText("Foto's", { exact: true }).first();
  }

  get practicalHeading(): Locator {
    return this.page.getByText('Praktische informatie');
  }
}
