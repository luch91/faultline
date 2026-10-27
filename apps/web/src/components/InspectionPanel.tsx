import type { EvaluationResult, Intervention, Workflow } from '@faultline/contracts';
import { observedValue, visualState } from '../scene/visualState';

type Verification = { repaired: EvaluationResult; safeguard: { stepId: string; conditionId: string }; resolved: boolean } | null;
type Props = { workflow: Workflow | null; result: EvaluationResult | null; intervention: Intervention | null; selected: string | null; activeView: string; verification: Verification; canVerify: boolean; onVerify: () => void; busy: boolean };

export function InspectionPanel({ workflow, result, intervention, selected, activeView, verification, canVerify, onVerify, busy }: Props) {
  const condition = workflow?.conditions.find(item => item.id === selected);
  const step = workflow?.steps.find(item => item.id === selected);
  const rule = workflow?.policyRules.find(item => item.subjectStepId === selected || item.requiredConditionIds.includes(selected ?? ''));
  const stepResult = result?.stepResults.find(item => item.stepId === selected);
  const policyResult = result?.policyResults.find(item => item.ruleId === rule?.id);
  const status = workflow && selected ? visualState(workflow, result, intervention, selected) : null;
  const sourceSpans = [...(condition?.sourceSpans ?? step?.sourceSpans ?? []), ...(rule?.sourceSpans ?? [])].filter((span, index, spans) => spans.findIndex(other => other.sourceId === span.sourceId && other.startOffset === span.startOffset && other.endOffset === span.endOffset) === index);
  return <section className="selection-card" aria-label="Selected module inspection">
    <span className="section-head">SELECTED MODULE / {activeView}</span>
    <strong>{condition?.name ?? step?.name ?? 'Select a module'}</strong>
    {status && <span className="inspection-state" data-state={status}>{status}</span>}
    {condition && workflow && <div className="inspection-readout"><span>Scenario observation: {String(observedValue(workflow, condition.id, intervention))}</span><span>Expected: {String(condition.expectedValue)}</span></div>}
    {step && <div className="inspection-readout"><span>Policy: {policyResult?.state ?? 'NOT EVALUATED'}</span><span>Execution: {stepResult ? stepResult.executes ? 'ELIGIBLE' : stepResult.eligibility === 'UNKNOWN' ? 'UNKNOWN' : 'BLOCKED' : 'NOT EVALUATED'}</span></div>}
    {step && workflow && <small>Execution gates: {step.executionGateIds.map(id => workflow.conditions.find(item => item.id === id)?.name ?? id).join(', ') || 'None declared'}</small>}
    {activeView === 'SAFEGUARD' && verification && step?.id === verification.safeguard.stepId && workflow && <small>Tested gate: {workflow.conditions.find(item => item.id === verification.safeguard.conditionId)?.name ?? verification.safeguard.conditionId}</small>}
    {rule && <small>Policy rule: {rule.description}</small>}
    {result?.outcome === 'UNSAFE_EXECUTION' && selected && <p className="inspection-finding unsafe">Policy violated while the configured execution step remains eligible. Rule: {result.firstViolation}.</p>}
    {result?.outcome === 'SAFE_BLOCK' && selected && <p className="inspection-finding safe">The required condition remains violated. The tested execution gate blocks deployment.</p>}
    {sourceSpans.length > 0 && <div className="inspection-evidence"><span className="section-head">SOURCE EVIDENCE</span>{sourceSpans.map((span, index) => <blockquote key={`${span.sourceId}-${span.startOffset}-${index}`}>{span.excerpt}<small>{span.verified ? 'VERIFIED' : 'UNVERIFIED'} / {span.sourceId} / {span.startOffset} to {span.endOffset}</small></blockquote>)}</div>}
    {canVerify && <button className="context-action" onClick={onVerify} disabled={busy}>Verify safeguard</button>}
  </section>;
}
