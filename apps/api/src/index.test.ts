import {describe,it,expect,vi} from 'vitest';
import api from './index';
import {missingApproval,missingApprovalIntervention} from '../../../fixtures/workflows/missing-approval';
import {hash} from '@minsk/simulator';

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
  it('checks preflight origin without consuming the application rate limit',async()=>{
    const original=ledger.admit;let admissions=0;
    ledger.admit=async()=>{admissions++;return {allowed:true};};
    const configured={...env,ALLOWED_ORIGIN:'https://minsk.example'};
    try{
      const allowed=await api.fetch(new Request('http://localhost/api/v1/experiments/run',{method:'OPTIONS',headers:{Origin:'https://minsk.example'}}),configured);
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://minsk.example');
      const denied=await api.fetch(new Request('http://localhost/api/v1/experiments/run',{method:'OPTIONS',headers:{Origin:'https://other.example'}}),configured);
      expect(denied.status).toBe(403);
      expect(admissions).toBe(0);
    }finally{ledger.admit=original;}
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
  it('exports Wonder call provenance from the trusted ledger',async()=>{
    const graphHash=await hash(missingApproval);
    const interventionHash=await hash(missingApprovalIntervention);
    const original=ledger.getAttestation;
    ledger.getAttestation=async()=>({graphHash,interventionHash,stepId:'deploy-production',conditionId:'human-approval',responseIds:['resp_wonder'],toolCallIds:['call_wonder'],inputTokens:120,outputTokens:70,verificationOutcome:'SAFE_BLOCK',calls:[{modelId:'muse-wonder-1.0',role:'COUNTERFACTUAL',responseId:'resp_wonder',toolCallId:'call_wonder',inputTokens:120,outputTokens:70,accountingStatus:'PROVIDER_USAGE',routingReason:'Complex workflow'}]});
    try{
      const response=await post('/api/v1/reports/export',{workflow:missingApproval,investigation:{investigationId:'00000000-0000-4000-8000-000000000001',intervention:missingApprovalIntervention,verification:{safeguard:{stepId:'deploy-production',conditionId:'human-approval'}}}});
      expect(response.status).toBe(200);
      const certificate=await response.json() as {modelMetadata:{model:string;calls:Array<{modelId:string}>};integrityHash:string};
      expect(certificate.modelMetadata.model).toBe('muse-wonder-1.0');
      expect(certificate.modelMetadata.calls[0]?.modelId).toBe('muse-wonder-1.0');
      expect(certificate.integrityHash).toMatch(/^[a-f0-9]{64}$/);
    }finally{ledger.getAttestation=original;}
  });
  it('throttles requests without an Origin header',async()=>{
    const original=ledger.admit;
    ledger.admit=async()=>({allowed:false,reason:'Request rate limit exceeded'});
    try{const response=await api.fetch(new Request('http://localhost/api/v1/samples'),env);expect(response.status).toBe(429);}finally{ledger.admit=original;}
  });
  it('keeps live model routes disabled without explicit configuration',async()=>{
    const extraction=await post('/api/v1/workflows/extract',{text:'Production deployment requires tests, approval, and migration compatibility.'});
    expect(extraction.status).toBe(503);
    const budget=await api.fetch(new Request('http://localhost/api/v1/budget'),env);
    expect(await budget.json()).toMatchObject({liveModelEnabled:false});
  });
  it('keeps the open-weight challenger disabled without separate credentials and switch',async()=>{
    const response=await post('/api/v1/challengers/open-weight',{workflow:missingApproval});
    expect(response.status).toBe(503);
    const budget=await api.fetch(new Request('http://localhost/api/v1/budget'),env);
    expect(await budget.json()).toMatchObject({openWeightEnabled:false});
  });
  it('evaluates a validated Baseten candidate with the independent simulator',async()=>{
    const testLedger={admit:async()=>({allowed:true}),getAttestation:async()=>null,acquireInvestigation:async()=>true,releaseInvestigation:async()=>{},reserve:async()=>({allowed:true}),settle:async()=>{},markUnknown:async()=>{}};
    const configured={...env,BASETEN_API_KEY:'test-key',BASETEN_CREDITS_CONFIRMED:'true',BASETEN_CHALLENGER_ENABLED:'true',BASETEN_TEST_TOKEN:'private-test-token',BUDGET:{getByName:()=>testLedger}} as unknown as Parameters<typeof api.fetch>[1];
    const original=globalThis.fetch;
    globalThis.fetch=vi.fn(async()=>Response.json({id:'baseten-mocked',choices:[{message:{content:JSON.stringify({candidates:[{conditionId:'human-approval',replacementValue:false,reason:'Test missing approval'}]})}}],usage:{prompt_tokens:100,completion_tokens:50}}));
    try{
      const response=await api.fetch(new Request('http://localhost/api/v1/challengers/open-weight',{method:'POST',headers:{'Content-Type':'application/json','X-Minsk-Test-Token':'private-test-token'},body:JSON.stringify({workflow:missingApproval})}),configured);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({challenger:{modelId:'meta-models/muse-spark-open-1026',responseId:'baseten-mocked'},experiments:[{result:{outcome:'UNSAFE_EXECUTION'}}]});
    }finally{globalThis.fetch=original;}
  });
});
