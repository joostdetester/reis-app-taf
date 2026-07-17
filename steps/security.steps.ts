import { expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { Given, When, Then } from './bdd';
import { TodayPage } from '../pageobjects/today.page';
import { TripOverviewPage } from '../pageobjects/trip-overview.page';

// Set once, from the first step unique to each scenario (the shared Given
// steps below - "opens the app with a valid edit token", "opens the trip
// overview page" - are reused by other, non-@security scenarios too, so
// describing the security angle there would mislabel those). Wrapped like
// fixtures.ts's safeAllure: an Allure call should never fail the test run
// (e.g. running without the allure-playwright reporter attached).
async function describeScenario(text: string): Promise<void> {
  try {
    await allure.description(text);
  } catch {
    // no-op - see comment above
  }
}

Then('the address bar no longer shows the edit token', async ({ page }) => {
  await describeScenario(
    "Confirms the edit-access token isn't left exposed in the address bar " +
      'after loading, or after a reload. A token visible in the URL bar can ' +
      'leak via a screen share, browser history, or a shared screenshot, ' +
      'effectively handing out write access to the trip. Passing means the ' +
      'app strips the token from the URL immediately and keeps edit access ' +
      'working via storage, not a re-shown token.',
  );
  expect(page.url()).not.toContain('token=');
});

When('the user reloads the page', async ({ page }) => {
  await page.reload();
});

Then('edit access is still available', async ({ page }) => {
  await expect(new TodayPage(page).logoutButton).toBeVisible();
});

Then('the address bar still does not show the edit token', async ({ page }) => {
  expect(page.url()).not.toContain('token=');
});

// Attribute-value payload (no quotes needed in HTML) so it also works
// unescaped as a Gherkin step string, and `alert()` gives an unambiguous,
// unmissable signal if it ever actually executes - a dialog Playwright would
// otherwise leave open and hang the test on, which is exactly why the
// listener below dismisses it immediately rather than letting that happen.
const XSS_PAYLOAD = '<img src=x onerror=alert(1)>';

When('the user searches for a script-injection payload', async ({ page, world }) => {
  await describeScenario(
    'Smoke-tests the trip search field against a classic XSS payload ' +
      '(`<img src=x onerror=alert(1)>`). If the app ever rendered search ' +
      'input as raw HTML instead of escaping it, this payload would pop a ' +
      'browser dialog. Passing means no dialog fires and the payload is ' +
      'treated as literal, non-matching search text, not executable markup.',
  );
  world.dialogFired = false;
  page.on('dialog', async (dialog) => {
    world.dialogFired = true;
    await dialog.dismiss();
  });
  await new TripOverviewPage(page).searchFor(XSS_PAYLOAD);
});

Then('no dialog is triggered by the search', async ({ world }) => {
  expect(world.dialogFired).toBe(false);
});

Then('no day matches the payload', async ({ page }) => {
  // Same "just an empty list, no explicit message" behavior as any other
  // non-matching search term - see ai/test-backlog.md's Trip overview
  // section for the confirmed-live baseline this reuses.
  await expect(new TripOverviewPage(page).dayCards).toHaveCount(0);
});

Given('the user requests the app over HTTPS', async ({ page, world }) => {
  await describeScenario(
    'Checks that the app sets the Strict-Transport-Security (HSTS) header. ' +
      'Without it, a user who ever connects over plain HTTP (e.g. an old ' +
      '`http://` link) risks an SSL-stripping man-in-the-middle attack; ' +
      'HSTS tells the browser to only ever use HTTPS for this site from now ' +
      'on. Only HSTS is asserted here - the app is also missing ' +
      'Content-Security-Policy, X-Frame-Options and X-Content-Type-Options, ' +
      'tracked as a known gap in ai/security-testing.md.',
  );
  const response = await page.goto('/');
  world.mainResponse = response;
});

Then('the response sets Strict-Transport-Security', async ({ world }) => {
  const headers = world.mainResponse.headers();
  expect(headers['strict-transport-security']).toBeTruthy();
});
