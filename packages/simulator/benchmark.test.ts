import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {evaluate,validateWorkflow,verifySafeguard,hash,EVALUATOR_VERSION} from './src/index';

type BenchmarkCase={id:string;benchmarkVersion:string;workflow:unknown;intervention:unknown;safeguard:{stepId:string;conditionId:string}|null;negativeControl:boolean;groundTruth:{baseline:string;counterfactual:string;afterSafeguard:string|null;trace:string[]|null;justification:string}};
const root=resolve(process.cwd(),'../../benchmark');
const now=new Date('2026-10-26T18:00:00.000Z');
const cases=readdirSync(resolve(root,'cases')).filter(name=>/^MFB-\d\d\.json$/.test(name)).sort();

describe('Minsk Failure Benchmark',()=>{
  it('matches locked independent expectations and writes a reproducible report',async()=>{
    expect(cases).toHaveLength(12);
    execFileSync(process.execPath,[resolve(root,'reference-oracle.mjs')],{cwd:root});
    const reference=JSON.parse(readFileSync(resolve(root,'results','reference-latest.json'),'utf8')) as {total:number;agreed:number;disagreed:number};
    expect(reference).toMatchObject({total:12,agreed:12,disagreed:0});
    const rows=[];
    for(const file of cases){
      const item=JSON.parse(readFileSync(resolve(root,'cases',file),'utf8')) as BenchmarkCase;
      const failures:string[]=[];
      if(item.benchmarkVersion!=='1'||!item.groundTruth.justification)failures.push('Missing version or independent justification');
      let baseline:string,counterfactual:string,trace:string[]|null=null,repaired:string|null=null,verified=false;
      try{
        const graph=validateWorkflow(item.workflow);
        baseline=(await evaluate(graph,undefined,now)).outcome;
        const changed=await evaluate(graph,item.intervention,now);
        counterfactual=changed.outcome;
        trace=changed.executionTrace.map(event=>event.status);
        const repeated=await evaluate(graph,item.intervention,new Date('2026-10-26T19:00:00.000Z'));
        if(changed.id!==repeated.id)failures.push('Semantic result hash changed');
        if(item.safeguard){const repair=await verifySafeguard(graph,item.intervention,item.safeguard.stepId,item.safeguard.conditionId,now);repaired=repair.repaired.outcome;verified=repair.resolved;if(!repair.resolved)failures.push('Safeguard was not verified');}
      }catch(error){baseline='INVALID_SCENARIO';counterfactual='INVALID_SCENARIO';if(item.groundTruth.counterfactual!=='INVALID_SCENARIO')failures.push(error instanceof Error?error.message:'Unexpected evaluation error');}
      if(baseline!==item.groundTruth.baseline)failures.push(`Baseline ${baseline} differs from ${item.groundTruth.baseline}`);
      if(counterfactual!==item.groundTruth.counterfactual)failures.push(`Counterfactual ${counterfactual} differs from ${item.groundTruth.counterfactual}`);
      if(JSON.stringify(trace)!==JSON.stringify(item.groundTruth.trace))failures.push('Trace differs from ground truth');
      if(item.safeguard&&repaired!==item.groundTruth.afterSafeguard)failures.push('Safeguard outcome differs from ground truth');
      rows.push({id:item.id,passed:failures.length===0,baseline,counterfactual,trace,safeguardOutcome:repaired,safeguardVerified:verified,negativeControl:item.negativeControl,failures});
    }
    const positives=rows.filter(row=>row.id>='MFB-01'&&row.id<='MFB-06');
    const negatives=rows.filter(row=>row.negativeControl);
    const detectionRecall=positives.filter(row=>row.counterfactual==='UNSAFE_EXECUTION').length/positives.length;
    const falsePositives=negatives.filter(row=>row.counterfactual==='UNSAFE_EXECUTION').length;
    const report={benchmark:'Minsk Failure Benchmark',benchmarkVersion:'1',evaluatorVersion:EVALUATOR_VERSION,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fixtureHash:await hash(cases.map(file=>readFileSync(resolve(root,'cases',file),'utf8'))),total:rows.length,passed:rows.filter(row=>row.passed).length,failed:rows.filter(row=>!row.passed).length,unsupported:0,indeterminate:rows.filter(row=>row.counterfactual==='INDETERMINATE').length,detectionRecall,falsePositives,verifiedSafeguards:rows.filter(row=>row.safeguardVerified).length,independentGroundTruthAgreement:reference.agreed,rows};
    const results=resolve(root,'results');mkdirSync(results,{recursive:true});writeFileSync(resolve(results,'latest.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(`MFB: ${report.passed}/${report.total} cases, ${report.verifiedSafeguards} verified repairs, ${falsePositives} false positives, ${report.indeterminate} indeterminate\n`);
    expect(report.failed,JSON.stringify(rows.filter(row=>!row.passed))).toBe(0);
  });
});
