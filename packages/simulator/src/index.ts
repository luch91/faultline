import { WorkflowSchema, InterventionSchema, type Workflow, type EvaluationResult, type EvaluationState } from '@minsk/contracts';

export const EVALUATOR_VERSION = '1.0.0';
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
export async function hash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stable(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2,'0')).join('');
}
async function rawTextHash(value:string):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function unique(ids: string[], kind: string): void { if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${kind} identifier`); }
function spansValid(graph: Workflow): void {
  const sources = new Map(graph.sourceDocuments.map(x => [x.id,x]));
  const spans = [...graph.conditions.flatMap(x=>x.sourceSpans), ...graph.steps.flatMap(x=>x.sourceSpans), ...graph.policyRules.flatMap(x=>x.sourceSpans)];
  for (const span of spans) { const source=sources.get(span.sourceId); if (!source || source.text.slice(span.startOffset,span.endOffset)!==span.excerpt || !span.verified) throw new Error('Invalid source evidence span'); }
}
export function validateWorkflow(input: unknown): Workflow {
  const graph=WorkflowSchema.parse(input);
  unique(graph.sourceDocuments.map(x=>x.id),'source'); unique(graph.conditions.map(x=>x.id),'condition'); unique(graph.steps.map(x=>x.id),'step'); unique(graph.policyRules.map(x=>x.id),'rule');
  const conditions=new Set(graph.conditions.map(x=>x.id)); const steps=new Set(graph.steps.map(x=>x.id));
  for (const step of graph.steps) { for (const id of step.dependsOn) if (!steps.has(id)) throw new Error(`Missing step reference ${id}`); for (const id of step.executionGateIds) if (!conditions.has(id)) throw new Error(`Missing gate reference ${id}`); }
  for (const rule of graph.policyRules) { if (!steps.has(rule.subjectStepId)) throw new Error(`Missing policy step ${rule.subjectStepId}`); for (const id of rule.requiredConditionIds) if (!conditions.has(id)) throw new Error(`Missing policy condition ${id}`); }
  spansValid(graph); topologicalSteps(graph); return graph;
}
export function topologicalSteps(graph: Workflow): Workflow['steps'] {
  const byId=new Map(graph.steps.map(x=>[x.id,x])); const seen=new Set<string>(); const active=new Set<string>(); const ordered: Workflow['steps']=[];
  function visit(id:string):void { if(active.has(id)) throw new Error('Dependency cycle'); if(seen.has(id)) return; const step=byId.get(id); if(!step) throw new Error(`Missing step ${id}`); active.add(id); for(const dep of [...step.dependsOn].sort()) visit(dep); active.delete(id); seen.add(id); ordered.push(step); }
  for(const id of [...byId.keys()].sort()) visit(id); return ordered;
}
export function combine(states: EvaluationState[], predicate: 'ALL'|'ANY'): EvaluationState {
  if(!states.length) return 'SATISFIED';
  if(predicate==='ALL') return states.includes('VIOLATED')?'VIOLATED':states.includes('UNKNOWN')?'UNKNOWN':'SATISFIED';
  return states.includes('SATISFIED')?'SATISFIED':states.includes('UNKNOWN')?'UNKNOWN':'VIOLATED';
}
function conditionState(condition: Workflow['conditions'][number], now: Date):EvaluationState {
  if(condition.observedValue===null) return 'UNKNOWN';
  if(condition.freshnessRequirement!==null) { if(!condition.observedAt) return 'UNKNOWN'; const age=now.getTime()-Date.parse(condition.observedAt); if(!Number.isFinite(age)||age<0||age>condition.freshnessRequirement*1000) return 'UNKNOWN'; }
  return condition.expectedValue===condition.observedValue?'SATISFIED':'VIOLATED';
}
export async function evaluate(input: unknown, rawIntervention?: unknown, now=new Date()):Promise<EvaluationResult> {
  const graph=validateWorkflow(input); const intervention=rawIntervention===undefined?undefined:InterventionSchema.parse(rawIntervention);
  for(const source of graph.sourceDocuments)if(await rawTextHash(source.text)!==source.contentHash)throw new Error('Source content hash mismatch');
  const conditionMap=new Map(graph.conditions.map(x=>[x.id,{...x}]));
  if(intervention) { const condition=conditionMap.get(intervention.targetConditionId); if(!condition) throw new Error('Invalid intervention target'); if(!intervention.validated) throw new Error('Intervention not validated'); if(condition.observedValue!==intervention.originalValue) throw new Error('Intervention original value mismatch'); conditionMap.set(condition.id,{...condition,observedValue:intervention.replacementValue}); }
  const states=new Map([...conditionMap].map(([id,condition])=>[id,conditionState(condition,now)]));
  const policyResults=graph.policyRules.map(rule=>({ruleId:rule.id,state:combine(rule.requiredConditionIds.map(id=>states.get(id)!),rule.predicate)}));
  const stepResults:EvaluationResult['stepResults']=[]; const executionTrace:EvaluationResult['executionTrace']=[]; const results=new Map<string,EvaluationState>();
  for(const step of topologicalSteps(graph)) {
    const gate=combine(step.executionGateIds.map(id=>states.get(id)!),'ALL'); const deps=combine(step.dependsOn.map(id=>results.get(id)!),'ALL'); const eligibility=combine([gate,deps],'ALL'); results.set(step.id,eligibility);
    const executes=eligibility==='SATISFIED'; stepResults.push({stepId:step.id,eligibility,executes}); executionTrace.push({sequence:executionTrace.length,stepId:step.id,status:executes?'EXECUTED':eligibility==='UNKNOWN'?'UNKNOWN':'BLOCKED',reason:eligibility==='SATISFIED'?'Execution gates and dependencies satisfied':gate!=='SATISFIED'?`Execution gate ${gate.toLowerCase()}`:`Dependency ${deps.toLowerCase()}`});
  }
  const unsafeRules=graph.policyRules.filter((rule,i)=>policyResults[i]?.state==='VIOLATED' && stepResults.find(x=>x.stepId===rule.subjectStepId)?.executes);
  const hasUnknown=policyResults.some(x=>x.state==='UNKNOWN') || stepResults.some(x=>x.eligibility==='UNKNOWN');
  const executes=stepResults.some(x=>x.executes && graph.steps.find(s=>s.id===x.stepId)?.actionType==='DEPLOY');
  const outcome=unsafeRules.length?'UNSAFE_EXECUTION':hasUnknown?'INDETERMINATE':executes?'SAFE_EXECUTION':'SAFE_BLOCK';
  const baselineHash=await hash(graph); const interventionHash=await hash(intervention??null); const semantic={baselineHash,interventionHash,evaluatorVersion:EVALUATOR_VERSION,stepResults,policyResults,executionTrace,outcome};
  const affectedNodeIds:string[]=[];
  if(intervention){affectedNodeIds.push(intervention.targetConditionId);const affected=new Set(graph.steps.filter(s=>s.executionGateIds.includes(intervention.targetConditionId)||graph.policyRules.some(r=>r.subjectStepId===s.id&&r.requiredConditionIds.includes(intervention.targetConditionId))).map(s=>s.id));for(const step of topologicalSteps(graph))if(step.dependsOn.some(id=>affected.has(id)))affected.add(step.id);affectedNodeIds.push(...topologicalSteps(graph).filter(x=>affected.has(x.id)).map(x=>x.id));}
  return {id:await hash(semantic),scenarioId:graph.id,baselineHash,interventionHash,evaluatorVersion:EVALUATOR_VERSION,stepResults,policyResults,executionTrace,affectedNodeIds,firstViolation:unsafeRules[0]?.id??null,unknownConditions:[...states].filter(([,v])=>v==='UNKNOWN').map(([id])=>id),outcome,timestamp:now.toISOString()};
}
export function addExecutionGate(input:unknown,stepId:string,conditionId:string):Workflow { const graph=validateWorkflow(input); if(!graph.conditions.some(x=>x.id===conditionId)) throw new Error('Unknown safeguard condition'); if(!graph.steps.some(x=>x.id===stepId)) throw new Error('Unknown safeguard step'); return {...graph,steps:graph.steps.map(x=>x.id===stepId?{...x,executionGateIds:[...new Set([...x.executionGateIds,conditionId])]}:x)}; }
export async function verifySafeguard(graph:unknown,intervention:unknown,stepId:string,conditionId:string,now=new Date()) { const validated=validateWorkflow(graph);const change=InterventionSchema.parse(intervention);const baseline=await evaluate(validated,undefined,now); const failure=await evaluate(validated,change,now); const patched=addExecutionGate(validated,stepId,conditionId); const repaired=await evaluate(patched,change,now); const relevant=validated.policyRules.some(rule=>rule.subjectStepId===stepId&&rule.requiredConditionIds.includes(conditionId)&&failure.policyResults.some(result=>result.ruleId===rule.id&&result.state==='VIOLATED'))&&!validated.steps.find(step=>step.id===stepId)?.executionGateIds.includes(conditionId); const unsafePathEliminated=failure.outcome==='UNSAFE_EXECUTION'&&repaired.outcome!=='UNSAFE_EXECUTION'; const resolved=unsafePathEliminated&&relevant&&repaired.outcome==='SAFE_BLOCK'; return {baseline,failure,repaired,patched,relevant,unsafePathEliminated,resolved,verificationStatus:resolved?'VERIFIED_SAFE_BLOCK':unsafePathEliminated?'UNRESOLVED':'NOT_RESOLVED'}; }
