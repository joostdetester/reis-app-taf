import { expect } from '@playwright/test';
import { Given, When, Then } from './bdd';
import { TodayPage } from '../pageobjects/today.page';
import { TripOverviewPage } from '../pageobjects/trip-overview.page';

Then('the address bar no longer shows the edit token', async ({ page }) => {
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
  const response = await page.goto('/');
  world.mainResponse = response;
});

Then('the response sets Strict-Transport-Security', async ({ world }) => {
  const headers = world.mainResponse.headers();
  expect(headers['strict-transport-security']).toBeTruthy();
});
