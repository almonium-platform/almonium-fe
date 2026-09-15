import {defineConfig, devices} from '@playwright/test';

// Set E2E_DIST to a built bundle directory to test that exact bundle instead
// of a dev server; CI does this with the artifact the image is built from.
const distDir = process.env['E2E_DIST'];
const port = process.env['E2E_PORT'] ?? '4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
  webServer: {
    command: distDir
      ? `node scripts/serve-dist.mjs ${distDir} ${port}`
      : `npm run start -- --configuration production --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    timeout: 120_000,
    reuseExistingServer: !process.env['CI'],
  },
});
