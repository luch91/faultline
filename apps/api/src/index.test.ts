import {describe,it,expect} from 'vitest';
import api from './index';
import {missingApproval,missingApprovalIntervention} from '../../../fixtures/workflows/missing-approval';

const env={} as Parameters<typeof api.fetch>[1];
async function post(path:string,body:unknown){return api.fetch(new Request(`http://localhost${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env);}
describe('deterministic HTTP flow',()=>{
  it('serves the sample and evaluates a counterfactual without model transport',async()=>{
    const sample=await api.fetch(new Request('http://localhost/api/v1/samples'),env);
    expect(sample.status).toBe(200);
    expect((await sample.json() as {samples:Array<{id:string}>}).samples[0]?.id).toBe('missing-approval');
    const response=await post('/api/v1/experiments/run',{workflow:missingApproval,intervention:missingApprovalIntervention});
    expect(response.status).toBe(200);
    expect((await response.json() as {result:{outcome:string}}).result.outcome).toBe('UNSAFE_EXECUTION');
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
});
