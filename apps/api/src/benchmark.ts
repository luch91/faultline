import case01 from '../../../benchmark/cases/MFB-01.json';
import case02 from '../../../benchmark/cases/MFB-02.json';
import case03 from '../../../benchmark/cases/MFB-03.json';
import case04 from '../../../benchmark/cases/MFB-04.json';
import case05 from '../../../benchmark/cases/MFB-05.json';
import case06 from '../../../benchmark/cases/MFB-06.json';
import case07 from '../../../benchmark/cases/MFB-07.json';
import case08 from '../../../benchmark/cases/MFB-08.json';
import case09 from '../../../benchmark/cases/MFB-09.json';
import case10 from '../../../benchmark/cases/MFB-10.json';
import case11 from '../../../benchmark/cases/MFB-11.json';
import case12 from '../../../benchmark/cases/MFB-12.json';
import {evaluate,verifySafeguard,EVALUATOR_VERSION} from '@minsk/simulator';

const cases=[case01,case02,case03,case04,case05,case06,case07,case08,case09,case10,case11,case12];
export async function runBenchmark(){
  const rows=[];
  for(const item of cases){
    let baseline='INVALID_SCENARIO',counterfactual='INVALID_SCENARIO',safeguardOutcome:string|null=null,verified=false;
    try{
      baseline=(await evaluate(item.workflow)).outcome;
      counterfactual=(await evaluate(item.workflow,item.intervention)).outcome;
      if(item.safeguard){const result=await verifySafeguard(item.workflow,item.intervention,item.safeguard.stepId,item.safeguard.conditionId);safeguardOutcome=result.repaired.outcome;verified=result.resolved;}
    }catch{ /* Invalid cases are expected to fail validation. */ }
    const passed=baseline===item.groundTruth.baseline&&counterfactual===item.groundTruth.counterfactual&&(!item.safeguard||safeguardOutcome===item.groundTruth.afterSafeguard&&verified);
    rows.push({id:item.id,title:item.workflow.title,baseline,counterfactual,safeguardOutcome,verified,passed,groundTruth:item.groundTruth.justification});
  }
  return {benchmark:'Minsk Failure Benchmark',version:'1',evaluatorVersion:EVALUATOR_VERSION,total:rows.length,passed:rows.filter(row=>row.passed).length,failed:rows.filter(row=>!row.passed).length,indeterminate:rows.filter(row=>row.counterfactual==='INDETERMINATE').length,falsePositives:rows.filter((row,index)=>cases[index]!.negativeControl&&row.counterfactual==='UNSAFE_EXECUTION').length,verifiedSafeguards:rows.filter(row=>row.verified).length,rows};
}
