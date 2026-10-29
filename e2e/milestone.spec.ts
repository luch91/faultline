import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  if (process.env.FAULTLINE_STAGING_URL && !process.env.FAULTLINE_STAGING_URL.startsWith('http://127.0.0.1')) return;
  const client = `locked-reference-test-${crypto.randomUUID()}`;
  await page.route('**/api/v1/**', route => route.continue({ headers: { ...route.request().headers(), 'CF-Connecting-IP': client } }));
});

test('Missing Approval evaluation, safeguard, replay, and certificate survive the visual replacement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  await expect(page.locator('.network-link.execution-gate')).toHaveCount(2);
  await expect(page.locator('.network-link.policy-requirement')).toHaveCount(4);
  await page.getByRole('button', { name: 'Workflow tools', exact: true }).click();
  const tools = page.getByRole('dialog', { name: 'Workflow tools' });
  await expect(tools.getByLabel('Human approval present', { exact: true })).not.toBeChecked();
  await expect(tools.locator('.missing-gate-readout')).toContainText('Human approval present');
  await tools.getByRole('combobox', { name: 'Condition', exact: true }).selectOption('human-approval');
  await tools.getByRole('button', { name: 'Apply intervention', exact: true }).click();
  await expect(page.locator('.evaluation-outcome')).toHaveText('UNSAFE_EXECUTION');
  await tools.getByRole('combobox', { name: 'Condition', exact: true }).selectOption('tests-pass');
  await tools.getByRole('button', { name: 'Test safeguard', exact: true }).click();
  await expect(page.locator('.evaluation-outcome')).toHaveText('SAFE_BLOCK');
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.getByRole('button', { name: 'Inspect Deploy to production', exact: true }).click();
  await expect(page.locator('[data-focused-id="deploy-production"]')).toBeVisible();
  await expect(page.locator('.radial-line.verified-gate')).toHaveCount(1);
  await expect(page.locator('.cluster-overview [data-node-id="human-approval"] title')).toHaveText(/VIOLATED: observed false/);
  await expect(page.locator('.network-link.execution-gate')).toHaveCount(3);
  await page.getByRole('button', { name: 'Flat view', exact: true }).click();
  await page.getByRole('button', { name: 'Return to network overview' }).click();
  await expect(page.locator('.reference-stage')).toHaveAttribute('data-motion-phase', 'overview');
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_BLOCK');
  await page.getByRole('button', { name: 'Flat view', exact: true }).click();
  await page.getByRole('button', { name: /Replay$/, exact: false }).click();
  const replay = page.getByRole('dialog', { name: 'Execution replay' });
  await replay.getByRole('button', { name: 'Step forward' }).click();
  await expect(replay).toContainText('EVENT 1 / 1');
  await expect(replay.locator('.trace-event-row')).toContainText('BLOCKED');
  const downloadPromise = page.waitForEvent('download');
  await replay.getByRole('button', { name: 'Export certificate' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const certificate = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(certificate.evaluationResult.outcome).toBe('UNSAFE_EXECUTION');
  expect(certificate.verificationResult.outcome).toBe('SAFE_BLOCK');
  expect(certificate.integrityHash).toMatch(/^[a-f0-9]{64}$/);
});

test('record filtering, ranking selection, heatmap, zoom, and return retain actual entities', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const modelCalls: string[] = [];
  page.on('request', request => { if (/workflows\/extract|\/investigations$/.test(request.url())) modelCalls.push(request.url()); });
  await page.goto('/');
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  await page.getByRole('textbox', { name: 'Search workflow records' }).fill('zzzz-no-record');
  await expect(page.locator('.directory-record')).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search workflow records' }).fill('');
  await page.getByRole('combobox', { name: 'Filter records' }).selectOption('Policy');
  await expect(page.locator('.directory-record i').first()).toHaveText('Policy');
  await page.getByRole('combobox', { name: 'Filter records' }).selectOption('All');
  await page.getByRole('button', { name: 'Heatmap', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Heatmap', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.live-network > g')).toHaveAttribute('transform', /scale\(1.2\)/);
  await page.getByRole('button', { name: 'Fit network' }).click();
  await page.getByRole('button', { name: 'Open record Human approval present', exact: true }).click();
  await expect(page.locator('[data-focused-id="human-approval"]')).toBeVisible();
  await page.getByRole('button', { name: 'Flat view', exact: true }).click();
  await page.getByRole('button', { name: 'Expand analytics' }).click();
  await expect(page.locator('.reference-stage')).toHaveAttribute('data-analytics-expanded', 'true');
  await page.getByRole('button', { name: 'Contract analytics' }).click();
  await expect(page.locator('.reference-stage')).toHaveAttribute('data-analytics-expanded', 'false');
  await page.getByRole('button', { name: 'Return to network overview' }).click();
  await expect(page.locator('.cluster-overview [data-node-id="human-approval"]')).toHaveClass(/selected/);
  expect(modelCalls).toEqual([]);
});

