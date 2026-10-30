import {describe,expect,it} from 'vitest';
import {evaluationAdmission,providerCeiling,publicQuotaLimits,quotaAdmission} from './budget';

describe('provider spending configuration',()=>{
  it('defaults Meta to fifty dollars and leaves Baseten uncapped',()=>{
    expect(providerCeiling('Meta',{})).toBe(50_000_000);
    expect(providerCeiling('Baseten',{})).toBe(Number.POSITIVE_INFINITY);
  });
  it('accepts explicit limits and rejects malformed values',()=>{
    expect(providerCeiling('Meta',{META_CEILING_MICRO_USD:'7500000'})).toBe(7_500_000);
    expect(providerCeiling('Baseten',{})).toBe(Number.POSITIVE_INFINITY);
    expect(providerCeiling('Meta',{META_CEILING_MICRO_USD:'Infinity'})).toBeNull();
    expect(providerCeiling('Meta',{META_CEILING_MICRO_USD:'50000001'})).toBeNull();
  });
});

describe('public quota configuration',()=>{
  it('uses safe defaults and enforces bounded explicit public quotas',()=>{
    expect(publicQuotaLimits({})).toEqual({globalRequestsPerMinute:300,clientRequestsPerMinute:30,globalModelCallsPerDay:30,clientModelCallsPerDay:5});
    expect(publicQuotaLimits({PUBLIC_GLOBAL_REQUESTS_PER_MINUTE:'20',PUBLIC_CLIENT_REQUESTS_PER_MINUTE:'3',PUBLIC_GLOBAL_MODEL_CALLS_PER_DAY:'11',PUBLIC_CLIENT_MODEL_CALLS_PER_DAY:'2'})).toEqual({globalRequestsPerMinute:20,clientRequestsPerMinute:3,globalModelCallsPerDay:11,clientModelCallsPerDay:2});
    expect(publicQuotaLimits({PUBLIC_GLOBAL_REQUESTS_PER_MINUTE:'0',PUBLIC_CLIENT_MODEL_CALLS_PER_DAY:'1001'})).toMatchObject({globalRequestsPerMinute:300,clientModelCallsPerDay:5});
  });
  it('rejects quota exhaustion across concurrent users without conflating their session counts',()=>{
    expect(quotaAdmission(2,1,3,2,'limited')).toEqual({allowed:true});
    expect(quotaAdmission(3,0,3,2,'limited')).toEqual({allowed:false,reason:'limited'});
    expect(quotaAdmission(2,2,3,2,'limited')).toEqual({allowed:false,reason:'limited'});
  });
});

describe('controlled evaluation dispatch limit',()=>{
  it('allows call six and blocks call seven across providers',()=>{
    const providers=['Meta','Meta','Meta','Meta','Meta','Baseten'];
    for(let count=0;count<providers.length;count++)expect(evaluationAdmission(count,count*20_000,20_000).allowed).toBe(true);
    expect(evaluationAdmission(providers.length,120_000,20_000)).toMatchObject({allowed:false,reason:'Evaluation call limit reached'});
  });
  it('does not apply the Meta evaluation estimate ceiling to Baseten',()=>{
    expect(evaluationAdmission(0,299_000,10_000,6,300_000,'Meta')).toMatchObject({allowed:false,reason:'Evaluation Meta estimate ceiling reached'});
    expect(evaluationAdmission(0,299_000,10_000,6,300_000,'Baseten')).toMatchObject({allowed:true});
  });
  it('counts retries and fallback as new dispatches',()=>{
    const attempts=['Spark','Wonder','Wonder retry','Spark fallback','Baseten','Spark'];
    expect(evaluationAdmission(attempts.length,100_000,10_000).allowed).toBe(false);
  });
  it('blocks missing or excessive estimates',()=>{
    expect(evaluationAdmission(0,0,Number.NaN).allowed).toBe(false);
    expect(evaluationAdmission(0,0,0).allowed).toBe(false);
    expect(evaluationAdmission(5,295_000,6_000).allowed).toBe(false);
  });
  it('accepts a configured larger session and rejects invalid limits',()=>{
    expect(evaluationAdmission(39,8_000_000,100_000,40,10_000_000).allowed).toBe(true);
    expect(evaluationAdmission(40,8_000_000,100_000,40,10_000_000).allowed).toBe(false);
    expect(evaluationAdmission(0,0,1,101,10_000_000).allowed).toBe(false);
    expect(evaluationAdmission(0,0,1,40,10_000_001).allowed).toBe(false);
  });
});
