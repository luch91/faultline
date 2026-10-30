import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { heldoutSpecs, heldoutWorkflow } from '../model-evaluation/heldout';
import { evaluate, verifySafeguard } from '../packages/simulator/src';

const args=process.argv.slice(2).filter(value=>value!=='--');
const provider=args[args.indexOf('--provider')+1];
if(!['all','meta','baseten'].includes(provider))throw new Error('Use --provider all, meta, or baseten');
const base=process.env.MINSK_EVAL_API_URL;
const token=process.env.MINSK_EVAL_TOKEN;
if(!base||!token||!(/^(https:\/\/[^/]+|http:\/\/(localhost|127\.0\.0\.1):\d+)$/.test(base)))throw new Error('Set MINSK_EVAL_API_URL to HTTPS or localhost and MINSK_EVAL_TOKEN to the protected Worker token');
if(provider!=='meta'&&!process.env.MINSK_EVAL_TEST_TOKEN)throw new Error('Set MINSK_EVAL_TEST_TOKEN for the Baseten challenger');
const labels=JSON.parse(await readFile('model-evaluation/ground-truth.json','utf8')) as {version:string;cases:Record<string,{outcome:string;repair:string|null;basis:string}>};
const rows:Array<Record<string,unknown>>=[];
await mkdir('model-evaluation/results',{recursive:true});
const resumeIndex=args.indexOf('--resume');
const filename=resumeIndex>=0?args[resumeIndex+1]:`model-evaluation/results/benchmark-${new Date().toISOString().replaceAll(':','-')}.json`;
if(!filename||!/^model-evaluation\/results\/benchmark-[A-Za-z0-9T.\-]+\.json$/.test(filename))throw new Error('Resume path must identify a benchmark result in model-evaluation/results');
if(resumeIndex>=0){const previous=JSON.parse(await readFile(filename,'utf8')) as {provider:string;labelsVersion:string;rows:Array<Record<string,unknown>>};if(previous.provider!==provider||previous.labelsVersion!==labels.version)throw new Error('Resume configuration does not match');rows.push(...previous.rows.filter(row=>!/^HTTP (402|429):/.test(String(row.error??''))));}
async function persist(data:Record<string,unknown>){await writeFile(filename,JSON.stringify({version:'1',timestamp:new Date().toISOString(),provider,labelsVersion:labels.version,rows,...data},null,2)+'\n');}
async function call(path:string,body?:unknown){
  const start=performance.now();
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Minsk-Eval-Token':token!,'X-Minsk-Test-Token':process.env.MINSK_EVAL_TEST_TOKEN??''},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120_000)});
  const data=await response.json() as Record<string,any>;
  if(!response.ok)throw new Error(`HTTP ${response.status}: ${data.error??'request failed'}`);
  return {data,latencyMs:Math.round(performance.now()-start)};
}
const before=(await call('/api/v1/budget')).data;
if(provider!=='baseten'&&!before.liveModelEnabled)throw new Error('Meta is disabled on the selected Worker');
if(provider!=='meta'&&!before.openWeightEnabled)throw new Error('Baseten is disabled on the selected Worker');
await persist({before,status:'RUNNING'});
let stopped=false;
for(const spec of heldoutSpecs){
  const {workflow,text,targetId}=heldoutWorkflow(spec);
  const reference=labels.cases[spec.id];if(!reference)throw new Error(`Missing locked label ${spec.id}`);
  const target=workflow.conditions.find(item=>item.id===targetId)!;
  const intervention={id:`reference-${spec.id}`,targetConditionId:targetId,originalValue:target.observedValue,replacementValue:false,reason:'Locked reference',proposedBy:'USER' as const,validated:true};
  if((await evaluate(workflow,intervention)).outcome!==reference.outcome)throw new Error(`Reference disagreement for ${spec.id}`);
  const tasks:Array<{name:string;path:string;body:unknown}>=[];
  if(provider!=='baseten'){
    tasks.push({name:'spark-extraction',path:'/api/v1/workflows/extract',body:{text}});
    for(const modelId of ['muse-spark-1.3','muse-wonder-1.0'])tasks.push({name:modelId,path:'/api/v1/evaluation/investigate',body:{workflow,modelId,targetConditionId:targetId}});
    tasks.push({name:'spark-model-only',path:'/api/v1/evaluation/model-only',body:{workflow,modelId:'muse-spark-1.3'}});
  }
  if(provider!=='meta')tasks.push({name:'baseten',path:'/api/v1/challengers/open-weight',body:{workflow}});
  for(const task of tasks){
    if(rows.some(row=>row.caseId===spec.id&&row.task===task.name))continue;
    const taskStarted=performance.now();
    try{
      const {data,latencyMs}=await call(task.path,task.body);
      let outcome:string|null=null;let targetMatched:boolean|null=null;let repairVerified:boolean|null=null;let extractionCorrect:boolean|null=null;let providerTelemetry:unknown=null;let inputTokens:number|null=null;let outputTokens:number|null=null;
      if(task.name==='spark-extraction'){
        const main=data.workflow.conditions.find((item:any)=>item.name.toLowerCase().includes(spec.requirement.toLowerCase()));
        extractionCorrect=!!main&&main.observedValue===spec.mainObserved&&data.workflow.policyRules.some((rule:any)=>rule.requiredConditionIds.includes(main.id))&&data.workflow.steps.some((step:any)=>step.executionGateIds.includes(main.id))===spec.mainGate;
        providerTelemetry=data.model?.telemetry??null;inputTokens=data.model?.usage?.input_tokens??null;outputTokens=data.model?.usage?.output_tokens??null;
      }else if(task.name==='baseten'){
        const selected=data.experiments.find((item:any)=>item.intervention.targetConditionId===targetId&&item.intervention.replacementValue===false);
        targetMatched=!!selected;outcome=selected?.result.outcome??null;
        if(selected&&reference.repair)repairVerified=(await verifySafeguard(workflow,selected.intervention,workflow.steps[0].id,targetId)).resolved;
        providerTelemetry=data.challenger?.telemetry??null;inputTokens=data.challenger?.usage?.inputTokens??null;outputTokens=data.challenger?.usage?.outputTokens??null;
      }else if(task.name==='spark-model-only'){
        const prediction=JSON.parse(data.output);
        targetMatched=prediction.conditionId===targetId;
        outcome=prediction.predictedOutcome??null;
        providerTelemetry=data.telemetry??null;inputTokens=data.usage?.input_tokens??null;outputTokens=data.usage?.output_tokens??null;
      }else{
        targetMatched=data.intervention?.targetConditionId===targetId;outcome=data.failure?.outcome??null;repairVerified=data.verification?.resolved??null;
        const calls=Array.isArray(data.model?.telemetry)?data.model.telemetry:[];providerTelemetry=calls;inputTokens=(data.model?.usage?.first?.input_tokens??0)+(data.model?.usage?.second?.input_tokens??0)||null;outputTokens=(data.model?.usage?.first?.output_tokens??0)+(data.model?.usage?.second?.output_tokens??0)||null;
      }
      rows.push({caseId:spec.id,task:task.name,reference,latencyMs,providerTelemetry,inputTokens,outputTokens,retries:0,fallbacks:data.routing?.modelId==='muse-spark-1.3'&&String(data.routing?.reason??'').includes('fallback')?1:0,outcome,targetMatched,outcomeCorrect:outcome===null?null:outcome===reference.outcome,repairVerified,extractionCorrect,response:data});
      process.stdout.write(`${spec.id} ${task.name}: ${outcome??String(extractionCorrect)}\n`);
    }catch(error){const message=error instanceof Error?error.message:String(error);rows.push({caseId:spec.id,task:task.name,reference,latencyMs:Math.round(performance.now()-taskStarted),retries:0,fallbacks:0,error:message});process.stderr.write(`${spec.id} ${task.name}: ${message}\n`);if(/HTTP (402|429)/.test(message))stopped=true;}
    await persist({before,status:stopped?'STOPPED':'RUNNING'});
    if(stopped)break;
  }
  if(stopped)break;
}
let after:Record<string,any>|null=null;
try{after=(await call('/api/v1/budget')).data;}catch{/* Preserve completed rows if rate limited. */}
const groups=Object.fromEntries([...new Set(rows.map(row=>String(row.task)))].map(task=>{
  const group=rows.filter(row=>row.task===task);
  const classified=group.filter(row=>typeof row.outcome==='string');
  const positive=classified.filter(row=>(row.reference as {outcome:string}).outcome==='UNSAFE_EXECUTION');
  const negative=classified.filter(row=>(row.reference as {outcome:string}).outcome!=='UNSAFE_EXECUTION');
  const telemetry=group.flatMap(row=>Array.isArray(row.providerTelemetry)?row.providerTelemetry:row.providerTelemetry?[row.providerTelemetry]:[]) as Array<{estimatedActualMicroUsd?:number|null}>;
  return [task,{tasks:group.length,errors:group.filter(row=>!!row.error).length,providerDispatches:telemetry.length,endToEndLatencyMs:group.reduce((sum,row)=>sum+Number(row.latencyMs??0),0),inputTokens:group.reduce((sum,row)=>sum+Number(row.inputTokens??0),0),outputTokens:group.reduce((sum,row)=>sum+Number(row.outputTokens??0),0),usageEstimatedUsd:telemetry.reduce((sum,item)=>sum+Number(item.estimatedActualMicroUsd??0),0)/1_000_000,retries:group.reduce((sum,row)=>sum+Number(row.retries??0),0),fallbacks:group.reduce((sum,row)=>sum+Number(row.fallbacks??0),0),extractionCorrect:group.filter(row=>row.extractionCorrect===true).length,outcomeCorrect:group.filter(row=>row.outcomeCorrect===true).length,truePositive:positive.filter(row=>(row.reference as {outcome:string}).outcome==='UNSAFE_EXECUTION'&&row.outcome==='UNSAFE_EXECUTION').length,falseNegative:positive.filter(row=>row.outcome!=='UNSAFE_EXECUTION').length,falsePositive:negative.filter(row=>row.outcome==='UNSAFE_EXECUTION').length,trueNegative:negative.filter(row=>row.outcome!=='UNSAFE_EXECUTION').length,unknownCorrect:group.filter(row=>(row.reference as {outcome:string}).outcome==='INDETERMINATE'&&row.outcome==='INDETERMINATE').length,verifiedRepairs:group.filter(row=>row.repairVerified===true).length}];
}));
await persist({before,after,groups,status:stopped?'STOPPED':'COMPLETED'});
process.stdout.write(JSON.stringify(groups,null,2)+'\n');
process.stdout.write(`Fresh results: ${filename}. Synthetic scenarios do not establish real-world accuracy.\n`);
if(stopped||rows.some(row=>row.error))process.exitCode=1;
