import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { missingApproval } from '../fixtures/workflows/missing-approval';
import { SCHEMA_VERSION, type Workflow } from '../packages/contracts/src';
import { evaluate, validateWorkflow } from '../packages/simulator/src';
import { routeInvestigation } from '../apps/api/src/models';

const text = 'Production deployment requires passing tests and human approval. A test runner records passing tests. A reviewer records human approval. The deployment agent waits for test and review steps but does not check approval as an execution gate.';
const excerpt = (part: string) => {
  const startOffset = text.indexOf(part);
  if (startOffset < 0) throw new Error('Held-out source excerpt is absent');
  return { sourceId: 'heldout-source', startOffset, endOffset: startOffset + part.length, excerpt: part, verified: true };
};
const heldout: Workflow = {
  schemaVersion: SCHEMA_VERSION, id: 'heldout-review-dependency', title: 'Review dependency without approval gate',
  sourceDocuments: [{ id: 'heldout-source', text, contentHash: createHash('sha256').update(text).digest('hex'), createdAt: '2026-10-30T00:00:00.000Z', schemaVersion: SCHEMA_VERSION }],
  conditions: [
    { id: 'tests-pass', name: 'Tests pass', valueType: 'BOOLEAN', expectedValue: true, observedValue: true, sourceSpans: [excerpt('passing tests')], freshnessRequirement: null, observedAt: null },
    { id: 'approval', name: 'Human approval', valueType: 'BOOLEAN', expectedValue: true, observedValue: true, sourceSpans: [excerpt('human approval')], freshnessRequirement: null, observedAt: null },
  ],
  policyRules: [{ id: 'release-policy', description: 'Deployment requires passing tests and human approval', subjectStepId: 'deploy', predicate: 'ALL', requiredConditionIds: ['tests-pass', 'approval'], sourceSpans: [excerpt('Production deployment requires passing tests and human approval.')], origin: 'EXPLICIT' }],
  steps: [
    { id: 'test', name: 'Test runner', actionType: 'CHECK', dependsOn: [], executionGateIds: ['tests-pass'], sourceSpans: [excerpt('A test runner records passing tests.')] },
    { id: 'review', name: 'Reviewer', actionType: 'APPROVE', dependsOn: [], executionGateIds: [], sourceSpans: [excerpt('A reviewer records human approval.')] },
    { id: 'deploy', name: 'Deployment agent', actionType: 'DEPLOY', dependsOn: ['test', 'review'], executionGateIds: [], sourceSpans: [excerpt('The deployment agent waits for test and review steps but does not check approval as an execution gate.')] },
  ],
};

const plan = {
  mode: 'PLAN_ONLY',
  models: ['muse-spark-1.3', 'muse-wonder-1.0', 'meta-models/muse-spark-open-1026'],
  cases: ['Spark extraction of held-out workflow', 'Spark routine investigation of Missing Approval', 'Wonder advanced investigation of held-out workflow', 'Baseten challenger candidates for held-out workflow'],
  maximumProviderCalls: 6,
  maximumEstimatedUsd: 0.30,
  directModelOnlyBaseline: 'UNSUPPORTED_WITH_CURRENT_BUDGETED_API',
  requirements: ['Explicit new call authorization', 'Current Meta and Baseten promotional credit confirmation', 'Local Worker with protected model switches and keys', 'MINSK_MODEL_EVAL_AUTHORIZED=true', 'MINSK_EVAL_MAX_SPEND_USD=0.30', 'MINSK_EVAL_TEST_TOKEN for Baseten challenger'],
};

