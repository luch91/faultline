import type { Workflow } from '@minsk/contracts';

export const modelRegistry = {
  'muse-spark-1.3': {
    id: 'muse-spark-1.3', provider: 'Meta Model API',
    roles: ['EXTRACTION', 'ROUTINE_INVESTIGATION', 'ESCALATION_FALLBACK'] as const,
    capabilities: ['RESPONSES', 'STRUCTURED_OUTPUT', 'FUNCTION_TOOLS'] as const,
    inputUsdPerMillion: 1.25, outputUsdPerMillion: 4.25,
    maxOutputTokens: 3000, timeoutMs: 30_000, escalationEligible: false,
  },
  'muse-wonder-1.0': {
    id: 'muse-wonder-1.0', provider: 'Meta Model API',
    roles: ['ADVANCED_INVESTIGATION'] as const,
    capabilities: ['RESPONSES', 'FUNCTION_TOOLS'] as const,
    inputUsdPerMillion: 4, outputUsdPerMillion: 20,
    maxOutputTokens: 2500, timeoutMs: 45_000, escalationEligible: true,
  },
} as const;

export type ModelId = keyof typeof modelRegistry;
export type InvestigationRoute = { modelId: ModelId; role: 'ROUTINE_INVESTIGATION' | 'ADVANCED_INVESTIGATION' | 'ESCALATION_FALLBACK'; reason: string; escalated: boolean };

export function modelConfig(id: string) {
  if (!(id in modelRegistry)) throw new Error('Unsupported model ID');
  return modelRegistry[id as ModelId];
}

export function routeInvestigation(workflow: Workflow, wonderEnabled: boolean): InvestigationRoute {
  const unknown = workflow.conditions.filter(condition => condition.observedValue === null).length;
  const missingGates = workflow.policyRules.reduce((count, rule) => {
    const step = workflow.steps.find(item => item.id === rule.subjectStepId);
    return count + rule.requiredConditionIds.filter(id => !step?.executionGateIds.includes(id)).length;
  }, 0);
  const complex = workflow.steps.length >= 3 || workflow.conditions.length >= 5 || workflow.policyRules.length >= 3 || unknown >= 2 || missingGates >= 2;
  const reason = complex ? `Complex workflow: ${workflow.steps.length} steps, ${workflow.conditions.length} conditions, ${workflow.policyRules.length} rules, ${unknown} unknown observations, ${missingGates} missing gates` : 'Routine validated workflow';
  if (complex && wonderEnabled) return { modelId: 'muse-wonder-1.0', role: 'ADVANCED_INVESTIGATION', reason, escalated: true };
  if (complex) return { modelId: 'muse-spark-1.3', role: 'ESCALATION_FALLBACK', reason: `${reason}; Wonder disabled`, escalated: false };
  return { modelId: 'muse-spark-1.3', role: 'ROUTINE_INVESTIGATION', reason, escalated: false };
}
