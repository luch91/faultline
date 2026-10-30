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
  it('does not reward a safe block caused by an unrelated condition',async()=>{
    const unrelated={...missingApproval.conditions[0]!,id:'unrelated-hold',name:'Unrelated hold',observedValue:false};
    const workflow={...missingApproval,conditions:[...missingApproval.conditions,unrelated]};
    const verification=await verifySafeguard(workflow,missingApprovalIntervention,'deploy-production','unrelated-hold');
    expect(verification.failure.outcome).toBe('UNSAFE_EXECUTION');
    expect(verification.repaired.outcome).toBe('SAFE_BLOCK');
    expect(verification.relevant).toBe(false);
    expect(verification.resolved).toBe(false);
  });
  it('preserves safe execution when an optional condition changes',async()=>{
    const workflow={...missingApproval,policyRules:missingApproval.policyRules.map(rule=>({...rule,requiredConditionIds:['tests-pass']})),steps:missingApproval.steps.map(step=>({...step,executionGateIds:['tests-pass']}))};
    const targetId='human-approval';
    const condition=workflow.conditions.find(item=>item.id===targetId)!;
    const intervention={id:'optional-change',targetConditionId:targetId,originalValue:condition.observedValue,replacementValue:false,reason:'Optional negative control',proposedBy:'USER' as const,validated:true};
    expect((await evaluate(workflow,intervention)).outcome).toBe('SAFE_EXECUTION');
    const verification=await verifySafeguard(workflow,intervention,workflow.steps[0]!.id,targetId);
    expect(verification.repaired.outcome).toBe('SAFE_BLOCK');
    expect(verification.resolved).toBe(false);
  });
  it('rejects invalid graph and intervention',async()=>{
    expect(()=>validateWorkflow({...missingApproval,steps:[{...missingApproval.steps[0]!,dependsOn:['missing']}]})).toThrow('Missing step reference');
    expect(()=>validateWorkflow({...missingApproval,steps:[{...missingApproval.steps[0]!,dependsOn:['deploy-production']}]})).toThrow('Dependency cycle');
    await expect(evaluate(missingApproval,{...missingApprovalIntervention,targetConditionId:'missing'})).rejects.toThrow('Invalid intervention target');
  });
  it('is semantically reproducible',async()=>{const a=await evaluate(missingApproval,missingApprovalIntervention,new Date('2026-10-26T18:00:00.000Z')); const b=await evaluate(missingApproval,missingApprovalIntervention,new Date('2026-10-26T19:00:00.000Z')); expect(a.id).toBe(b.id); expect(await hash(missingApproval)).toBe(await hash(missingApproval));});
});
