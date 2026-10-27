import { test, expect } from '@playwright/test';

test('Live Meta preview milestone', async ({ page }) => {
  test.skip(process.env.FAULTLINE_LIVE_E2E !== '1', 'Run only during controlled credited preview verification');
  test.setTimeout(120_000);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Missing Approval' })).toBeVisible();

  const extractionResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/workflows/extract'));
  await page.getByRole('button', { name: 'Analyze workflow' }).click();
  const extraction = await extractionResponse;
  expect(extraction.status()).toBe(200);
  const extracted = await extraction.json();
  expect(extracted.workflow.conditions.length).toBeGreaterThan(0);
  expect(extracted.workflow.policyRules.length).toBeGreaterThan(0);
  expect(extracted.workflow.conditions[0].sourceSpans[0].verified).toBe(true);

  for (const condition of extracted.workflow.conditions) {
    await page.getByRole('combobox', { name: `Observed value for ${condition.name}` }).selectOption('true');
  }

  await page.getByRole('button', { name: 'EXPERIMENT' }).click();
  const investigationResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/investigations'));
  await page.getByRole('button', { name: 'Run investigation' }).click();
  const investigation = await investigationResponse;
  expect(investigation.status()).toBe(200);
  const result = await investigation.json();
  expect(result.failure.outcome).toBe('UNSAFE_EXECUTION');
  expect(result.verification.repaired.outcome).toBe('SAFE_BLOCK');
  expect(result.trace).toHaveLength(2);
  expect(result.investigationId).toMatch(/^[a-f0-9-]{36}$/);

  await page.getByRole('button', { name: 'REPLAY' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export certificate' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const certificate = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(certificate.modelMetadata.model).toBe('muse-spark-1.3');
  expect(certificate.modelMetadata.responseIds).toHaveLength(2);
  expect(certificate.modelMetadata.toolCallIds).toHaveLength(2);
  expect(certificate.integrityHash).toMatch(/^[a-f0-9]{64}$/);
});
