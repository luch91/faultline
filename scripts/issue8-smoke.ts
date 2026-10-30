import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { heldoutSpecs, heldoutWorkflow } from '../model-evaluation/heldout';
import { missingApproval } from '../fixtures/workflows/missing-approval';
import { verifyCertificate } from '../packages/simulator/src/certificate';

const vars={...Object.fromEntries((await readFile('apps/api/.dev.vars','utf8').catch(()=>'' )).split(/\r?\n/).filter(line=>/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];})),MINSK_EVAL_TOKEN:process.env.MINSK_EVAL_TOKEN??'',BASETEN_TEST_TOKEN:process.env.BASETEN_TEST_TOKEN??''};
const headers={'Content-Type':'application/json','X-Minsk-Eval-Token':vars.MINSK_EVAL_TOKEN,'X-Minsk-Test-Token':vars.BASETEN_TEST_TOKEN};
const base=process.env.MINSK_SMOKE_API_URL??'http://127.0.0.1:8798';
if(!/^(https:\/\/minsk-api-preview\.judithorluchee\.workers\.dev|http:\/\/127\.0\.0\.1:\d+)$/.test(base))throw new Error('Unsupported smoke Worker URL');
async function request(path:string,body?:unknown){
  const started=performance.now();
  const response=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120_000)});
  const payload=await response.json() as Record<string,any>;
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status} ${payload.error??'request failed'}`);
  return {payload,latencyMs:Math.round(performance.now()-started)};
}
const before=(await request('/api/v1/budget')).payload;
if(!before.liveModelEnabled||!before.openWeightEnabled)throw new Error('Provider switches or protected tokens unavailable');
const events:unknown[]=[];
const {text}=heldoutWorkflow(heldoutSpecs[0]);
const extracted=await request('/api/v1/workflows/extract',{text});
events.push({task:'Spark extraction',latencyMs:extracted.latencyMs,model:extracted.payload.model,conditions:extracted.payload.workflow.conditions.length});
for(const modelId of ['muse-spark-1.3','muse-wonder-1.0']){
  const response=await request('/api/v1/evaluation/investigate',{workflow:missingApproval,modelId,targetConditionId:'human-approval'});
  const run=response.payload;
  const certificate=await request('/api/v1/reports/export',{workflow:missingApproval,investigation:{investigationId:run.investigationId,intervention:run.intervention,verification:run.verification}});
  const verified=await verifyCertificate(certificate.payload,missingApproval);
  events.push({task:'investigation',requestedModel:modelId,latencyMs:response.latencyMs,model:run.model,routing:run.routing,trace:run.trace,baseline:run.baseline.outcome,counterfactual:run.failure.outcome,safeguard:run.verification?.repaired?.outcome??null,certificate:verified});
}
try{
  const response=await request('/api/v1/challengers/open-weight',{workflow:missingApproval});
  events.push({task:'Baseten challenger',latencyMs:response.latencyMs,challenger:response.payload.challenger,outcomes:response.payload.experiments.map((item:any)=>item.result.outcome)});
}catch(error){events.push({task:'Baseten challenger',error:error instanceof Error?error.message:String(error)});}
const after=(await request('/api/v1/budget')).payload;
await mkdir('model-evaluation/results',{recursive:true});
const report={timestamp:new Date().toISOString(),mode:base.startsWith('https:')?'live protected preview Worker':'live local protected Worker',before,after,events};
await writeFile(`model-evaluation/results/issue8-smoke-${base.startsWith('https:')?'preview':'local'}.json`,JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify(report,null,2)+'\n');
