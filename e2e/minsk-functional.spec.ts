import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('sample, counterfactual, safeguard, replay, certificate, and benchmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Minsk', exact: true })).toBeVisible();
  await expect(page.getByLabel('Baseline outcome')).toHaveText('SAFE_EXECUTION', { timeout: 20_000 });
  await expect(page.getByText('Deployment requires passing tests, human approval, and migration compatibility')).toBeVisible();

  await page.getByLabel('Intervention target').selectOption('human-approval');
  await page.getByRole('button', { name: 'Run counterfactual' }).click();
  await expect(page.getByLabel('Counterfactual outcome')).toHaveText('UNSAFE_EXECUTION');
  await page.getByRole('button', { name: 'Verify safeguard' }).click();
  await expect(page.getByLabel('Safeguard outcome')).toHaveText('SAFE_BLOCK');
  await expect(page.getByText('Verified: true')).toBeVisible();
  await expect(page.getByText('Violated policy: approval-required. The tested gate blocks execution.')).toBeVisible();
  await expect(page.getByText('TESTED EXECUTION CONTROLS')).toBeVisible();

  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await page.getByRole('button', { name: 'BASELINE' }).click();
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  await page.getByRole('button', { name: 'COUNTERFACTUAL', exact: true }).click();
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('UNSAFE_EXECUTION');
  await page.getByRole('button', { name: 'SAFEGUARD', exact: true }).click();
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_BLOCK');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export certificate' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('minsk-certificate.json');
  const certificate = JSON.parse(await readFile(await file.path(), 'utf8'));
  expect(certificate.certificateVersion).toBe('1');
  expect(certificate.baseline.outcome).toBe('SAFE_EXECUTION');
  expect(certificate.evaluationResult.outcome).toBe('UNSAFE_EXECUTION');
  expect(certificate.verificationResult.outcome).toBe('SAFE_BLOCK');
  expect(certificate.modelMetadata).toBeNull();
  expect(certificate.integrityHash).toMatch(/^[a-f0-9]{64}$/);
  await expect(page.getByText('Exported certificate')).toBeVisible();
  await page.getByRole('button', { name: 'Verify certificate' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Integrity valid' })).toContainText('original input matched');

  await page.getByRole('button', { name: 'Evaluation', exact: true }).click();
  await page.getByRole('button', { name: 'Run 12 deterministic cases' }).click();
  await expect(page.getByLabel('Benchmark results')).toContainText('MFB-12');
});

test('sample selection and unknown evidence remain usable on mobile and desktop', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Baseline outcome')).toHaveText('SAFE_EXECUTION', { timeout: 30_000 });
  await page.getByLabel('Sample workflow').selectOption('mfb-09');
  await expect(page.getByLabel('Baseline outcome')).toHaveText('INDETERMINATE', { timeout: 30_000 });
  await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth', 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await expect(page.getByText('Original source')).toBeVisible();
});

test('API failure is reported as an error', async ({ page }) => {
  await page.route('**/api/v1/samples', route => route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Unavailable</html>' }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText('API returned 502 without JSON');
});
