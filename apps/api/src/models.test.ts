import {describe,expect,it} from 'vitest';
import {missingApproval} from '../../../fixtures/workflows/missing-approval';
import {actualMicroUsd,estimateMicroUsd} from './budget';
import {modelConfig,routeInvestigation} from './models';

describe('server model selection and accounting',()=>{
  it('keeps simple investigations on Spark',()=>{
    expect(routeInvestigation(missingApproval,true)).toMatchObject({modelId:'muse-spark-1.3',escalated:false});
  });
  it('routes complex workflows to Wonder only when explicitly enabled',()=>{
    const complex={...missingApproval,conditions:[...missingApproval.conditions,...missingApproval.conditions.map(condition=>({...condition,id:`extra-${condition.id}`}))]};
    expect(routeInvestigation(complex,false)).toMatchObject({modelId:'muse-spark-1.3',role:'ESCALATION_FALLBACK'});
    expect(routeInvestigation(complex,true)).toMatchObject({modelId:'muse-wonder-1.0',role:'ADVANCED_INVESTIGATION',escalated:true});
  });
  it('rejects arbitrary model identifiers',()=>{
    expect(()=>modelConfig('client-supplied-model')).toThrow('Unsupported model ID');
  });
  it('prices reservations and reported usage by model',()=>{
    expect(estimateMicroUsd(3000,1000,'muse-spark-1.3')).toBe(8000);
    expect(estimateMicroUsd(3000,1000,'muse-wonder-1.0')).toBe(32000);
    expect(actualMicroUsd(1000,1000,'muse-spark-1.3')).toBe(5500);
    expect(actualMicroUsd(1000,1000,'muse-wonder-1.0')).toBe(24000);
  });
});