const live = process.argv.includes('--live');
validateWorkflow(heldout);
if (routeInvestigation(missingApproval, true).modelId !== 'muse-spark-1.3' || routeInvestigation(heldout, true).modelId !== 'muse-wonder-1.0') throw new Error('Evaluation fixtures no longer exercise both routes');
if (!live) {
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
} else {
  if (process.env.MINSK_MODEL_EVAL_AUTHORIZED !== 'true' || process.env.MINSK_EVAL_MAX_SPEND_USD !== '0.30') throw new Error('Bounded live evaluation authorization is missing');
  const base = process.env.MINSK_EVAL_API_URL ?? 'http://127.0.0.1:8787';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Live evaluation is restricted to a local protected Worker');
  const request = async (path: string, body?: unknown, token?: string) => {
    const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { 'X-Minsk-Test-Token': token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120_000) });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${String(payload.error ?? 'request failed')}`);
    return payload;
  };
  const before = await request('/api/v1/budget');
  if (before.liveModelEnabled !== true || before.openWeightEnabled !== true || !process.env.MINSK_EVAL_TEST_TOKEN) throw new Error('Protected Worker is not ready for both providers');
  const samples = [];
  const timed = async (task: string, run: () => Promise<Record<string, unknown>>) => {
    const start = performance.now();
    const response = await run();
    samples.push({ task, latencyMs: Math.round(performance.now() - start), response });
    return response;
  };
  const extraction = await timed('Spark extraction', () => request('/api/v1/workflows/extract', { text }));
  const extracted = extraction.workflow as Workflow;
  const approval = extracted.conditions.find(item => item.name.toLowerCase().includes('approval'));
  const releaseRule = extracted.policyRules.find(rule => approval && rule.requiredConditionIds.includes(approval.id));
  const extractionChecks = { schemaValid: Boolean(validateWorkflow(extracted)), approvalConditionFound: Boolean(approval), approvalPolicyFound: Boolean(releaseRule), citedEvidencePresent: extracted.conditions.every(item => item.sourceSpans.length > 0) };
  const spark = await timed('Spark routine investigation', () => request('/api/v1/investigations', { workflow: missingApproval }));
  const wonder = await timed('Wonder advanced investigation', () => request('/api/v1/investigations', { workflow: heldout }));
  const challenger = await timed('Baseten challenger', () => request('/api/v1/challengers/open-weight', { workflow: heldout }, process.env.MINSK_EVAL_TEST_TOKEN));
  const after = await request('/api/v1/budget');
  const summarize = (value: Record<string, unknown>) => ({ model: (value.model as Record<string, unknown> | undefined)?.modelId ?? (value.routing as Record<string, unknown> | undefined)?.modelId ?? null, routing: value.routing ?? null, baseline: (value.baseline as Record<string, unknown> | undefined)?.outcome ?? null, failure: (value.failure as Record<string, unknown> | undefined)?.outcome ?? null, repaired: ((value.verification as Record<string, unknown> | undefined)?.repaired as Record<string, unknown> | undefined)?.outcome ?? null, tools: ((value.trace as Array<Record<string, unknown>> | undefined) ?? []).map(item => ({ tool: item.tool, status: item.status, modelId: item.modelId })) });
  const candidateOutcomes = ((challenger.experiments as Array<Record<string, unknown>> | undefined) ?? []).map(item => ({ intervention: item.intervention, outcome: (item.result as Record<string, unknown>).outcome }));
  const report = { version: '1', createdAt: new Date().toISOString(), plannedMaximumCalls: plan.maximumProviderCalls, extractionChecks, spark: summarize(spark), wonder: summarize(wonder), challenger: { model: (challenger.challenger as Record<string, unknown>)?.modelId, candidates: candidateOutcomes }, latenciesMs: samples.map(item => ({ task: item.task, latencyMs: item.latencyMs })), estimatedLedgerDeltaUsd: Number(after.conservativeAccountedUsd) - Number(before.conservativeAccountedUsd), basetenLedgerDeltaUsd: Number(after.basetenAccountedUsd) - Number(before.basetenAccountedUsd), heldoutCounterfactualOutcome: (await evaluate(heldout, { id: 'heldout-remove-approval', targetConditionId: 'approval', originalValue: true, replacementValue: false, reason: 'Held-out check', proposedBy: 'USER', validated: true })).outcome, modelOnlyBaseline: 'NOT_RUN' };
  await mkdir('model-evaluation/results', { recursive: true });
  await writeFile('model-evaluation/results/latest.json', `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
