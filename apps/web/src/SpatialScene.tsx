import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { Workflow, EvaluationResult, Intervention } from '@faultline/contracts';
import { ExecutionHardware, type HardwareKind } from './scene/ExecutionHardware';
import { CameraDirector, type CameraState } from './scene/CameraDirector';
import { WorkflowMap } from './scene/WorkflowMap';
import { visualState, type VisualState } from './scene/visualState';

type Module = { id: string; name: string; x: number; z: number; state: VisualState; kind: HardwareKind };
type TestedGate = { stepId: string; conditionId: string } | null;
type Props = { workflow: Workflow; result: EvaluationResult | null; intervention: Intervention | null; selected: string | null; testedGate: TestedGate; onSelect: (id: string) => void; cameraState: CameraState; reducedMotion: boolean; zoom: number };

function stateColor(state: VisualState) {
  if (state === 'UNSAFE' || state === 'VIOLATED') return '#f07858';
  if (state === 'UNKNOWN') return '#e7b861';
  if (state === 'BLOCKED') return '#bd8173';
  if (state === 'SATISFIED') return '#51cbbb';
  return '#70b5ff';
}

function ModuleLabel({ name, state, compact = false }: { name: string; state: VisualState; compact?: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 112;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0c1b2d'; ctx.fillRect(0, 0, 640, 112);
    ctx.strokeStyle = stateColor(state); ctx.lineWidth = 4; ctx.strokeRect(2, 2, 636, 108);
    ctx.fillStyle = '#e9f4ff'; ctx.font = '600 33px Arial';
    ctx.fillText(name.length > 28 ? `${name.slice(0, 27)}...` : name, 20, 49);
    ctx.fillStyle = stateColor(state); ctx.font = 'bold 23px Arial'; ctx.fillText(state, 20, 88);
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, [name, state]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0, compact ? 1.25 : 2.08, 0]} scale={compact ? [2.5, .44, 1] : [2.3, .42, 1]}><spriteMaterial map={texture} transparent depthWrite={false} /></sprite>;
}

function RenderMeter() {
  const { gl, invalidate } = useThree();
  useFrame(() => {
    if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('measure')) return;
    const target = window as typeof window & { __faultlineRenderMetrics?: { frames: number[]; drawCalls: number[]; triangles: number[] } };
    const sample = target.__faultlineRenderMetrics ??= { frames: [], drawCalls: [], triangles: [] };
    sample.frames.push(performance.now());
    sample.drawCalls.push(gl.info.render.calls);
    sample.triangles.push(gl.info.render.triangles);
    if (sample.frames.length > 600) { sample.frames.shift(); sample.drawCalls.shift(); sample.triangles.shift(); }
    invalidate();
  });
  return null;
}

function Route({ from, to, color, thin = false, onSelect }: { from: [number, number, number]; to: [number, number, number]; color: string; thin?: boolean; onSelect: () => void }) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...from); const b = new THREE.Vector3(...to);
    const bendX = (a.x + b.x) / 2;
    const points = [a, new THREE.Vector3(bendX, a.y, a.z), new THREE.Vector3(bendX, b.y, b.z), b];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 32, thin ? .035 : .06, 6, false);
  }, [from, to, thin]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} onClick={event => { event.stopPropagation(); onSelect(); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}><meshBasicMaterial color={color} toneMapped={false} transparent={thin} opacity={thin ? .7 : 1} /></mesh>;
}

function Environment() {
  const ribs = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ x: i % 2 ? 12.2 : -12.2, z: (i % 8) * 3.1 - 10.85, height: .25 + (i % 3) * .08 })), []);
  const serviceBays = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ x: (i % 6) * 3.2 - 8, z: i < 6 ? -8.35 : 8.35 })), []);
  return <group>
    <mesh position={[0, -.85, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[80, 80]} /><meshStandardMaterial color="#080f1d" roughness={1} /></mesh>
    <gridHelper args={[80, 80, '#243a54', '#14243a']} position={[0, -.81, 0]} />
    <mesh position={[0, -.64, 0]}><boxGeometry args={[29, .32, 24]} /><meshStandardMaterial color="#0e1b2e" roughness={.92} metalness={.12} /></mesh>
    <mesh position={[0, -.4, 0]}><boxGeometry args={[25, .18, 20]} /><meshStandardMaterial color="#172b43" roughness={.76} metalness={.27} /></mesh>
    <mesh position={[0, -.2, 0]}><boxGeometry args={[20.5, .25, 16.2]} /><meshStandardMaterial color="#10243a" roughness={.82} metalness={.22} /></mesh>
    <mesh position={[0, -.045, 0]}><boxGeometry args={[17.3, .055, 13.5]} /><meshStandardMaterial color="#1a344f" roughness={.69} metalness={.34} /></mesh>
    {[-1, 1].map(side => <group key={`path-${side}`} position={[side * 10.9, -.27, 0]}>
      <mesh><boxGeometry args={[1.9, .08, 17.9]} /><meshStandardMaterial color="#263d55" roughness={.9} metalness={.16} /></mesh>
      <mesh position={[-side * .67, .06, 0]}><boxGeometry args={[.08, .035, 17.9]} /><meshBasicMaterial color="#3f7097" transparent opacity={.53} /></mesh>
    </group>)}
    {serviceBays.map((bay, i) => <group key={`bay-${i}`} position={[bay.x, -.29, bay.z]}>
      <mesh><boxGeometry args={[2.6, .04, 1.35]} /><meshStandardMaterial color="#0b1929" roughness={.94} /></mesh>
      <mesh position={[0, .025, 0]}><boxGeometry args={[2.2, .018, .86]} /><meshStandardMaterial color="#1f3449" roughness={.85} metalness={.16} /></mesh>
      {[-.69, .69].map(x => <mesh key={x} position={[x, .04, 0]}><boxGeometry args={[.035, .025, .77]} /><meshBasicMaterial color="#426786" transparent opacity={.46} /></mesh>)}
    </group>)}
    {ribs.map((r, i) => <mesh key={`rib-${i}`} position={[r.x, r.height / 2 - .35, r.z]}><boxGeometry args={[.22, r.height, 2.45]} /><meshStandardMaterial color="#29415b" roughness={.76} metalness={.3} /></mesh>)}
    {[-1, 1].map(side => <group key={`edge-${side}`} position={[side * 8.7, .02, 0]}><mesh><boxGeometry args={[.12, .2, 13.6]} /><meshBasicMaterial color="#3d769e" transparent opacity={.42} /></mesh></group>)}
  </group>;
}

