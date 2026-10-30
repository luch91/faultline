import { mkdir, writeFile } from 'node:fs/promises';
import { missingApproval, missingApprovalIntervention } from '../fixtures/workflows/missing-approval';
import { EVALUATOR_VERSION, evaluate, hash, verifySafeguard } from '../packages/simulator/src';
import { verifyCertificate } from '../packages/simulator/src/certificate';

const now = new Date('2026-10-26T18:00:00.000Z');
const baseline = await evaluate(missingApproval, undefined, now);
const failure = await evaluate(missingApproval, missingApprovalIntervention, now);
const repair = await verifySafeguard(missingApproval, missingApprovalIntervention, 'deploy-production', 'human-approval', now);
if (baseline.outcome !== 'SAFE_EXECUTION' || failure.outcome !== 'UNSAFE_EXECUTION' || repair.repaired.outcome !== 'SAFE_BLOCK' || !repair.resolved) throw new Error('Demonstration outcomes do not match the fixture');
const body = {
  certificateVersion: '1', sourceHash: await hash(missingApproval.sourceDocuments), graphHash: await hash(missingApproval),
  baseline, intervention: missingApprovalIntervention, evaluationResult: failure,
  violatedRules: failure.policyResults.filter(rule => rule.state === 'VIOLATED').map(rule => rule.ruleId),
  affectedPath: failure.affectedNodeIds, safeguard: { stepId: 'deploy-production', conditionId: 'human-approval' },
  verificationResult: repair.repaired, modelMetadata: null,
  evaluationMetadata: { evaluatorVersion: EVALUATOR_VERSION, generatedAt: now.toISOString() },
};
const certificate = { ...body, integrityHash: await hash(body) };
const verified = await verifyCertificate(certificate, missingApproval);
if (!verified.valid || !verified.inputVerified) throw new Error(`Certificate verification failed: ${verified.errors.join('; ')}`);
await mkdir('demo/results', { recursive: true });
await writeFile('demo/results/workflow.json', JSON.stringify(missingApproval, null, 2) + '\n');
await writeFile('demo/results/certificate.json', JSON.stringify(certificate, null, 2) + '\n');
process.stdout.write(JSON.stringify({ baseline: baseline.outcome, counterfactual: failure.outcome, violatedRules: body.violatedRules, safeguard: repair.repaired.outcome, resolved: repair.resolved, certificateIntegrity: certificate.integrityHash, verification: verified, files: ['demo/results/workflow.json', 'demo/results/certificate.json'] }, null, 2) + '\n');
