import { useState } from 'react';
import type { EvaluationResult, Workflow } from '@faultline/contracts';

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

type Point = { id: string; name: string; kind: string; x: number; y: number; color: string };

function pointsFor(workflow: Workflow, counterfactual: EvaluationResult | null, repaired: boolean): Point[] {
  const unsafe = counterfactual?.outcome === 'UNSAFE_EXECUTION';
  const conditions = workflow.conditions.map((condition, index) => ({ id: condition.id, name: condition.name, kind: 'CONDITION', x: 145 + (index % 4) * 160, y: 255 + ([70, -55, 100, -15][index % 4] ?? 0) + Math.floor(index / 4) * 95, color: unsafe && counterfactual?.affectedNodeIds.includes(condition.id) ? '#f07858' : '#6aafe9' }));
  const rules = workflow.policyRules.map((rule, index) => ({ id: rule.id, name: rule.description, kind: 'POLICY', x: 450 + index * 75, y: 420 - index * 60, color: unsafe ? '#a888cb' : '#8476b9' }));
  const steps = workflow.steps.map((step, index) => ({ id: step.id, name: step.name, kind: 'EXECUTION', x: 690 + index * 55, y: 315 + index * 70, color: unsafe ? '#f07858' : repaired ? '#51cbbb' : '#75b6ef' }));
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
  const visible = workflows.filter(workflow => filter === 'ALL' || (workflow.id === activeWorkflowId && (filter === 'UNSAFE' ? counterfactual?.outcome === 'UNSAFE_EXECUTION' : safeguard?.outcome === 'SAFE_BLOCK')));
  const selected = workflows.find(workflow => workflow.id === selectedWorkflowId) ?? null;
  const points = selected ? pointsFor(selected, counterfactual, safeguard?.outcome === 'SAFE_BLOCK') : [];
  const byId = new Map(points.map(point => [point.id, point]));
  const highlighted = points.find(point => point.id === selectedEntityId);
  const entityCount = workflows.reduce((total, workflow) => total + workflow.conditions.length + workflow.policyRules.length + workflow.steps.length, 0);
  return <main className="atlas" aria-label="Faultline Atlas">
    <aside className="atlas-intelligence">
      <div className="atlas-kicker">FAULTLINE / TOPOLOGY</div>
      <div className="atlas-tabs"><button aria-pressed="true">Overview</button><button onClick={() => selected && onOpen(selected)}>Investigation</button></div>
      <div className="atlas-gauges"><div className="atlas-gauge"><span className="gauge-arc" /><strong>{workflows.length}</strong><small>WORKFLOWS</small></div><div className="atlas-gauge"><span className="gauge-arc" /><strong>{entityCount}</strong><small>DECLARED ENTITIES</small></div></div>
      <div className="atlas-statline"><span>Completed investigations</span><strong>{completedInvestigations}</strong></div>
      <div className="atlas-statline"><span>Unsafe outcomes</span><strong>{counterfactual?.outcome === 'UNSAFE_EXECUTION' ? 1 : 0}</strong></div>
      <div className="atlas-statline"><span>Safe blocks</span><strong>{safeguard?.outcome === 'SAFE_BLOCK' ? 1 : 0}</strong></div>
      <div className="atlas-statline"><span>Verified safeguards</span><strong>{safeguard?.outcome === 'SAFE_BLOCK' ? 1 : 0}</strong></div>
      <div className="section-head">FILTER</div>
      <div className="atlas-filters">{(['ALL', 'UNSAFE', 'SAFE BLOCK'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <small className="atlas-disclosure">Counts reflect this browser session. The loaded sample is demonstration data.</small>
    </aside>
    <section className="atlas-field" aria-label="Workflow topology overview">
      {error && <div className="atlas-alert" role="alert">{error}</div>}
      <div className="atlas-field-head"><span>ABSTRACT WORKFLOW TOPOLOGY</span><span>{visible.length} WORKFLOW{visible.length === 1 ? '' : 'S'}</span></div>
      {selected && visible.some(item => item.id === selected.id) ? <svg viewBox="0 0 900 590" role="img" aria-label="Declared workflow conditions, policy, and execution topology">
        <g fill="none" strokeLinecap="round">
          {selected.policyRules.flatMap(rule => rule.requiredConditionIds.map(conditionId => { const a = byId.get(conditionId); const b = byId.get(rule.id); if (!a || !b) return null; const violated = counterfactual?.outcome === 'UNSAFE_EXECUTION' && selectedEntityId === conditionId; return <path key={`policy-${conditionId}-${rule.id}`} d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 110} ${b.x} ${b.y}`} stroke={violated ? '#f07858' : '#927ac0'} strokeWidth={violated ? 2.3 : 1.2} opacity={violated ? .9 : .53} />; }))}
          {selected.steps.flatMap(step => step.executionGateIds.map(conditionId => { const a = byId.get(conditionId); const b = byId.get(step.id); if (!a || !b) return null; return <path key={`gate-${conditionId}-${step.id}`} d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 120} ${b.x} ${b.y}`} stroke="#6baded" strokeWidth="1.8" opacity=".7" />; }))}
          {selected.policyRules.map(rule => { const a = byId.get(rule.id); const b = byId.get(rule.subjectStepId); return a && b ? <path key={`scope-${rule.id}`} d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${a.y - 55} ${b.x} ${b.y}`} stroke="#927ac0" strokeDasharray="4 6" opacity=".55" /> : null; })}
        </g>
        {points.map(point => <AtlasMarker key={point.id} point={point} selected={selectedEntityId === point.id} onSelect={() => onSelectEntity(point.id)} />)}
        <g className="atlas-workflow-marker" role="button" tabIndex={0} aria-label={`Select workflow ${selected.title}`} onClick={() => onSelect(selected.id)} onDoubleClick={() => onOpen(selected)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selected.id); } }}>
          <path d="M363 480a42 42 0 0 1 84 0" fill="none" stroke="#7bb6ee" strokeWidth="4" />
          <circle cx="405" cy="480" r="5" fill="#92c8f7" />
          <text x="405" y="505" textAnchor="middle" fill="#deeffc" fontSize="11">{selected.title}</text>
        </g>
      </svg> : <div className="atlas-empty">No workflows match this filter.</div>}
      <div className="atlas-field-foot">{highlighted ? `${highlighted.kind} / ${highlighted.name}` : 'Select a marker to inspect its declared role.'}<span>BLUE: EXECUTION / VIOLET: POLICY</span></div>
    </section>
    <aside className="atlas-directory">
      <div className="section-head">WORKFLOW DIRECTORY <span>{visible.length}</span></div>
      {visible.map(workflow => <button key={workflow.id} className={`atlas-directory-item ${selectedWorkflowId === workflow.id ? 'active' : ''}`} onClick={() => onSelect(workflow.id)} onDoubleClick={() => onOpen(workflow)}><small>WORKFLOW / {workflow.id}</small><strong>{workflow.title}</strong><span>{workflow.conditions.length} CONDITIONS / {workflow.policyRules.length} POLICY / {workflow.steps.length} STEP</span></button>)}
      {selected && visible.some(item => item.id === selected.id) && <div className="atlas-selection"><div className="section-head">SELECTED WORKFLOW</div><strong>{selected.title}</strong><p>{selected.sourceDocuments[0]?.text ?? 'No source text.'}</p>{selected.id === activeWorkflowId && <small>BASELINE: {baseline?.outcome ?? 'NOT EVALUATED'}<br />COUNTERFACTUAL: {counterfactual?.outcome ?? 'NOT RUN'}<br />SAFEGUARD: {safeguard?.outcome ?? 'NOT RUN'}</small>}<button onClick={() => onOpen(selected)}>Open investigation</button></div>}
      {selected && <div className="atlas-entity-directory"><div className="section-head">DECLARED ENTITIES <span>{points.length}</span></div>{points.map(point => <button key={point.id} aria-pressed={selectedEntityId === point.id} onClick={() => onSelectEntity(point.id)}><span style={{ color: point.color }}>◠</span>{point.name}</button>)}</div>}
    </aside>
  </main>;
}
