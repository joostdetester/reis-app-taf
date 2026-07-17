import { Locator, Page } from '@playwright/test';

// The inline edit "sheet" that opens when an authenticated user clicks a
// "Bewerk" (edit) button on any editable field. Every field's edit sheet
// shares this same testid suffix scheme (`<field-testid>-sheet`, with
// `-input`/`-cancel`/`-save`/`-confirm`/`-back`/`-error` inside it) -
// confirmed live, including the bespoke flight-time sheet on the Flights
// page, which isn't the shared EditSheet component but mirrors the same
// convention. This page object is intentionally field-agnostic: it targets
// "whichever edit sheet is currently open", not one specific field's id.
export class InlineEditForm {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.locator('[data-testid$="-sheet"]');
  }

  get heading(): Locator {
    return this.root.locator('h2');
  }

  get textInput(): Locator {
    return this.root.locator('[data-testid$="-input"]');
  }

  get cancelButton(): Locator {
    return this.root.locator('[data-testid$="-cancel"]');
  }

  get saveButton(): Locator {
    return this.root.locator('[data-testid$="-save"]');
  }
}
