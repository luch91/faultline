import { useMemo } from 'react';
import { ReactFlow, Controls, Handle, Position, type Edge, type Node, type NodeProps } from '@xyflow/react';
import type { EvaluationResult, Intervention, Workflow } from '@faultline/contracts';
import { visualState } from './visualState';

type Props = { workflow: Workflow | null; result: EvaluationResult | null; intervention: Intervention | null; selected: string | null; testedGate: { stepId: string; conditionId: string } | null; onSelect: (id: string) => void };
type SignalNode = Node<{ kind: string; name: string; state: string; code: string }, 'signal'>;

function Signal({ data, selected }: NodeProps<SignalNode>) {
  return <div className={`topology-signal state-${data.state.toLowerCase()} ${selected ? 'selected' : ''}`} aria-label={`${data.kind}: ${data.name}, ${data.state}`}>
    <Handle type="target" position={Position.Left} />
    <div className="signal-arch"><span>{data.code}</span></div>
    <div className="signal-caption"><small>{data.kind}</small><strong>{data.name}</strong><em>{data.state}</em></div>
    <Handle type="source" position={Position.Right} />
  </div>;
}

const nodeTypes = { signal: Signal };

export function graphElements(workflow: Workflow, result: EvaluationResult | null, intervention: Intervention | null, selected: string | null, testedGate: Props['testedGate']) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  workflow.conditions.forEach((condition, index) => {
    const state = visualState(workflow, result, intervention, condition.id);
    nodes.push({ id: condition.id, type: 'signal', className: `state-${state.toLowerCase()}`, position: { x: 45 + (index % 4) * 185, y: 165 + ([120, 0, 130, 30][index % 4] ?? 0) + Math.floor(index / 4) * 180 }, data: { kind: 'CONDITION', name: condition.name, state, code: String(index + 1).padStart(2, '0') }, selected: selected === condition.id });
  });
  workflow.policyRules.forEach((rule, index) => {
    const state = result?.policyResults.find(item => item.ruleId === rule.id)?.state ?? 'UNKNOWN';
    nodes.push({ id: rule.id, type: 'signal', className: `state-${state.toLowerCase()}`, position: { x: 370 + index * 135, y: 455 + index * 90 }, data: { kind: 'POLICY RULE', name: rule.description.length > 42 ? `${rule.description.slice(0, 42)}...` : rule.description, state, code: 'P' + String(index + 1) }, selected: selected === rule.id });
    rule.requiredConditionIds.forEach(conditionId => edges.push({ id: `policy-${conditionId}-${rule.id}`, source: conditionId, target: rule.id, type: 'default', className: `graph-edge policy-edge ${state === 'VIOLATED' && intervention?.targetConditionId === conditionId ? 'violated-edge' : ''}`, style: { stroke: state === 'VIOLATED' && intervention?.targetConditionId === conditionId ? '#f07858' : '#947ac0', strokeWidth: 2 }, data: { relation: 'POLICY REQUIREMENT' } }));
    edges.push({ id: `subject-${rule.id}-${rule.subjectStepId}`, source: rule.id, target: rule.subjectStepId, type: 'default', className: 'graph-edge policy-edge', style: { stroke: '#947ac0', strokeWidth: 1.4, strokeDasharray: '5 4' }, data: { relation: 'POLICY APPLIES TO' } });
  });
  workflow.steps.forEach((step, index) => {
    const state = visualState(workflow, result, intervention, step.id);
    nodes.push({ id: step.id, type: 'signal', className: `state-${state.toLowerCase()}`, position: { x: 765 + index * 145, y: 275 + index * 110 }, data: { kind: 'WORKFLOW STEP', name: step.name, state, code: 'E' + String(index + 1) }, selected: selected === step.id });
    step.executionGateIds.forEach(conditionId => {
      const tested = testedGate?.stepId === step.id && testedGate.conditionId === conditionId;
      edges.push({ id: `gate-${conditionId}-${step.id}`, source: conditionId, target: step.id, type: 'default', className: `graph-edge ${tested ? 'tested-edge' : 'gate-edge'}`, style: { stroke: tested ? '#51cbbb' : '#6baded', strokeWidth: tested ? 3 : 2.4 }, data: { relation: tested ? 'TESTED EXECUTION GATE' : 'EXECUTION GATE' } });
    });
    step.dependsOn.forEach(stepId => edges.push({ id: `dependency-${stepId}-${step.id}`, source: stepId, target: step.id, type: 'default', className: 'graph-edge dependency-edge', style: { stroke: '#6baded', strokeWidth: 2 }, data: { relation: 'STEP DEPENDENCY' } }));
  });
  return { nodes, edges };
}

export function WorkflowGraph({ workflow, result, intervention, selected, testedGate, onSelect }: Props) {
  const compact = window.matchMedia('(max-width: 680px)').matches;
  const elements = useMemo(() => workflow ? graphElements(workflow, result, intervention, selected, testedGate) : { nodes: [], edges: [] }, [workflow, result, intervention, selected, testedGate]);
  if (!workflow) return <div className="scene-fallback" role="status">Load a workflow to inspect its dependencies.</div>;
  return <div className="workflow-graph" aria-label="Interactive workflow dependency graph">
    <ReactFlow nodeTypes={nodeTypes} nodes={elements.nodes} edges={elements.edges} onNodeClick={(_, node) => onSelect(node.id)} nodesDraggable={false} nodesConnectable={false} elementsSelectable fitView={!compact} defaultViewport={compact ? { x: 4, y: 70, zoom: .88 } : undefined} fitViewOptions={{ padding: .13 }} minZoom={.3} maxZoom={1.8} proOptions={{ hideAttribution: true }}>
      <Controls showInteractive={false} />
    </ReactFlow>
    {compact && <div className="graph-mobile-hint">Drag to follow dependencies. Fit view shows the full model.</div>}
    <div className="graph-key" aria-label="Relationship legend"><span className="policy">POLICY REQUIREMENT</span><span className="gate">EXECUTION GATE</span><span className="tested">TESTED GATE</span></div>
  </div>;
}
