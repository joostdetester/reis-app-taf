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
