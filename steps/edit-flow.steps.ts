import { expect } from '@playwright/test';
import { Given, When, Then } from './bdd';
import { NavigationPage } from '../pageobjects/navigation.page';
import { TodayPage } from '../pageobjects/today.page';
import { InlineEditForm } from '../pageobjects/inline-edit-form.page';

// Dutch part labels used on the day-card, keyed by the English wording used
// in the Gherkin scenarios.
const PART_KICKERS: Record<string, string> = {
  morning: 'Ochtend',
  afternoon: 'Middag',
  evening: 'Avond',
};

function kickerFor(part: string): string {
  const kicker = PART_KICKERS[part];
  if (!kicker) {
    throw new Error(`Unknown day part "${part}"`);
  }
  return kicker;
}

Given('the user opens the today page without an edit token', async ({ page, world }) => {
  const nav = new NavigationPage(page);
  await nav.open('today');
  world.nav = nav;
});

Then('a read-only badge is shown', async ({ page }) => {
  await expect(new TodayPage(page).readonlyBadge).toContainText(/alleen-lezen/i);
});

Then('no edit buttons are shown', async ({ page }) => {
  await expect(new TodayPage(page).editButtons).toHaveCount(0);
});

Given('the user opens the app with a valid edit token', async ({ page, config, world }) => {
  const nav = new NavigationPage(page);
  await nav.openWithToken(config.editUrl);
  world.nav = nav;
  await expect(new TodayPage(page).dayCards.first()).toBeVisible();
});

Then('a logout button is shown', async ({ page }) => {
  await expect(new TodayPage(page).logoutButton).toContainText('Uitloggen');
});

Then('an edit button is shown for each part of the day', async ({ page }) => {
  const card = new TodayPage(page).dayCard(0);
  for (const kicker of Object.values(PART_KICKERS)) {
    await expect(card.editButtonForPart(kicker)).toBeVisible();
  }
});

Then('an edit button is shown for the note', async ({ page }) => {
  await expect(new TodayPage(page).dayCard(0).noteEditButton).toBeVisible();
});

When(
  'the user clicks the edit button for the {word} part of the day',
  async ({ page }, part: string) => {
    const card = new TodayPage(page).dayCard(0);
    await card.editButtonForPart(kickerFor(part)).click();
  },
);

Then('an inline form titled {string} is shown', async ({ page }, title: string) => {
  await expect(new InlineEditForm(page).heading).toHaveText(title);
});

Given('the user opened the inline edit form for the morning part of the day', async ({ page }) => {
  const card = new TodayPage(page).dayCard(0);
  await card.editButtonForPart(kickerFor('morning')).click();
  await expect(new InlineEditForm(page).root).toBeVisible();
});

When('the user types a change into the form', async ({ page, world }) => {
  const card = new TodayPage(page).dayCard(0);
  world.originalMorningText = await card.part(kickerFor('morning')).textContent();
  await new InlineEditForm(page).textInput.fill('TEMPORARY TEST EDIT - SHOULD NOT BE SAVED');
});

When('the user clicks cancel', async ({ page }) => {
  await new InlineEditForm(page).cancelButton.click();
});

Then('the form is closed', async ({ page }) => {
  await expect(new InlineEditForm(page).root).toHaveCount(0);
});

Then('the morning part of the day still shows its original value', async ({ page, world }) => {
  const card = new TodayPage(page).dayCard(0);
  await expect(card.part(kickerFor('morning'))).toHaveText(world.originalMorningText ?? '');
});
