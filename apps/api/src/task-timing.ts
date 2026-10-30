export type TaskTiming = { taskId: string; modelId: string; startedAtMs: number; completedAtMs: number; durationMs: number };

export async function timeTask<T>(taskId: string, modelId: string, run: () => Promise<T>, clock: { epoch: () => number; monotonic: () => number } = { epoch: Date.now, monotonic: () => performance.now() }): Promise<{ ok: true; value: T; timing: TaskTiming } | { ok: false; error: unknown; timing: TaskTiming }> {
  const startedAtMs = clock.epoch();
  const start = clock.monotonic();
  const finish = (): TaskTiming => ({ taskId, modelId, startedAtMs, completedAtMs: clock.epoch(), durationMs: Math.max(0, Math.round(clock.monotonic() - start)) });
  try { const value = await run(); return { ok: true, value, timing: finish() }; }
  catch (error) { return { ok: false, error, timing: finish() }; }
}
