import { defineConfig, devices } from '@playwright/test';

const stagingUrl = process.env.FAULTLINE_STAGING_URL;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: stagingUrl ?? 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'on', video: 'on', launchOptions: process.env.FAULTLINE_CHROMIUM_PATH ? { executablePath: process.env.FAULTLINE_CHROMIUM_PATH } : undefined },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
  ],
  webServer: stagingUrl ? undefined : [
    { command: 'pnpm --filter @faultline/api exec wrangler dev --local --persist-to .wrangler/e2e --ip 127.0.0.1 --port 8787 --var ALLOWED_ORIGIN:http://127.0.0.1:5173 --var MODEL_CALLS_ENABLED:false', url: 'http://127.0.0.1:8787/healthz', reuseExistingServer: false, timeout: 120_000 },
    { command: 'pnpm --filter @faultline/web dev --host 127.0.0.1 --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: false, timeout: 120_000 },
  ],
});
