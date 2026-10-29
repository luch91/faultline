import { useMemo, useRef, useState, type WheelEvent } from 'react';
import { colors, contextPaths, type Group, type Network, type NetworkNode, type NetworkLink } from './model';
import { ease, type Motion } from './motion';

type Props = { network: Network; selected: string | null; motion: Motion; query: string; filter: Group | 'All'; heatmap: boolean; onSelect: (id: string) => void; onFocus: (id: string) => void };
const short = (text: string, limit = 25) => text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
export function NetworkCanvas({ network, selected, motion, query, filter, heatmap, onSelect, onFocus }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const returnShape = motion.t >= 314 / 30 && motion.t < 14.4 ? 1 - ease((motion.t - 13.2) / 1.1) : 0;
  const shifts: Record<Group, [number, number]> = { Conditions: [155, -40], Policy: [65, -25], Sources: [45, 20], Evidence: [55, -5], Evaluation: [70, -10], Execution: [-60, 20] };
  const posedNodes = network.nodes.map(node => ({ ...node, x: node.x + shifts[node.kind][0] * returnShape, y: node.y + shifts[node.kind][1] * returnShape }));
  const byId = new Map(posedNodes.map(node => [node.id, node]));
  const root = byId.get(selected ?? '') ?? network.nodes.find(node => node.kind === 'Execution') ?? network.nodes[0];
  const paths = useMemo(() => root ? contextPaths(network, root.id) : new Map<string, NetworkLink[]>(), [network, root]);
  const visible = (node: NetworkNode) => (filter === 'All' || filter === node.kind) && (!query || `${node.name} ${node.detail} ${node.kind}`.toLowerCase().includes(query.toLowerCase()));
  const current = hovered ?? (returnShape > .5 ? network.nodes.find(node => node.kind === 'Conditions')?.id : selected);
  const connected = new Set(network.links.filter(link => link.from === current || link.to === current).flatMap(link => [link.from, link.to]));
  const focusNodes = network.nodes.filter(node => node.id !== root?.id && !node.id.includes(':token:') && paths.has(node.id));
  const leafPosition = (index: number) => {
    const half = Math.ceil(focusNodes.length / 2); const left = index < half; const offset = left ? index : index - half;
    const n = left ? half : focusNodes.length - half;
    const angle = n <= 1 ? .5 : offset / (n - 1);
    return { x: left ? 185 - Math.sin(angle * Math.PI) * 85 : 400 + Math.sin(angle * Math.PI) * 70, y: 55 + angle * 315, left };
  };
  const zoom = (delta: number) => setView(v => ({ ...v, scale: Math.max(.55, Math.min(2.8, v.scale + delta)) }));
  const wheel = (event: WheelEvent<SVGSVGElement>) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); zoom(event.deltaY < 0 ? .1 : -.1); } };
  function select(node: NetworkNode, focus = false) { onSelect(node.entityId); if (focus) onFocus(node.entityId); }
  const inspected = byId.get(hovered ?? '') ?? root;
  return <section className="network-field" aria-label="Interactive workflow network" data-presentation={motion.phase}>
    <div className="field-zoom"><button aria-label="Zoom in" onClick={() => zoom(.2)}>+</button><button aria-label="Zoom out" onClick={() => zoom(-.2)}>−</button><button aria-label="Fit network" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>Fit</button></div>
    <svg className="live-network" viewBox="0 0 570 415" preserveAspectRatio="none" aria-label={motion.focus > .5 ? 'Focused relationship visualization' : 'Multi-cluster workflow overview'} onWheel={wheel} onPointerDown={event => { if ((event.target as Element).closest('[data-node-id]')) return; drag.current = { x: event.clientX, y: event.clientY, originX: view.x, originY: view.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { if (drag.current) { const box = event.currentTarget.getBoundingClientRect(); setView(v => ({ ...v, x: drag.current!.originX + (event.clientX - drag.current!.x) * 570 / box.width, y: drag.current!.originY + (event.clientY - drag.current!.y) * 415 / box.height })); } }} onPointerUp={() => { drag.current = null; }}>
      <defs><filter id="node-soft"><feGaussianBlur stdDeviation="8" /></filter><radialGradient id="node-density"><stop stopColor="#138de0" stopOpacity=".6"/><stop offset="1" stopColor="#138de0" stopOpacity="0"/></radialGradient></defs>
      <g transform={`translate(${view.x} ${view.y}) translate(285 207.5) scale(${view.scale}) translate(-285 -207.5)`}>
        <g className="cluster-overview" opacity={1 - motion.focus} pointerEvents={motion.focus > .5 ? 'none' : 'auto'} aria-hidden={motion.focus > .5}>
          {heatmap && posedNodes.filter(visible).map(node => <circle key={node.id} cx={node.x} cy={node.y} r={node.radius * 5} fill="url(#node-density)" />)}
          {network.links.map(link => {
            const from = byId.get(link.from), to = byId.get(link.to); if (!from || !to) return null;
            const active = current === from.id || current === to.id;
            return <path key={link.id} className={`network-link ${link.gate ? 'execution-gate' : link.policy ? 'policy-requirement' : 'context-link'} ${link.tested ? 'verified-gate' : ''}`} data-relation={link.relation} d={`M${from.x},${from.y} Q${(from.x + to.x) / 2},${(from.y + to.y) / 2 - 8} ${to.x},${to.y}`} fill="none" stroke={link.tested ? '#58c8ad' : active ? '#9eaab3' : colors[from.kind]} strokeWidth={active ? .8 : .3} strokeDasharray={link.policy ? '2 2' : undefined} opacity={visible(from) && visible(to) ? active ? .7 : .18 : .035}><title>{from.name} → {to.name}: {link.relation}</title></path>;
          })}
          {posedNodes.map(node => {
            const active = current === node.id || current === node.entityId; const subdued = !visible(node);
            return <g key={node.id} role="button" tabIndex={subdued || motion.focus > .5 ? -1 : 0} aria-label={`Inspect ${node.name}`} data-node-id={node.id} data-entity-id={node.entityId} className={`network-node ${active ? 'selected' : ''}`} opacity={subdued ? .07 : current && !active && !connected.has(node.id) ? .58 : .9} onPointerEnter={() => setHovered(node.id)} onPointerLeave={() => setHovered(null)} onClick={() => select(node, true)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(node, true); } }}>
              <title>{node.name}: {node.detail}</title>
              <circle cx={node.x} cy={node.y} r={Math.max(node.radius + 4, 7)} fill="transparent" />
              {(active || connected.has(node.id)) && <circle cx={node.x} cy={node.y} r={node.radius + 3} fill="none" stroke={active ? '#dcf5f5' : colors[node.kind]} strokeWidth={active ? 1 : .4} opacity={active ? .8 : .35} />}
              <circle cx={node.x} cy={node.y} r={node.radius} fill={node.state === 'VIOLATED' || node.state === 'UNSAFE' ? '#bb657a' : returnShape > .5 && active ? '#a5efed' : colors[node.kind]} />
              {node.radius >= 5 && <><text x={node.x} y={node.y + node.radius + 10} textAnchor="middle">{short(node.name, 24)}</text><text className="node-subtitle" x={node.x} y={node.y + node.radius + 17} textAnchor="middle">{node.kind}</text></>}
            </g>;
          })}
          {root && <g className="related-cloud" transform="translate(438 125)"><text className="cloud-heading" y="-9">Connected records</text>{network.links.filter(link => link.from === root.id || link.to === root.id).slice(0, 9).map((link, index) => { const node = byId.get(link.from === root.id ? link.to : link.from); return node ? <g key={link.id} transform={`translate(0 ${index * 19})`} role="button" tabIndex={motion.focus > .5 ? -1 : 0} aria-label={`Select related ${node.name}`} onClick={() => select(node, true)} onKeyDown={e => e.key === 'Enter' && select(node, true)}><circle r="2" fill="#0caef3"/><text x="8" y="2">{short(node.name, 24)}</text></g> : null; })}</g>}
        </g>
        <g className="radial-network" transform={`translate(${motion.t < 7 ? -30 * ease((motion.t - 3.4) / 1.3) : 30} 0)`} opacity={motion.focus} pointerEvents={motion.focus < .5 ? 'none' : 'auto'} aria-hidden={motion.focus < .5}>
          <text x="185" y="37" className="radial-column-label">Policy &amp; evidence</text><text x="418" y="37" className="radial-column-label">Execution context</text>
          {focusNodes.map((node, index) => {
            const position = leafPosition(index); const reveal = ease((motion.expansion - index / Math.max(1, focusNodes.length) * .28) / .72);
            const x = 300 + (position.x - 300) * reveal, y = 200 + (position.y - 200) * reveal;
            const path = paths.get(node.id)!; const direct = path.length === 1; const relation = direct ? path[0]!.relation : `CONTEXT VIA ${path.map(link => link.relation).join(' / ')}`;
            const gate = direct && path[0]!.gate, policy = path.some(link => link.policy), tested = direct && path[0]!.tested;
            return <g key={node.id} className="radial-spoke" data-context-node={node.id} data-relation={relation} opacity={reveal}>
              <path className={`radial-line ${gate ? 'execution-gate' : policy ? 'policy-requirement' : 'context-link'} ${tested ? 'verified-gate' : ''}`} d={`M300,200 C${position.left ? 230 : 370},200 ${position.left ? 290 : 310},${y} ${x},${y}`} pathLength="1" strokeDasharray={policy ? '.012 .009' : '1'} strokeDashoffset={1 - reveal} stroke={tested ? '#5fc0ac' : gate ? '#2899d2' : '#566075'} fill="none" strokeWidth={gate ? .85 : .55}>
                <title>{node.name}: {relation}</title>
              </path>
              <g role="button" tabIndex={reveal > .95 && motion.focus > .5 ? 0 : -1} aria-label={`Select relationship ${node.name}`} data-node-id={node.id} onClick={() => onSelect(node.entityId)} onPointerEnter={() => setHovered(node.id)} onPointerLeave={() => setHovered(null)} onKeyDown={e => { if (e.key === 'Enter') onSelect(node.entityId); }}>
                <circle cx={x} cy={y} r="7" fill="transparent"/><circle cx={x} cy={y} r={2.1} fill={colors[node.kind]}/>
                <text x={x + (position.left ? -6 : 6)} y={y + 1.5} textAnchor={position.left ? 'end' : 'start'} opacity={ease((reveal - .7) / .3)}>{short(node.name, position.left ? 23 : 28)}</text>
              </g>
            </g>;
          })}
          {root && <g role="button" tabIndex={motion.focus > .5 ? 0 : -1} aria-label={`Focused entity ${root.name}`} data-focused-id={root.entityId} onClick={() => onSelect(root.entityId)}>
            <circle cx="300" cy="200" r="11" fill="#00b8fd"/><text className="central-label" x="300" y="221" textAnchor="middle">{short(root.name, 32)}</text><text x="300" y="229" textAnchor="middle">{root.kind} / {root.state || 'DECLARED'}</text>
          </g>}
        </g>
      </g>
    </svg>
    {hovered && inspected && <div className="network-tooltip"><strong>{inspected.name}</strong><span>{inspected.detail}</span></div>}
    <div className="network-legend"><span><i style={{ background: '#8b7aac' }} />Dashed: policy</span><span><i style={{ background: '#2684b7' }} />Solid: execution</span><span><i style={{ background: '#5fc0ac' }} />Verified gate</span></div>
  </section>;
}
