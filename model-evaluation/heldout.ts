import { createHash } from 'node:crypto';
import { SCHEMA_VERSION, type Workflow } from '../packages/contracts/src';

type CaseSpec = { id: string; subject: string; requirement: string; mainObserved: boolean | null; mainGate: boolean; supportPolicy: boolean; supportGate: boolean; target: 'main' | 'support' };

export const heldoutSpecs: CaseSpec[] = [
  { id: 'H01', subject: 'release deployment', requirement: 'human approval', mainObserved: true, mainGate: false, supportPolicy: true, supportGate: true, target: 'main' },
  { id: 'H02', subject: 'production promotion', requirement: 'automated test completion', mainObserved: true, mainGate: false, supportPolicy: true, supportGate: true, target: 'main' },
  { id: 'H03', subject: 'schema rollout', requirement: 'migration compatibility', mainObserved: true, mainGate: false, supportPolicy: true, supportGate: true, target: 'main' },
  { id: 'H04', subject: 'service publication', requirement: 'security verification', mainObserved: true, mainGate: false, supportPolicy: true, supportGate: true, target: 'main' },
  { id: 'H05', subject: 'regional rollout', requirement: 'canary health', mainObserved: true, mainGate: true, supportPolicy: true, supportGate: true, target: 'main' },
  { id: 'H06', subject: 'release tagging', requirement: 'release branch authorization', mainObserved: true, mainGate: true, supportPolicy: true, supportGate: true, target: 'main' },
  { id: 'H07', subject: 'artifact publication', requirement: 'review evidence', mainObserved: null, mainGate: false, supportPolicy: false, supportGate: false, target: 'support' },
  { id: 'H08', subject: 'package staging', requirement: 'test completion', mainObserved: true, mainGate: true, supportPolicy: false, supportGate: false, target: 'support' },
];

export function heldoutWorkflow(spec: CaseSpec): { workflow: Workflow; text: string; targetId: string } {
  const observed = spec.mainObserved === null ? 'not available' : spec.mainObserved ? 'present' : 'absent';
  const rule = `${spec.subject} requires ${spec.requirement}${spec.supportPolicy ? ' and an artifact signature' : ''}.`;
  const main = `The recorded ${spec.requirement} is ${observed}.`;
  const support = 'The artifact signature is present.';
  const step = `The ${spec.subject} agent checks ${[spec.mainGate ? spec.requirement : '', spec.supportGate ? 'the artifact signature' : ''].filter(Boolean).join(' and ') || 'no condition'} before executing.`;
  const text = [rule, main, support, step].join(' ');
  const span = (excerpt: string) => { const startOffset = text.indexOf(excerpt); if (startOffset < 0) throw new Error('Invalid held-out source'); return { sourceId: spec.id, startOffset, endOffset: startOffset + excerpt.length, excerpt, verified: true }; };
  const mainId = `${spec.id.toLowerCase()}-requirement`;
  const supportId = `${spec.id.toLowerCase()}-signature`;
  const workflow: Workflow = {
    schemaVersion: SCHEMA_VERSION, id: spec.id, title: spec.subject,
    sourceDocuments: [{ id: spec.id, text, contentHash: createHash('sha256').update(text).digest('hex'), createdAt: '2026-10-30T00:00:00.000Z', schemaVersion: SCHEMA_VERSION }],
    conditions: [
      { id: mainId, name: spec.requirement, valueType: 'BOOLEAN', expectedValue: true, observedValue: spec.mainObserved, sourceSpans: [span(main)], freshnessRequirement: null, observedAt: null },
      { id: supportId, name: 'artifact signature', valueType: 'BOOLEAN', expectedValue: true, observedValue: true, sourceSpans: [span(support)], freshnessRequirement: null, observedAt: null },
    ],
    policyRules: [{ id: `${spec.id.toLowerCase()}-policy`, description: rule, subjectStepId: `${spec.id.toLowerCase()}-execute`, predicate: 'ALL', requiredConditionIds: [mainId, ...(spec.supportPolicy ? [supportId] : [])], sourceSpans: [span(rule)], origin: 'EXPLICIT' }],
    steps: [{ id: `${spec.id.toLowerCase()}-execute`, name: `${spec.subject} agent`, actionType: 'DEPLOY', dependsOn: [], executionGateIds: [spec.mainGate ? mainId : '', spec.supportGate ? supportId : ''].filter(Boolean), sourceSpans: [span(step)] }],
  };
  return { workflow, text, targetId: spec.target === 'main' ? mainId : supportId };
}
