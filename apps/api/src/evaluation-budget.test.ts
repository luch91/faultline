import {describe,expect,it} from 'vitest';
import {evaluationAdmission,providerCeiling} from './budget';

describe('provider spending configuration',()=>{
  it('defaults Meta to fifty dollars and fails closed for unconfigured Baseten',()=>{
    expect(providerCeiling('Meta',{})).toBe(50_000_000);
    expect(providerCeiling('Baseten',{})).toBeNull();
  });
  it('accepts explicit limits and rejects malformed values',()=>{
    expect(providerCeiling('Meta',{META_CEILING_MICRO_USD:'7500000'})).toBe(7_500_000);
    expect(providerCeiling('Baseten',{BASETEN_CEILING_MICRO_USD:'25000000'})).toBe(25_000_000);
    expect(providerCeiling('Baseten',{BASETEN_CEILING_MICRO_USD:'0'})).toBeNull();
    expect(providerCeiling('Meta',{META_CEILING_MICRO_USD:'Infinity'})).toBeNull();
    expect(providerCeiling('Meta',{META_CEILING_MICRO_USD:'50000001'})).toBeNull();
  });
});

describe('controlled evaluation dispatch limit',()=>{
  it('allows call six and blocks call seven across providers',()=>{
    const providers=['Meta','Meta','Meta','Meta','Meta','Baseten'];
    for(let count=0;count<providers.length;count++)expect(evaluationAdmission(count,count*20_000,20_000).allowed).toBe(true);
    expect(evaluationAdmission(providers.length,120_000,20_000)).toMatchObject({allowed:false,reason:'Evaluation call limit reached'});
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