function ExecutionModule({ module, selected, onSelect, showLabel }: { module: Module; selected: boolean; onSelect: (id: string) => void; showLabel: boolean }) {
  const color = stateColor(module.state);
  return <group position={[module.x, 0, module.z]} onClick={e => { e.stopPropagation(); onSelect(module.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
    <ExecutionHardware kind={module.kind} color={color} blocked={module.state === 'BLOCKED' || module.state === 'UNSAFE'} />
    {selected && <pointLight position={[0, 2.5, 1.2]} intensity={4} distance={7} color="#91c5ed" />}
    {selected && <mesh position={[0, .015, 0]}><boxGeometry args={[3.32, .045, 2.54]} /><meshBasicMaterial color="#81c2ff" transparent opacity={.8} /></mesh>}
    {(module.state === 'UNSAFE' || module.state === 'VIOLATED' || module.state === 'UNKNOWN') && <mesh position={[0, 2.33, 0]}><octahedronGeometry args={[.2]} /><meshBasicMaterial color={color} /></mesh>}
    {showLabel && <ModuleLabel name={module.name} state={module.state} />}
  </group>;
}

function TopologyArc({ from, to, color }: { from: THREE.Vector3; to: THREE.Vector3; color: string }) {
  const geometry = useMemo(() => {
    const center = from.clone().lerp(to, .5).add(new THREE.Vector3(0, 2.6, 0));
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, center, to), 24, .035, 5, false);
  }, [from, to]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshBasicMaterial color={color} transparent opacity={.82} /></mesh>;
}

function TopologyOverview({ modules, workflow, testedGate, onSelect }: { modules: Module[]; workflow: Workflow; testedGate: TestedGate; onSelect: (id: string) => void }) {
  const positions = useMemo(() => new Map(modules.map((m, i) => [m.id, new THREE.Vector3((i % 2 ? 1 : -1) * (7 + Math.floor(i / 2) * 2), .2, (i < 2 ? -7 : 8))])), [modules]);
  const edges = workflow.steps.flatMap(s => [...s.executionGateIds, ...s.dependsOn].map(source => ({ source, target: s.id }))).filter(e => positions.has(e.source) && positions.has(e.target));
  const policyEdges = workflow.policyRules.flatMap(r => r.requiredConditionIds.map(source => ({ source, target: r.subjectStepId }))).filter(e => positions.has(e.source) && positions.has(e.target));
  return <group>{modules.map(m => {
    const p = positions.get(m.id)!; const color = stateColor(m.state);
    return <group key={m.id} position={p} onClick={e => { e.stopPropagation(); onSelect(m.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <mesh position={[0, .08, 0]}><cylinderGeometry args={[.18, .42, .25, 12]} /><meshStandardMaterial color="#365573" metalness={.5} roughness={.37} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .01, 0]}><ringGeometry args={[.6, .67, 32]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, .48, 0]}><sphereGeometry args={[.1, 8, 8]} /><meshBasicMaterial color={color} /></mesh>
      <ModuleLabel name={m.name} state={m.state} compact />
    </group>;
  })}{edges.map((e, i) => <TopologyArc key={`execution-${e.source}-${e.target}-${i}`} from={positions.get(e.source)!} to={positions.get(e.target)!} color={testedGate?.conditionId === e.source && testedGate.stepId === e.target ? '#56c4b2' : '#3988c9'} />)}{policyEdges.map((e, i) => <TopologyArc key={`policy-${e.source}-${e.target}-${i}`} from={positions.get(e.source)!} to={positions.get(e.target)!} color={modules.find(m => m.id === e.source)?.state === 'VIOLATED' ? '#f07858' : '#876fbc'} />)}</group>;
}

function Installation({ modules, workflow, selected, testedGate, onSelect, overview }: { modules: Module[]; workflow: Workflow; selected: string | null; testedGate: TestedGate; onSelect: (id: string) => void; overview: boolean }) {
  const positions = new Map(modules.map(m => [m.id, m]));
  const links = workflow.steps.flatMap(s => [...s.executionGateIds, ...s.dependsOn].map(source => ({ source, target: s.id }))).filter(l => positions.has(l.source) && positions.has(l.target));
  const policyLinks = workflow.policyRules.flatMap(rule => rule.requiredConditionIds.map(source => ({ source, target: rule.subjectStepId }))).filter(l => positions.has(l.source) && positions.has(l.target));
  return <group><Environment />
    {modules.map(m => <ExecutionModule key={m.id} module={m} selected={selected === m.id} onSelect={onSelect} showLabel={!overview && selected === m.id} />)}
    {links.map((l, i) => { const a = positions.get(l.source)!; const b = positions.get(l.target)!; const sameColumn = Math.abs(a.x - b.x) < .1; const tested = testedGate?.conditionId === l.source && testedGate.stepId === l.target; return <Route key={`execution-${l.source}-${l.target}-${i}`} from={[a.x + 1.55, .54, a.z - .54]} to={[b.x + (sameColumn ? 1.55 : -1.55), .54, b.z - .54]} color={tested ? '#56c4b2' : selected === l.source || selected === l.target ? '#a0dbff' : '#56aee7'} onSelect={() => onSelect(l.target)} />; })}
    {policyLinks.map((l, i) => { const a = positions.get(l.source)!; const b = positions.get(l.target)!; const sameColumn = Math.abs(a.x - b.x) < .1; return <Route key={`policy-${l.source}-${l.target}-${i}`} from={[a.x + 1.55, .54, a.z + .54]} to={[b.x + (sameColumn ? 1.55 : -1.55), .54, b.z + .54]} color={a.state === 'VIOLATED' ? '#f07858' : '#796ca5'} thin onSelect={() => onSelect(l.source)} />; })}
    {overview && <TopologyOverview modules={modules} workflow={workflow} testedGate={testedGate} onSelect={onSelect} />}
  </group>;
}

function moduleKind(name: string, actionType?: Workflow['steps'][number]['actionType']): HardwareKind {
  const normalized = name.toLowerCase();
  if (actionType === 'DEPLOY') return 'DEPLOY';
  if (actionType === 'ROLLBACK' || normalized.includes('rollback')) return 'ROLLBACK';
  if (normalized.includes('approval') || actionType === 'APPROVE') return 'APPROVAL';
  if (normalized.includes('test')) return 'TEST';
  if (normalized.includes('migration') || actionType === 'MIGRATE') return 'MIGRATION';
  if (normalized.includes('monitor') || normalized.includes('canary')) return 'MONITOR';
  return actionType ? 'STEP' : 'CONDITION';
}

export default function SpatialScene({ workflow, result, intervention, selected, testedGate, onSelect, cameraState, reducedMotion, zoom }: Props) {
  const [failed, setFailed] = useState(false);
  const modules = useMemo<Module[]>(() => {
    const items = [...workflow.conditions.map(c => ({ id: c.id, name: c.name, actionType: undefined })), ...workflow.steps.map(s => ({ id: s.id, name: s.name, actionType: s.actionType }))];
    return items.map((item, i) => {
      return { id: item.id, name: item.name, x: (i % 2) * 3.7 - 1.85, z: Math.floor(i / 2) * 3.2 - 1.6, state: visualState(workflow, result, intervention, item.id), kind: moduleKind(item.name, item.actionType) };
    });
  }, [workflow, result, intervention]);
  if (failed) return <WorkflowMap workflow={workflow} result={result} intervention={intervention} selected={selected} testedGate={testedGate} onSelect={onSelect} />;
  const overview = cameraState === 'OVERVIEW' || cameraState === 'RETURN';
  return <div className="spatial-scene" aria-label="Interactive workflow execution lattice" data-camera-state={cameraState}>
    <Canvas frameloop="demand" camera={{ position: [12, 18, 24], fov: 36, near: .1, far: 200 }} dpr={window.innerWidth > 900 ? .8 : 1} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', () => setFailed(true))}>
      <color attach="background" args={['#0a1424']} /><fog attach="fog" args={['#0a1424', 32, 85]} />
      <hemisphereLight args={['#9bb8d4', '#0a1421', .72]} />
      <ambientLight intensity={.35} color="#849fbb" />
      <directionalLight position={[5, 12, 9]} intensity={2.1} color="#d2e4f2" />
      <directionalLight position={[-8, 6, -5]} intensity={1.35} color="#4b91c7" />
      <pointLight position={[1, 3, -2]} intensity={4.5} distance={12} color="#578fbc" />
      <CameraDirector state={cameraState} selected={selected} modules={modules} reducedMotion={reducedMotion} zoom={zoom} />
      <RenderMeter />
      <Installation modules={modules} workflow={workflow} selected={selected} testedGate={testedGate} onSelect={onSelect} overview={overview} />
    </Canvas>
  </div>;
}
