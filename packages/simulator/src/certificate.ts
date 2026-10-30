import { CounterexampleCertificateSchema, type CounterexampleCertificate } from '@minsk/contracts';
import { addExecutionGate, EVALUATOR_VERSION, evaluate, hash, validateWorkflow } from './index';

export type CertificateVerification = {
  valid: boolean;
  errors: string[];
  inputVerified: boolean;
  provenanceAuthenticity: 'NOT_VERIFIED';
};

async function resultIdMatches(result: CounterexampleCertificate['baseline']): Promise<boolean> {
  const semantic = {
    baselineHash: result.baselineHash,
    interventionHash: result.interventionHash,
    evaluatorVersion: result.evaluatorVersion,
    stepResults: result.stepResults,
    policyResults: result.policyResults,
    executionTrace: result.executionTrace,
    outcome: result.outcome,
  };
  return result.id === await hash(semantic);
}

export async function verifyCertificate(input: unknown, originalWorkflow?: unknown): Promise<CertificateVerification> {
  const parsed = CounterexampleCertificateSchema.safeParse(input);
  if (!parsed.success) return { valid: false, errors: ['Invalid certificate schema or version'], inputVerified: false, provenanceAuthenticity: 'NOT_VERIFIED' };
  const certificate = parsed.data;
  const errors: string[] = [];
  const { integrityHash, ...body } = certificate;
  const originalBody = { ...(input as Record<string, unknown>) };
  delete originalBody.integrityHash;
  if (await hash(originalBody) !== await hash(body)) errors.push('Unknown certificate fields');
  if (!/^[a-f0-9]{64}$/.test(integrityHash) || await hash(body) !== integrityHash) errors.push('Certificate integrity hash mismatch');
  if (certificate.evaluationMetadata.evaluatorVersion !== EVALUATOR_VERSION) errors.push('Evaluator version is unsupported');
  if ((certificate.safeguard === null) !== (certificate.verificationResult === null)) errors.push('Safeguard and verification result disagree');
  const baselineInterventionHash = await hash(null);
  const changedInterventionHash = await hash(certificate.intervention);
  if (certificate.baseline.interventionHash !== baselineInterventionHash || certificate.evaluationResult.interventionHash !== changedInterventionHash) errors.push('Intervention hashes disagree');
  if (certificate.baseline.baselineHash !== certificate.graphHash || certificate.evaluationResult.baselineHash !== certificate.graphHash) errors.push('Workflow hashes disagree');
  if (certificate.baseline.scenarioId !== certificate.evaluationResult.scenarioId || certificate.verificationResult && certificate.verificationResult.scenarioId !== certificate.baseline.scenarioId) errors.push('Scenario identifiers disagree');
  const violated = certificate.evaluationResult.policyResults.filter(rule => rule.state === 'VIOLATED').map(rule => rule.ruleId);
  if (JSON.stringify(violated) !== JSON.stringify(certificate.violatedRules)) errors.push('Violated rules disagree');
  if (JSON.stringify(certificate.evaluationResult.affectedNodeIds) !== JSON.stringify(certificate.affectedPath)) errors.push('Affected path disagrees');
  for (const result of [certificate.baseline, certificate.evaluationResult, certificate.verificationResult].filter((item): item is NonNullable<typeof item> => item !== null)) {
    if (result.evaluatorVersion !== EVALUATOR_VERSION || !await resultIdMatches(result)) errors.push('Evaluation identifier or version mismatch');
  }
  let inputVerified = false;
  if (originalWorkflow !== undefined) {
    try {
      const graph = validateWorkflow(originalWorkflow);
      if (await hash(graph.sourceDocuments) !== certificate.sourceHash || await hash(graph) !== certificate.graphHash) throw new Error('Source or workflow hash mismatch');
      const condition = graph.conditions.find(item => item.id === certificate.intervention.targetConditionId);
      if (!condition || condition.observedValue !== certificate.intervention.originalValue) throw new Error('Intervention does not match original workflow');
      const baseline = await evaluate(graph, undefined, new Date(certificate.baseline.timestamp));
      const changed = await evaluate(graph, certificate.intervention, new Date(certificate.evaluationResult.timestamp));
      if (JSON.stringify(baseline) !== JSON.stringify(certificate.baseline) || JSON.stringify(changed) !== JSON.stringify(certificate.evaluationResult)) throw new Error('Evaluations do not match original workflow');
      if (certificate.safeguard && certificate.verificationResult) {
        const repaired = await evaluate(addExecutionGate(graph, certificate.safeguard.stepId, certificate.safeguard.conditionId), certificate.intervention, new Date(certificate.verificationResult.timestamp));
        if (JSON.stringify(repaired) !== JSON.stringify(certificate.verificationResult)) throw new Error('Safeguard evaluation does not match original workflow');
      }
      inputVerified = true;
    } catch (error) { errors.push(error instanceof Error ? error.message : 'Original input verification failed'); }
  }
  return { valid: errors.length === 0, errors, inputVerified, provenanceAuthenticity: 'NOT_VERIFIED' };
}
