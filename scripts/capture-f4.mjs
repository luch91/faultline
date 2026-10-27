import { chromium } from '@playwright/test';
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.env.FAULTLINE_CAPTURE_URL ?? 'http://127.0.0.1:5173';
const output = process.env.FAULTLINE_CAPTURE_DIR ?? 'f4-captures';
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.FAULTLINE_CHROMIUM_PATH ? { executablePath: process.env.FAULTLINE_CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 1827, height: 864 }, deviceScaleFactor: 1, recordVideo: { dir: output, size: { width: 1827, height: 864 } } });
const page = await context.newPage();
const image = async name => page.screenshot({ path: join(output, `${name}.png`), fullPage: true });

try {
  await page.goto(url);
  await page.locator('.outcome-chip').getByText('SAFE_EXECUTION').waitFor();
  await page.getByRole('button', { name: 'Overview' }).click();
  await page.waitForTimeout(1350);
  await image('01-overview-wide');
  await page.getByRole('button', { name: 'Focus' }).click();
  await page.waitForTimeout(500);
  await image('02-approach-wide');
  await page.waitForTimeout(1250);
  await page.locator('.module-items').getByRole('button', { name: /Human approval present/ }).click();
  await page.waitForTimeout(850);
  await image('03-inspection-wide');
  await page.getByRole('button', { name: '2D list' }).click();
  await image('04-dependencies-wide');
  await page.getByRole('button', { name: '3D scene' }).click();
  await page.getByRole('button', { name: 'EXPERIMENT' }).click();
  await page.getByRole('combobox', { name: 'Condition' }).selectOption('human-approval');
  await page.getByRole('button', { name: 'Apply intervention' }).click();
  await page.locator('.outcome-chip').getByText('UNSAFE_EXECUTION').waitFor();
  await page.waitForTimeout(850);
  await image('05-unsafe-wide');
  await page.getByRole('button', { name: 'Test safeguard' }).click();
  await page.locator('.outcome-chip').getByText('SAFE_BLOCK').waitFor();
  await page.waitForTimeout(850);
  await image('06-safeguard-wide');
  await page.getByRole('button', { name: 'REPLAY' }).click();
  await page.getByRole('button', { name: 'Step forward' }).click();
  await image('07-replay-wide');
  await page.getByRole('button', { name: 'Overview' }).click();
  await page.waitForTimeout(1350);
  await image('08-return-wide');
} finally {
  const video = page.video();
  await context.close();
  if (video) await copyFile(await video.path(), join(output, 'f4-motion-wide.webm'));
  await browser.close();
}
