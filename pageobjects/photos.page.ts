import { Locator, Page } from '@playwright/test';

// The Photos page (#/photos): one list-card per trip day (data-testid
// `day-photos-<dayId>`), each either showing a photo grid or the
// "Nog geen foto's voor deze dag." empty-state paragraph.
export class PhotosPage {
  constructor(private readonly page: Page) {}

  get pageContent(): Locator {
    return this.page.getByTestId('page-photos');
  }

  get dayCards(): Locator {
    return this.page.locator('[data-testid^="day-photos-"]');
  }

  dayCard(index: number): Locator {
    return this.dayCards.nth(index);
  }

  emptyState(index: number): Locator {
    return this.dayCard(index).locator('.muted', { hasText: 'Nog geen' });
  }

  photoGrid(index: number): Locator {
    return this.dayCard(index).locator('.photo-grid');
  }
}
