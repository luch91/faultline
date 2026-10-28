import { test, expect } from '@playwright/test';
import { missingApproval } from '../fixtures/workflows/missing-approval';
import { evaluate } from '../packages/simulator/src';

test.beforeEach(async ({ page }) => {
  if (process.env.FAULTLINE_STAGING_URL && !process.env.FAULTLINE_STAGING_URL.startsWith('http://127.0.0.1')) return;
  const testClient = `browser-test-${crypto.randomUUID()}`;
  await page.route('**/api/v1/**', route => route.continue({ headers: { ...route.request().headers(), 'CF-Connecting-IP': testClient } }));
});

test('Missing Approval journey', async ({ page }) => {
  const baselineResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/experiments/run') && response.request().postData()?.includes('"intervention"') === false);
  await page.goto('/');
  const baseline = await baselineResponse;
  expect(baseline.status()).toBe(200);
  expect(await baseline.json()).toMatchObject({ kind: 'BASELINE', result: { outcome: 'SAFE_EXECUTION' } });
  await expect(page.getByRole('main', { name: 'Faultline Atlas' })).toBeVisible();
  await expect(page.locator('.atlas-directory-item')).toHaveCount(1);
  await page.screenshot({ path: `test-results/atlas-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Open investigation' }).click();
  await expect(page.getByRole('heading', { name: 'The Missing Approval' })).toBeVisible();
  await expect(page.locator('.policy-entry').getByText('Deployment requires passing tests, human approval, and migration compatibility')).toBeVisible();
  await expect(page.locator('.condition-row').filter({ hasText: 'Automated tests pass' })).toBeVisible();
  await expect(page.locator('.condition-row').filter({ hasText: 'Migration compatible' })).toBeVisible();
  await expect(page.locator('.gate-row').getByLabel('Human approval present')).not.toBeChecked();
  await expect(page.locator('.workflow-graph')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(5);
  await expect(page.locator('.policy-edge')).toHaveCount(4);
  await expect(page.locator('.gate-edge')).toHaveCount(2);
  await page.locator('.react-flow__controls-fitview').click();
  await expect.poll(() => page.locator('.graph-canvas').evaluate(canvas => {
    const bounds = canvas.getBoundingClientRect();
    return [...canvas.querySelectorAll('.react-flow__node')].every(node => { const rect = node.getBoundingClientRect(); return rect.top >= bounds.top && rect.bottom <= bounds.bottom && rect.left >= bounds.left && rect.right <= bounds.right; });
  })).toBe(true);
  await page.screenshot({ path: `test-results/baseline-graph-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('.spatial-scene canvas')).toBeVisible({ timeout: 30_000 });
  await page.locator('.module-items').getByRole('button', { name: /Human approval present/ }).click();
  await expect(page.locator('.selection-card')).toContainText('Human approval present');
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.locator('.spatial-scene')).toHaveAttribute('data-camera-state', /RETURN|OVERVIEW/);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `test-results/overview-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Focus' }).click();
  await expect(page.locator('.spatial-scene')).toHaveAttribute('data-camera-state', /APPROACH|INSTALLATION/);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `test-results/approach-${test.info().project.name}.png`, fullPage: true });
  await page.locator('.module-items').getByRole('button', { name: /Automated tests pass/ }).click();
  await expect(page.locator('.selection-card')).toContainText('Automated tests pass');
  await page.locator('.module-items').getByRole('button', { name: /Human approval present/ }).click();
  await page.getByRole('button', { name: 'Dependency list' }).click();
  await expect(page.getByRole('list', { name: 'Workflow modules' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.dependency-links')).toContainText('POLICY');
  await expect(page.locator('.dependency-links')).toContainText('EXECUTION GATE');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('.spatial-scene canvas')).toBeVisible();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `test-results/design-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'EXPERIMENT' }).click();
  await page.getByRole('combobox', { name: 'Condition' }).selectOption('human-approval');
  await page.getByRole('button', { name: 'Apply intervention' }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('UNSAFE_EXECUTION');
  await expect(page.locator('.selection-card')).toContainText('Scenario observation: false');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await expect(page.locator('.react-flow__node.state-violated')).toHaveCount(2);
  await expect(page.locator('.react-flow__node.state-unsafe')).toHaveCount(1);
  await expect(page.locator('.gate-edge')).toHaveCount(2);
  await page.screenshot({ path: `test-results/unsafe-graph-${test.info().project.name}.png`, fullPage: true });
  await page.waitForTimeout(750);
  await page.screenshot({ path: `test-results/experiment-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Test safeguard' }).click();
  await expect(page.locator('.timeline-grid')).toContainText('SAFE_BLOCK');
  await expect(page.locator('.timeline-strip')).toBeVisible();
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_BLOCK');
  await expect(page.locator('.selection-card')).toContainText('The required condition remains violated.');
  await expect(page.locator('.inspection-state')).toHaveText('VIOLATED');
  await expect(page.locator('.tested-edge')).toHaveCount(1);
  await page.screenshot({ path: `test-results/safeguard-graph-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Show counterfactual scenario' }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('UNSAFE_EXECUTION');
  await page.getByRole('button', { name: 'Show safeguard scenario' }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_BLOCK');
  await page.locator('.module-items').getByRole('button', { name: /Deploy to production/ }).click();
  await expect(page.locator('.inspection-state')).toHaveText('BLOCKED');
  await expect(page.locator('.selection-card')).toContainText('Policy: VIOLATED');
  await expect(page.locator('.selection-card')).toContainText('Execution: BLOCKED');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/safeguard-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Dependency list' }).click();
  await expect(page.locator('.dependency-nodes button').filter({ hasText: 'Human approval present' })).toContainText('VIOLATED');
  await expect(page.locator('.dependency-nodes button').filter({ hasText: 'Deploy to production' })).toContainText('BLOCKED');
  await expect(page.locator('.dependency-links button').filter({ hasText: 'Human approval present → Deploy to production' }).filter({ hasText: 'TESTED GATE' })).toHaveCount(1);
  await page.screenshot({ path: `test-results/safeguard-fallback-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await page.getByRole('button', { name: 'REPLAY' }).click();
  await page.getByRole('button', { name: 'Step forward' }).click();
  await expect(page.getByText('EVENT 01 / 01')).toBeVisible();
  await page.getByRole('button', { name: 'SAFEGUARD', exact: true }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_BLOCK');
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
  await page.getByRole('button', { name: 'Overview' }).click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `test-results/return-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'ATLAS' }).click();
  await expect(page.locator('.atlas-selection')).toContainText('UNSAFE_EXECUTION');
  await expect(page.locator('.atlas-selection')).toContainText('SAFE_BLOCK');
});

test('camera navigation respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open investigation' }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_EXECUTION', { timeout: 30_000 });
  await expect(page.locator('.spatial-scene canvas')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Focus' }).click();
  await expect(page.locator('.spatial-scene')).toHaveAttribute('data-camera-state', 'INSTALLATION');
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.locator('.spatial-scene')).toHaveAttribute('data-camera-state', 'OVERVIEW');
});

