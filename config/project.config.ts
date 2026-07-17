export const projectConfig = {
  baseUrl: process.env.BASE_URL ?? 'https://playwright.dev',
  apiBaseUrl: process.env.API_BASE_URL ?? 'https://jsonplaceholder.typicode.com',
  editToken: process.env.EDIT_TOKEN ?? '',
  get editUrl() {
    return `${this.baseUrl}/?token=${this.editToken}`;
  },
  // Deliberately never a real token: verifies that the app treats a wrong/guessed
  // token as read-only instead of trusting its mere presence (see
  // verify-edit-token in reis-app).
  get invalidEditUrl() {
    return `${this.baseUrl}/?token=clearly-invalid-test-token`;
  },
};
