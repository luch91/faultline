import type { InvestigationState } from './useInvestigation';
export function ExperimentControls({ state }: { state: InvestigationState }) {
 return <>
    <section className="experiment-tools" aria-label="Investigation controls"><h3>Counterfactual investigation</h3><label>Condition<select aria-label="Condition" value={state.intervention?.targetConditionId ?? ''} onChange={e => state.selectCondition(e.target.value)}><option value="">Select a condition</option>{state.workflow?.conditions.filter(c => typeof c.observedValue === 'boolean').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="experiment-actions"><button disabled={!state.intervention || !!state.busy} onClick={state.applyIntervention}>Apply intervention</button><button disabled={!state.failure || !!state.busy} onClick={state.verify}>Test safeguard</button><button disabled={!state.liveEnabled || !!state.busy} onClick={state.investigate}>Run investigation</button></div>
      <p className="scenario-diagnosis">{state.scenario === 'SAFEGUARD' ? `Policy remains violated; the verified execution gate blocks deployment. ${state.result?.outcome ?? ''}` : state.result?.outcome === 'UNSAFE_EXECUTION' ? 'Policy is violated while deployment still executes. Approval is absent from the execution gates.' : state.result?.outcome ?? 'Awaiting evaluation'}</p>
      {!state.liveEnabled && <small>Live Meta investigation is disabled. Manual experiments use the deterministic simulator.</small>}
    </section>
 </>;
}
