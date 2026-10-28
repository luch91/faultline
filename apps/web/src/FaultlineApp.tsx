import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Workflow, Intervention, EvaluationResult } from '@faultline/contracts';
import { InspectionPanel } from './components/InspectionPanel';
import { WorkflowMap } from './scene/WorkflowMap';
import { WorkflowGraph } from './scene/WorkflowGraph';
import { FaultlineAtlas } from './scene/FaultlineAtlas';
import type { CameraState } from './scene/CameraDirector';

const SpatialScene = lazy(() => import('./SpatialScene'));
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
type Investigation = { investigationId?: string; baseline: EvaluationResult; intervention: Intervention; failure: EvaluationResult; verification: { repaired: EvaluationResult; safeguard: { stepId: string; conditionId: string }; resolved: boolean } | null; trace: Array<{ id: string; tool: string; status: string; arguments: unknown; result: unknown }>; model: { id: string | null; usage: unknown } };
const API = import.meta.env.VITE_API_URL || 'http://localhost:8787';
async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let session = sessionStorage.getItem('faultline-session');
  if (!session) { session = crypto.randomUUID(); sessionStorage.setItem('faultline-session', session); }
  const response = await fetch(`${API}${path}`, { method: body ? 'POST' : 'GET', headers: { 'X-Faultline-Session': session, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed: ${response.status}`);
  return result as T;
}

export default function FaultlineApp() {
  const [tab, setTab] = useState<'ATLAS' | 'DESIGN' | 'EXPERIMENT' | 'REPLAY'>('ATLAS');
  const [lastInvestigationTab, setLastInvestigationTab] = useState<'DESIGN' | 'EXPERIMENT'>('DESIGN');
  const [samples, setSamples] = useState<Workflow[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [atlasSelected, setAtlasSelected] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [appliedIntervention, setAppliedIntervention] = useState<Intervention | null>(null);
  const [baseline, setBaseline] = useState<EvaluationResult | null>(null);
  const [failure, setFailure] = useState<EvaluationResult | null>(null);
  const [verification, setVerification] = useState<Investigation['verification']>(null);
  const [trace, setTrace] = useState<Investigation['trace']>([]);
  const [model, setModel] = useState<Investigation['model'] | null>(null);
  const [investigationId, setInvestigationId] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [frame, setFrame] = useState(0);
  const [replayLane, setReplayLane] = useState<'BASELINE' | 'COUNTERFACTUAL' | 'SAFEGUARD'>('COUNTERFACTUAL');
  const [scenarioView, setScenarioView] = useState<'BASELINE' | 'COUNTERFACTUAL' | 'SAFEGUARD'>('BASELINE');
  const [cameraState, setCameraState] = useState<CameraState>('INSTALLATION');
  const [zoom, setZoom] = useState(() => matchMedia('(max-width: 680px)').matches ? 1.45 : 1);
  const [sceneMode, setSceneMode] = useState<'GRAPH' | '3D' | 'LIST'>('GRAPH');
  const [slow3D, setSlow3D] = useState(false);
  const [controller, setController] = useState<AbortController | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const m = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReducedMotion(m.matches); m.addEventListener('change', change); return () => m.removeEventListener('change', change); }, []);
  useEffect(() => {
    if (cameraState !== 'APPROACH' && cameraState !== 'RETURN') return;
    const next: CameraState = cameraState === 'APPROACH' ? 'INSTALLATION' : 'OVERVIEW';
    const timer = window.setTimeout(() => setCameraState(current => current === cameraState ? next : current), reducedMotion ? 0 : cameraState === 'APPROACH' ? 1050 : 1200);
    return () => window.clearTimeout(timer);
  }, [cameraState, reducedMotion]);

  async function run<T>(label: string, fn: (signal: AbortSignal) => Promise<T>, done: (result: T) => void) {
    const ac = new AbortController(); setController(ac); setBusy(label); setError('');
    try { done(await fn(ac.signal)); } catch (e) { if (!ac.signal.aborted) setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setBusy(''); setController(null); }
  }
  function setGraph(g: Workflow) {
    setWorkflow(g); setText(g.sourceDocuments[0]?.text ?? ''); setSelected(null); setBaseline(null); setFrame(0); setAppliedIntervention(null); setIntervention(null); setFailure(null); setVerification(null); setTrace([]); setModel(null); setInvestigationId(null); setCameraState('INSTALLATION'); setScenarioView('BASELINE');
    run('Evaluating baseline', s => call<{ result: EvaluationResult }>('/api/v1/experiments/run', { workflow: g }, s), x => setBaseline(x.result));
  }
  useEffect(() => { call<{ samples: Workflow[] }>('/api/v1/samples').then(x => { setSamples(x.samples); if (x.samples[0]) { setAtlasSelected(x.samples[0].id); setGraph(x.samples[0]); } }).catch(e => setError(e.message)).finally(() => setSamplesLoading(false)); }, []);
  useEffect(() => { call<{ liveModelEnabled: boolean }>('/api/v1/budget').then(x => setLiveEnabled(x.liveModelEnabled)).catch(() => setLiveEnabled(false)); }, []);
  function editCondition(id: string, value: boolean | null) { if (workflow) setGraph({ ...workflow, conditions: workflow.conditions.map(c => c.id === id ? { ...c, observedValue: value } : c) }); }
  function toggleGate(stepId: string, conditionId: string) { if (workflow) setGraph({ ...workflow, steps: workflow.steps.map(s => s.id === stepId ? { ...s, executionGateIds: s.executionGateIds.includes(conditionId) ? s.executionGateIds.filter(id => id !== conditionId) : [...s.executionGateIds, conditionId] } : s) }); }
  function analyze() { run('Extracting workflow with Muse Spark', s => call<{ workflow: Workflow; model: Investigation['model'] }>('/api/v1/workflows/extract', { text }, s), x => { setGraph(x.workflow); setModel(x.model); }); }
  function applyIntervention() { if (!workflow || !intervention) return; run('Evaluating intervention', s => call<{ result: EvaluationResult }>('/api/v1/experiments/run', { workflow, intervention }, s), x => { setAppliedIntervention(intervention); setTrace([]); setModel(null); setInvestigationId(null); setFailure(x.result); setVerification(null); setLastInvestigationTab('EXPERIMENT'); setTab('EXPERIMENT'); setCameraState('COUNTERFACTUAL'); setScenarioView('COUNTERFACTUAL'); }); }
  function investigate() { if (!workflow) return; run('Meta investigator calling simulator', s => call<Investigation>('/api/v1/investigations', { workflow }, s), x => { setBaseline(x.baseline); setIntervention(x.intervention); setAppliedIntervention(x.intervention); setFailure(x.failure); setVerification(x.verification); setTrace(x.trace); setModel(x.model); setInvestigationId(x.investigationId ?? null); setLastInvestigationTab('EXPERIMENT'); setTab('EXPERIMENT'); setCameraState('COUNTERFACTUAL'); setScenarioView('COUNTERFACTUAL'); }); }
  function verify() { if (!workflow || !appliedIntervention) return; const intervention = appliedIntervention; const stepId = workflow.policyRules.find(r => r.requiredConditionIds.includes(intervention.targetConditionId))?.subjectStepId; if (!stepId) return; run('Testing safeguard', s => call<{ repaired: EvaluationResult; resolved: boolean }>('/api/v1/safeguards/verify', { workflow, intervention, stepId, conditionId: intervention.targetConditionId }, s), x => { setVerification({ repaired: x.repaired, resolved: x.resolved, safeguard: { stepId, conditionId: intervention.targetConditionId } }); setCameraState('SAFEGUARD'); setScenarioView('SAFEGUARD'); }); }
  async function exportTrace() { if (!workflow || !baseline || !failure || !appliedIntervention) return; try { const report = await call<unknown>('/api/v1/reports/export', { workflow, investigation: { investigationId: investigationId ?? undefined, baseline, intervention: appliedIntervention, failure, verification, trace, model } }); const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'faultline-certificate.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) { setError(e instanceof Error ? e.message : 'Certificate export failed'); } }
  const lanes = [{ name: 'BASELINE', result: baseline }, { name: 'COUNTERFACTUAL', result: failure }, { name: 'SAFEGUARD', result: verification?.repaired ?? null }];
  const maxFrame = Math.max(0, ...lanes.map(l => l.result?.executionTrace.length ?? 0));
  const activeView = tab === 'REPLAY' ? replayLane : scenarioView;
  const activeResult = lanes.find(l => l.name === activeView)?.result ?? baseline;
  const repairedStep = verification?.repaired.stepResults.find(item => item.stepId === verification.safeguard.stepId);
  const repairedPolicy = verification?.repaired.policyResults.find(item => item.state === 'VIOLATED')?.state ?? verification?.repaired.policyResults[0]?.state ?? 'UNKNOWN';
  const repairedExecution = repairedStep?.eligibility === 'UNKNOWN' ? 'unknown' : repairedStep?.executes ? 'eligible' : 'blocked';
  const safeguardDiagnosis = verification ? `Policy remains ${repairedPolicy}; the tested execution path is ${repairedExecution}. Outcome: ${verification.repaired.outcome}.` : '';
  const selectedCondition = workflow?.conditions.find(c => c.id === selected);
  const selectedStep = workflow?.steps.find(s => s.id === selected);
  const entities = useMemo(() => workflow ? [...workflow.conditions, ...workflow.steps] : [], [workflow]);
  const outcome = activeResult?.outcome ?? 'AWAITING EVALUATION';
  const scenarioIntervention = activeView === 'BASELINE' ? null : appliedIntervention;
  const testedGate = activeView === 'SAFEGUARD' ? verification?.safeguard ?? null : null;
  const sceneWorkflow = useMemo(() => {
    if (!workflow || activeView !== 'SAFEGUARD' || !verification) return workflow;
    const { stepId, conditionId } = verification.safeguard;
    return { ...workflow, steps: workflow.steps.map(step => step.id === stepId && !step.executionGateIds.includes(conditionId) ? { ...step, executionGateIds: [...step.executionGateIds, conditionId] } : step) };
  }, [workflow, activeView, verification]);
  function selectModule(id: string) { setSelected(id); if (sceneMode === '3D') setCameraState('MODULE_FOCUS'); }
  function selectScenario(name: 'BASELINE' | 'COUNTERFACTUAL' | 'SAFEGUARD') { setScenarioView(name); setCameraState(name === 'SAFEGUARD' ? 'SAFEGUARD' : name === 'COUNTERFACTUAL' ? 'COUNTERFACTUAL' : 'INSTALLATION'); }
  const availableWorkflows = workflow ? [...samples.filter(sample => sample.id !== workflow.id), workflow] : samples;
  const fallback = <WorkflowMap workflow={sceneWorkflow} result={activeResult} intervention={scenarioIntervention} selected={selected} testedGate={testedGate} onSelect={selectModule} />;
  const unavailable = <><div className="slow-scene" role="status">3D is unavailable. The dependency list remains interactive. <button onClick={() => setSceneMode('GRAPH')}>Open graph</button></div>{fallback}</>;
  function openAtlasWorkflow(next: Workflow) { if (workflow?.id !== next.id) setGraph(next); setAtlasSelected(next.id); setTab(lastInvestigationTab); }
  function openInvestigationTab(next: 'DESIGN' | 'EXPERIMENT') { setLastInvestigationTab(next); setTab(next); }
  function selectCondition(id: string) { if (!id) { setIntervention(null); return; } const c = workflow?.conditions.find(x => x.id === id); if (c) setIntervention({ id: `user-${c.id}`, targetConditionId: c.id, originalValue: c.observedValue, replacementValue: c.observedValue === true ? false : true, reason: 'Manual counterfactual', proposedBy: 'USER', validated: true }); }
  return <div className="app visual-app">
    <header className="topbar"><div className="brand"><span className="brand-mark">F/</span> FAULTLINE <span className="version">EXECUTION LAB</span></div><div className="top-context">{workflow?.title ?? 'WORKFLOW UNLOADED'} <span className="header-status"><span className="status-dot" /> {busy || 'SIMULATOR READY'}</span></div></header>
    <div className="visual-workspace"><nav className="icon-rail" aria-label="Workspace">{(['ATLAS', 'INVESTIGATION', 'REPLAY'] as const).map((name, i) => <button key={name} className={(name === 'INVESTIGATION' ? tab === 'DESIGN' || tab === 'EXPERIMENT' : tab === name) ? 'active' : ''} title={name} aria-label={name} onClick={() => setTab(name === 'INVESTIGATION' ? lastInvestigationTab : name)}><span>0{i + 1}</span><b>{name.slice(0, 1)}</b></button>)}<div className="rail-monogram">FL</div></nav>
      {tab === 'ATLAS' ? samplesLoading ? <main className="atlas-initial-loading" role="status">Loading workflow topology</main> : <FaultlineAtlas workflows={availableWorkflows} selectedWorkflowId={atlasSelected} selectedEntityId={selected} activeWorkflowId={workflow?.id ?? null} baseline={baseline} counterfactual={failure} safeguard={verification?.repaired ?? null} completedInvestigations={investigationId ? 1 : 0} error={error} onSelect={setAtlasSelected} onSelectEntity={setSelected} onOpen={openAtlasWorkflow} /> : <>
      <aside className="diagnostic"><div className="diagnostic-title"><span>DEPLOYMENT / {tab}</span><h1>{workflow?.title ?? 'Select a workflow'}</h1><small>Decision model / Version 1</small></div>
        {tab !== 'REPLAY' && <div className="investigation-tabs" aria-label="Investigation tools"><button aria-pressed={tab === 'DESIGN'} onClick={() => openInvestigationTab('DESIGN')}>DESIGN</button><button aria-pressed={tab === 'EXPERIMENT'} onClick={() => openInvestigationTab('EXPERIMENT')}>EXPERIMENT</button></div>}
        {tab === 'DESIGN' && <div className="diagnostic-scroll"><section className="diag-section"><div className="section-head">SOURCE INPUT <span>01</span></div><label htmlFor="source">Deployment procedure</label><textarea id="source" value={text} onChange={e => setText(e.target.value)} rows={7} /><div className="compact-actions"><button onClick={analyze} disabled={!liveEnabled || !!busy || text.length < 30}>Analyze workflow</button><button className="ghost" onClick={() => call<{ samples: Workflow[] }>('/api/v1/samples').then(x => x.samples[0] && setGraph(x.samples[0]))}>Load sample</button></div>{!liveEnabled && <p className="diag-copy inference-note">Live extraction is disabled on this preview. The sample remains available for deterministic testing.</p>}</section>
          <section className="diag-section"><div className="section-head">DECLARED POLICY <span>{workflow?.policyRules.length ?? 0}</span></div>{workflow?.policyRules.map(r => <button className="policy-entry" key={r.id} onClick={() => selectModule(r.subjectStepId)}><span className="small-dot amber" /><span>{r.description}<small>{r.origin} / {r.requiredConditionIds.join(', ')}</small></span></button>)}</section>
          <section className="diag-section"><div className="section-head">OBSERVATIONS <span>{workflow?.conditions.length ?? 0}</span></div>{workflow?.conditions.map(c => <div className="condition-row" key={c.id}><span>{c.name}</span><select aria-label={`Observed value for ${c.name}`} value={String(c.observedValue)} onChange={e => editCondition(c.id, e.target.value === 'null' ? null : e.target.value === 'true')}><option value="true">PASS</option><option value="false">FAIL</option><option value="null">UNKNOWN</option></select></div>)}</section>
          <section className="diag-section"><div className="section-head">EXECUTION GATES</div>{workflow?.steps.map(s => <div key={s.id} className="gate-row"><strong>{s.name}</strong>{workflow.conditions.map(c => <label key={c.id}><input type="checkbox" checked={s.executionGateIds.includes(c.id)} onChange={() => toggleGate(s.id, c.id)} />{c.name}</label>)}</div>)}</section></div>}
        {tab === 'EXPERIMENT' && <div className="diagnostic-scroll"><section className="diag-section"><div className="section-head">ROOT CAUSE ANALYSIS</div><p className="diag-copy">{activeView === 'SAFEGUARD' && verification ? safeguardDiagnosis : failure?.outcome === 'UNSAFE_EXECUTION' ? `Rule ${failure.firstViolation} is violated while execution remains eligible.` : failure ? `The intervention evaluated as ${failure.outcome}.` : 'Select a condition and run a counterfactual.'}</p></section><section className="diag-section"><div className="section-head">INTERVENTION</div><label htmlFor="condition">Condition</label><select id="condition" value={intervention?.targetConditionId ?? ''} onChange={e => selectCondition(e.target.value)}><option value="">Select a condition</option>{workflow?.conditions.filter(c => typeof c.observedValue === 'boolean').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{intervention && <div className="delta">{String(intervention.originalValue)} <b>→</b> {String(intervention.replacementValue)}</div>}<div className="compact-actions vertical"><button onClick={investigate} disabled={!liveEnabled || !workflow || !!busy}>Run investigation</button><button className="ghost" onClick={applyIntervention} disabled={!intervention || !!busy}>Apply intervention</button><button className="ghost" onClick={verify} disabled={!failure || !appliedIntervention || !!busy}>Test safeguard</button></div>{!liveEnabled && <p className="diag-copy inference-note">Live investigation is disabled on this preview. Manual experiments use the deterministic simulator.</p>}</section><section className="diag-section"><div className="section-head">ACTUAL TOOL ACTIONS <span>{trace.length}</span></div>{trace.length ? trace.map(t => <details key={t.id} className="trace"><summary>{t.tool} <span>{t.status}</span></summary><pre>{JSON.stringify(t.result, null, 2)}</pre></details>) : <p className="diag-copy">No agent tool calls recorded.</p>}{model?.id && <small>Meta response ID: {model.id}</small>}</section></div>}
        {tab === 'REPLAY' && <div className="diagnostic-scroll"><section className="diag-section"><div className="section-head">EXECUTION RECORDER</div><p className="diag-copy">Compare each simulator trace at the same logical step. Select an event to inspect the actual decision.</p><div className="replay-controls"><button className="ghost" onClick={() => setFrame(0)}>Reset</button><button className="ghost" onClick={() => setFrame(Math.max(0, frame - 1))}>Step back</button><button onClick={() => setFrame(Math.min(maxFrame, frame + 1))}>Step forward</button></div><div className="event-count">EVENT {String(frame).padStart(2, '0')} / {String(maxFrame).padStart(2, '0')}</div></section>{lanes.map(l => <section className="diag-section" key={l.name}><button className={`lane-selector ${replayLane === l.name ? 'active' : ''}`} onClick={() => setReplayLane(l.name as typeof replayLane)}>{l.name}</button><strong className={l.result?.outcome === 'UNSAFE_EXECUTION' ? 'unsafe' : 'safe'}>{l.result?.outcome ?? 'NOT RUN'}</strong>{l.result?.executionTrace.map((ev, i) => <button key={`${ev.stepId}-${i}`} className={`replay-event ${i < frame ? 'visible' : ''}`} onClick={() => { setFrame(i + 1); setSelected(ev.stepId); setReplayLane(l.name as typeof replayLane); }}><span>{String(i + 1).padStart(2, '0')} / {ev.stepId}</span><small>{i < frame ? `${ev.status}: ${ev.reason}` : 'PENDING'}</small></button>)}</section>)}<button className="export-control" onClick={exportTrace} disabled={!failure}>Export certificate</button></div>}
        <div className="diagnostic-footer">Faultline evaluates declared workflow rules and hypothetical conditions. It does not execute deployments or guarantee real-world safety.</div>
      </aside>
      <main className="visual-main"><div className="scene-header"><div><span className="breadcrumb">WORKFLOW / {tab} / {selected ?? 'OVERVIEW'}</span><h2>{selectedCondition?.name ?? selectedStep?.name ?? 'Execution Lattice'}</h2></div><div className={`outcome-chip ${outcome === 'UNSAFE_EXECUTION' ? 'danger' : ''}`}>{outcome}</div></div>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="scene-shell"><div className="scene-control top">{sceneMode === '3D' && <><button onClick={() => setCameraState('RETURN')}>Overview</button><button onClick={() => setCameraState('APPROACH')}>Focus</button><button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(z => Math.max(.7, Math.round((z - .15) * 100) / 100))}>+</button><button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(z => Math.min(1.6, Math.round((z + .15) * 100) / 100))}>-</button></>}<button aria-pressed={sceneMode === 'GRAPH'} onClick={() => setSceneMode('GRAPH')}>Graph</button><button aria-pressed={sceneMode === '3D'} onClick={() => setSceneMode('3D')}>3D</button><button aria-pressed={sceneMode === 'LIST'} onClick={() => setSceneMode('LIST')}>Dependency list</button>{controller && <button onClick={() => controller.abort()}>Cancel</button>}</div>
          {tab !== 'REPLAY' && <div className="scenario-control" aria-label="Scenario view">{lanes.map(l => <button key={l.name} aria-label={`Show ${l.name.toLowerCase()} scenario`} aria-pressed={scenarioView === l.name} disabled={!l.result} onClick={() => selectScenario(l.name as typeof scenarioView)}>{l.name}</button>)}</div>}
          {slow3D && sceneMode === '3D' && <div className="slow-scene" role="status">3D rendering is slow on this device. <button onClick={() => setSceneMode('GRAPH')}>Open graph</button></div>}
          {sceneMode === '3D' && workflow ? <SceneBoundary fallback={unavailable}><Suspense fallback={<div className="scene-loading">Loading execution lattice</div>}><SpatialScene workflow={sceneWorkflow ?? workflow} result={activeResult} intervention={scenarioIntervention} selected={selected} testedGate={testedGate} onSelect={selectModule} cameraState={cameraState} reducedMotion={reducedMotion} zoom={zoom} onSlow={() => setSlow3D(true)} /></Suspense></SceneBoundary> : sceneMode === 'GRAPH' ? <WorkflowGraph workflow={sceneWorkflow} result={activeResult} intervention={scenarioIntervention} selected={selected} testedGate={testedGate} onSelect={selectModule} /> : fallback}
          <div className="scene-legend"><span><i className="blue" /> EXECUTION</span><span><i className="purple" /> POLICY</span><span><i className="teal" /> SATISFIED</span><span><i className="coral" /> VIOLATED</span><span><i className="amber" /> UNKNOWN</span></div>
          <InspectionPanel workflow={sceneWorkflow} result={activeResult} intervention={scenarioIntervention} selected={selected} activeView={activeView} verification={verification} canVerify={tab === 'EXPERIMENT' && failure?.outcome === 'UNSAFE_EXECUTION' && !verification} onVerify={verify} busy={!!busy} />
        </div>
        <div className="bottom-deck"><div className="module-strip"><div className="section-head">SYSTEM MODULES <span>{entities.length}</span></div><div className="module-items">{entities.map((e, i) => <button key={e.id} className={selected === e.id ? 'selected' : ''} onClick={() => selectModule(e.id)}><span>{String(i + 1).padStart(2, '0')}</span>{e.name}</button>)}</div></div><div className="timeline-strip"><div className="section-head">EVALUATION / TRACE</div><div className="timeline-grid">{lanes.map(l => <div key={l.name}><small>{l.name}</small><strong className={l.result?.outcome === 'UNSAFE_EXECUTION' ? 'unsafe' : 'safe'}>{l.result?.outcome ?? 'NOT RUN'}</strong><span className="trace-event">{l.result?.executionTrace[0]?.status ?? 'AWAITING TRACE'}</span></div>)}</div></div></div>
      </main>
      </>}
    </div>
  </div>;
}
