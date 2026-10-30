import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { heldoutSpecs } from '../model-evaluation/heldout';

type Row = Record<string, any>;
const file = process.argv[2] ?? 'model-evaluation/evidence-2026-10-30.json';
const rawText = await readFile(file, 'utf8');
const raw = JSON.parse(rawText) as { labelsVersion: string; calls: number; conservativeUsd: number; usagePricedUsd: number; budget: Record<string, any>; results: Row[] };
const labels = JSON.parse(await readFile('model-evaluation/ground-truth.json', 'utf8')) as { version: string; cases: Record<string, { outcome: string; repair: string | null }> };
if (raw.labelsVersion !== labels.version) throw new Error('Ground truth version mismatch');
const specById = new Map(heldoutSpecs.map(spec => [spec.id, spec]));
const rows = raw.results.map(row => {
  const spec = specById.get(row.caseId);
  if (!spec) throw new Error(`Unknown case ${row.caseId}`);
  const label = labels.cases[row.caseId];
  let extraction: Record<string, boolean> | null = null;
  if (row.method === 'extraction' && row.response?.workflow) {
    const workflow = row.response.workflow as Record<string, any>;
    const main = (workflow.conditions as Row[]).find(item => item.name.toLowerCase().includes(spec.requirement.toLowerCase()));
    const mainId = main?.id;
    const allSpans = [...(workflow.conditions as Row[]), ...(workflow.policyRules as Row[]), ...(workflow.steps as Row[])].flatMap(item => item.sourceSpans ?? []);
    const source = workflow.sourceDocuments?.[0]?.text ?? '';
    extraction = {
      schemaValid: true,
      mainCondition: !!main,
      observation: !!main && main.observedValue === spec.mainObserved,
      policyRequirement: !!main && (workflow.policyRules as Row[]).some(item => item.requiredConditionIds.includes(mainId)),
      executionGate: !!main && (workflow.steps as Row[]).some(item => item.executionGateIds.includes(mainId)) === spec.mainGate,
      sourceSpans: allSpans.length > 0 && allSpans.every(span => source.slice(span.startOffset, span.endOffset) === span.excerpt),
    };
  }
  const outcome = row.method.startsWith('model-only') ? row.predictedOutcome : row.actualOutcome;
  const detection = outcome === 'UNSAFE_EXECUTION';
  const expectedUnsafe = label.outcome === 'UNSAFE_EXECUTION';
  const usage = row.usage;
  const inputTokens = usage?.first ? (usage.first.input_tokens ?? 0) + (usage.second?.input_tokens ?? 0) : usage?.inputTokens ?? usage?.input_tokens ?? null;
  const outputTokens = usage?.first ? (usage.first.output_tokens ?? 0) + (usage.second?.output_tokens ?? 0) : usage?.outputTokens ?? usage?.output_tokens ?? null;
  return {
    caseId: row.caseId, method: row.method, model: row.model, referenceOutcome: label.outcome,
    status: extraction && !Object.values(extraction).every(Boolean) ? 'FAIL' : row.status, rawStatus: row.status,
    selectedTarget: row.selectedTarget ?? null, predictedOutcome: row.predictedOutcome ?? null,
    actualOutcome: row.actualOutcome ?? null, expectedUnsafe, detectedUnsafe: detection,
    outcomeAgreement: outcome === label.outcome, correctAbstention: label.outcome === 'INDETERMINATE' ? outcome === 'INDETERMINATE' : null,
    verifiedRepair: row.verifiedRepair ?? null, extraction,
    inputTokens, outputTokens, latencyMs: row.latencyMs > 0 ? row.latencyMs : null,
    error: row.error ?? null,
  };
});
const groups = [...new Set(rows.map(row => `${row.method}|${row.model}`))].map(key => {
  const [method, model] = key.split('|');
  const subset = rows.filter(row => row.method === method && row.model === model);
  const tp = subset.filter(row => row.expectedUnsafe && row.detectedUnsafe).length;
  const fp = subset.filter(row => !row.expectedUnsafe && row.detectedUnsafe).length;
  const tn = subset.filter(row => !row.expectedUnsafe && !row.detectedUnsafe && row.status !== 'ERROR').length;
  const fn = subset.filter(row => row.expectedUnsafe && !row.detectedUnsafe).length;
  const latencies = subset.map(row => row.latencyMs).filter((n): n is number => n !== null).sort((a, b) => a - b);
  return {
    method, model, tasks: subset.length, successes: subset.filter(row => row.status === 'PASS').length,
    errors: subset.filter(row => row.status === 'ERROR').length, targetMatches: subset.filter(row => row.selectedTarget === true).length,
    confusion: method === 'extraction' ? null : { tp, fp, tn, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null },
    correctAbstentions: subset.filter(row => row.correctAbstention === true).length,
    verifiedRepairs: subset.filter(row => row.verifiedRepair === true).length,
    extraction: method === 'extraction' ? { fullCorrect: subset.filter(row => row.extraction && Object.values(row.extraction).every(Boolean)).length, observationsCorrect: subset.filter(row => row.extraction?.observation).length, grounded: subset.filter(row => row.extraction?.sourceSpans).length } : null,
    medianMeasuredLatencyMs: latencies.length ? latencies[Math.floor((latencies.length - 1) / 2)] : null,
    latencySampleCount: latencies.length,
    inputTokens: subset.reduce((n, row) => n + (row.inputTokens ?? 0), 0),
    outputTokens: subset.reduce((n, row) => n + (row.outputTokens ?? 0), 0),
  };
});
const report = {
  version: '1', sourceSha256: createHash('sha256').update(rawText).digest('hex'), labelsVersion: labels.version,
  distinctCases: heldoutSpecs.length, scenarioModelTasks: rows.length, providerDispatches: raw.calls,
  authorizedCeilingUsd: 10, conservativeReservationUsd: raw.conservativeUsd, usagePricedUsd: raw.usagePricedUsd,
  providerReportedChargesUsd: null, providerReportedChargesNote: 'Provider responses supplied tokens, not final billed currency amounts.',
  modelLedger: raw.budget.models, groups, rows,
};
await writeFile('model-evaluation/scored-2026-10-30.json', JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ cases: report.distinctCases, tasks: report.scenarioModelTasks, dispatches: report.providerDispatches, conservativeUsd: report.conservativeReservationUsd, groups }, null, 2) + '\n');
