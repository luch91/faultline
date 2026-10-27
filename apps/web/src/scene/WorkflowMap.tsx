import type { EvaluationResult, Intervention, Workflow } from '@faultline/contracts';
import { visualState } from './visualState';

type Props = { workflow: Workflow | null; result: EvaluationResult | null; intervention: Intervention | null; selected: string | null; testedGate?: { stepId: string; conditionId: string } | null; onSelect: (id: string) => void };

export function WorkflowMap({ workflow, result, intervention, selected, testedGate, onSelect }: Props) {
  if (!workflow) return <div className="scene-fallback" role="status">Load a workflow to inspect its dependencies.</div>;
  const entities = [...workflow.conditions, ...workflow.steps];
  const name = (id: string) => entities.find(item => item.id === id)?.name ?? id;
  return <div className="dependency-map" aria-label="Workflow dependencies">
    <div className="dependency-map-head"><strong>Workflow dependency map</strong><span>Policy and execution are evaluated separately.</span></div>
    <ol className="dependency-nodes" aria-label="Workflow modules">{entities.map(item => <li key={item.id}>
      <button className={selected === item.id ? 'selected' : ''} onClick={() => onSelect(item.id)} aria-current={selected === item.id ? 'true' : undefined}>
        <span>{'expectedValue' in item ? 'CONDITION' : 'STEP'}</span><strong>{item.name}</strong><em data-state={visualState(workflow, result, intervention, item.id)}>{visualState(workflow, result, intervention, item.id)}</em>
      </button>
    </li>)}</ol>
    <div className="dependency-links"><strong>Declared relationships</strong>
      {workflow.policyRules.flatMap(rule => rule.requiredConditionIds.map(id => <button key={`${rule.id}-${id}`} onClick={() => onSelect(id)}><span className="relationship policy">POLICY</span><span>{name(id)} → {name(rule.subjectStepId)}</span><small>{rule.id}</small></button>))}
      {workflow.steps.flatMap(step => [...step.executionGateIds.map(id => ({ id, relation: testedGate?.stepId === step.id && testedGate.conditionId === id ? 'TESTED GATE' : 'EXECUTION GATE' })), ...step.dependsOn.map(id => ({ id, relation: 'DEPENDENCY' }))].map(link => <button key={`${step.id}-${link.id}-${link.relation}`} onClick={() => onSelect(step.id)}><span className={`relationship ${link.relation === 'TESTED GATE' ? 'tested' : 'execution'}`}>{link.relation}</span><span>{name(link.id)} → {step.name}</span></button>))}
    </div>
  </div>;
}
