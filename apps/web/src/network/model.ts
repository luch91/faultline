import { referenceLayout } from './referenceLayout';
import type { EvaluationResult, Intervention, Workflow } from '@faultline/contracts';

export type Group = 'Conditions' | 'Policy' | 'Execution' | 'Sources' | 'Evidence' | 'Evaluation';
export const colors: Record<Group, string> = { Conditions: '#6fb4ac', Policy: '#9c84d0', Execution: '#00b7fb', Sources: '#bd6078', Evidence: '#d6ae3f', Evaluation: '#74b5c4' };
export type NetworkNode = { id: string; entityId: string; name: string; kind: Group; detail: string; x: number; y: number; radius: number; state: string };
export type NetworkLink = { id: string; from: string; to: string; relation: string; policy?: boolean; gate?: boolean; tested?: boolean };
export type Network = { nodes: NetworkNode[]; links: NetworkLink[] };
const anchors: Record<Group, [number, number]> = { Conditions: [130, 235], Policy: [145, 365], Execution: [350, 220], Sources: [40, 130], Evidence: [185, 70], Evaluation: [275, 75] };

export function networkFor(workflow: Workflow, result: EvaluationResult | null, intervention: Intervention | null, tested: { stepId: string; conditionId: string } | null): Network {
  const nodes: NetworkNode[] = [], links: NetworkLink[] = [];
  const totals: Partial<Record<Group, number>> = {};
  const add = (id: string, entityId: string, name: string, kind: Group, detail: string, radius = 4, state = '') => {
    const index = totals[kind] ?? 0; totals[kind] = index + 1;
    const [cx, cy] = anchors[kind];
    const angle = index * 2.39996;
    const ring = index === 0 ? 0 : 19 + Math.sqrt(index) * 11;
    nodes.push({ id, entityId, name, kind, detail, radius, state, x: cx + Math.cos(angle) * ring, y: cy + Math.sin(angle) * ring });
  };
  const edge = (from: string, to: string, relation: string, options: Partial<NetworkLink> = {}) => links.push({ id: `${relation}-${from}-${to}`, from, to, relation, ...options });
  workflow.sourceDocuments.forEach(doc => add(doc.id, doc.id, 'Deployment procedure', 'Sources', doc.text, 6));
  workflow.conditions.forEach((c, index) => {
    const value = intervention?.targetConditionId === c.id ? intervention.replacementValue : c.observedValue;
    const state = value === null ? 'UNKNOWN' : value === c.expectedValue ? 'SATISFIED' : 'VIOLATED';
    add(c.id, c.id, c.name, 'Conditions', `${state}: observed ${String(value)}, expected ${String(c.expectedValue)}`, 10 + (index === 0 ? 4 : 0), state);
    const conditionNode = nodes[nodes.length - 1]!;
    const position = [[115, 210], [170, 225], [145, 250]][index];
    if (position) { conditionNode.x = position[0]!; conditionNode.y = position[1]!; }
    for (const [label, v] of [['Observed', value], ['Expected', c.expectedValue]] as const) { const id = `${c.id}:${label}`; add(id, c.id, `${label}: ${String(v)}`, 'Conditions', `${c.name}: ${label.toLowerCase()} value`, 2.6, state); edge(c.id, id, label.toUpperCase()); }
  });
  workflow.policyRules.forEach(rule => {
    const state = result?.policyResults.find(r => r.ruleId === rule.id)?.state ?? 'UNKNOWN';
    add(rule.id, rule.id, 'Deployment policy', 'Policy', rule.description, 10, state);
    edge(rule.id, rule.subjectStepId, 'POLICY APPLIES TO', { policy: true });
    rule.requiredConditionIds.forEach(id => edge(id, rule.id, 'POLICY REQUIREMENT', { policy: true }));
    for (const [label, value] of [['Predicate', rule.predicate], ['Origin', rule.origin]] as const) { const id = `${rule.id}:${label}`; add(id, rule.id, `${label}: ${value}`, 'Policy', rule.description, 3); edge(id, rule.id, label.toUpperCase()); }
  });
  workflow.steps.forEach(step => {
    const actual = result?.stepResults.find(r => r.stepId === step.id);
    const state = actual ? actual.executes ? result?.policyResults.some(r => r.state === 'VIOLATED' && workflow.policyRules.some(rule => rule.id === r.ruleId && rule.subjectStepId === step.id)) ? 'UNSAFE' : 'EXECUTED' : actual.eligibility === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCKED' : 'NOT RUN';
    add(step.id, step.id, step.name, 'Execution', `${step.actionType}: ${state}`, 9, state);
    step.executionGateIds.forEach(id => edge(id, step.id, 'EXECUTION GATE', { gate: true, tested: tested?.stepId === step.id && tested.conditionId === id }));
    step.dependsOn.forEach(id => edge(id, step.id, 'STEP DEPENDENCY'));
    add(`${step.id}:action`, step.id, step.actionType, 'Execution', 'Declared action type', 3); edge(`${step.id}:action`, step.id, 'ACTION TYPE');
  });
  [...workflow.conditions, ...workflow.policyRules, ...workflow.steps].forEach(entity => entity.sourceSpans.forEach((span, index) => {
    const id = `${entity.id}:evidence:${index}`; add(id, entity.id, span.excerpt, 'Evidence', `${span.verified ? 'Verified' : 'Unverified'} source span ${span.startOffset} to ${span.endOffset}`, 3.5);
    edge(span.sourceId, id, 'SOURCE SPAN'); edge(id, entity.id, 'SOURCE EVIDENCE');
    for (const [label, value] of [['start', span.startOffset], ['end', span.endOffset]] as const) { const offsetId = `${id}:${label}`; add(offsetId, entity.id, `${label}: ${value}`, 'Evidence', `Source character ${label}`, 1.5); edge(offsetId, id, 'SPAN OFFSET'); }
  }));
  // Provenance tokens retain their real source offsets. They populate the overview
  // without inventing workflows, incidents, or simulator outcomes.
  workflow.sourceDocuments.forEach(doc => {
    const words = [...doc.text.matchAll(/\S+/g)];
    words.forEach((match, index) => {
      const id = `${doc.id}:token:${match.index}`;
      add(id, doc.id, match[0], 'Sources', `Source token at ${match.index}:${match.index + match[0].length}`, index % 5 === 0 ? 2.8 : 1.7);
      const node = nodes[nodes.length - 1]!;
      const cluster = index < words.length / 2 ? [42, 130] : [265, 360];
      const angle = index * 2.39996; const ring = 15 + (index % 7) * 7;
      node.x = cluster[0]! + Math.cos(angle) * ring; node.y = cluster[1]! + Math.sin(angle) * ring;
      edge(doc.id, id, 'SOURCE TOKEN');
    });
  });
  workflow.policyRules.forEach(rule => rule.sourceSpans.forEach((span, spanIndex) => {
    [...span.excerpt.matchAll(/\S+/g)].forEach((match, index) => {
      const id = `${rule.id}:token:${spanIndex}:${index}`;
      add(id, rule.id, match[0], 'Policy', `Policy source token at ${span.startOffset + match.index}`, index % 4 === 0 ? 3.2 : 1.6);
      const node = nodes[nodes.length - 1]!; const angle = index * 2.39996; const ring = 12 + (index % 6) * 9;
      node.x = 280 + Math.cos(angle) * ring; node.y = 75 + Math.sin(angle) * ring;
      edge(`${rule.id}:evidence:${spanIndex}`, id, 'SOURCE TOKEN');
    });
  }));
  if (result) {
    result.policyResults.forEach(r => { const id = `evaluated:${r.ruleId}`; add(id, r.ruleId, r.state, 'Evaluation', 'Policy evaluation', 4, r.state); edge(r.ruleId, id, 'POLICY RESULT'); });
    result.stepResults.forEach(r => { const id = `evaluated:${r.stepId}`; add(id, r.stepId, r.executes ? 'Executes' : 'Blocked', 'Evaluation', `Eligibility: ${r.eligibility}`, 5); edge(r.stepId, id, 'EXECUTION RESULT'); });
    result.executionTrace.forEach((event, index) => { const id = `trace:${index}`; add(id, event.stepId, event.status, 'Evaluation', event.reason, 3); edge(event.stepId, id, 'TRACE EVENT'); });
  }
  for (const kind of Object.keys(referenceLayout) as Group[]) {
    const members = nodes.filter(node => node.kind === kind).sort((a, b) => Number(b.id === b.entityId) - Number(a.id === a.entityId));
    members.forEach((node, index) => { const position = referenceLayout[kind][index]; if (position) { node.x = position[0]; node.y = position[1]; node.radius = position[2]; } });
  }
  return { nodes, links };
}

export function degrees(network: Network) { return network.nodes.map(node => ({ node, count: network.links.filter(link => link.from === node.id || link.to === node.id).length })).sort((a, b) => b.count - a.count || a.node.id.localeCompare(b.node.id)); }

// A focused spoke represents an explicitly labeled context path, never an invented gate.
export function contextPaths(network: Network, root: string) {
  const visited = new Map<string, NetworkLink[]>(); visited.set(root, []);
  const queue = [root];
  while (queue.length) {
    const id = queue.shift()!;
    for (const link of network.links.filter(edge => edge.from === id || edge.to === id)) {
      const next = link.from === id ? link.to : link.from;
      if (!visited.has(next)) { visited.set(next, [...visited.get(id)!, link]); queue.push(next); }
    }
  }
  return visited;
}
