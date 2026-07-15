export const projectConfig = {
  baseUrl: process.env.BASE_URL ?? 'https://playwright.dev',
  apiBaseUrl: process.env.API_BASE_URL ?? 'https://jsonplaceholder.typicode.com',
  editToken: process.env.EDIT_TOKEN ?? '',
  get editUrl() {
    return `${this.baseUrl}/?token=${this.editToken}`;
  },
};
