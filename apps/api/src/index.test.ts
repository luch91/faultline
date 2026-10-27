import {describe,it,expect} from 'vitest';
import api from './index';
import {missingApproval,missingApprovalIntervention} from '../../../fixtures/workflows/missing-approval';
import {hash} from '@faultline/simulator';

const ledger:{admit:()=>Promise<{allowed:boolean;reason?:string}>;getAttestation:()=>Promise<unknown>;status:()=>Promise<unknown>}={admit:async()=>({allowed:true}),getAttestation:async()=>null,status:async()=>({conservativeAccountedUsd:0})};
const env={BUDGET:{getByName:()=>ledger}} as unknown as Parameters<typeof api.fetch>[1];
async function post(path:string,body:unknown){return api.fetch(new Request(`http://localhost${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env);}
describe('deterministic HTTP flow',()=>{
  it('serves the sample and evaluates a counterfactual without model transport',async()=>{
    const sample=await api.fetch(new Request('http://localhost/api/v1/samples'),env);
    expect(sample.status).toBe(200);
    expect((await sample.json() as {samples:Array<{id:string}>}).samples[0]?.id).toBe('missing-approval');
    const baseline=await post('/api/v1/experiments/run',{workflow:missingApproval});
    expect(baseline.status).toBe(200);
    expect(await baseline.json()).toMatchObject({kind:'BASELINE',result:{outcome:'SAFE_EXECUTION'}});
    const response=await post('/api/v1/experiments/run',{workflow:missingApproval,intervention:missingApprovalIntervention});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({kind:'COUNTERFACTUAL',result:{outcome:'UNSAFE_EXECUTION'}});
  });
  it('verifies a safeguard and exports a recomputed certificate',async()=>{
    const verification=await post('/api/v1/safeguards/verify',{workflow:missingApproval,intervention:missingApprovalIntervention,stepId:'deploy-production',conditionId:'human-approval'});
    expect(verification.status).toBe(200);
    expect((await verification.json() as {repaired:{outcome:string}}).repaired.outcome).toBe('SAFE_BLOCK');
    const report=await post('/api/v1/reports/export',{workflow:missingApproval,investigation:{intervention:missingApprovalIntervention,verification:{safeguard:{stepId:'deploy-production',conditionId:'human-approval'}}}});
    expect(report.status).toBe(200);
    const certificate=await report.json() as {evaluationResult:{outcome:string};verificationResult:{outcome:string};integrityHash:string};
    expect(certificate.evaluationResult.outcome).toBe('UNSAFE_EXECUTION');
    expect(certificate.verificationResult.outcome).toBe('SAFE_BLOCK');
    expect(certificate.integrityHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects a cross-origin request',async()=>{
    const response=await api.fetch(new Request('http://localhost/api/v1/samples',{headers:{Origin:'https://other.example'}}),env);
    expect(response.status).toBe(403);
  });
  it('rejects an invalid intervention with a controlled error',async()=>{
    const response=await post('/api/v1/experiments/run',{workflow:missingApproval,intervention:{...missingApprovalIntervention,targetConditionId:'missing'}});
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({error:'Invalid intervention target'});
  });
  it('rejects unverified model provenance',async()=>{
    const response=await post('/api/v1/reports/export',{workflow:missingApproval,investigation:{investigationId:'00000000-0000-4000-8000-000000000001',intervention:missingApprovalIntervention,verification:{safeguard:{stepId:'deploy-production',conditionId:'human-approval'}}}});
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({error:'Investigation provenance does not match the recomputed certificate'});
  });
  it('exports attested model provenance only when graph and intervention match',async()=>{
    const graphHash=await hash(missingApproval);
    const interventionHash=await hash(missingApprovalIntervention);
    const original=ledger.getAttestation;
    ledger.getAttestation=async()=>({graphHash,interventionHash,stepId:'deploy-production',conditionId:'human-approval',responseIds:['resp_verified'],toolCallIds:['call_verified'],inputTokens:100,outputTokens:50,verificationOutcome:'SAFE_BLOCK'});
    try{const response=await post('/api/v1/reports/export',{workflow:missingApproval,investigation:{investigationId:'00000000-0000-4000-8000-000000000001',intervention:missingApprovalIntervention,verification:{safeguard:{stepId:'deploy-production',conditionId:'human-approval'}}}});expect(response.status).toBe(200);expect(await response.json()).toMatchObject({modelMetadata:{model:'muse-spark-1.3',responseIds:['resp_verified'],toolCallIds:['call_verified']}});}finally{ledger.getAttestation=original;}
  });
  it('throttles requests without an Origin header',async()=>{
    const original=ledger.admit;
    ledger.admit=async()=>({allowed:false,reason:'Request rate limit exceeded'});
    try{const response=await api.fetch(new Request('http://localhost/api/v1/samples'),env);expect(response.status).toBe(429);}finally{ledger.admit=original;}
  });
});
