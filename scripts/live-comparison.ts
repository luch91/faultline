import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { heldoutSpecs, heldoutWorkflow } from '../model-evaluation/heldout';
import { evaluate, validateWorkflow, verifySafeguard } from '../packages/simulator/src';
import { timeTask } from '../apps/api/src/task-timing';

type Label = { outcome: string; repair: string | null; basis: string };
type Result = { caseId: string; method: string; model: string; status: 'PASS' | 'FAIL' | 'ERROR'; latencyMs: number; timing?: { taskId: string; modelId: string; startedAtMs: number; completedAtMs: number; durationMs: number }; selectedTarget?: boolean; actualOutcome?: string; predictedOutcome?: string; outcomeCorrect?: boolean; verifiedRepair?: boolean; grounded?: boolean; usage?: unknown; error?: string; response?: unknown };
const labels = JSON.parse(await readFile('model-evaluation/ground-truth.json', 'utf8')) as { version: string; cases: Record<string, Label> };
const vars = Object.fromEntries((await readFile('apps/api/.dev.vars', 'utf8')).split(/\r?\n/).filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
if (process.env.MINSK_MODEL_EVAL_AUTHORIZED !== 'true' || process.env.MINSK_EVAL_MAX_SPEND_USD !== '10' || vars.MINSK_EVAL_MAX_CALLS !== '80' || vars.MINSK_EVAL_MAX_MICRO_USD !== '10000000') throw new Error('Controlled evaluation authorization and Worker limits are required');
const base = 'http://127.0.0.1:8787';
const headers = { 'Content-Type': 'application/json', 'X-Minsk-Eval-Token': vars.MINSK_EVAL_TOKEN };
const request = async (path: string, body?: unknown, challenger = false): Promise<Record<string, any>> => {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...headers, ...(challenger ? { 'X-Minsk-Test-Token': vars.BASETEN_TEST_TOKEN } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
  const json = await response.json() as Record<string, any>;
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${String(json.error ?? 'request failed')}`);
  return json;
};
const budget = async () => { for (let attempt = 0; ; attempt++) { try { return await request('/api/v1/budget'); } catch (error) { if (attempt >= 12 || !String(error).includes('HTTP 429')) throw error; await new Promise(resolve => setTimeout(resolve, 5000)); } } };
const startBudget = await budget();
if (!startBudget.liveModelEnabled || !startBudget.openWeightEnabled) throw new Error('Protected local Worker does not have both providers enabled');
let previous: { results?: Result[] } = {};
try { previous = JSON.parse(await readFile('model-evaluation/results/comparison.json', 'utf8')) as { results?: Result[] }; } catch { /* First run. */ }
const results: Result[] = previous.results ?? [];
await mkdir('model-evaluation/results', { recursive: true });
let current = startBudget;
const persist = async (refresh = false) => {
  if (refresh) current = await budget();
  const calls = Number(current.evaluation?.calls ?? 0);
  const conservativeUsd = Number(current.evaluation?.conservativeUsd ?? NaN);
  if (!Number.isFinite(conservativeUsd)) throw new Error('Worker did not report conservative evaluation accounting');
  await writeFile('model-evaluation/results/comparison.json', JSON.stringify({ version: '1', labelsVersion: labels.version, timestamp: new Date().toISOString(), authorizedCeilingUsd: 10, dispatchCeiling: 80, calls, conservativeUsd, usagePricedUsd: current.evaluation?.usagePricedUsd, startBudget: { metaUsd: startBudget.conservativeAccountedUsd, basetenUsd: startBudget.basetenAccountedUsd }, budget: current, results }, null, 2) + '\n');
  if (calls >= 80 || conservativeUsd >= 10) throw new Error('Evaluation dispatch or estimate ceiling reached');
};
const run = async (caseId: string, method: string, model: string, fn: () => Promise<Omit<Result, 'caseId' | 'method' | 'model' | 'latencyMs'>>): Promise<void> => {
  if (results.some(item => item.caseId === caseId && item.method === method && item.model === model)) return;
  const measured = await timeTask(`${caseId}:${method}`, model, fn);
  if (measured.ok) results.push({ caseId, method, model, latencyMs: measured.timing.durationMs, timing: measured.timing, ...measured.value });
  else results.push({ caseId, method, model, latencyMs: measured.timing.durationMs, timing: measured.timing, status: 'ERROR', error: measured.error instanceof Error ? measured.error.message : String(measured.error) });
  await persist();
  const last = results.at(-1)!;
  process.stdout.write(`${caseId} ${method} ${last.status} ${last.actualOutcome ?? ''} ${last.latencyMs}ms\n`);
};
for (const spec of heldoutSpecs) {
  const { workflow, text, targetId } = heldoutWorkflow(spec);
  validateWorkflow(workflow);
  const label = labels.cases[spec.id];
  if (!label) throw new Error(`Missing locked ground truth for ${spec.id}`);
  const target = workflow.conditions.find(item => item.id === targetId)!;
  const referenceIntervention = { id: `${spec.id}-reference`, targetConditionId: targetId, originalValue: target.observedValue, replacementValue: false, reason: 'Locked reference intervention', proposedBy: 'USER' as const, validated: true };
  const reference = await evaluate(workflow, referenceIntervention);
  if (reference.outcome !== label.outcome) throw new Error(`Independent reference disagreement for ${spec.id}: ${reference.outcome} versus ${label.outcome}`);
  if (label.repair) { const repair = await verifySafeguard(workflow, referenceIntervention, workflow.steps[0].id, targetId); if (repair.repaired.outcome !== label.repair) throw new Error(`Repair reference disagreement for ${spec.id}`); }
  await run(spec.id, 'extraction', 'muse-spark-1.3', async () => {
    const response = await request('/api/v1/workflows/extract', { text });
    const extracted = validateWorkflow(response.workflow);
    const grounded = [...extracted.conditions.flatMap(x => x.sourceSpans), ...extracted.policyRules.flatMap(x => x.sourceSpans), ...extracted.steps.flatMap(x => x.sourceSpans)].every(span => text.slice(span.startOffset, span.endOffset) === span.excerpt);
    const main = extracted.conditions.find(x => x.name.toLowerCase().includes(spec.requirement.toLowerCase()));
    const policy = extracted.policyRules.some(x => !!main && x.requiredConditionIds.includes(main.id));
    const gate = extracted.steps.some(x => !!main && x.executionGateIds.includes(main.id));
    const observationCorrect = !!main && main.observedValue === spec.mainObserved;
    const correct = !!main && observationCorrect && policy && gate === spec.mainGate && grounded;
    return { status: correct ? 'PASS' : 'FAIL', grounded, outcomeCorrect: correct, usage: response.model?.usage, response: { workflow: extracted, model: response.model } };
  });
  for (const modelId of ['muse-spark-1.3', 'muse-wonder-1.0'] as const) {
    await run(spec.id, 'assisted', modelId, async () => {
      const response = await request('/api/v1/evaluation/investigate', { workflow, modelId });
      const selectedTarget = response.intervention?.targetConditionId === targetId && response.intervention?.replacementValue === false;
      const actualOutcome = response.failure?.outcome;
      const verifiedRepair = response.verification?.repaired?.outcome === 'SAFE_BLOCK' && response.verification?.resolved === true;
      const outcomeCorrect = selectedTarget && actualOutcome === label.outcome;
      return { status: outcomeCorrect && (!label.repair || verifiedRepair) ? 'PASS' : 'FAIL', selectedTarget, actualOutcome, outcomeCorrect, verifiedRepair, usage: response.model?.usage, response };
    });
  }
  await run(spec.id, 'challenger', 'meta-models/muse-spark-open-1026', async () => {
    const response = await request('/api/v1/challengers/open-weight', { workflow }, true);
    const candidate = (response.experiments as Array<any>).find(item => item.intervention.targetConditionId === targetId && item.intervention.replacementValue === false);
    const actualOutcome = candidate?.result?.outcome;
    const outcomeCorrect = actualOutcome === label.outcome;
    return { status: outcomeCorrect ? 'PASS' : 'FAIL', selectedTarget: !!candidate, actualOutcome, outcomeCorrect, usage: response.challenger?.usage, response };
  });
  await run(spec.id, 'model-only', 'muse-spark-1.3', async () => {
    const response = await request('/api/v1/evaluation/model-only', { workflow, modelId: 'muse-spark-1.3' });
    let parsed: Record<string, any> = {};
    try { parsed = JSON.parse(response.output); } catch { /* Invalid model output is scored as a failure. */ }
    const selected = workflow.conditions.find(item => item.id === parsed.conditionId && typeof item.observedValue === 'boolean' && item.observedValue !== parsed.replacementValue);
    const selectedTarget = selected?.id === targetId && parsed.replacementValue === false;
    const actualOutcome = selected ? (await evaluate(workflow, { ...referenceIntervention, targetConditionId: selected.id, originalValue: selected.observedValue, replacementValue: parsed.replacementValue })).outcome : undefined;
    const outcomeCorrect = !!selectedTarget && parsed.predictedOutcome === label.outcome && actualOutcome === label.outcome;
    return { status: outcomeCorrect ? 'PASS' : 'FAIL', selectedTarget, actualOutcome, predictedOutcome: parsed.predictedOutcome, outcomeCorrect, usage: response.usage, response };
  });
  await persist(true);
}
for (const id of ['H01', 'H07']) {
  const spec = heldoutSpecs.find(item => item.id === id)!;
  const { workflow, targetId } = heldoutWorkflow(spec);
  const label = labels.cases[id];
  for (const modelId of ['muse-spark-1.3', 'muse-wonder-1.0'] as const) {
    await run(id, 'assisted-repeat', modelId, async () => {
      const response = await request('/api/v1/evaluation/investigate', { workflow, modelId });
      const selectedTarget = response.intervention?.targetConditionId === targetId && response.intervention?.replacementValue === false;
      const actualOutcome = response.failure?.outcome;
      const verifiedRepair = response.verification?.repaired?.outcome === 'SAFE_BLOCK' && response.verification?.resolved === true;
      const outcomeCorrect = selectedTarget && actualOutcome === label.outcome;
      return { status: outcomeCorrect && (!label.repair || verifiedRepair) ? 'PASS' : 'FAIL', selectedTarget, actualOutcome, outcomeCorrect, verifiedRepair, usage: response.model?.usage, response };
    });
  }
  await run(id, 'challenger-repeat', 'meta-models/muse-spark-open-1026', async () => {
    const response = await request('/api/v1/challengers/open-weight', { workflow }, true);
    const candidate = (response.experiments as Array<any>).find(item => item.intervention.targetConditionId === targetId && item.intervention.replacementValue === false);
    const actualOutcome = candidate?.result?.outcome;
    return { status: actualOutcome === label.outcome ? 'PASS' : 'FAIL', selectedTarget: !!candidate, actualOutcome, outcomeCorrect: actualOutcome === label.outcome, usage: response.challenger?.usage, response };
  });
  await run(id, 'model-only-repeat', 'muse-spark-1.3', async () => {
    const response = await request('/api/v1/evaluation/model-only', { workflow, modelId: 'muse-spark-1.3' });
    let parsed: Record<string, any> = {};
    try { parsed = JSON.parse(response.output); } catch { /* Invalid output is scored as failure. */ }
    const selected = workflow.conditions.find(item => item.id === parsed.conditionId && typeof item.observedValue === 'boolean' && item.observedValue !== parsed.replacementValue);
    const selectedTarget = selected?.id === targetId && parsed.replacementValue === false;
    const actualOutcome = selected ? (await evaluate(workflow, { id: `${id}-repeat`, targetConditionId: selected.id, originalValue: selected.observedValue, replacementValue: parsed.replacementValue, reason: 'Repeat check', proposedBy: 'USER', validated: true })).outcome : undefined;
    const outcomeCorrect = !!selectedTarget && parsed.predictedOutcome === label.outcome && actualOutcome === label.outcome;
    return { status: outcomeCorrect ? 'PASS' : 'FAIL', selectedTarget, actualOutcome, predictedOutcome: parsed.predictedOutcome, outcomeCorrect, usage: response.usage, response };
  });
  await persist(true);
}
await persist(true);
process.stdout.write(`Completed ${results.length} scored tasks. Results: model-evaluation/results/comparison.json\n`);
