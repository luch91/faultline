import {DurableObject} from 'cloudflare:workers';

const CEILING_MICRO_USD=100_000_000;
const DAILY_REQUEST_LIMIT=100;
const SESSION_REQUEST_LIMIT=5;
export class BudgetLedger extends DurableObject {
  private initialize():void {this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, day TEXT NOT NULL, session TEXT NOT NULL, reserved INTEGER NOT NULL, actual INTEGER, kind TEXT NOT NULL)');}
  reserve(id:string,session:string,estimatedMicroUsd:number,kind:'text'|'image'): {allowed:boolean;reason?:string} {
    this.initialize();
    const day=new Date().toISOString().slice(0,10);
    const total=this.ctx.storage.sql.exec<{value:number}>('SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) AS value FROM calls').one().value;
    const daily=this.ctx.storage.sql.exec<{value:number}>('SELECT COUNT(*) AS value FROM calls WHERE day=?',day).one().value;
    const perSession=this.ctx.storage.sql.exec<{value:number}>('SELECT COUNT(*) AS value FROM calls WHERE session=? AND day=?',session,day).one().value;
    if(total+estimatedMicroUsd>CEILING_MICRO_USD)return {allowed:false,reason:'Internal Meta spending ceiling reached'};
    if(daily>=DAILY_REQUEST_LIMIT||perSession>=SESSION_REQUEST_LIMIT)return {allowed:false,reason:'Model request allowance reached'};
    this.ctx.storage.sql.exec('INSERT INTO calls (id,day,session,reserved,actual,kind) VALUES (?,?,?,?,NULL,?)',id,day,session,estimatedMicroUsd,kind);
    return {allowed:true};
  }
  settle(id:string,actualMicroUsd:number):void {this.initialize();this.ctx.storage.sql.exec('UPDATE calls SET actual=? WHERE id=?',Math.max(0,Math.floor(actualMicroUsd)),id);}
  status(){this.initialize();const spent=this.ctx.storage.sql.exec<{value:number}>('SELECT COALESCE(SUM(COALESCE(actual,reserved)),0) AS value FROM calls').one().value;return {internalCeilingUsd:100,estimatedOrActualUsageUsd:spent/1_000_000,providerBillingReconciled:false};}
}
export function estimateMicroUsd(inputChars:number,outputTokens:number):number {const inputTokens=Math.ceil(inputChars/3);return Math.ceil(inputTokens*1.25+outputTokens*4.25);}
export function actualMicroUsd(inputTokens:number,outputTokens:number):number{return Math.ceil(inputTokens*1.25+outputTokens*4.25);}
