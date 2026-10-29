import { test, expect } from '@playwright/test';

test('Live Meta extraction and bounded investigation remain wired through the replacement', async ({ page }) => {
  test.skip(process.env.FAULTLINE_LIVE_E2E !== '1', 'Run only during controlled credited Meta verification');
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  await page.getByRole('button', { name: 'Workflow tools', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Workflow tools' });
  const extractionResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/workflows/extract'));
  await tools.getByRole('button', { name: 'Analyze workflow' }).click();
  const extraction = await extractionResponse;
  expect(extraction.status()).toBe(200);
  const extracted = await extraction.json();
  expect(extracted.workflow.conditions.length).toBeGreaterThan(0);
  expect(extracted.workflow.conditions[0].sourceSpans[0].verified).toBe(true);
  await expect(tools.getByRole('button', { name: 'Run investigation' })).toBeEnabled();
  const investigationResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/investigations'));
  await tools.getByRole('button', { name: 'Run investigation' }).click();
  const investigation = await investigationResponse;
  expect(investigation.status()).toBe(200);
  const investigated = await investigation.json();
  expect(investigated.trace.some((item: { tool: string }) => item.tool === 'run_counterfactual')).toBe(true);
  expect(investigated.model.id).toBeTruthy();
  await expect(page.locator('.evaluation-outcome')).toHaveText(investigated.failure.outcome);
});
