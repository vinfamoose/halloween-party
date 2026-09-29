// Browser tests for the site. The pages are served as plain static files from the repo root, and
// Supabase is replaced by tests/fixtures/supabase-stub.js, so no network or database is needed.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Lets a machine with its own Chromium (set CHROMIUM_PATH) skip `playwright install`.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'big-screen', use: { viewport: { width: 1920, height: 1080 } }, testMatch: /display/ }
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory ..',
    url: 'http://127.0.0.1:4173/party.html',
    reuseExistingServer: !process.env.CI
  }
});
