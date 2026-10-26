import {describe,it,expect} from 'vitest';
import {missingApproval,missingApprovalIntervention} from '../../../fixtures/workflows/missing-approval';
import {evaluate,verifySafeguard,addExecutionGate,validateWorkflow,hash} from './index';

describe('Missing Approval',()=>{
  it('finds unsafe execution and verifies a blocking gate',async()=>{
    const now=new Date('2026-10-26T18:00:00.000Z');
    const baseline=await evaluate(missingApproval,undefined,now);
    const changed=await evaluate(missingApproval,missingApprovalIntervention,now);
    expect(baseline.outcome).toBe('SAFE_EXECUTION'); expect(changed.outcome).toBe('UNSAFE_EXECUTION');
    expect(changed.firstViolation).toBe('approval-required');
    const verification=await verifySafeguard(missingApproval,missingApprovalIntervention,'deploy-production','human-approval',now);
    expect(verification.repaired.outcome).toBe('SAFE_BLOCK'); expect(verification.resolved).toBe(true);
    expect(missingApproval.steps[0]?.executionGateIds).not.toContain('human-approval');
    expect((await evaluate(addExecutionGate(missingApproval,'deploy-production','human-approval'),missingApprovalIntervention,now)).id).toBe(verification.repaired.id);
  });
  it('classifies an existing approval gate as safe block',async()=>{expect((await evaluate(addExecutionGate(missingApproval,'deploy-production','human-approval'),missingApprovalIntervention,new Date('2026-10-26T18:00:00.000Z'))).outcome).toBe('SAFE_BLOCK');});
  it('rejects invalid graph and intervention',async()=>{
    expect(()=>validateWorkflow({...missingApproval,steps:[{...missingApproval.steps[0]!,dependsOn:['missing']}]})).toThrow('Missing step reference');
    expect(()=>validateWorkflow({...missingApproval,steps:[{...missingApproval.steps[0]!,dependsOn:['deploy-production']}]})).toThrow('Dependency cycle');
    await expect(evaluate(missingApproval,{...missingApprovalIntervention,targetConditionId:'missing'})).rejects.toThrow('Invalid intervention target');
  });
  it('is semantically reproducible',async()=>{const a=await evaluate(missingApproval,missingApprovalIntervention,new Date('2026-10-26T18:00:00.000Z')); const b=await evaluate(missingApproval,missingApprovalIntervention,new Date('2026-10-26T19:00:00.000Z')); expect(a.id).toBe(b.id); expect(await hash(missingApproval)).toBe(await hash(missingApproval));});
});
