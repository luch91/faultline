import { describe, expect, it } from 'vitest';
import { evaluate, verifySafeguard } from '../../../../packages/simulator/src';
import { missingApproval, missingApprovalIntervention } from '../../../../fixtures/workflows/missing-approval';
import { graphElements } from './WorkflowGraph';
import { visualState } from './visualState';

describe('validated workflow dependency graph', () => {
  it('derives policy and execution relationships independently from the workflow', async () => {
    const result = await evaluate(missingApproval);
    const { nodes, edges } = graphElements(missingApproval, result, null, 'human-approval', null);
    expect(result.outcome).toBe('SAFE_EXECUTION');
    expect(nodes.map(node => node.id)).toEqual([...missingApproval.conditions, ...missingApproval.policyRules, ...missingApproval.steps].map(entity => entity.id));
    expect(nodes.find(node => node.id === 'human-approval')?.selected).toBe(true);
    expect(edges.filter(edge => edge.data?.relation === 'POLICY REQUIREMENT')).toHaveLength(3);
    expect(edges.filter(edge => edge.data?.relation === 'EXECUTION GATE')).toHaveLength(2);
    expect(edges.some(edge => edge.source === 'human-approval' && edge.data?.relation === 'EXECUTION GATE')).toBe(false);
    expect(edges.every(edge => edge.label && edge.markerEnd)).toBe(true);
    expect(edges.find(edge => edge.data?.relation === 'POLICY REQUIREMENT')?.style?.strokeDasharray).toBe('6 4');
  });

  it('keeps the violated approval separate from the unsafe execution and verified block', async () => {
    const failure = await evaluate(missingApproval, missingApprovalIntervention);
    const stepId = missingApproval.steps[0]!.id;
    const conditionId = missingApprovalIntervention.targetConditionId;
    expect(failure.outcome).toBe('UNSAFE_EXECUTION');
    expect(visualState(missingApproval, failure, missingApprovalIntervention, conditionId)).toBe('VIOLATED');
    expect(visualState(missingApproval, failure, missingApprovalIntervention, stepId)).toBe('UNSAFE');
    const verification = await verifySafeguard(missingApproval, missingApprovalIntervention, stepId, conditionId);
    expect(verification.repaired.outcome).toBe('SAFE_BLOCK');
    const repairedWorkflow = { ...missingApproval, steps: missingApproval.steps.map(step => step.id === stepId ? { ...step, executionGateIds: [...step.executionGateIds, conditionId] } : step) };
    const { nodes, edges } = graphElements(repairedWorkflow, verification.repaired, missingApprovalIntervention, stepId, { stepId, conditionId });
    expect(nodes.find(node => node.id === stepId)?.data.state).toBe('BLOCKED');
    expect(nodes.find(node => node.id === conditionId)?.data.state).toBe('VIOLATED');
    expect(edges.filter(edge => edge.data?.relation === 'TESTED EXECUTION GATE')).toHaveLength(1);
    expect(visualState(repairedWorkflow, verification.repaired, missingApprovalIntervention, missingApproval.policyRules[0]!.id)).toBe('VIOLATED');
  });
});
