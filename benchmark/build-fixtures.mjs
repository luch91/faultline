import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';

const version='1.0.0';
const observedAt='2026-10-26T18:00:00.000Z';
const cases=[
  {id:'MFB-01',title:'Missing human approval',requirements:['human approval'],gates:[],change:'human approval',expected:'UNSAFE_EXECUTION',repaired:'SAFE_BLOCK',explanation:'Approval is mandatory, yet the deployment gate does not check it.'},
  {id:'MFB-02',title:'Required tests bypassed',requirements:['passing tests'],gates:[],change:'passing tests',expected:'UNSAFE_EXECUTION',repaired:'SAFE_BLOCK',explanation:'The deployment proceeds after mandatory tests fail because the execution gate omits the test condition.'},
  {id:'MFB-03',title:'Migration compatibility bypass',requirements:['migration compatibility'],gates:[],change:'migration compatibility',expected:'UNSAFE_EXECUTION',repaired:'SAFE_BLOCK',explanation:'A failed mandatory compatibility check is absent from the execution gate.'},
  {id:'MFB-04',title:'Canary gate bypass',requirements:['canary health'],gates:[],change:'canary health',expected:'UNSAFE_EXECUTION',repaired:'SAFE_BLOCK',explanation:'The release policy requires healthy canary evidence, while the execution gate omits it.'},
  {id:'MFB-05',title:'Release branch restriction missing',requirements:['approved release branch'],gates:[],change:'approved release branch',expected:'UNSAFE_EXECUTION',repaired:'SAFE_BLOCK',explanation:'The policy requires an approved branch but the deployment gate does not enforce it.'},
  {id:'MFB-06',title:'Security verification skipped',requirements:['security verification'],gates:[],change:'security verification',expected:'UNSAFE_EXECUTION',repaired:'SAFE_BLOCK',explanation:'A required security check fails without blocking execution.'},
  {id:'MFB-07',title:'Correctly protected workflow',requirements:['human approval'],gates:['human approval'],change:'human approval',expected:'SAFE_BLOCK',repaired:'SAFE_BLOCK',explanation:'The required approval gate blocks deployment when approval is absent.'},
  {id:'MFB-08',title:'Healthy execution',requirements:['passing tests'],gates:['passing tests'],conditions:['passing tests','optional notification'],change:'optional notification',expected:'SAFE_EXECUTION',repaired:'SAFE_EXECUTION',explanation:'The optional notification is irrelevant to the required test gate and deployment remains safe.'},
  {id:'MFB-09',title:'Missing verification evidence',requirements:['human approval','passing tests'],gates:['human approval','passing tests'],conditions:['human approval','passing tests','optional notification'],unknown:['human approval'],change:'optional notification',expected:'INDETERMINATE',repaired:'INDETERMINATE',explanation:'Approval evidence is unknown. Changing an unrelated optional notification does not resolve that unknown policy condition.'},
  {id:'MFB-10',title:'Multi-step dependency failure',requirements:['passing tests'],gates:[],change:'passing tests',upstream:true,expected:'SAFE_BLOCK',repaired:'SAFE_BLOCK',explanation:'The failed test step blocks its dependent deployment before execution.'},
  {id:'MFB-11',title:'Invalid dependency graph',requirements:['passing tests'],gates:['passing tests'],change:'passing tests',invalid:'reference',expected:'INVALID_SCENARIO',repaired:null,explanation:'The deployment references a step that is not declared.'},
  {id:'MFB-12',title:'Unsupported source evidence',requirements:['human approval'],gates:[],change:'human approval',invalid:'evidence',expected:'INVALID_SCENARIO',repaired:null,explanation:'The policy evidence excerpt does not match the source document.'}
];

function make(spec){
  const conditionNames=spec.conditions??spec.requirements;
  const policyText=`Policy: production deployment requires ${spec.requirements.join(' and ')}.`;
  const gateText=`Automation: deployment checks ${spec.gates.length?spec.gates.join(' and '):'no condition gates'}.`;
  const conditionText=conditionNames.map(name=>`Observation: ${name} is recorded.`).join(' ');
  const upstreamText=spec.upstream?'Test step: passing tests is required before deployment.':'';
  const source=[policyText,gateText,conditionText,upstreamText].filter(Boolean).join(' ');
  const sourceId=`${spec.id.toLowerCase()}-source`;
  const span=excerpt=>{const startOffset=source.indexOf(excerpt);if(startOffset<0)throw new Error(`Missing excerpt ${excerpt}`);return {sourceId,startOffset,endOffset:startOffset+excerpt.length,excerpt,verified:true};};
  const conditions=conditionNames.map((name,index)=>({id:`condition-${index+1}`,name,valueType:'BOOLEAN',expectedValue:true,observedValue:spec.unknown?.includes(name)?null:true,sourceSpans:[span(`Observation: ${name} is recorded.`)],freshnessRequirement:null,observedAt:null}));
  const idFor=name=>conditions.find(condition=>condition.name===name)?.id;
  const steps=spec.upstream?[{id:'test-step',name:'Run tests',actionType:'CHECK',dependsOn:[],executionGateIds:[idFor('passing tests')],sourceSpans:[span(upstreamText)]}]:[];
  steps.push({id:'deploy-production',name:'Deploy production',actionType:'DEPLOY',dependsOn:spec.invalid==='reference'?['missing-step']:spec.upstream?['test-step']:[],executionGateIds:spec.gates.map(idFor),sourceSpans:[span(gateText)]});
  const policySpan=spec.invalid==='evidence'?{...span(policyText),excerpt:'Unsupported policy statement'}:span(policyText);
  const workflow={schemaVersion:version,id:spec.id.toLowerCase(),title:spec.title,sourceDocuments:[{id:sourceId,text:source,contentHash:createHash('sha256').update(source).digest('hex'),createdAt:observedAt,schemaVersion:version}],conditions,policyRules:[{id:'deployment-policy',description:policyText,subjectStepId:'deploy-production',predicate:'ALL',requiredConditionIds:spec.requirements.map(idFor),sourceSpans:[policySpan],origin:'EXPLICIT'}],steps};
  const target=conditions.find(condition=>condition.name===spec.change);
  const intervention={id:`${spec.id.toLowerCase()}-change`,targetConditionId:target.id,originalValue:target.observedValue,replacementValue:false,reason:`Test failure of ${spec.change}`,proposedBy:'USER',validated:true};
  return {benchmarkVersion:'1',id:spec.id,workflow,intervention,safeguard:spec.expected==='UNSAFE_EXECUTION'?{stepId:'deploy-production',conditionId:target.id}:null,assumptions:['Boolean observations are declared fixture inputs, not live telemetry.','Only declared execution gates and step dependencies are evaluated.'],negativeControl:spec.id==='MFB-07'||spec.id==='MFB-08'||spec.id==='MFB-09',groundTruth:{baseline:spec.expected==='INVALID_SCENARIO'?'INVALID_SCENARIO':spec.id==='MFB-09'?'INDETERMINATE':'SAFE_EXECUTION',counterfactual:spec.expected,afterSafeguard:spec.repaired,trace:spec.expected==='INVALID_SCENARIO'?null:spec.upstream?['BLOCKED','BLOCKED']:[spec.expected==='SAFE_BLOCK'?'BLOCKED':spec.expected==='INDETERMINATE'?'UNKNOWN':'EXECUTED'],justification:spec.explanation}};
}

mkdirSync(new URL('./cases/',import.meta.url),{recursive:true});
for(const spec of cases)writeFileSync(new URL(`./cases/${spec.id}.json`,import.meta.url),JSON.stringify(make(spec),null,2)+'\n');