test('Atlas, Graph, and 3D preserve the selected workflow entity', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Faultline Atlas' })).toBeVisible();
  if (test.info().project.name === 'desktop') {
    await expect(page.locator('.atlas-3d canvas')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Select Human approval present' }).click();
    await expect(page.locator('.atlas-field-foot')).toContainText('Human approval present');
    await page.getByRole('button', { name: '2D MAP' }).click();
    await expect(page.locator('.atlas-visual svg')).toBeVisible();
    await page.getByRole('button', { name: '3D MAP' }).click();
    await expect(page.locator('.atlas-3d canvas')).toBeVisible({ timeout: 30_000 });
  } else {
    await expect(page.locator('.atlas-visual svg')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Open investigation' }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_EXECUTION');
  await page.locator('.react-flow__node').filter({ hasText: 'Human approval present' }).click();
  await expect(page.locator('.selection-card')).toContainText('Human approval present');
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('.spatial-scene canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.selection-card')).toContainText('Human approval present');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await expect(page.locator('.react-flow__node.selected')).toContainText('Human approval present');
  await page.getByRole('button', { name: 'ATLAS' }).click();
  await expect(page.locator('.atlas-selection')).toContainText('SAFE_EXECUTION');
  await page.getByRole('button', { name: 'Open investigation' }).click();
  await expect(page.locator('.selection-card')).toContainText('Human approval present');
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_EXECUTION');
});

