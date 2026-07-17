/**
 * Third-party integrations the app calls directly from the browser, and the
 * version each test run is presumed to run against. Unlike the app itself
 * (fetched live from `{BASE_URL}/version.json`, see version-tracking.ts),
 * these are external services we don't control — there is no endpoint to ask
 * "what version are you". Update an entry by hand when you notice the
 * integration change (e.g. `src/utils/weather.ts` in the reis-app repo
 * switching from `/v1/` to `/v2/`), the same way you'd update a page object
 * when the app's markup changes.
 */
export interface TrackedThirdParty {
  label: string;
  /** null when the integration has no meaningful version to track (see note). */
  version: string | null;
  note: string;
}

export const trackedThirdPartyVersions: Record<string, TrackedThirdParty> = {
  'open-meteo': {
    label: 'Open-Meteo Weather API',
    version: 'v1',
    note: 'From the URL path (api.open-meteo.com/v1/forecast) used in reis-app src/utils/weather.ts.',
  },
  getyourguide: {
    label: 'GetYourGuide',
    version: null,
    note: 'Outbound link only (reis-app src/pages/TripPage.tsx) — no API call is made, so there is no version to track.',
  },
};
