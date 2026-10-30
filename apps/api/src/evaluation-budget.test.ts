import {describe,expect,it} from 'vitest';
import {evaluationAdmission} from './budget';

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
});
