import { chromium } from '@playwright/test';

const base = process.env.FAULTLINE_MEASURE_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch(process.env.FAULTLINE_CHROMIUM_PATH ? { executablePath: process.env.FAULTLINE_CHROMIUM_PATH } : {});
const results = [];
const renderers = {};

function summarize(label, values) {
  const gaps = values.frames.slice(1).map((value, index) => value - values.frames[index]).filter(value => value > 0);
  const sorted = [...gaps].sort((a, b) => a - b);
  const duration = values.frames.length > 1 ? values.frames.at(-1) - values.frames[0] : 0;
  return {
    label,
    renderedFrames: values.frames.length,
    meanFramesPerSecond: duration ? Math.round((values.frames.length - 1) * 1000 / duration * 10) / 10 : null,
    p95FrameIntervalMs: sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)] * 10) / 10 : null,
    meanDrawCalls: values.drawCalls.length ? Math.round(values.drawCalls.reduce((sum, value) => sum + value, 0) / values.drawCalls.length) : null,
    meanTriangles: values.triangles.length ? Math.round(values.triangles.reduce((sum, value) => sum + value, 0) / values.triangles.length) : null,
  };
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'wide', width: 1827, height: 864 }, { name: 'mobile', width: 360, height: 780 }].filter(item => !process.env.FAULTLINE_MEASURE_VIEWPORT || item.name === process.env.FAULTLINE_MEASURE_VIEWPORT)) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  await page.goto(`${base}/?measure=1`);
  await page.locator('.spatial-scene canvas').waitFor();
  await page.waitForTimeout(1200);
  renderers[viewport.name] = await page.locator('.spatial-scene canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? 'unavailable';
  });
  for (const [label, action, duration] of [
    ['return', () => page.getByRole('button', { name: 'Overview' }).click(), 1350],
    ['approach', () => page.getByRole('button', { name: 'Focus' }).click(), 1200],
    ['module-focus', () => page.locator('.module-items').getByRole('button', { name: /Human approval present/ }).click(), 1050],
  ]) {
    await page.evaluate(() => { window.__faultlineRenderMetrics = { frames: [], drawCalls: [], triangles: [] }; });
    await action();
    await page.waitForTimeout(duration);
    const values = await page.evaluate(() => window.__faultlineRenderMetrics);
    results.push({ viewport: viewport.name, ...summarize(label, values) });
  }
  await page.close();
}
await browser.close();
process.stdout.write(`${JSON.stringify({ url: base, measuredAt: new Date().toISOString(), renderers, samples: results }, null, 2)}\n`);
