import {DurableObject} from 'cloudflare:workers';

const CEILING_MICRO_USD=100_000_000;
const DAILY_REQUEST_LIMIT=30;
const CLIENT_REQUEST_LIMIT=5;
export type InvestigationAttestation={graphHash:string;interventionHash:string;stepId:string;conditionId:string;responseIds:string[];toolCallIds:string[];inputTokens:number;outputTokens:number;verificationOutcome:string};
export class BudgetLedger extends DurableObject {
  private initialize():void {
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, day TEXT NOT NULL, session TEXT NOT NULL, reserved INTEGER NOT NULL, actual INTEGER, kind TEXT NOT NULL, state TEXT NOT NULL DEFAULT \'RESERVED\')');
    const columns=this.ctx.storage.sql.exec<{name:string}>('PRAGMA table_info(calls)').toArray();if(!columns.some(x=>x.name==='state'))this.ctx.storage.sql.exec('ALTER TABLE calls ADD COLUMN state TEXT NOT NULL DEFAULT \'UNKNOWN_USAGE\'');
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
  reserve(id:string,client:string,estimatedMicroUsd:number,kind:'text'|'image'): {allowed:boolean;reason?:string} {
    this.initialize();
    const day=new Date().toISOString().slice(0,10);
    const total=this.ctx.storage.sql.exec<{value:number}>('SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) AS value FROM calls').one().value;
    const daily=this.ctx.storage.sql.exec<{value:number}>('SELECT COUNT(*) AS value FROM calls WHERE day=?',day).one().value;
    const perClient=this.ctx.storage.sql.exec<{value:number}>('SELECT COUNT(*) AS value FROM calls WHERE session=? AND day=?',client,day).one().value;
    if(total+estimatedMicroUsd>CEILING_MICRO_USD)return {allowed:false,reason:'Internal Meta spending ceiling reached'};
    if(daily>=DAILY_REQUEST_LIMIT||perClient>=CLIENT_REQUEST_LIMIT)return {allowed:false,reason:'Model request allowance reached'};
    this.ctx.storage.sql.exec('INSERT INTO calls (id,day,session,reserved,actual,kind,state) VALUES (?,?,?,?,NULL,?,\'RESERVED\')',id,day,client,estimatedMicroUsd,kind);
    return {allowed:true};
  }
  settle(id:string,actualMicroUsd:number):void {this.initialize();this.ctx.storage.sql.exec('UPDATE calls SET actual=?,state=\'PROVIDER_USAGE\' WHERE id=?',Math.max(0,Math.floor(actualMicroUsd)),id);}
  markUnknown(id:string):void{this.initialize();this.ctx.storage.sql.exec('UPDATE calls SET state=\'UNKNOWN_USAGE\' WHERE id=? AND actual IS NULL',id);}
  attest(id:string,payload:InvestigationAttestation):void{this.initialize();this.ctx.storage.sql.exec('INSERT INTO attestations (id,payload,created) VALUES (?,?,?)',id,JSON.stringify(payload),Date.now());}
  getAttestation(id:string):InvestigationAttestation|null{this.initialize();const row=this.ctx.storage.sql.exec<{payload:string;created:number}>('SELECT payload,created FROM attestations WHERE id=?',id).toArray()[0];if(!row||Date.now()-row.created>86_400_000)return null;return JSON.parse(row.payload) as InvestigationAttestation;}
  status(){this.initialize();const rows=this.ctx.storage.sql.exec<{state:string;value:number;count:number}>('SELECT state,COALESCE(SUM(COALESCE(actual,reserved)),0) AS value,COUNT(*) AS count FROM calls GROUP BY state').toArray();const total=rows.reduce((sum,row)=>sum+row.value,0);return {internalCeilingUsd:100,conservativeAccountedUsd:total/1_000_000,states:Object.fromEntries(rows.map(row=>[row.state,{calls:row.count,usd:row.value/1_000_000}])),providerBillingReconciled:false};}
}
export function estimateMicroUsd(inputChars:number,outputTokens:number):number {const inputTokens=Math.ceil(inputChars/3);return Math.ceil(inputTokens*1.25+outputTokens*4.25);}
export function actualMicroUsd(inputTokens:number,outputTokens:number):number{return Math.ceil(inputTokens*1.25+outputTokens*4.25);}
