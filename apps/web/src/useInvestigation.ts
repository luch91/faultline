import { useEffect, useRef, useState } from 'react';
import type { EvaluationResult, Intervention, Workflow } from '@minsk/contracts';

export type ModelRecord = { id: string | null; modelId: string; provider: string; role: string; usage: unknown; accountingStatus: string };
export type Investigation = { investigationId?: string; baseline: EvaluationResult; intervention: Intervention; failure: EvaluationResult; verification: { repaired: EvaluationResult; safeguard: { stepId: string; conditionId: string }; resolved: boolean } | null; trace: Array<{ id: string; tool: string; status: string; arguments: unknown; result: unknown; modelId?: string; responseId?: string | null }>; routing?: {modelId:string;reason:string;escalated:boolean}; model: ModelRecord };
export type Scenario = 'BASELINE' | 'COUNTERFACTUAL' | 'SAFEGUARD';
const API = import.meta.env.VITE_API_URL || '';
async function call<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(`API returned ${response.status} without JSON. Check the configured API URL.`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed: ${response.status}`);
  return result as T;
}

export function useInvestigation() {
  const [samples, setSamples] = useState<Workflow[]>([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [baseline, setBaseline] = useState<EvaluationResult | null>(null);
  const [failure, setFailure] = useState<EvaluationResult | null>(null);
  const [verification, setVerification] = useState<Investigation['verification']>(null);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [applied, setApplied] = useState<Intervention | null>(null);
  const [trace, setTrace] = useState<Investigation['trace']>([]);
  const [model, setModel] = useState<Investigation['model'] | null>(null);
  const [extractionModel, setExtractionModel] = useState<ModelRecord | null>(null);
  const [routing, setRouting] = useState<Investigation['routing']>(undefined);
  const [investigationId, setInvestigationId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>('BASELINE');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState<unknown>(null);
  const [benchmark, setBenchmark] = useState<unknown>(null);
  const [challenger,setChallenger]=useState<unknown>(null);
  const [challengerEnabled,setChallengerEnabled]=useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    call<{ samples: Workflow[] }>('/api/v1/samples', undefined, ac.signal).then(async response => {
      if (ac.signal.aborted) return;
      setSamples(response.samples);
      const first = response.samples[0];
      if (!first) return;
      setWorkflow(first); setSelected(first.steps[0]?.id ?? first.conditions[0]?.id ?? null); setSource(first.sourceDocuments[0]?.text ?? '');
      const evaluated = await call<{ result: EvaluationResult }>('/api/v1/experiments/run', { workflow: first }, ac.signal);
      if (!ac.signal.aborted) setBaseline(evaluated.result);
    }).catch(e => { if (!ac.signal.aborted) setError(e.message); }).finally(() => { if (!ac.signal.aborted) setLoading(false); });
    call<{ liveModelEnabled: boolean }>('/api/v1/budget', undefined, ac.signal).then(x => setLiveEnabled(x.liveModelEnabled)).catch(() => {});
    call<{publicChallengerEnabled:boolean}>('/api/v1/budget', undefined, ac.signal).then(x=>setChallengerEnabled(x.publicChallengerEnabled)).catch(()=>{});
    return () => { ac.abort(); controller.current?.abort(); };
  }, []);

  async function run<T>(label: string, operation: (signal: AbortSignal) => Promise<T>, done: (value: T) => void) {
    controller.current?.abort(); const ac = new AbortController(); controller.current = ac; setBusy(label); setError('');
    try { const value = await operation(ac.signal); if (!ac.signal.aborted) done(value); }
    catch (e) { if (!ac.signal.aborted) setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { if (controller.current === ac) { setBusy(''); controller.current = null; } }
  }
  function reset(next: Workflow) {
    setWorkflow(next); setSource(next.sourceDocuments[0]?.text ?? ''); setSelected(next.steps[0]?.id ?? null); setBaseline(null); setFailure(null); setVerification(null); setIntervention(null); setApplied(null); setTrace([]); setModel(null); setExtractionModel(null); setCertificate(null);setChallenger(null); setRouting(undefined); setInvestigationId(null); setScenario('BASELINE');
  }
  function selectWorkflow(next: Workflow) {
    if (workflow === next) return;
    reset(next);
    return run('Evaluating workflow', s => call<{ result: EvaluationResult }>('/api/v1/experiments/run', { workflow: next }, s), x => setBaseline(x.result));
  }
  function loadWorkflowJson(text:string) { return run('Validating workflow',s=>call<{workflow:Workflow}>('/api/v1/workflows/validate',JSON.parse(text),s),x=>{void selectWorkflow(x.workflow);}); }
  function editCondition(id: string, value: boolean | null) { if (workflow) return selectWorkflow({ ...workflow, conditions: workflow.conditions.map(c => c.id === id ? { ...c, observedValue: value } : c) }); }
  function toggleGate(stepId: string, conditionId: string) { if (workflow) return selectWorkflow({ ...workflow, steps: workflow.steps.map(step => step.id === stepId ? { ...step, executionGateIds: step.executionGateIds.includes(conditionId) ? step.executionGateIds.filter(id => id !== conditionId) : [...step.executionGateIds, conditionId] } : step) }); }
  function selectCondition(id: string) {
    const c = workflow?.conditions.find(item => item.id === id);
    setIntervention(c ? { id: `user-${c.id}`, targetConditionId: c.id, originalValue: c.observedValue, replacementValue: c.observedValue === true ? false : true, reason: 'Manual counterfactual', proposedBy: 'USER', validated: true } : null);
  }
  function analyze() { return run('Extracting workflow', async s => {const extracted=await call<{ workflow: Workflow; model: ModelRecord }>('/api/v1/workflows/extract', { text: source }, s);const evaluated=await call<{result:EvaluationResult}>('/api/v1/experiments/run',{workflow:extracted.workflow},s);return {extracted,evaluated};},x=>{reset(x.extracted.workflow);setExtractionModel(x.extracted.model);setBaseline(x.evaluated.result);}); }
  function applyIntervention() {
    if (!workflow || !intervention) return;
    return run('Evaluating counterfactual', s => call<{ result: EvaluationResult }>('/api/v1/experiments/run', { workflow, intervention }, s), x => { setApplied(intervention); setFailure(x.result); setVerification(null); setScenario('COUNTERFACTUAL'); setTrace([]); setModel(null); setRouting(undefined); setInvestigationId(null); });
  }
  function investigate() {
    if (!workflow) return;
    return run('Meta investigation', s => call<Investigation>('/api/v1/investigations', { workflow, ...(intervention?{targetConditionId:intervention.targetConditionId}:{}) }, s), x => { setBaseline(x.baseline); setIntervention(x.intervention); setApplied(x.intervention); setFailure(x.failure); setVerification(x.verification); setTrace(x.trace); setModel(x.model); setRouting(x.routing); setInvestigationId(x.investigationId ?? null); setScenario('COUNTERFACTUAL'); });
  }
  function verify() {
    if (!workflow || !applied) return;
    const stepId = workflow.policyRules.find(rule => rule.requiredConditionIds.includes(applied.targetConditionId))?.subjectStepId;
    if (!stepId) return;
    return run('Verifying safeguard', s => call<{ repaired: EvaluationResult; resolved: boolean }>('/api/v1/safeguards/verify', { workflow, intervention: applied, stepId, conditionId: applied.targetConditionId }, s), x => { setVerification({ ...x, safeguard: { stepId, conditionId: applied.targetConditionId } }); setScenario('SAFEGUARD'); });
  }
  function exportCertificate() {
    if (!workflow || !baseline || !failure || !applied) return;
    return run('Exporting certificate', s => call<unknown>('/api/v1/reports/export', { workflow, investigation: { investigationId: investigationId ?? undefined, baseline, intervention: applied, failure, verification, trace, model } }, s), report => {
      setCertificate(report);const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'minsk-certificate.json'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  function loadBenchmark(){return run('Running benchmark',s=>call<unknown>('/api/v1/benchmark',undefined,s),setBenchmark);}
  function runChallenger(){if(!workflow)return;return run('Running Baseten challenger',s=>call<unknown>('/api/v1/challengers/open-weight',{workflow,...(investigationId&&applied?{hosted:{investigationId,intervention:applied}}:{})},s),setChallenger);}
  const result = scenario === 'SAFEGUARD' ? verification?.repaired ?? baseline : scenario === 'COUNTERFACTUAL' ? failure ?? baseline : baseline;
  const sceneWorkflow = workflow && scenario === 'SAFEGUARD' && verification ? { ...workflow, steps: workflow.steps.map(step => step.id === verification.safeguard.stepId && !step.executionGateIds.includes(verification.safeguard.conditionId) ? { ...step, executionGateIds: [...step.executionGateIds, verification.safeguard.conditionId] } : step) } : workflow;
  return { samples, workflow, sceneWorkflow, selected, setSelected, source, setSource, baseline, failure, verification, intervention, applied, trace, model, extractionModel, routing, scenario, setScenario, result, busy, error, liveEnabled, challengerEnabled,challenger,runChallenger,loading, certificate, benchmark, loadBenchmark,loadWorkflowJson, selectWorkflow, selectCondition, editCondition, toggleGate, analyze, applyIntervention, investigate, verify, exportCertificate, cancel: () => controller.current?.abort() };
}
export type InvestigationState = ReturnType<typeof useInvestigation>;
