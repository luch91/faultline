import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import type { EvaluationResult, Workflow } from '@faultline/contracts';
import type { AtlasPoint, AtlasRoute, AtlasEvidence } from './AtlasScene';

const AtlasScene = lazy(() => import('./AtlasScene'));
class AtlasBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

type Props = {
  workflows: Workflow[];
  selectedWorkflowId: string | null;
  selectedEntityId: string | null;
  activeWorkflowId: string | null;
  baseline: EvaluationResult | null;
  counterfactual: EvaluationResult | null;
  safeguard: EvaluationResult | null;
  completedInvestigations: number;
  error: string;
  onSelect: (id: string) => void;
  onSelectEntity: (id: string) => void;
  onOpen: (workflow: Workflow) => void;
};

type Point = AtlasPoint;
type Route = AtlasRoute;

function pointsFor(workflow: Workflow, counterfactual: EvaluationResult | null, safeguard: EvaluationResult | null): Point[] {
  const unsafe = counterfactual?.outcome === 'UNSAFE_EXECUTION';
  const conditions = workflow.conditions.map((condition, index) => ({ id: condition.id, name: condition.name, kind: 'CONDITION', x: 145 + (index % 4) * 160, y: 255 + ([70, -55, 100, -15][index % 4] ?? 0) + Math.floor(index / 4) * 95, color: unsafe && counterfactual?.affectedNodeIds.includes(condition.id) ? '#f07858' : '#6aafe9' }));
  const rules = workflow.policyRules.map((rule, index) => ({ id: rule.id, name: rule.description, kind: 'POLICY', x: 450 + index * 75, y: 420 - index * 60, color: unsafe ? '#a888cb' : '#8476b9' }));
  const steps = workflow.steps.map((step, index) => ({ id: step.id, name: step.name, kind: 'EXECUTION', x: 690 + index * 55, y: 315 + index * 70, color: safeguard?.outcome === 'SAFE_BLOCK' && safeguard.stepResults.find(result => result.stepId === step.id)?.eligibility === 'VIOLATED' ? '#51cbbb' : unsafe && counterfactual?.affectedNodeIds.includes(step.id) ? '#f07858' : '#75b6ef' }));
  return [...conditions, ...rules, ...steps];
}

function AtlasMarker({ point, selected, onSelect }: { point: Point; selected: boolean; onSelect: () => void }) {
  return <g className={`atlas-entity ${selected ? 'selected' : ''}`} role="button" tabIndex={0} aria-label={`Select ${point.kind.toLowerCase()} ${point.name}`} onClick={onSelect} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }}>
    <circle cx={point.x} cy={point.y - 8} r="28" fill="transparent" />
    <path d={`M${point.x - 20} ${point.y}a20 20 0 0 1 40 0`} fill="none" stroke={point.color} strokeWidth={selected ? 4 : 2.5} opacity={selected ? 1 : .85} />
    <circle cx={point.x} cy={point.y} r={selected ? 5 : 3} fill={point.color} />
    <path d={`M${point.x} ${point.y + 3}v11`} stroke={point.color} strokeWidth="1" opacity=".7" />
    {selected && <><rect x={point.x - 50} y={point.y - 53} width="100" height="27" fill="#0b1a2d" stroke="#53799a" /><text x={point.x} y={point.y - 36} textAnchor="middle" fill="#dcecf8" fontSize="10">{point.name.length > 17 ? `${point.name.slice(0, 16)}...` : point.name}</text></>}
  </g>;
}

