import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { missingApproval, missingApprovalIntervention } from '../../../fixtures/workflows/missing-approval';
import { EVALUATOR_VERSION, evaluate, hash, verifySafeguard } from './index';
import { verifyCertificate } from './certificate';

const now = new Date('2026-10-26T18:00:00.000Z');
async function fixture() {
  const baseline = await evaluate(missingApproval, undefined, now);
  const evaluationResult = await evaluate(missingApproval, missingApprovalIntervention, now);
  const repair = await verifySafeguard(missingApproval, missingApprovalIntervention, 'deploy-production', 'human-approval', now);
  const body = {
    certificateVersion: '1', sourceHash: await hash(missingApproval.sourceDocuments), graphHash: await hash(missingApproval),
    baseline, intervention: missingApprovalIntervention, evaluationResult,
    violatedRules: evaluationResult.policyResults.filter(rule => rule.state === 'VIOLATED').map(rule => rule.ruleId),
    affectedPath: evaluationResult.affectedNodeIds,
    safeguard: { stepId: 'deploy-production', conditionId: 'human-approval' }, verificationResult: repair.repaired,
    modelMetadata: null, evaluationMetadata: { evaluatorVersion: EVALUATOR_VERSION, generatedAt: now.toISOString() },
  };
  return { ...body, integrityHash: await hash(body) };
}
async function resign(value: Record<string, unknown>) {
  const body = { ...value };
  delete body.integrityHash;
  return { ...body, integrityHash: await hash(body) };
}

describe('independent certificate verification', () => {
  it('accepts the original export and recomputes its integrity hash', async () => {
    const certificate = await fixture();
    expect(await verifyCertificate(certificate, missingApproval)).toEqual({ valid: true, errors: [], inputVerified: true, provenanceAuthenticity: 'NOT_VERIFIED' });
    expect((await verifyCertificate(certificate)).inputVerified).toBe(false);
  });
  it.each(['sourceHash', 'intervention', 'evaluationResult', 'verificationResult', 'integrityHash'] as const)('rejects modified %s', async field => {
    const certificate = await fixture();
    const changed = structuredClone(certificate) as Record<string, unknown>;
    if (field === 'sourceHash' || field === 'integrityHash') changed[field] = 'a'.repeat(64);
    if (field === 'intervention') changed[field] = { ...certificate.intervention, replacementValue: true };
    if (field === 'evaluationResult') changed[field] = { ...certificate.evaluationResult, outcome: 'SAFE_EXECUTION' };
    if (field === 'verificationResult') changed[field] = { ...certificate.verificationResult, outcome: 'UNSAFE_EXECUTION' };
    expect((await verifyCertificate(changed, missingApproval)).valid).toBe(false);
  });
  it('rejects a tampered outcome even if its integrity hash is recomputed', async () => {
    const certificate = await fixture();
    const changed = await resign({ ...certificate, evaluationResult: { ...certificate.evaluationResult, outcome: 'SAFE_EXECUTION' } });
    expect((await verifyCertificate(changed, missingApproval)).valid).toBe(false);
  });
  it('rejects unsupported versions and missing evidence', async () => {
    const certificate = await fixture();
    expect((await verifyCertificate({ ...certificate, certificateVersion: '2' })).valid).toBe(false);
    expect((await verifyCertificate({ ...certificate, sourceHash: undefined })).valid).toBe(false);
    expect((await verifyCertificate({ ...certificate, extraClaim: 'verified in production' })).valid).toBe(false);
  });
  it('detects a mismatched original workflow after a valid integrity hash', async () => {
    const certificate = await fixture();
    const changed = await resign({ ...certificate, sourceHash: 'a'.repeat(64) });
    const result = await verifyCertificate(changed, missingApproval);
    expect(result.valid).toBe(false);
    expect(result.inputVerified).toBe(false);
  });
  it('checks an exported JSON file through the standalone command', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'minsk-certificate-'));
    try {
      const certificatePath = join(folder, 'certificate.json');
      const workflowPath = join(folder, 'workflow.json');
      writeFileSync(certificatePath, JSON.stringify(await fixture()));
      writeFileSync(workflowPath, JSON.stringify(missingApproval));
      const root = resolve(process.cwd(), '../..');
      const output = execFileSync(process.execPath, [resolve(root, 'node_modules/tsx/dist/cli.mjs'), resolve(root, 'scripts/verify-certificate.ts'), certificatePath, workflowPath], { cwd: root, encoding: 'utf8' });
      expect(JSON.parse(output)).toMatchObject({ valid: true, inputVerified: true, provenanceAuthenticity: 'NOT_VERIFIED' });
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });
});
