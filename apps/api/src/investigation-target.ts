import type { Workflow } from '@minsk/contracts';

export function eligibleInvestigationTargets(workflow: Workflow, requestedId?: string) {
  const observed = workflow.conditions.filter(condition => typeof condition.observedValue === 'boolean');
  if (!requestedId) return observed;
  const target = observed.find(condition => condition.id === requestedId);
  if (!target) throw new Error('Invalid investigation target');
  return [target];
}
