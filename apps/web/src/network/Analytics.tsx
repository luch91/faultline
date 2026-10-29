import { useMemo } from 'react';
import { colors, degrees, type Network } from './model';
import { ExperimentControls } from './ExperimentControls';
import type { InvestigationState } from './useInvestigation';

type Props = { state: InvestigationState; network: Network; expanded: boolean; onOpenTools: () => void; onExpand: () => void };
export function Analytics({ state, network, expanded, onExpand, onOpenTools }: Props) {
  const ranks = useMemo(() => degrees(network), [network]);
  const selected = network.nodes.find(node => node.id === state.selected);
  const related = network.links.filter(link => link.from === state.selected || link.to === state.selected);
  const values = [...network.nodes]
    .sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id))
    .map(node => network.links.filter(link => link.from === node.id || link.to === node.id).length);
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => `${12 + index / Math.max(1, values.length - 1) * 296},${98 - value / maximum * 80}`).join(' ');
  const gates = state.sceneWorkflow?.steps.reduce((total, step) => total + step.executionGateIds.length, 0) ?? 0;
  return <aside className={`relationship-analytics ${expanded ? 'expanded' : ''}`} aria-label="Workflow relationship analytics">
    <header><div><strong>{selected?.name ?? state.workflow?.title}</strong><small>{selected?.kind ?? 'Workflow'} / {selected?.state ?? 'DECLARED'}</small></div><button className="analytics-inspect" onClick={onOpenTools}>Inspect</button><button aria-label={expanded ? 'Contract analytics' : 'Expand analytics'} onClick={onExpand}>{expanded ? '↙' : '↗'}</button></header>
    <div className="analytics-tabs"><button aria-pressed="true">Overview</button><button onClick={() => document.getElementById('source-evidence')?.scrollIntoView({ block: 'nearest' })}>Evidence</button></div>
    <div className="relationship-metrics"><div><strong>{network.nodes.length}</strong><small>Records</small></div><div><strong>{network.links.length}</strong><small>Relations</small></div><div><strong>{gates}</strong><small>Gates</small></div><div><strong>{state.result?.policyResults.filter(item => item.state === 'VIOLATED').length ?? 0}</strong><small>Violations</small></div></div>
    <figure className="relationship-chart"><figcaption>Declared relationships by map position <span>Current scenario</span></figcaption><svg viewBox="0 0 330 118" role="img" aria-label="Actual relationship counts per record, ordered left to right by map position">
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="12" x2="315" y1={18 + i * 20} y2={18 + i * 20} stroke="#353849" strokeWidth=".45"/><text x="1" y={21 + i * 20}>{Math.round(maximum * (1 - i / 4))}</text></g>)}
      <polygon points={`12,98 ${points} 308,98`} fill="#337b80" fillOpacity=".42"/><polyline points={points} fill="none" stroke="#62b6b1" strokeWidth="1.2"/>
      <text x="12" y="113">1</text><text x="303" y="113">{values.length}</text>
    </svg></figure>
    <div className="analytics-columns"><section><h3>My policy requirements</h3>{state.workflow?.policyRules.flatMap(rule => rule.requiredConditionIds.map(id => <button key={`${rule.id}-${id}`} onClick={() => state.setSelected(id)}><span className="tiny-dot" />{state.workflow?.conditions.find(c => c.id === id)?.name ?? id}</button>))}</section><section><h3>My execution gates</h3>{state.sceneWorkflow?.steps.flatMap(step => step.executionGateIds.map(id => <button key={`${step.id}-${id}`} onClick={() => state.setSelected(id)}>{state.workflow?.conditions.find(c => c.id === id)?.name ?? id}<span>→</span></button>))}</section></div>
    <section className="related-table"><h3>Relationship ranking <small>by declared degree</small></h3><table><thead><tr><th>Record</th><th>Links</th><th>Type</th></tr></thead><tbody>{ranks.slice(0, expanded ? 9 : 5).map(({ node, count }) => <tr key={node.id}><td><button onClick={() => state.setSelected(node.entityId)}><i style={{ background: colors[node.kind] }}/>{node.name}</button></td><td>{count}</td><td>{node.kind}</td></tr>)}</tbody></table></section>
    <ExperimentControls state={state} />
    <section className="source-readout" id="source-evidence"><h3>Source-linked evidence</h3><p>{selected?.detail}</p>{state.workflow && [...state.workflow.conditions, ...state.workflow.steps, ...state.workflow.policyRules].find(entity => entity.id === state.selected)?.sourceSpans.map((span, i) => <blockquote key={i}>{span.excerpt}<small>{span.verified ? 'Verified' : 'Unverified'} / {span.sourceId} / {span.startOffset}:{span.endOffset}</small></blockquote>)}</section>
    <details className="actual-trace"><summary>Investigation trace ({state.trace.length})</summary>{state.trace.length ? state.trace.map(t => <details key={t.id}><summary>{t.tool}: {t.status}</summary><pre>{JSON.stringify(t.result, null, 2)}</pre></details>) : <p>No model tool calls recorded.</p>}</details>
    <span className="analytics-selection" aria-live="polite">{related.length} direct relationships for selected record</span>
  </aside>;
}