export function FaultlineAtlas({ workflows, selectedWorkflowId, selectedEntityId, activeWorkflowId, baseline, counterfactual, safeguard, completedInvestigations, error, onSelect, onSelectEntity, onOpen }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'UNSAFE' | 'SAFE BLOCK'>('ALL');
  const [mapMode, setMapMode] = useState<'3D' | '2D'>(() => {
    if (matchMedia('(max-width: 680px)').matches) return '2D';
    try { const canvas = document.createElement('canvas'); return canvas.getContext('webgl2') || canvas.getContext('webgl') ? '3D' : '2D'; } catch { return '2D'; }
  });
  const [sceneReady, setSceneReady] = useState(false);
  const visible = workflows.filter(workflow => filter === 'ALL' || (workflow.id === activeWorkflowId && (filter === 'UNSAFE' ? counterfactual?.outcome === 'UNSAFE_EXECUTION' : safeguard?.outcome === 'SAFE_BLOCK')));
  const selected = workflows.find(workflow => workflow.id === selectedWorkflowId) ?? null;
  const points = selected ? pointsFor(selected, counterfactual, safeguard) : [];
  const byId = new Map(points.map(point => [point.id, point]));
  const highlighted = points.find(point => point.id === selectedEntityId);
  const entityCount = workflows.reduce((total, workflow) => total + workflow.conditions.length + workflow.policyRules.length + workflow.steps.length, 0);
  const routes: Route[] = [];
  if (selected) {
    selected.policyRules.forEach(rule => {
      const target = byId.get(rule.id);
      if (!target) return;
      rule.requiredConditionIds.forEach(id => { const from = byId.get(id); if (from) routes.push({ id: `policy-${id}-${rule.id}`, from, to: target, color: counterfactual?.outcome === 'UNSAFE_EXECUTION' && counterfactual.affectedNodeIds.includes(id) ? '#d77b70' : '#8d78b5' }); });
      const step = byId.get(rule.subjectStepId);
      if (step) routes.push({ id: `scope-${rule.id}`, from: target, to: step, color: '#8d78b5', dashed: true });
    });
    selected.steps.forEach(step => {
      const target = byId.get(step.id);
      if (!target) return;
      step.executionGateIds.forEach(id => { const from = byId.get(id); if (from) routes.push({ id: `gate-${id}-${step.id}`, from, to: target, color: '#71aee5' }); });
      step.dependsOn.forEach(id => { const from = byId.get(id); if (from) routes.push({ id: `dependency-${id}-${step.id}`, from, to: target, color: '#71aee5' }); });
    });
  }
  const routePoint = (route: Route, t: number) => {
    const controlX = (route.from.x + route.to.x) / 2;
    const controlY = Math.min(route.from.y, route.to.y) - 105;
    const reverse = 1 - t;
    return { x: reverse * reverse * route.from.x + 2 * reverse * t * controlX + t * t * route.to.x, y: reverse * reverse * route.from.y + 2 * reverse * t * controlY + t * t * route.to.y };
  };
  const evidence: AtlasEvidence[] = selected ? [...selected.conditions, ...selected.policyRules, ...selected.steps]
    .flatMap((entity, index) => entity.sourceSpans.map((span, spanIndex) => {
      const owner = byId.get(entity.id);
      return owner ? { id: `${entity.id}-${span.startOffset}-${spanIndex}`, x: owner.x + 24 + spanIndex * 13, y: owner.y - 45 - (index % 2) * 12 } : null;
    }))
    .filter((item): item is AtlasEvidence => item !== null) : [];
  return <main className="atlas" aria-label="Faultline Atlas">
    <aside className="atlas-intelligence">
      <div className="atlas-kicker">FAULTLINE / TOPOLOGY</div>
      <div className="atlas-tabs"><button aria-pressed="true">Overview</button><button onClick={() => selected && onOpen(selected)}>Investigation</button></div>
      <div className="atlas-gauges"><div className="atlas-gauge"><span className="gauge-arc" /><strong>{workflows.length}</strong><small>WORKFLOWS</small></div><div className="atlas-gauge"><span className="gauge-arc" /><strong>{entityCount}</strong><small>DECLARED ENTITIES</small></div></div>
      <div className="atlas-statline"><span>Completed investigations</span><strong>{completedInvestigations}</strong></div>
      <div className="atlas-statline"><span>Unsafe outcomes</span><strong>{counterfactual?.outcome === 'UNSAFE_EXECUTION' ? 1 : 0}</strong></div>
      <div className="atlas-statline"><span>Safe blocks</span><strong>{safeguard?.outcome === 'SAFE_BLOCK' ? 1 : 0}</strong></div>
      <div className="atlas-statline"><span>Verified safeguards</span><strong>{safeguard?.outcome === 'SAFE_BLOCK' ? 1 : 0}</strong></div>
      <div className="atlas-analysis"><div className="section-head">DECLARED RELATIONSHIPS</div><div className="atlas-bar-row"><span>Policy requirements</span><strong>{selected?.policyRules.reduce((total, rule) => total + rule.requiredConditionIds.length, 0) ?? 0}</strong><i style={{ width: `${Math.min(100, (selected?.policyRules.reduce((total, rule) => total + rule.requiredConditionIds.length, 0) ?? 0) * 24)}%` }} /></div><div className="atlas-bar-row"><span>Execution gates</span><strong>{selected?.steps.reduce((total, step) => total + step.executionGateIds.length, 0) ?? 0}</strong><i className="execution" style={{ width: `${Math.min(100, (selected?.steps.reduce((total, step) => total + step.executionGateIds.length, 0) ?? 0) * 24)}%` }} /></div><div className="atlas-outcomes"><div className="section-head">EVALUATED OUTCOMES</div><span>BASELINE <strong>{baseline?.outcome ?? 'NOT RUN'}</strong></span><span>CHANGE <strong>{counterfactual?.outcome ?? 'NOT RUN'}</strong></span><span>REPAIR <strong>{safeguard?.outcome ?? 'NOT RUN'}</strong></span></div></div>
      <div className="section-head">FILTER</div>
      <div className="atlas-filters">{(['ALL', 'UNSAFE', 'SAFE BLOCK'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <small className="atlas-disclosure">Counts reflect this browser session. The loaded sample is demonstration data.</small>
      {selected && visible.some(item => item.id === selected.id) && <div className="atlas-selection"><div className="section-head">SELECTED WORKFLOW</div><strong>{selected.title}</strong>{selected.id === activeWorkflowId && <small>BASELINE: {baseline?.outcome ?? 'NOT EVALUATED'}<br />COUNTERFACTUAL: {counterfactual?.outcome ?? 'NOT RUN'}<br />SAFEGUARD: {safeguard?.outcome ?? 'NOT RUN'}</small>}<button onClick={() => onOpen(selected)}>Open investigation</button></div>}
    </aside>
    <section className="atlas-field" aria-label="Workflow topology overview">
      {error && <div className="atlas-alert" role="alert">{error}</div>}
      <div className="atlas-field-head"><span>ABSTRACT WORKFLOW TOPOLOGY</span><span>{visible.length} WORKFLOW{visible.length === 1 ? '' : 'S'} <button className="atlas-map-toggle" onClick={() => { setSceneReady(false); setMapMode(value => value === '3D' ? '2D' : '3D'); }}>{mapMode === '3D' ? '2D MAP' : '3D MAP'}</button></span></div>
      {selected && visible.some(item => item.id === selected.id) ? <div className="atlas-visual">
        {mapMode === '3D' && <AtlasBoundary onFailure={() => setMapMode('2D')}><Suspense fallback={null}><AtlasScene points={points} routes={routes} evidence={evidence} selected={selectedEntityId} onSelect={onSelectEntity} onReady={() => setSceneReady(true)} onFailure={() => setMapMode('2D')} /></Suspense></AtlasBoundary>}
        {mapMode === '3D' && !sceneReady && <div className="atlas-loading" role="status">Loading spatial topology</div>}
        <svg className={mapMode === '3D' ? 'atlas-svg-hidden' : ''} viewBox="0 0 900 590" role="img" aria-label="Declared workflow conditions, policy, and execution topology">
        <g fill="none" strokeLinecap="round">{routes.map(route => { const controlX = (route.from.x + route.to.x) / 2; const controlY = Math.min(route.from.y, route.to.y) - 105; const seed = [...route.id].reduce((sum, character) => sum + character.charCodeAt(0), 0); return <g key={route.id}><path d={`M${route.from.x} ${route.from.y} Q${controlX} ${controlY} ${route.to.x} ${route.to.y}`} stroke={route.color} strokeWidth={route.dashed ? .9 : 1.2} strokeDasharray={route.dashed ? '4 5' : undefined} opacity={route.dashed ? .22 : .25} />{!route.dashed && [0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88, 0.96].map((t, index) => { const point = routePoint(route, t); const x = point.x + Math.sin(seed * .13 + index * 2.3) * 15; const y = point.y + Math.cos(seed * .19 + index * 1.7) * 21; const radius = index % 5 === 0 ? 11 : 7; return <path key={t} d={`M${x - radius} ${y}a${radius} ${radius} 0 0 1 ${radius * 2} 0`} stroke={route.color} strokeWidth="1.5" opacity=".75" />; })}</g>; })}</g>
        <g className="atlas-evidence" aria-label="Source evidence positions">{evidence.map(point => <g key={point.id}><path d={`M${point.x} ${point.y - 19}l-7 19h14Z`} fill="#57bbc3" opacity=".55" /><circle cx={point.x} cy={point.y + 2} r="2" fill="#74cbd0" opacity=".9" /></g>)}</g>
        {points.map(point => <AtlasMarker key={point.id} point={point} selected={selectedEntityId === point.id} onSelect={() => onSelectEntity(point.id)} />)}
        <g className="atlas-workflow-marker" role="button" tabIndex={0} aria-label={`Select workflow ${selected.title}`} onClick={() => onSelect(selected.id)} onDoubleClick={() => onOpen(selected)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selected.id); } }}>
          <path d="M363 480a42 42 0 0 1 84 0" fill="none" stroke="#7bb6ee" strokeWidth="4" />
          <circle cx="405" cy="480" r="5" fill="#92c8f7" />
          <text x="405" y="505" textAnchor="middle" fill="#deeffc" fontSize="11">{selected.title}</text>
        </g>
      </svg></div> : <div className="atlas-empty">No workflows match this filter.</div>}
      <div className="atlas-field-foot">{highlighted ? `${highlighted.kind} / ${highlighted.name}` : 'Select a marker to inspect its declared role.'}<span>ARCHES: PATH WAYPOINTS / TRIANGLES: SOURCE EVIDENCE</span></div>
    </section>
    <aside className="atlas-directory">
      <div className="section-head">WORKFLOW DIRECTORY <span>{visible.length}</span></div>
      {visible.map(workflow => <button key={workflow.id} className={`atlas-directory-item ${selectedWorkflowId === workflow.id ? 'active' : ''}`} onClick={() => onSelect(workflow.id)} onDoubleClick={() => onOpen(workflow)} aria-label={`Select workflow ${workflow.title}`}><small>WORKFLOW</small><strong>{workflow.id}</strong></button>)}
      {selected && <div className="atlas-entity-directory"><div className="section-head">ENTITY INDEX <span>{points.length}</span></div>{points.map(point => <button key={point.id} aria-label={`Select ${point.name}`} aria-pressed={selectedEntityId === point.id} onClick={() => onSelectEntity(point.id)}><span style={{ color: point.color }}>◠</span>{point.id}</button>)}</div>}
    </aside>
  </main>;
}
