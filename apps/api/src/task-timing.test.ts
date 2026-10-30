import { describe, expect, it } from 'vitest';
import { timeTask } from './task-timing';

describe('evaluation task timing', () => {
  it('finishes after the asynchronous provider response', async () => {
    let resolve!: (value: string) => void;
    const pending = new Promise<string>(done => { resolve = done; });
    let epoch = 1000; let monotonic = 10;
    const measure = timeTask('H01:assisted', 'muse-spark-1.3', () => pending, { epoch: () => epoch, monotonic: () => monotonic });
    epoch = 1040; monotonic = 50; resolve('complete');
    const result = await measure;
    expect(result).toMatchObject({ ok: true, value: 'complete', timing: { taskId: 'H01:assisted', modelId: 'muse-spark-1.3', startedAtMs: 1000, completedAtMs: 1040, durationMs: 40 } });
  });
  it('records failed attempts instead of losing their duration', async () => {
    let tick = 0;
    const result = await timeTask('H04:challenger', 'meta-models/muse-spark-open-1026', async () => { tick = 17; throw new Error('No candidate'); }, { epoch: () => 1000 + tick, monotonic: () => tick });
    expect(result).toMatchObject({ ok: false, timing: { startedAtMs: 1000, completedAtMs: 1017, durationMs: 17 } });
  });
});
