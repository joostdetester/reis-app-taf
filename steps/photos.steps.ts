import { expect } from '@playwright/test';
import { Given, Then } from './bdd';
import { NavigationPage } from '../pageobjects/navigation.page';
import { PhotosPage } from '../pageobjects/photos.page';

Given('the user opens the photos page', async ({ page, world }) => {
  const nav = new NavigationPage(page);
  await nav.open('photos');
  world.nav = nav;
});

Then('every day without photos shows the placeholder text {string}', async ({ page }, text: string) => {
  const photos = new PhotosPage(page);
  await expect(photos.dayCards.first()).toBeVisible();
  const count = await photos.dayCards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const hasPhotos = (await photos.photoGrid(i).count()) > 0;
    if (!hasPhotos) {
      await expect(photos.emptyState(i)).toHaveText(text);
    }
  }
});
