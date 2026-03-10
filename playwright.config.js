// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:8765',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    // No npm/node server needed — Python's built-in HTTP server serves the
    // static files. gear.js is loaded as a plain <script> tag.
    command: 'python3 -m http.server 8765',
    url: 'http://localhost:8765',
    reuseExistingServer: !process.env.CI,
    timeout: 5000,
  },
};
