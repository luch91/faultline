import { expect, test } from '@playwright/test';

test('sample, counterfactual, safeguard, replay, certificate, and benchmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Minsk', exact: true })).toBeVisible();
  await expect(page.getByLabel('Baseline outcome')).toHaveText('SAFE_EXECUTION');
  await expect(page.getByText('Deployment requires passing tests, human approval, and migration compatibility')).toBeVisible();

  await page.getByLabel('Intervention target').selectOption('human-approval');
  await page.getByRole('button', { name: 'Run counterfactual' }).click();
  await expect(page.getByLabel('Counterfactual outcome')).toHaveText('UNSAFE_EXECUTION');
  await page.getByRole('button', { name: 'Verify safeguard' }).click();
  await expect(page.getByLabel('Safeguard outcome')).toHaveText('SAFE_BLOCK');
  await expect(page.getByText('Verified: true')).toBeVisible();

  await page.getByRole('button', { name: 'BASELINE' }).click();
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  await page.getByRole('button', { name: 'COUNTERFACTUAL', exact: true }).click();
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('UNSAFE_EXECUTION');
  await page.getByRole('button', { name: 'SAFEGUARD', exact: true }).click();
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_BLOCK');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export certificate' }).click();
  expect((await download).suggestedFilename()).toBe('minsk-certificate.json');
  await expect(page.getByText('Exported certificate')).toBeVisible();

  await page.getByRole('button', { name: 'Run 12 deterministic cases' }).click();
  await expect(page.getByLabel('Benchmark results')).toContainText('MFB-12');
});

test('API failure is reported as an error', async ({ page }) => {
  await page.route('**/api/v1/samples', route => route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Unavailable</html>' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('API returned 502 without JSON');
});