test('Atlas refresh keeps the 2D map hidden in 3D mode', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop');
  await page.goto('/');
  await expect(page.locator('.atlas-3d canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.atlas-visual svg')).toBeHidden();
  await page.route('**/api/v1/samples', async route => {
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.continue();
  });
  await page.reload({ waitUntil: 'commit' });
  await expect(page.locator('.atlas-initial-loading')).toBeVisible();
  await expect(page.locator('.atlas')).toHaveCount(0);
  await expect(page.locator('.atlas-3d canvas')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.atlas-visual svg')).toBeHidden();
  await expect(page.locator('.atlas-loading')).toBeHidden();
});

test('API failure is visible', async ({ page }) => {
  await page.route('**/api/v1/samples', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Sample service unavailable' }) }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Sample service unavailable');
  await page.screenshot({ path: `test-results/error-${test.info().project.name}.png`, fullPage: true });
});

test('2D navigation appears when WebGL is unavailable', async ({ page }) => {
  const baseline = await evaluate(missingApproval);
  await page.route('**/api/v1/samples', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ samples: [missingApproval] }) }));
  await page.route('**/api/v1/budget', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ liveModelEnabled: false }) }));
  await page.route('**/api/v1/experiments/run', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ kind: 'BASELINE', result: baseline }) }));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await expect(page.locator('.atlas-visual svg')).toBeVisible();
  await expect(page.locator('.atlas-3d canvas')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open investigation' }).click();
  await expect(page.locator('.workflow-graph')).toBeVisible();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Workflow modules' })).toBeVisible({ timeout: 30_000 });
  await page.locator('.dependency-nodes button').filter({ hasText: 'Human approval present' }).click();
  await expect(page.locator('.selection-card')).toContainText('Human approval present');
  await expect(page.locator('.dependency-links')).toContainText('POLICY');
  await page.screenshot({ path: `test-results/fallback-${test.info().project.name}.png`, fullPage: true });
});

test('evaluated scenarios survive pending edits and view navigation without model calls', async ({ page }) => {
  const modelCalls: string[] = [];
  page.on('request', request => { if (/workflows\/extract|\/investigations$/.test(request.url())) modelCalls.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open investigation' }).click();
  await page.getByRole('button', { name: 'EXPERIMENT', exact: true }).click();
  await page.getByRole('combobox', { name: 'Condition', exact: true }).selectOption('human-approval');
  await page.getByRole('button', { name: 'Apply intervention' }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('UNSAFE_EXECUTION');
  await page.locator('.module-items').getByRole('button', { name: /Human approval present/ }).click();
  await page.getByRole('combobox', { name: 'Condition', exact: true }).selectOption('tests-pass');
  await expect(page.locator('.selection-card')).toContainText('Scenario observation: false');
  await page.getByRole('button', { name: 'Test safeguard', exact: true }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_BLOCK');
  await page.locator('.module-items').getByRole('button', { name: /Deploy to production/ }).click();
  await expect(page.locator('.selection-card')).toContainText('Execution gates: Automated tests pass, Migration compatible, Human approval present');
  await page.getByRole('button', { name: 'DESIGN', exact: true }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_BLOCK');
  await page.getByRole('button', { name: 'ATLAS', exact: true }).click();
  await page.getByRole('button', { name: 'Open investigation' }).click();
  await expect(page.locator('.outcome-chip')).toHaveText('SAFE_BLOCK');
  await expect(page.locator('.selection-card')).toContainText('Deploy to production');
  expect(modelCalls).toEqual([]);
});

test('observed slow rendering offers an immediate graph recovery', async ({ page }) => {
  test.skip(!!process.env.FAULTLINE_STAGING_URL, 'Uses the local development render meter to sustain a deterministic measurement window');
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => requestFrame(() => { window.setTimeout(() => callback(performance.now()), 120); });
  });
  await page.goto('/?measure=1');
  await page.getByRole('button', { name: 'Open investigation' }).click();
  await page.locator('.module-items').getByRole('button', { name: /Human approval present/ }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('.slow-scene')).toContainText('3D rendering is slow', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Open graph', exact: true }).click();
  await expect(page.locator('.workflow-graph')).toBeVisible();
  await expect(page.locator('.react-flow__node.selected')).toContainText('Human approval present');
  await expect(page.locator('.spatial-scene canvas')).toHaveCount(0);
});
