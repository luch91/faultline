import {describe,expect,it} from 'vitest';
import {evaluationAdmission,publicJudgeAdmission} from './budget';

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
describe('public judge dispatch configuration',()=>{
  it('defaults closed and requires both finite limits',()=>{
    expect(publicJudgeAdmission(0,0,100,0,0).allowed).toBe(false);
    expect(publicJudgeAdmission(0,0,100,5,0).allowed).toBe(false);
    expect(publicJudgeAdmission(0,0,Number.NaN,5,1000).allowed).toBe(false);
  });
  it('counts every provider dispatch against one public ceiling',()=>{
    expect(publicJudgeAdmission(4,800_000,100_000,5,1_000_000).allowed).toBe(true);
    expect(publicJudgeAdmission(5,900_000,100_000,5,1_000_000).allowed).toBe(false);
    expect(publicJudgeAdmission(4,950_000,100_000,5,1_000_000).allowed).toBe(false);
  });
});
