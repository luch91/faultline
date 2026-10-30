import {z} from 'zod';
import type {Workflow} from '@minsk/contracts';
import {BudgetLedger} from './budget';

export const BASETEN_MODEL='meta-models/muse-spark-open-1026' as const;
const INPUT_RATE=1.25;
const OUTPUT_RATE=4.25;
const MAX_OUTPUT_TOKENS=2048;
const candidateSchema=z.object({conditionId:z.string(),replacementValue:z.boolean(),reason:z.string().min(1).max(300)});
const responseSchema=z.object({candidates:z.array(candidateSchema).max(3)});
export type Candidate=z.infer<typeof candidateSchema>;
export type CandidateConstraints={maxCandidates:number};
export type ChallengerResult={candidates:Candidate[];provider:'Baseten';modelId:typeof BASETEN_MODEL;responseId:string|null;usage:{inputTokens:number;outputTokens:number}|null;accountingStatus:'PROVIDER_USAGE'|'UNKNOWN_USAGE'};
export interface AdversarialModelProvider {
  generateCandidates(workflow:Workflow,constraints:CandidateConstraints,signal:AbortSignal):Promise<ChallengerResult>;
  validateAvailability():boolean;
  getModelMetadata():{provider:string;modelId:string};
}
export class ChallengerError extends Error {constructor(public status:number,message:string){super(message);}}
export function basetenEstimateMicroUsd(inputChars:number,outputTokens=MAX_OUTPUT_TOKENS){return Math.ceil(Math.ceil(inputChars/3)*INPUT_RATE+outputTokens*OUTPUT_RATE);}
export function basetenActualMicroUsd(inputTokens:number,outputTokens:number){return Math.ceil(inputTokens*INPUT_RATE+outputTokens*OUTPUT_RATE);}

export class EligibleOpenWeightInvestigator implements AdversarialModelProvider {
  constructor(private readonly key:string|undefined,private readonly enabled:boolean,private readonly ledger:DurableObjectStub<BudgetLedger>,private readonly client:string){}
  validateAvailability(){return this.enabled&&!!this.key;}
  getModelMetadata(){return {provider:'Baseten',modelId:BASETEN_MODEL};}
  async generateCandidates(workflow:Workflow,constraints:CandidateConstraints,signal:AbortSignal):Promise<ChallengerResult>{
    if(!this.validateAvailability())throw new ChallengerError(503,'Open-weight challenger is disabled');
    const candidates=workflow.conditions.filter(condition=>typeof condition.observedValue==='boolean');
    if(!candidates.length)throw new ChallengerError(422,'No observed boolean condition is eligible');
    const prompt=JSON.stringify({conditions:candidates.map(condition=>({id:condition.id,name:condition.name,observedValue:condition.observedValue})),rules:workflow.policyRules.map(rule=>({id:rule.id,subjectStepId:rule.subjectStepId,requiredConditionIds:rule.requiredConditionIds})),steps:workflow.steps.map(step=>({id:step.id,executionGateIds:step.executionGateIds})),maxCandidates:Math.min(3,constraints.maxCandidates)});
    const payload=JSON.stringify({model:BASETEN_MODEL,messages:[{role:'system',content:'Propose adversarial changes to observed boolean conditions in the validated workflow. Return only a JSON object with a candidates array. Each candidate has conditionId, replacementValue, and reason. Use only listed IDs and choose a value different from the observation. Do not claim any simulator outcome.'},{role:'user',content:prompt}],max_tokens:MAX_OUTPUT_TOKENS,reasoning_effort:'low',response_format:{type:'json_object'},temperature:0});
    const id=crypto.randomUUID();
    const reservation=await this.ledger.reserve(id,this.client,basetenEstimateMicroUsd(payload.length),'text',BASETEN_MODEL,'Baseten');
    if(!reservation.allowed)throw new ChallengerError(reservation.reason?.includes('ceiling')?402:429,reservation.reason??'Baseten request denied');
    const timeout=AbortSignal.timeout(30_000);
    try{
      const response=await fetch('https://inference.baseten.co/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:payload,signal:AbortSignal.any([signal,timeout])});
      if(!response.ok)throw new ChallengerError(response.status===429?429:response.status>=500?502:502,`Baseten provider returned ${response.status}`);
      const result=await response.json() as {id?:string;choices?:Array<{message?:{content?:string}}>;usage?:{prompt_tokens?:number;completion_tokens?:number}};
      const content=result.choices?.[0]?.message?.content;
      if(!content)throw new ChallengerError(502,'Baseten returned no candidate content');
      let parsed:z.infer<typeof responseSchema>;
      try{parsed=responseSchema.parse(JSON.parse(content));}catch{throw new ChallengerError(502,'Baseten returned malformed candidates');}
      const eligible=new Map(candidates.map(candidate=>[candidate.id,candidate.observedValue]));
      const unique=new Set<string>();
      const valid=parsed.candidates.filter(candidate=>eligible.has(candidate.conditionId)&&candidate.replacementValue!==eligible.get(candidate.conditionId)&&!unique.has(candidate.conditionId)&&unique.add(candidate.conditionId)).slice(0,Math.min(3,constraints.maxCandidates));
      if(!valid.length)throw new ChallengerError(502,'Baseten proposed no valid intervention');
      const reported=result.usage?.prompt_tokens!==undefined&&result.usage.completion_tokens!==undefined;
      if(reported)await this.ledger.settle(id,basetenActualMicroUsd(result.usage!.prompt_tokens!,result.usage!.completion_tokens!),result.usage!.prompt_tokens,result.usage!.completion_tokens);else await this.ledger.markUnknown(id);
      return {candidates:valid,provider:'Baseten',modelId:BASETEN_MODEL,responseId:result.id??null,usage:reported?{inputTokens:result.usage!.prompt_tokens!,outputTokens:result.usage!.completion_tokens!}:null,accountingStatus:reported?'PROVIDER_USAGE':'UNKNOWN_USAGE'};
    }catch(error){await this.ledger.markUnknown(id);if(signal.aborted)throw new ChallengerError(499,'Request cancelled');if(timeout.aborted)throw new ChallengerError(504,'Baseten provider timed out');throw error;}
  }
}
