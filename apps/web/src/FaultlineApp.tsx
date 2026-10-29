import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useInvestigation, type Scenario } from './network/useInvestigation';
import { NetworkCanvas } from './network/NetworkCanvas';
import { ExperimentControls } from './network/ExperimentControls';
import { Analytics } from './network/Analytics';
import { colors, degrees, networkFor, type Group } from './network/model';
import { motionAt, REFERENCE_DURATION } from './network/motion';

const groupNames = Object.keys(colors) as Group[];
export default function FaultlineApp() {
  const state = useInvestigation();
  const [time, setTime] = useState(() => { const value = Number(new URLSearchParams(location.search).get('motion') ?? 0); return Number.isFinite(value) ? Math.min(REFERENCE_DURATION, Math.max(0, value)) : 0; });
  const [animation, setAnimation] = useState<{ start: number; end: number } | null>(null);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Group | 'All'>('All');
  const [heatmap, setHeatmap] = useState(false);
  const [dialog, setDialog] = useState<'source' | 'replay' | 'records' | 'relationship' | null>(null);
  const [replayFrame, setReplayFrame] = useState(0);
  const [screenScale, setScreenScale] = useState(1);
  const [manualScale, setManualScale] = useState<number | null>(null);
  const [flat, setFlat] = useState(false);
  const [relationship, setRelationship] = useState<string[] | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const stage = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const motion = motionAt(time);
  const tested = state.scenario === 'SAFEGUARD' ? state.verification?.safeguard ?? null : null;
  const network = useMemo(() => state.sceneWorkflow ? networkFor(state.sceneWorkflow, state.result, state.scenario === 'BASELINE' ? null : state.applied, tested) : { nodes: [], links: [] }, [state.sceneWorkflow, state.result, state.scenario, state.applied, tested]);
  const ranking = useMemo(() => degrees(network), [network]);
  const isFocus = motion.focus > .5;
  const largeAnalytics = expanded ?? motion.analytics > .5;
  const selectedNode = network.nodes.find(node => node.id === state.selected);
  const canonical = network.nodes.filter(node => node.id === node.entityId);
  const missing = state.sceneWorkflow?.policyRules.flatMap(rule => rule.requiredConditionIds.filter(id => !state.sceneWorkflow?.steps.find(step => step.id === rule.subjectStepId)?.executionGateIds.includes(id))) ?? [];
  const lanes = [{ name: 'BASELINE' as const, result: state.baseline }, { name: 'COUNTERFACTUAL' as const, result: state.failure }, { name: 'SAFEGUARD' as const, result: state.verification?.repaired ?? null }];
  useEffect(() => {
    const element = stage.current; if (!element) return;
    const resize = new ResizeObserver(([entry]) => { if (entry) setScreenScale(entry.contentRect.width / 750); }); resize.observe(element); return () => resize.disconnect();
  }, []);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => {
    if (!animation) return;
    let frame = 0;
    let started: number | null = null;
    const tick = (now: number) => { started ??= now; const next = Math.min(animation.end, animation.start + (now - started) / 1000); setTime(next); if (next < animation.end) frame = requestAnimationFrame(tick); else setAnimation(null); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [animation]);
  useEffect(() => {
    const element = dialogRef.current; if (!element) return;
    if (dialog && !element.open) element.showModal(); else if (!dialog && element.open) element.close();
  }, [dialog]);
  function play(start: number, end: number, explicit = false) {
    setFlat(false); setManualScale(null); if (start === 0) setExpanded(null);
    if (reducedMotion && !explicit) { setAnimation(null); setTime(end); return; }
    setTime(start); setAnimation({ start, end });
  }
  function focus(id: string) { state.setSelected(id); setExpanded(null); play(47 / 30, 6.95); }
  function overview() { setExpanded(null); play(314 / 30, 17.6); }
  function selectScenario(scenario: Scenario) { state.setScenario(scenario); }
  // The reference camera films a display. Keep the real application plane stable.
  const planeStyle = { '--screen-scale': screenScale, '--analytics-width': isFocus ? largeAnalytics ? 'clamp(420px, 32vw, 620px)' : 'clamp(340px, 26vw, 500px)' : 'clamp(280px, 22vw, 420px)' } as CSSProperties;
  const records = [...state.samples.filter(item => item.id !== state.workflow?.id), ...(state.workflow ? [state.workflow] : [])];
  return <main className="faultline-network-app" aria-label="Faultline workflow explorer">
    <div className="reference-stage" ref={stage} data-motion-time={time.toFixed(3)} data-motion-phase={motion.phase} data-analytics-expanded={largeAnalytics}>
      <div className="screen-space" style={planeStyle}>
        <div className="network-screen">
          <header className="network-topbar"><button className="new-wordmark" aria-label="Network overview" onClick={overview}><span className="new-wordmark-symbol">f</span>faultline</button><label className="workflow-switch"><small>Select workflow</small><select aria-label="Active workflow" value={state.workflow?.id ?? ''} onChange={e => { const next = records.find(item => item.id === e.target.value); if (next) { state.selectWorkflow(next); setTime(0); } }}>{records.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="topbar-actions"><button onClick={() => setDialog('records')}><i className="group-mark"/>{groupNames.length} Groups</button><button onClick={() => setDialog('replay')}><span className="replay-mark">▶</span>Replay</button><button onClick={() => setDialog('source')}>Workflow tools</button><button className="presentation-play" aria-label={animation ? 'Pause presentation' : 'Play presentation'} onClick={() => animation ? setAnimation(null) : play(0, REFERENCE_DURATION, true)}>{animation ? 'Ⅱ' : '▷'}</button></div></header>
          {!isFocus ? <div className="network-filterbar"><label className="network-search"><span>⌕</span><input aria-label="Search workflow records" placeholder="Search workflow, condition or evidence" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="density-control"><small>Zoom</small><input aria-label="Presentation scale" type="range" min=".6" max="1" step=".01" value={manualScale ?? (flat ? 1 : motion.scale)} onChange={e => { setAnimation(null); setFlat(true); setManualScale(Number(e.target.value)); }}/></label><label><small>Records</small><select aria-label="Filter records" value={filter} onChange={e => setFilter(e.target.value as Group | 'All')}><option>All</option>{groupNames.map(name => <option key={name}>{name}</option>)}</select></label><label><small>Scenario</small><select aria-label="Scenario" value={state.scenario} onChange={e => selectScenario(e.target.value as Scenario)}>{lanes.map(lane => <option key={lane.name} disabled={!lane.result} value={lane.name}>{lane.name.toLowerCase()}</option>)}</select></label></div> : <div className="focused-context"><button className="focus-back" aria-label="Return to network overview" onClick={overview}>‹</button><span>{state.workflow?.title}<small>{selectedNode?.name ?? 'Workflow context'}</small></span><div><select aria-label="Scenario" value={state.scenario} onChange={e => selectScenario(e.target.value as Scenario)}>{lanes.map(lane => <option key={lane.name} disabled={!lane.result} value={lane.name}>{lane.name.toLowerCase()}</option>)}</select><button aria-label="Reset perspective" onClick={() => { setAnimation(null); setFlat(value => !value); }}>▣</button></div></div>}
          <div className={`network-body ${isFocus ? 'focused-body' : ''}`}>
            <div className="network-main"><div className="presentation-tabs"><button aria-pressed={!heatmap} onClick={() => setHeatmap(false)}>Network</button><button aria-pressed={heatmap} onClick={() => setHeatmap(true)}>Heatmap</button></div>
              {state.loading && <div className="network-loading" role="status">Loading workflow records</div>}
              {state.error && <div className="network-error" role="alert">{state.error}</div>}
              <NetworkCanvas network={network} selected={state.selected} motion={motion} displayScale={manualScale ?? (flat ? 1 : undefined)} query={query} filter={filter} heatmap={heatmap} onSelect={state.setSelected} onFocus={focus} onRelationship={ids => { setRelationship(ids); setDialog('relationship'); }} />
              <footer className="network-timeline"><button aria-label="Open execution replay" onClick={() => setDialog('replay')}>⌃</button><span>{isFocus ? 'Relationship context' : 'Declared workflow network'}</span><output aria-label="Evaluation outcome" className={`evaluation-outcome outcome-${state.result?.outcome}`}>{state.busy || state.result?.outcome || 'NOT EVALUATED'}</output></footer>
            </div>
            {isFocus ? <Analytics state={state} network={network} onOpenTools={() => setDialog('source')} expanded={largeAnalytics} onExpand={() => { if (largeAnalytics) setExpanded(false); else { setExpanded(true); play(7, 10.45); } }} /> : <aside className="network-directory" aria-label="Relationship ranking directory"><header><h1>Relationship ranking</h1><button aria-label="Open workflow records" onClick={() => setDialog('records')}>☷</button></header><div className="directory-labels"><span>#</span><span>Name</span><span>Links</span></div><div className="directory-rows">{ranking.filter(({ node }) => (filter === 'All' || node.kind === filter) && `${node.name} ${node.detail}`.toLowerCase().includes(query.toLowerCase())).map(({ node, count }, index) => <button className={`directory-record ${state.selected === node.id ? 'selected' : ''}`} key={node.id} onClick={() => focus(node.entityId)} aria-label={`Open record ${node.name}`}><span>{index + 1}</span><strong>{node.name}</strong><b>{count}</b><i style={{ color: colors[node.kind] }}>{node.kind}</i></button>)}</div><small className="directory-disclosure">Workflow records / ranked by declared links</small></aside>}
          </div>
        </div>
      </div>
      <div className="presentation-scrubber"><button aria-label={animation ? 'Pause motion' : 'Play motion sequence'} onClick={() => animation ? setAnimation(null) : play(time >= REFERENCE_DURATION ? 0 : time, REFERENCE_DURATION, true)}>{animation ? 'Pause' : 'Play'}</button><input aria-label="Motion sequence position" type="range" min="0" max={REFERENCE_DURATION} step={1 / 30} value={time} onChange={event => { setAnimation(null); setFlat(false); setExpanded(null); setTime(Number(event.target.value)); }}/><output>{time.toFixed(2)} / {REFERENCE_DURATION.toFixed(2)}</output><button onClick={() => { setAnimation(null); setFlat(true); }}>Flat view</button></div>
    </div>
    <dialog ref={dialogRef} className="workflow-dialog" onCancel={() => setDialog(null)} onClick={event => { if (event.target === event.currentTarget) setDialog(null); }} aria-label={dialog === 'source' ? 'Workflow tools' : dialog === 'replay' ? 'Execution replay' : dialog === 'relationship' ? 'Relationship details' : 'Workflow records'}>
      <header><strong>{dialog === 'source' ? 'Workflow tools' : dialog === 'replay' ? 'Execution replay' : dialog === 'relationship' ? 'Relationship details' : 'Workflow records'}</strong><button aria-label="Close panel" onClick={() => setDialog(null)}>×</button></header>
      {dialog === 'source' && <><ExperimentControls state={state}/><label>Deployment procedure<textarea aria-label="Deployment procedure" value={state.source} onChange={e => state.setSource(e.target.value)}/></label><div className="dialog-actions"><button disabled={!state.liveEnabled || !!state.busy || state.source.length < 30} onClick={state.analyze}>Analyze workflow</button><button disabled={!!state.busy || !state.samples[0]} onClick={() => state.samples[0] && state.selectWorkflow(state.samples[0])}>Load sample</button></div><p>{state.liveEnabled ? 'Meta extraction and investigation are available under the existing spending controls.' : 'Live Meta is disabled. The sample and manual simulator remain available.'}</p><section><h2>Observations</h2>{state.workflow?.conditions.map(c => <label key={c.id} className="observation-edit">{c.name}<select aria-label={`Observed value for ${c.name}`} value={String(c.observedValue)} onChange={e => state.editCondition(c.id, e.target.value === 'null' ? null : e.target.value === 'true')}><option value="true">PASS</option><option value="false">FAIL</option><option value="null">UNKNOWN</option></select></label>)}</section><section><h2>Execution gates</h2>{state.workflow?.steps.map(step => <fieldset key={step.id}><legend>{step.name}</legend>{state.workflow?.conditions.map(c => <label className="gate-checkbox" key={c.id}><input type="checkbox" checked={step.executionGateIds.includes(c.id)} disabled={!!state.busy} onChange={() => state.toggleGate(step.id, c.id)}/>{c.name}</label>)}</fieldset>)}</section><section><h2>Policy requirements</h2>{state.workflow?.policyRules.map(rule => <p key={rule.id}>{rule.description}</p>)}<p className="missing-gate-readout">{missing.length ? `Policy requirements without execution gates: ${missing.map(id => state.workflow?.conditions.find(c => c.id === id)?.name).join(', ')}` : 'All declared policy requirements have execution gates in the current scenario.'}</p></section></>}
      {dialog === 'replay' && <><div className="replay-lanes">{lanes.map(lane => <button key={lane.name} aria-pressed={state.scenario === lane.name} disabled={!lane.result} onClick={() => state.setScenario(lane.name)}>{lane.name}<small>{lane.result?.outcome ?? 'NOT RUN'}</small></button>)}</div><div className="dialog-actions"><button onClick={() => setReplayFrame(0)}>Reset</button><button onClick={() => setReplayFrame(i => Math.max(0, i - 1))}>Step back</button><button onClick={() => setReplayFrame(i => Math.min(state.result?.executionTrace.length ?? 0, i + 1))}>Step forward</button></div><p>EVENT {replayFrame} / {state.result?.executionTrace.length ?? 0}</p>{state.result?.executionTrace.map((event, i) => <button key={`${event.stepId}-${i}`} className="trace-event-row" onClick={() => { setReplayFrame(i + 1); state.setSelected(event.stepId); }}><span>{i + 1}. {event.stepId}</span><strong>{i < replayFrame ? `${event.status}: ${event.reason}` : 'PENDING'}</strong></button>)}<button className="export-certificate" disabled={!state.failure || !!state.busy} onClick={state.exportCertificate}>Export certificate</button></>}
      {dialog === 'relationship' && <section aria-label="Selected relationship path"><p>Declared relationships in the current workflow. A context path is not an execution gate.</p>{relationship?.map(id => { const link = network.links.find(item => item.id === id); if (!link) return <p key={id}>This relationship is absent from the current scenario.</p>; const from = network.nodes.find(node => node.id === link.from); const to = network.nodes.find(node => node.id === link.to); return <article key={id} className="relationship-detail"><h2>{link.relation}</h2><p>{from?.name} → {to?.name}</p><p>{link.gate ? 'Actual execution gate' : link.policy ? 'Policy requirement, independently evaluated' : 'Declared workflow or evidence relationship'}{link.tested ? ' / Verified safeguard' : ''}</p><p>{from?.detail}</p><p>{to?.detail}</p></article>; })}</section>}
      {dialog === 'records' && <><label>Record type<select aria-label="Record type" value={filter} onChange={e => setFilter(e.target.value as Group | 'All')}><option>All</option>{groupNames.map(name => <option key={name}>{name}</option>)}</select></label><p>{records.length} available workflow. Counts reflect actual declared records and evaluated results.</p>{canonical.map(node => <button key={node.id} className="record-list-row" onClick={() => { setDialog(null); focus(node.entityId); }}><i style={{ background: colors[node.kind] }}/><strong>{node.name}</strong><span>{node.kind}</span></button>)}</>}
      {state.error && <p role="alert">{state.error}</p>}{state.busy && <button onClick={state.cancel}>Cancel {state.busy}</button>}
    </dialog>
  </main>;
}
