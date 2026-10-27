import type { EvaluationResult, Intervention, Workflow } from '@faultline/contracts';

export type VisualState = 'SATISFIED' | 'VIOLATED' | 'UNKNOWN' | 'BLOCKED' | 'UNSAFE' | 'READY';

export function observedValue(workflow: Workflow, conditionId: string, intervention: Intervention | null) {
  const condition = workflow.conditions.find(item => item.id === conditionId);
  return intervention?.targetConditionId === conditionId ? intervention.replacementValue : condition?.observedValue;
}

export function visualState(workflow: Workflow, result: EvaluationResult | null, intervention: Intervention | null, id: string): VisualState {
  const condition = workflow.conditions.find(item => item.id === id);
  if (condition) {
    const value = observedValue(workflow, id, intervention);
    if (value === null || value === undefined) return 'UNKNOWN';
    return value === condition.expectedValue ? 'SATISFIED' : 'VIOLATED';
  }
  const step = result?.stepResults.find(item => item.stepId === id);
  if (!step) return 'READY';
  if (step.eligibility === 'UNKNOWN') return 'UNKNOWN';
  if (!step.executes) return 'BLOCKED';
  const policyViolated = workflow.policyRules.some(rule => rule.subjectStepId === id && result?.policyResults.some(item => item.ruleId === rule.id && item.state === 'VIOLATED'));
  return policyViolated ? 'UNSAFE' : 'SATISFIED';
}
