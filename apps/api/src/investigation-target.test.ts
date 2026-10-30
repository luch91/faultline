import { describe, expect, it } from 'vitest';
import { missingApproval } from '../../../fixtures/workflows/missing-approval';
import { eligibleInvestigationTargets } from './investigation-target';

describe('requested intervention target', () => {
  const workflow = { ...missingApproval, policyRules: missingApproval.policyRules.map(rule => ({ ...rule, requiredConditionIds: ['tests-pass'] })), steps: missingApproval.steps.map(step => ({ ...step, executionGateIds: ['tests-pass'] })) };
  const targetId = 'human-approval';
  it('restricts an optional-condition task to the requested condition', () => {
    expect(eligibleInvestigationTargets(workflow, targetId).map(item => item.id)).toEqual([targetId]);
    expect(eligibleInvestigationTargets(workflow).length).toBe(3);
  });
  it('rejects an unknown or unobserved target', () => {
    expect(() => eligibleInvestigationTargets(workflow, 'missing')).toThrow('Invalid investigation target');
    const unknown = { ...workflow, conditions: workflow.conditions.map(item => item.id === targetId ? { ...item, observedValue: null } : item) };
    expect(() => eligibleInvestigationTargets(unknown, targetId)).toThrow('Invalid investigation target');
  });
});
