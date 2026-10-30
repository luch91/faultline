import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const caseNames = readdirSync(resolve(root, 'cases')).filter(name => /^MFB-\d\d\.json$/.test(name)).sort();
const digest = text => createHash('sha256').update(text).digest('hex');
const decide = (values, mode = 'ALL') => mode === 'ANY'
  ? values.includes(true) ? true : values.includes(null) ? null : false
  : values.includes(false) ? false : values.includes(null) ? null : true;

function checkInput(workflow) {
  const sources = new Map(workflow.sourceDocuments.map(source => [source.id, source]));
  const conditions = new Set(workflow.conditions.map(item => item.id));
  const steps = new Map(workflow.steps.map(item => [item.id, item]));
  if (sources.size !== workflow.sourceDocuments.length || conditions.size !== workflow.conditions.length || steps.size !== workflow.steps.length) throw new Error('Duplicate identifier');
  for (const source of sources.values()) if (digest(source.text) !== source.contentHash) throw new Error('Source hash mismatch');
  for (const entity of [...workflow.conditions, ...workflow.policyRules, ...workflow.steps]) for (const span of entity.sourceSpans) {
    const source = sources.get(span.sourceId);
    if (!source || source.text.slice(span.startOffset, span.endOffset) !== span.excerpt || !span.verified) throw new Error('Unsupported source evidence');
  }
  for (const rule of workflow.policyRules) if (!steps.has(rule.subjectStepId) || rule.requiredConditionIds.some(id => !conditions.has(id))) throw new Error('Invalid policy reference');
  for (const step of steps.values()) if (step.dependsOn.some(id => !steps.has(id)) || step.executionGateIds.some(id => !conditions.has(id))) throw new Error('Invalid execution reference');
  const visited = new Set();
  const visiting = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('Dependency cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of steps.get(id).dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of steps.keys()) visit(id);
}

function inspect(workflow, intervention, safeguard) {
  checkInput(workflow);
  const observations = new Map(workflow.conditions.map(item => [item.id, item.observedValue]));
  if (intervention) {
    if (!observations.has(intervention.targetConditionId) || observations.get(intervention.targetConditionId) !== intervention.originalValue || !intervention.validated) throw new Error('Invalid intervention');
    observations.set(intervention.targetConditionId, intervention.replacementValue);
  }
  const conditionStates = new Map(workflow.conditions.map(item => {
    const observed = observations.get(item.id);
    const stale = item.freshnessRequirement !== null && (!item.observedAt || Date.parse(item.observedAt) + item.freshnessRequirement * 1000 < Date.parse('2026-10-26T18:00:00.000Z'));
    return [item.id, observed === null || stale ? null : observed === item.expectedValue];
  }));
  const policy = workflow.policyRules.map(rule => ({ id: rule.id, subject: rule.subjectStepId, value: decide(rule.requiredConditionIds.map(id => conditionStates.get(id)), rule.predicate) }));
  const byId = new Map(workflow.steps.map(step => [step.id, step]));
  const stepStates = new Map();
  const trace = [];
  function run(id) {
    if (stepStates.has(id)) return stepStates.get(id);
    const step = byId.get(id);
    const prerequisites = step.dependsOn.map(run);
    const gates = safeguard && safeguard.stepId === id ? [...new Set([...step.executionGateIds, safeguard.conditionId])] : step.executionGateIds;
    const allowed = decide([...prerequisites, ...gates.map(gate => conditionStates.get(gate))]);
    stepStates.set(id, allowed);
    trace.push({ id, status: allowed === true ? 'EXECUTED' : allowed === null ? 'UNKNOWN' : 'BLOCKED' });
    return allowed;
  }
  for (const id of [...byId.keys()].sort()) run(id);
  const unsafe = policy.some(rule => rule.value === false && stepStates.get(rule.subject) === true);
  const unknown = policy.some(rule => rule.value === null) || [...stepStates.values()].includes(null);
  const deploys = workflow.steps.some(step => step.actionType === 'DEPLOY' && stepStates.get(step.id) === true);
  return { outcome: unsafe ? 'UNSAFE_EXECUTION' : unknown ? 'INDETERMINATE' : deploys ? 'SAFE_EXECUTION' : 'SAFE_BLOCK', trace: trace.map(event => event.status) };
}

const rows = caseNames.map(name => {
  const item = JSON.parse(readFileSync(resolve(root, 'cases', name), 'utf8'));
  let baseline, counterfactual, trace = null, afterSafeguard = null;
  try {
    baseline = inspect(item.workflow).outcome;
    const changed = inspect(item.workflow, item.intervention);
    counterfactual = changed.outcome;
    trace = changed.trace;
    afterSafeguard = item.safeguard ? inspect(item.workflow, item.intervention, item.safeguard).outcome : changed.outcome;
  } catch {
    baseline = 'INVALID_SCENARIO';
    counterfactual = 'INVALID_SCENARIO';
  }
  const expected = item.groundTruth;
  const agreed = baseline === expected.baseline && counterfactual === expected.counterfactual && JSON.stringify(trace) === JSON.stringify(expected.trace) && afterSafeguard === expected.afterSafeguard;
  return { id: item.id, agreed, baseline, counterfactual, trace, afterSafeguard };
});
const report = { reference: 'MFB decision oracle v1', total: rows.length, agreed: rows.filter(row => row.agreed).length, disagreed: rows.filter(row => !row.agreed).length, rows };
mkdirSync(resolve(root, 'results'), { recursive: true });
writeFileSync(resolve(root, 'results/reference-latest.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
if (report.total !== 12 || report.disagreed) process.exitCode = 1;
