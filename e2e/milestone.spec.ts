import { test, expect } from '@playwright/test';

test('Missing Approval journey', async ({ page }) => {
  const baselineResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/experiments/run') && response.request().postData()?.includes('"intervention"') === false);
  await page.goto('/');
  const baseline = await baselineResponse;
  expect(baseline.status()).toBe(200);
  expect(await baseline.json()).toMatchObject({ kind: 'BASELINE', result: { outcome: 'SAFE_EXECUTION' } });
  await expect(page.getByRole('heading', { name: 'Model the decision' })).toBeVisible();
  await expect(page.getByText('The Missing Approval')).toBeVisible();
  await expect(page.getByText('Deployment requires passing tests, human approval, and migration compatibility')).toBeVisible();
  await expect(page.locator('.condition-row').filter({ hasText: 'Automated tests pass' })).toBeVisible();
  await expect(page.locator('.condition-row').filter({ hasText: 'Migration compatible' })).toBeVisible();
  await expect(page.locator('.gate-row').getByLabel('Human approval present')).not.toBeChecked();
  await page.screenshot({ path: `test-results/design-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: /EXPERIMENT/ }).click();
  await page.getByRole('combobox', { name: 'Condition' }).selectOption('human-approval');
  await page.getByRole('button', { name: 'Apply intervention' }).click();
  await expect(page.getByText('UNSAFE_EXECUTION')).toBeVisible();
  await page.screenshot({ path: `test-results/experiment-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Test safeguard' }).click();
  await expect(page.getByText('SAFE_BLOCK')).toBeVisible();
  await page.getByRole('button', { name: /REPLAY/ }).click();
  await page.getByRole('button', { name: 'Step forward' }).click();
  await expect(page.getByText('EVENT 01 / 01')).toBeVisible();
  await page.screenshot({ path: `test-results/replay-${test.info().project.name}.png`, fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export certificate' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const certificate = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(certificate.evaluationResult.outcome).toBe('UNSAFE_EXECUTION');
  expect(certificate.verificationResult.outcome).toBe('SAFE_BLOCK');
  expect(certificate.integrityHash).toMatch(/^[a-f0-9]{64}$/);
});

test('API failure is visible', async ({ page }) => {
  await page.route('**/api/v1/samples', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Sample service unavailable' }) }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Sample service unavailable');
  await page.screenshot({ path: `test-results/error-${test.info().project.name}.png`, fullPage: true });
});