test('the 557-frame motion sequence forms spokes, expands analytics, returns, and transitions again', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  await page.clock.install();
  await page.getByRole('button', { name: 'Play presentation', exact: true }).click();
  await page.clock.runFor(2300);
  await expect(page.locator('.reference-stage')).toHaveAttribute('data-motion-phase', 'focus');
  const early = await page.locator('.radial-spoke').last().getAttribute('opacity');
  await page.clock.runFor(3000);
  await expect(page.locator('.radial-spoke').last()).toHaveAttribute('opacity', '1');
  expect(Number(early)).toBeLessThan(1);
  await page.clock.runFor(2800);
  await expect(page.locator('.reference-stage')).toHaveAttribute('data-analytics-expanded', 'true');
  await page.clock.runFor(2500);
  await expect(page.locator('.reference-stage')).toHaveAttribute('data-motion-phase', 'overview');
  await page.clock.runFor(8300);
  await expect(page.locator('.reference-stage')).toHaveAttribute('data-motion-phase', 'focus');
  await expect(page.getByRole('button', { name: 'Play presentation', exact: true })).toBeVisible();
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
});

test('network and investigation remain functional without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  await page.getByRole('button', { name: 'Inspect Human approval present', exact: true }).press('Enter');
  await expect(page.locator('[data-focused-id="human-approval"]')).toBeVisible();
  await expect(page.locator('.radial-spoke')).not.toHaveCount(0);
});

test('workflow source, observations, gates, and controlled Meta availability remain accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  await page.getByRole('button', { name: 'Workflow tools', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Workflow tools' });
  await expect(panel.getByRole('textbox', { name: 'Deployment procedure' })).toHaveValue(/human approval/);
  await expect(panel.getByRole('button', { name: 'Analyze workflow' })).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Run investigation' })).toBeDisabled();
  await panel.getByRole('combobox', { name: 'Observed value for Human approval present' }).selectOption('false');
  await expect(page.locator('.evaluation-outcome')).toHaveText('UNSAFE_EXECUTION');
  await panel.getByRole('checkbox', { name: 'Human approval present', exact: true }).check();
  await expect(page.locator('.evaluation-outcome')).toHaveText('SAFE_BLOCK');
  await panel.press('Escape');
  await expect(panel).not.toBeVisible();
});

test('API errors are displayed without invented records', async ({ page }) => {
  await page.route('**/api/v1/samples', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Sample service unavailable' }) }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText('Sample service unavailable');
  await expect(page.locator('.directory-record')).toHaveCount(0);
});

test('relationship inspection exposes actual semantics and filming never moves the application frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByLabel('Evaluation outcome')).toHaveText('SAFE_EXECUTION');
  const initial = await page.locator('.network-screen').boundingBox();
  await page.getByRole('button', { name: 'Inspect POLICY REQUIREMENT: Human approval present to Deployment policy', exact: true }).press('Enter');
  const details = page.getByRole('dialog', { name: 'Relationship details' });
  await expect(details).toContainText('Human approval present → Deployment policy');
  await expect(details).toContainText('Policy requirement, independently evaluated');
  await details.press('Escape');
  await page.getByRole('button', { name: 'Inspect Deploy to production', exact: true }).press('Enter');
  await expect(page.locator('[data-focused-id="deploy-production"]')).toBeVisible();
  const focused = await page.locator('.network-screen').boundingBox();
  expect(focused).toEqual(initial);
  await expect(page.locator('.monitor-edge, .presentation-surround')).toHaveCount(0);
  const labels = await page.locator('.radial-spoke text').evaluateAll(elements => elements.map(element => { const box = (element as SVGGraphicsElement).getBBox(); return { x: box.x, right: box.x + box.width }; }));
  expect(labels.every(box => box.x >= 0 && box.right <= 570)).toBe(true);
  await page.getByRole('button', { name: 'Select relationship Human approval present', exact: true }).press('Enter');
  await expect(details).toContainText('POLICY APPLIES TO');
  await expect(details).toContainText('POLICY REQUIREMENT');
  await expect(details).not.toContainText('Actual execution gate');
});
