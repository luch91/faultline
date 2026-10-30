import {describe,expect,it,vi} from 'vitest';
import {missingApproval} from '../../../fixtures/workflows/missing-approval';
import {BASETEN_MODEL,EligibleOpenWeightInvestigator,basetenActualMicroUsd,basetenEstimateMicroUsd} from './challenger';
import type {BudgetLedger} from './budget';

describe('open-weight challenger boundary',()=>{
  it('uses an explicit provider model and a separate conservative estimate',()=>{
    expect(BASETEN_MODEL).toBe('meta-models/muse-spark-open-1026');
    expect(basetenEstimateMicroUsd(3000,1000)).toBe(5500);
    expect(basetenActualMicroUsd(1000,1000)).toBe(5500);
  });
  it('refuses a disabled provider before transport',async()=>{
    const provider=new EligibleOpenWeightInvestigator('test-key',false,{} as DurableObjectStub<BudgetLedger>,'client');
    expect(provider.validateAvailability()).toBe(false);
    await expect(provider.generateCandidates(missingApproval,{maxCandidates:3},new AbortController().signal)).rejects.toMatchObject({status:503});
  });
  it('validates and deduplicates candidates before simulator use',async()=>{
    const ledger={reserve:vi.fn(async()=>({allowed:true})),settle:vi.fn(async()=>{}),markUnknown:vi.fn(async()=>{})};
    const original=globalThis.fetch;
    globalThis.fetch=vi.fn(async()=>Response.json({id:'baseten-response',choices:[{message:{content:JSON.stringify({candidates:[{conditionId:'human-approval',replacementValue:false,reason:'Remove approval'},{conditionId:'human-approval',replacementValue:false,reason:'Duplicate'},{conditionId:'missing',replacementValue:false,reason:'Unknown ID'}]})}}],usage:{prompt_tokens:100,completion_tokens:50}}));
    try{
      const provider=new EligibleOpenWeightInvestigator('test-key',true,ledger as unknown as DurableObjectStub<BudgetLedger>,'client');
      const result=await provider.generateCandidates(missingApproval,{maxCandidates:3},new AbortController().signal);
      expect(result.candidates).toEqual([{conditionId:'human-approval',replacementValue:false,reason:'Remove approval'}]);
      expect(result.responseId).toBe('baseten-response');
      expect(result.accountingStatus).toBe('PROVIDER_USAGE');
      expect(ledger.reserve).toHaveBeenCalledWith(expect.any(String),'client',expect.any(Number),'text',BASETEN_MODEL,'Baseten');
      expect(ledger.settle).toHaveBeenCalledWith(expect.any(String),338,100,50);
    }finally{globalThis.fetch=original;}
  });
});
