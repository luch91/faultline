import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { heldoutSpecs, heldoutWorkflow } from '../model-evaluation/heldout';
import { evaluate, validateWorkflow, verifySafeguard } from '../packages/simulator/src';

type Label = { outcome: string; repair: string | null; basis: string };
type Result = { caseId: string; method: string; model: string; status: 'PASS' | 'FAIL' | 'ERROR'; latencyMs: number; selectedTarget?: boolean; actualOutcome?: string; predictedOutcome?: string; outcomeCorrect?: boolean; verifiedRepair?: boolean; grounded?: boolean; usage?: unknown; error?: string; response?: unknown };
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
const budget = () => request('/api/v1/budget');
const startBudget = await budget();
if (!startBudget.liveModelEnabled || !startBudget.openWeightEnabled) throw new Error('Protected local Worker does not have both providers enabled');
const results: Result[] = [];
await mkdir('model-evaluation/results', { recursive: true });
const persist = async () => {
  const current = await budget();
  const calls = Object.values(current.providers as Record<string, { calls: number }>).reduce((n, row) => n + row.calls, 0);
  const conservativeUsd = Number(current.conservativeAccountedUsd) + Number(current.basetenAccountedUsd);
  await writeFile('model-evaluation/results/comparison.json', JSON.stringify({ version: '1', labelsVersion: labels.version, timestamp: new Date().toISOString(), authorizedCeilingUsd: 10, dispatchCeiling: 80, calls, conservativeUsd, startBudget: { metaUsd: startBudget.conservativeAccountedUsd, basetenUsd: startBudget.basetenAccountedUsd }, budget: current, results }, null, 2) + '\n');
  if (calls >= 80 || conservativeUsd >= 10) throw new Error('Evaluation dispatch or estimate ceiling reached');
};
const run = async (caseId: string, method: string, model: string, fn: () => Promise<Omit<Result, 'caseId' | 'method' | 'model' | 'latencyMs'>>): Promise<void> => {
  const begin = performance.now();
  try { results.push({ caseId, method, model, latencyMs: Math.round(performance.now() - begin), ...await fn() }); }
  catch (error) { results.push({ caseId, method, model, latencyMs: Math.round(performance.now() - begin), status: 'ERROR', error: error instanceof Error ? error.message : String(error) }); }
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
    const correct = !!main && policy && gate === spec.mainGate && grounded;
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
}
await persist();
process.stdout.write(`Completed ${results.length} scored tasks. Results: model-evaluation/results/comparison.json\n`);
