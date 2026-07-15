import { Locator, Page } from '@playwright/test';

// The inline edit "sheet" (.sheet) that opens when an authenticated user
// clicks a "Bewerk" (edit) button on a day-card field.
export class InlineEditForm {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.locator('.sheet');
  }

  get heading(): Locator {
    return this.root.locator('h2');
  }

  get textInput(): Locator {
    return this.root.locator('textarea');
  }

  get cancelButton(): Locator {
    return this.root.getByRole('button', { name: 'Annuleren' });
  }

  get saveButton(): Locator {
    return this.root.getByRole('button', { name: 'Opslaan' });
  }
}
