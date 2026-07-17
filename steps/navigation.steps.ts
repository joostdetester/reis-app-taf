import { expect } from '@playwright/test';
import { Given, When, Then } from './bdd';
import { MainRoute, NavigationPage } from '../pageobjects/navigation.page';

const ALL_ROUTES: MainRoute[] = ['today', 'trip', 'hotels', 'flights', 'photos', 'practical'];

Given('the user opens the today page', async ({ page, world }) => {
  const nav = new NavigationPage(page);
  await nav.open('today');
  world.nav = nav;
});

When('the user navigates to the trip overview', async ({ world }) => {
  await world.nav.goTo('trip');
});

Then('the trip overview is visible', async ({ world }) => {
  await expect(world.nav.tripToolbar).toBeVisible();
});

When('the user navigates to the hotels page', async ({ world }) => {
  await world.nav.goTo('hotels');
});

Then('the hotels overview is visible', async ({ world }) => {
  await expect(world.nav.hotelsHeading).toBeVisible();
});

When('the user navigates to the flights page', async ({ world }) => {
  await world.nav.goTo('flights');
});

Then('the flights overview is visible', async ({ world }) => {
  await expect(world.nav.flightsHeading).toBeVisible();
});

When('the user navigates back to the today page', async ({ world }) => {
  await world.nav.goTo('today');
});

Then('the today page is visible', async ({ world }) => {
  await expect(world.nav.todayCard).toBeVisible();
});

When('the user opens the photos page from the extra menu', async ({ world }) => {
  await world.nav.goTo('photos');
});

Then('the photos page is visible', async ({ world }) => {
  await expect(world.nav.photosHeading).toBeVisible();
});

When('the user opens the practical information page from the extra menu', async ({ world }) => {
  await world.nav.goTo('practical');
});

Then('the practical information page is visible', async ({ world }) => {
  await expect(world.nav.practicalHeading).toBeVisible();
});

When('the user visits every main page in sequence', async ({ page, world }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  for (const route of ALL_ROUTES) {
    await world.nav.visitRoute(route);
  }

  world.consoleErrors = errors;
});

Then('no console errors should have occurred', async ({ world }) => {
  expect(world.consoleErrors).toEqual([]);
});

When('the user taps through every main section', async ({ world }) => {
  // Each section's heading must be checked right after its own tap, not
  // after the whole loop - by the time later taps have navigated away, only
  // the final route's page is still on screen to inspect.
  const notShown: string[] = [];
  for (const route of ALL_ROUTES) {
    await world.nav.tapTo(route);
    try {
      await expect(world.nav.headingFor(route)).toBeVisible();
    } catch {
      notShown.push(route);
    }
  }
  world.sectionsNotShownAfterTap = notShown;
});

Then('each section is shown in turn', async ({ world }) => {
  expect(world.sectionsNotShownAfterTap).toEqual([]);
});

When('the user scrolls to the bottom of the page', async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
});

Then('the bottom navigation does not overlap the page content', async ({ world }) => {
  const navBox = await world.nav.bottomNav.boundingBox();
  const contentBox = await world.nav.lastMainContent.boundingBox();
  expect(navBox, 'Expected the bottom nav to be visible').not.toBeNull();
  expect(contentBox, 'Expected page content to be visible').not.toBeNull();
  expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(navBox!.y);
});
