import {DurableObject} from 'cloudflare:workers';
import {modelConfig, type ModelId} from './models';

export function providerCeiling(provider:BillingProvider,settings:{META_CEILING_MICRO_USD?:string}):number|null {
  // The owner has authorized Baseten promotional-credit use without an
  // application-dollar ceiling. Meta remains bounded by its $50 application
  // ceiling. Request, session, evaluation, timeout, and validation limits
  // still apply to both providers.
  if(provider==='Baseten')return Number.POSITIVE_INFINITY;
  const raw=settings.META_CEILING_MICRO_USD??'50000000';
  if(!raw||!/^[1-9]\d*$/.test(raw))return null;
  const ceiling=Number(raw);
  return Number.isSafeInteger(ceiling)&&(provider!=='Meta'||ceiling<=50_000_000)?ceiling:null;
}
const DAILY_REQUEST_LIMIT=30;
const CLIENT_REQUEST_LIMIT=5;
export function evaluationAdmission(count:number,costMicroUsd:number,estimatedMicroUsd:number,limit=6,ceilingMicroUsd=300_000,provider:BillingProvider='Meta'){
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(ceilingMicroUsd)||ceilingMicroUsd<1||ceilingMicroUsd>10_000_000)return {allowed:false,reason:'Invalid evaluation budget configuration'};
  if(count>=limit)return {allowed:false,reason:'Evaluation call limit reached'};
  if(!Number.isFinite(estimatedMicroUsd)||estimatedMicroUsd<=0)return {allowed:false,reason:'Invalid evaluation estimate'};
  if(provider==='Meta'&&costMicroUsd+estimatedMicroUsd>ceilingMicroUsd)return {allowed:false,reason:'Evaluation Meta estimate ceiling reached'};
  return {allowed:true};
}
export type ModelCallAttestation={modelId:ModelId;role:string;responseId:string|null;toolCallId:string;toolArgumentsJson?:string;toolResultJson?:string;inputTokens:number;outputTokens:number;accountingStatus:'PROVIDER_USAGE'|'UNKNOWN_USAGE';routingReason:string};
export type InvestigationAttestation={graphHash:string;interventionHash:string;stepId:string|null;conditionId:string|null;responseIds:string[];toolCallIds:string[];inputTokens:number;outputTokens:number;verificationOutcome:string|null;calls?:ModelCallAttestation[]};
export type BillingProvider='Meta'|'Baseten';
export class BudgetLedger extends DurableObject {
  private initialize():void {
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, day TEXT NOT NULL, session TEXT NOT NULL, reserved INTEGER NOT NULL, actual INTEGER, kind TEXT NOT NULL, state TEXT NOT NULL DEFAULT \'RESERVED\')');
    const columns=this.ctx.storage.sql.exec<{name:string}>('PRAGMA table_info(calls)').toArray();if(!columns.some(x=>x.name==='state'))this.ctx.storage.sql.exec('ALTER TABLE calls ADD COLUMN state TEXT NOT NULL DEFAULT \'UNKNOWN_USAGE\'');
    if(!columns.some(x=>x.name==='model'))this.ctx.storage.sql.exec("ALTER TABLE calls ADD COLUMN model TEXT NOT NULL DEFAULT 'muse-spark-1.3'");
    if(!columns.some(x=>x.name==='provider'))this.ctx.storage.sql.exec("ALTER TABLE calls ADD COLUMN provider TEXT NOT NULL DEFAULT 'Meta'");
    if(!columns.some(x=>x.name==='input_tokens'))this.ctx.storage.sql.exec('ALTER TABLE calls ADD COLUMN input_tokens INTEGER');
    if(!columns.some(x=>x.name==='output_tokens'))this.ctx.storage.sql.exec('ALTER TABLE calls ADD COLUMN output_tokens INTEGER');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS request_counts (key TEXT PRIMARY KEY, count INTEGER NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS attestations (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created INTEGER NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS investigation_lock (id INTEGER PRIMARY KEY CHECK (id=1), started INTEGER NOT NULL)');
  }
  admit(client:string):{allowed:boolean;reason?:string}{
    this.initialize();const minute=new Date().toISOString().slice(0,16);for(const [key,limit] of [[`global:${minute}`,300],[`client:${client}:${minute}`,30]] as const){const count=this.ctx.storage.sql.exec<{count:number}>('SELECT count FROM request_counts WHERE key=?',key).toArray()[0]?.count??0;if(count>=limit)return {allowed:false,reason:'Request rate limit exceeded'};}
    for(const key of [`global:${minute}`,`client:${client}:${minute}`])this.ctx.storage.sql.exec('INSERT INTO request_counts (key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1',key);
    this.ctx.storage.sql.exec('DELETE FROM request_counts WHERE key NOT LIKE ?',`%${minute}`);
    return {allowed:true};
  }
  acquireInvestigation():boolean{this.initialize();const now=Date.now();this.ctx.storage.sql.exec('DELETE FROM investigation_lock WHERE started<?',now-60_000);const current=this.ctx.storage.sql.exec<{id:number}>('SELECT id FROM investigation_lock WHERE id=1').toArray();if(current.length)return false;this.ctx.storage.sql.exec('INSERT INTO investigation_lock (id,started) VALUES (1,?)',now);return true;}
  releaseInvestigation():void{this.initialize();this.ctx.storage.sql.exec('DELETE FROM investigation_lock WHERE id=1');}
  reserve(id:string,client:string,estimatedMicroUsd:number,kind:'text'|'image',model:ModelId|'meta-models/muse-spark-open-1026'='muse-spark-1.3',provider:BillingProvider='Meta'): {allowed:boolean;reason?:string} {
    this.initialize();
    if(client==='eval:controlled'){
      const used=this.ctx.storage.sql.exec<{count:number;cost:number}>('SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN provider=\'Meta\' THEN MAX(COALESCE(actual,0),reserved) ELSE 0 END),0) AS cost FROM calls WHERE session=?',client).one();
      const settings=this.env as {MINSK_EVAL_MAX_CALLS?:string;MINSK_EVAL_MAX_MICRO_USD?:string};
      const admission=evaluationAdmission(used.count,used.cost,estimatedMicroUsd,settings.MINSK_EVAL_MAX_CALLS?Number(settings.MINSK_EVAL_MAX_CALLS):6,settings.MINSK_EVAL_MAX_MICRO_USD?Number(settings.MINSK_EVAL_MAX_MICRO_USD):300_000,provider);
      if(!admission.allowed)return admission;
    }
    const day=new Date().toISOString().slice(0,10);
    const total=this.ctx.storage.sql.exec<{value:number}>('SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) AS value FROM calls WHERE provider=?',provider).one().value;
    const daily=this.ctx.storage.sql.exec<{value:number}>('SELECT COUNT(*) AS value FROM calls WHERE day=?',day).one().value;
    const perClient=this.ctx.storage.sql.exec<{value:number}>('SELECT COUNT(*) AS value FROM calls WHERE session=? AND day=? AND provider=?',client,day,provider).one().value;
    const ceiling=providerCeiling(provider,this.env as {META_CEILING_MICRO_USD?:string});
    if(ceiling===null||!Number.isSafeInteger(estimatedMicroUsd)||estimatedMicroUsd<=0)return {allowed:false,reason:`Invalid ${provider} spending configuration or estimate`};
    if(total+estimatedMicroUsd>ceiling)return {allowed:false,reason:`Internal ${provider} spending ceiling reached`};
    if(client!=='eval:controlled'&&(daily>=DAILY_REQUEST_LIMIT||perClient>=CLIENT_REQUEST_LIMIT))return {allowed:false,reason:'Model request allowance reached'};
    this.ctx.storage.sql.exec('INSERT INTO calls (id,day,session,reserved,actual,kind,state,model,provider) VALUES (?,?,?,?,NULL,?,\'RESERVED\',?,?)',id,day,client,estimatedMicroUsd,kind,model,provider);
    return {allowed:true};
  }
  settle(id:string,actualMicroUsd:number,inputTokens?:number,outputTokens?:number):void {this.initialize();this.ctx.storage.sql.exec('UPDATE calls SET actual=?,input_tokens=?,output_tokens=?,state=\'PROVIDER_USAGE\' WHERE id=?',Math.max(0,Math.floor(actualMicroUsd)),inputTokens??null,outputTokens??null,id);}
  markUnknown(id:string):void{this.initialize();this.ctx.storage.sql.exec('UPDATE calls SET state=\'UNKNOWN_USAGE\' WHERE id=? AND actual IS NULL',id);}
  attest(id:string,payload:InvestigationAttestation):void{this.initialize();this.ctx.storage.sql.exec('INSERT INTO attestations (id,payload,created) VALUES (?,?,?)',id,JSON.stringify(payload),Date.now());}
  getAttestation(id:string):InvestigationAttestation|null{this.initialize();const row=this.ctx.storage.sql.exec<{payload:string;created:number}>('SELECT payload,created FROM attestations WHERE id=?',id).toArray()[0];if(!row||Date.now()-row.created>86_400_000)return null;return JSON.parse(row.payload) as InvestigationAttestation;}
  status(){this.initialize();const rows=this.ctx.storage.sql.exec<{state:string;value:number;count:number}>('SELECT state,COALESCE(SUM(COALESCE(actual,reserved)),0) AS value,COUNT(*) AS count FROM calls WHERE provider=\'Meta\' GROUP BY state').toArray();const models=this.ctx.storage.sql.exec<{model:string;value:number;count:number;inputTokens:number;outputTokens:number}>('SELECT model,COALESCE(SUM(COALESCE(actual,reserved)),0) AS value,COUNT(*) AS count,COALESCE(SUM(input_tokens),0) AS inputTokens,COALESCE(SUM(output_tokens),0) AS outputTokens FROM calls GROUP BY model').toArray();const providers=this.ctx.storage.sql.exec<{provider:string;value:number;count:number}>('SELECT provider,COALESCE(SUM(COALESCE(actual,reserved)),0) AS value,COUNT(*) AS count FROM calls GROUP BY provider').toArray();const evaluation=this.ctx.storage.sql.exec<{calls:number;conservative:number;reported:number;reserved:number}>('SELECT COUNT(*) AS calls,COALESCE(SUM(MAX(COALESCE(actual,0),reserved)),0) AS conservative,COALESCE(SUM(actual),0) AS reported,COALESCE(SUM(reserved),0) AS reserved FROM calls WHERE session=?','eval:controlled').one();const total=rows.reduce((sum,row)=>sum+row.value,0);const metaCeiling=providerCeiling('Meta',this.env as {META_CEILING_MICRO_USD?:string});return {internalCeilingUsd:metaCeiling===null?null:metaCeiling/1_000_000,conservativeAccountedUsd:total/1_000_000,basetenCeilingUsd:null,basetenAccountedUsd:(providers.find(row=>row.provider==='Baseten')?.value??0)/1_000_000,evaluation:{calls:evaluation.calls,conservativeUsd:evaluation.conservative/1_000_000,usagePricedUsd:evaluation.reported/1_000_000,reservedUsd:evaluation.reserved/1_000_000},states:Object.fromEntries(rows.map(row=>[row.state,{calls:row.count,usd:row.value/1_000_000}])),models:Object.fromEntries(models.map(row=>[row.model,{calls:row.count,usd:row.value/1_000_000,inputTokens:row.inputTokens,outputTokens:row.outputTokens}])),providers:Object.fromEntries(providers.map(row=>[row.provider,{calls:row.count,usd:row.value/1_000_000}])),providerBillingReconciled:false};}
}
export function estimateMicroUsd(inputBytes:number,outputTokens:number,modelId:ModelId='muse-spark-1.3'):number {const model=modelConfig(modelId);return Math.ceil(inputBytes*model.inputUsdPerMillion+outputTokens*model.outputUsdPerMillion);}
export function actualMicroUsd(inputTokens:number,outputTokens:number,modelId:ModelId='muse-spark-1.3'):number{const model=modelConfig(modelId);return Math.ceil(inputTokens*model.inputUsdPerMillion+outputTokens*model.outputUsdPerMillion);}
