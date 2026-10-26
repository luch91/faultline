import {type Workflow,type Intervention,SCHEMA_VERSION} from '../../packages/contracts/src';

export const sampleText='Production deployment requires passing automated tests, human approval, and verified migration compatibility. The deployment agent executes when tests pass and migration compatibility passes.';
const span=(excerpt:string)=>({sourceId:'missing-approval-source',startOffset:sampleText.indexOf(excerpt),endOffset:sampleText.indexOf(excerpt)+excerpt.length,excerpt,verified:true});
export const missingApproval:Workflow={
  schemaVersion:SCHEMA_VERSION,id:'missing-approval',title:'The Missing Approval',
  sourceDocuments:[{id:'missing-approval-source',text:sampleText,contentHash:'8e37513651f04718c89510a36bc1f2b7fcb881d492202c67c628d4a9fd0a1d8a',createdAt:'2026-10-26T18:00:00.000Z',schemaVersion:SCHEMA_VERSION}],
  conditions:[
    {id:'tests-pass',name:'Automated tests pass',valueType:'BOOLEAN',expectedValue:true,observedValue:true,sourceSpans:[span('passing automated tests')],freshnessRequirement:null,observedAt:null},
    {id:'human-approval',name:'Human approval present',valueType:'BOOLEAN',expectedValue:true,observedValue:true,sourceSpans:[span('human approval')],freshnessRequirement:null,observedAt:null},
    {id:'migration-compatible',name:'Migration compatible',valueType:'BOOLEAN',expectedValue:true,observedValue:true,sourceSpans:[span('verified migration compatibility')],freshnessRequirement:null,observedAt:null}
  ],
  policyRules:[{id:'approval-required',description:'Deployment requires passing tests, human approval, and migration compatibility',subjectStepId:'deploy-production',predicate:'ALL',requiredConditionIds:['tests-pass','human-approval','migration-compatible'],sourceSpans:[span('Production deployment requires passing automated tests, human approval, and verified migration compatibility.')],origin:'EXPLICIT'}],
  steps:[{id:'deploy-production',name:'Deploy to production',actionType:'DEPLOY',dependsOn:[],executionGateIds:['tests-pass','migration-compatible'],sourceSpans:[span('The deployment agent executes when tests pass and migration compatibility passes.')]}]
};
export const missingApprovalIntervention:Intervention={id:'remove-approval',targetConditionId:'human-approval',originalValue:true,replacementValue:false,reason:'Test missing approval',proposedBy:'USER',validated:true};
