import {useState} from 'react';
import {useInvestigation} from './useInvestigation';

const show=(value:unknown)=>JSON.stringify(value,null,2);
export default function MinskApp(){
  const state=useInvestigation();
  const [workflowJson,setWorkflowJson]=useState('');
  const workflow=state.workflow;
  return <main>
    <header><h1>Minsk</h1><p>Compare declared deployment policy with actual execution controls.</p><p className="notice">Minsk evaluates declared workflow rules and hypothetical conditions. It does not execute deployments or guarantee real-world safety.</p></header>
    {state.error&&<p role="alert" className="error">{state.error}</p>}
    {state.busy&&<p role="status">{state.busy} <button type="button" onClick={state.cancel}>Cancel</button></p>}
    <section aria-labelledby="intake-title"><h2 id="intake-title">1. Workflow input</h2>
      <label>Sample workflow <select aria-label="Sample workflow" value={workflow?.id??''} onChange={event=>{const sample=state.samples.find(item=>item.id===event.target.value);if(sample)void state.selectWorkflow(sample);}}>{state.samples.map(sample=><option key={sample.id} value={sample.id}>{sample.title}</option>)}</select></label>
      <label>Deployment workflow text <textarea aria-label="Deployment workflow text" rows={5} value={state.source} onChange={event=>state.setSource(event.target.value)}/></label>
      <button type="button" disabled={!state.liveEnabled||!!state.busy} onClick={()=>void state.analyze()}>Extract with Muse Spark</button> <span>{state.liveEnabled?'Live extraction available':'Live extraction disabled in this environment'}</span>
      <details><summary>Import validated workflow JSON</summary><textarea aria-label="Workflow JSON" rows={6} value={workflowJson} onChange={event=>setWorkflowJson(event.target.value)}/><button type="button" onClick={()=>void state.loadWorkflowJson(workflowJson)}>Validate and load JSON</button></details>
      {state.extractionModel&&<p>Extraction: {state.extractionModel.provider} / {state.extractionModel.modelId}</p>}
    </section>
    {workflow&&<>
      <section aria-labelledby="model-title"><h2 id="model-title">2. Validated workflow</h2><p>Workflow: {workflow.title} ({workflow.id})</p>
        <h3>Conditions</h3><div className="scroll"><table><thead><tr><th>ID</th><th>Condition</th><th>Expected</th><th>Observed</th><th>Evidence</th></tr></thead><tbody>{workflow.conditions.map(condition=><tr key={condition.id}><td><code>{condition.id}</code></td><td>{condition.name}</td><td>{String(condition.expectedValue)}</td><td><select aria-label={`Observed ${condition.name}`} value={String(condition.observedValue)} onChange={event=>void state.editCondition(condition.id,event.target.value==='null'?null:event.target.value==='true')}><option value="true">true</option><option value="false">false</option><option value="null">unknown</option></select></td><td>{condition.sourceSpans.map(span=><span key={`${span.sourceId}-${span.startOffset}`}>{span.excerpt} [{span.sourceId}:{span.startOffset}-{span.endOffset}]</span>)}</td></tr>)}</tbody></table></div>
        <h3>Policy rules</h3><div className="scroll"><table><thead><tr><th>Rule</th><th>Subject</th><th>Predicate</th><th>Required conditions</th><th>Origin and evidence</th></tr></thead><tbody>{workflow.policyRules.map(rule=><tr key={rule.id}><td>{rule.description}</td><td><code>{rule.subjectStepId}</code></td><td>{rule.predicate}</td><td>{rule.requiredConditionIds.join(', ')}</td><td>{rule.origin}: {rule.sourceSpans.map(span=>span.excerpt).join('; ')}</td></tr>)}</tbody></table></div>
        <h3>Execution steps</h3><div className="scroll"><table><thead><tr><th>Step</th><th>Type</th><th>Dependencies</th><th>Actual gates</th><th>Evidence</th></tr></thead><tbody>{workflow.steps.map(step=><tr key={step.id}><td>{step.name} <code>{step.id}</code></td><td>{step.actionType}</td><td>{step.dependsOn.join(', ')||'None'}</td><td>{workflow.conditions.map(condition=><label key={condition.id} className="inline"><input type="checkbox" checked={step.executionGateIds.includes(condition.id)} onChange={()=>void state.toggleGate(step.id,condition.id)}/>{condition.name}</label>)}</td><td>{step.sourceSpans.map(span=>span.excerpt).join('; ')}</td></tr>)}</tbody></table></div>
      </section>
      <section aria-labelledby="experiment-title"><h2 id="experiment-title">3. Evaluation and counterfactual</h2><p>Baseline: <strong aria-label="Baseline outcome">{state.baseline?.outcome??(state.loading?'Loading':'Not evaluated')}</strong></p>
        <label>Intervention target <select aria-label="Intervention target" value={state.intervention?.targetConditionId??''} onChange={event=>state.selectCondition(event.target.value)}><option value="">Select condition</option>{workflow.conditions.filter(condition=>typeof condition.observedValue==='boolean').map(condition=><option key={condition.id} value={condition.id}>{condition.name}</option>)}</select></label>
        {state.intervention&&<p>Hypothesis: change {state.intervention.targetConditionId} from {String(state.intervention.originalValue)} to {String(state.intervention.replacementValue)}.</p>}
        <div className="actions"><button type="button" disabled={!state.intervention||!!state.busy} onClick={()=>void state.applyIntervention()}>Run counterfactual</button><button type="button" disabled={!state.liveEnabled||!!state.busy} onClick={()=>void state.investigate()}>Run Meta investigation</button><button type="button" disabled={!state.applied||!!state.busy} onClick={()=>void state.verify()}>Verify safeguard</button></div>
        <p>Counterfactual: <strong aria-label="Counterfactual outcome">{state.failure?.outcome??'Not run'}</strong>. Repaired: <strong aria-label="Safeguard outcome">{state.verification?.repaired.outcome??'Not tested'}</strong>. Verified: {state.verification?.resolved===undefined?'Not tested':String(state.verification.resolved)}.</p>
        {state.routing&&<p>Investigator: {state.routing.modelId}. Route: {state.routing.reason}</p>}
        {state.trace.length>0&&<details open><summary>Actual model tool trace</summary><pre>{show(state.trace)}</pre></details>}
      </section>
      <section aria-labelledby="replay-title"><h2 id="replay-title">4. Replay and certificate</h2><div className="actions">{(['BASELINE','COUNTERFACTUAL','SAFEGUARD'] as const).map(scenario=><button key={scenario} type="button" disabled={scenario==='COUNTERFACTUAL'&&!state.failure||scenario==='SAFEGUARD'&&!state.verification} aria-pressed={state.scenario===scenario} onClick={()=>state.setScenario(scenario)}>{scenario}</button>)}</div>
        <p>Selected result: <strong aria-label="Evaluation outcome">{state.result?.outcome??'Not evaluated'}</strong></p>
        <div className="scroll"><table><thead><tr><th>Sequence</th><th>Step</th><th>Status</th><th>Reason</th></tr></thead><tbody>{state.result?.executionTrace.map(event=><tr key={event.sequence}><td>{event.sequence}</td><td>{event.stepId}</td><td>{event.status}</td><td>{event.reason}</td></tr>)}</tbody></table></div>
        <details><summary>Policy and execution results</summary><pre>{show({policy:state.result?.policyResults,steps:state.result?.stepResults,firstViolation:state.result?.firstViolation,unknown:state.result?.unknownConditions,affected:state.result?.affectedNodeIds})}</pre></details>
        <button type="button" disabled={!state.failure||!!state.busy} onClick={()=>void state.exportCertificate()}>Export certificate</button>{state.certificate!==null&&<details open><summary>Exported certificate</summary><pre>{show(state.certificate)}</pre></details>}
      </section>
    </>}
    <section aria-labelledby="benchmark-title"><h2 id="benchmark-title">5. Minsk Failure Benchmark</h2><button type="button" onClick={()=>void state.loadBenchmark()}>Run 12 deterministic cases</button>{state.benchmark!==null&&<pre aria-label="Benchmark results">{show(state.benchmark)}</pre>}<p>Run <code>pnpm benchmark</code> in a clean checkout for the machine-readable report.</p></section>
  </main>;
}
