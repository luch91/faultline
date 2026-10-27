import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Workflow, EvaluationResult } from '@faultline/contracts';

type State = 'SAFE' | 'UNSAFE' | 'UNKNOWN' | 'BLOCKED' | 'READY';
type Kind = 'APPROVAL' | 'TEST' | 'MIGRATION' | 'DEPLOY' | 'MONITOR' | 'ROLLBACK' | 'CONDITION' | 'STEP';
type Module = { id: string; name: string; x: number; z: number; state: State; kind: Kind };
type Props = { workflow: Workflow; result: EvaluationResult | null; selected: string | null; onSelect: (id: string) => void; overview: boolean; reducedMotion: boolean; zoom: number };

function stateColor(state: State) {
  if (state === 'UNSAFE') return '#f07858';
  if (state === 'UNKNOWN') return '#e7b861';
  if (state === 'BLOCKED') return '#bd8173';
  if (state === 'SAFE') return '#51cbbb';
  return '#70b5ff';
}

function ModuleLabel({ name, state, compact = false }: { name: string; state: State; compact?: boolean }) {
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
  return <sprite position={[0, compact ? 1.25 : 1.94, 0]} scale={compact ? [2.5, .44, 1] : [3.08, .54, 1]}><spriteMaterial map={texture} transparent depthWrite={false} /></sprite>;
}

function CameraRig({ overview, selected, modules, reducedMotion, zoom }: { overview: boolean; selected: string | null; modules: Module[]; reducedMotion: boolean; zoom: number }) {
  const { camera, invalidate } = useThree();
  const lookAt = useRef(new THREE.Vector3());
  useEffect(() => { invalidate(); }, [overview, selected, modules, reducedMotion, zoom, invalidate]);
  useFrame((_, delta) => {
    const chosen = modules.find(m => m.id === selected);
    const focus = overview ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3((chosen?.x ?? 0) * .45, 0, (chosen?.z ?? 0) * .45);
    const offset = overview ? new THREE.Vector3(14, 20, 27) : new THREE.Vector3(5.2, 7.3, 10.5);
    offset.multiplyScalar(zoom);
    const destination = focus.clone().add(offset);
    const ease = reducedMotion ? 1 : 1 - Math.exp(-delta * (overview ? 2.7 : 3.4));
    camera.position.lerp(destination, ease);
    lookAt.current.lerp(focus, ease);
    camera.lookAt(lookAt.current);
    if (camera.position.distanceTo(destination) > .015 || lookAt.current.distanceTo(focus) > .015) invalidate();
  });
  return null;
}

function Route({ from, to, color, thin = false }: { from: [number, number, number]; to: [number, number, number]; color: string; thin?: boolean }) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...from); const b = new THREE.Vector3(...to);
    const bendX = (a.x + b.x) / 2;
    const points = [a, new THREE.Vector3(bendX, a.y, a.z), new THREE.Vector3(bendX, b.y, b.z), b];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 32, thin ? .035 : .06, 6, false);
  }, [from, to, thin]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshBasicMaterial color={color} toneMapped={false} /></mesh>;
}

function Environment() {
  const ribs = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ x: i % 2 ? 10 + Math.floor(i / 2) * .78 : -10 - Math.floor(i / 2) * .78, z: (i % 9) * 3.5 - 14, height: .18 + (i % 4) * .08 })), []);
  return <group>
    <mesh position={[0, -.34, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[90, 90]} /><meshStandardMaterial color="#0a1424" roughness={1} /></mesh>
    <gridHelper args={[90, 90, '#284462', '#172a41']} position={[0, -.28, 0]} />
    <mesh position={[0, -.16, 0]}><boxGeometry args={[20, .23, 16]} /><meshStandardMaterial color="#11243a" roughness={.86} metalness={.18} /></mesh>
    <mesh position={[0, -.025, 0]}><boxGeometry args={[17.5, .045, 13.7]} /><meshStandardMaterial color="#17304b" roughness={.7} metalness={.25} /></mesh>
    {ribs.map((r, i) => <mesh key={i} position={[r.x, r.height / 2 - .22, r.z]}><boxGeometry args={[.16, r.height, 2.6]} /><meshStandardMaterial color="#203a58" roughness={.8} metalness={.25} /></mesh>)}
    {[-1, 1].map(side => <group key={side} position={[side * 8.85, .05, 0]}><mesh><boxGeometry args={[.1, .2, 13.7]} /><meshBasicMaterial color="#34709a" transparent opacity={.42} /></mesh></group>)}
  </group>;
}

function StatusSocket({ x, color }: { x: number; color: string }) {
  return <group position={[x, .61, 0]} rotation={[0, 0, Math.PI / 2]}>
    <mesh><cylinderGeometry args={[.25, .25, .15, 16]} /><meshStandardMaterial color="#172d46" metalness={.65} roughness={.35} /></mesh>
    <mesh position={[0, .08, 0]}><torusGeometry args={[.17, .035, 6, 20]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
}

function ModuleHardware({ kind, color, blocked }: { kind: Kind; color: string; blocked: boolean }) {
  if (kind === 'APPROVAL') return <group>
    {[-.77, .77].map(x => <mesh key={x} position={[x, 1.12, 0]}><boxGeometry args={[.28, .83, 1.05]} /><meshStandardMaterial color="#39516b" metalness={.65} roughness={.3} /></mesh>)}
    <mesh position={[0, 1.48, 0]}><boxGeometry args={[1.82, .18, .25]} /><meshStandardMaterial color="#5c7591" metalness={.55} roughness={.35} /></mesh>
    <mesh position={[0, 1.08, .1]}><boxGeometry args={[blocked ? 1.28 : .32, .38, .23]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.24} /></mesh>
    <mesh position={[0, .84, .56]}><boxGeometry args={[1.45, .06, .12]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
  if (kind === 'TEST') return <group>
    {[-.74, 0, .74].map((x, i) => <group key={x} position={[x, 1.05, 0]}>
      <mesh><boxGeometry args={[.5, .55, 1.3]} /><meshStandardMaterial color="#314d6c" metalness={.45} roughness={.38} /></mesh>
      <mesh position={[0, .3, 0]}><boxGeometry args={[.42, .04, 1.18]} /><meshBasicMaterial color={i === 1 ? color : '#648bad'} /></mesh>
      <mesh position={[0, .04, .68]}><boxGeometry args={[.2, .13, .035]} /><meshBasicMaterial color={color} /></mesh>
    </group>)}
  </group>;
  if (kind === 'MIGRATION') return <group>
    {[-.68, 0, .68].map((x, i) => <group key={x} position={[x, 1.01, 0]}>
      <mesh><cylinderGeometry args={[.29, .29, .39, 18]} /><meshStandardMaterial color="#385577" metalness={.6} roughness={.33} /></mesh>
      <mesh position={[0, .22, 0]}><cylinderGeometry args={[.31, .31, .06, 18]} /><meshStandardMaterial color={i === 1 ? color : '#708ca9'} emissive={i === 1 ? color : '#0a1a29'} emissiveIntensity={.18} /></mesh>
      <mesh position={[0, -.18, 0]}><cylinderGeometry args={[.31, .31, .05, 18]} /><meshStandardMaterial color="#83a2bd" /></mesh>
    </group>)}
    <mesh position={[0, .83, -.57]}><boxGeometry args={[1.9, .1, .13]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
  if (kind === 'DEPLOY') return <group>
    <mesh position={[0, 1.1, 0]}><boxGeometry args={[1.12, .79, 1.2]} /><meshStandardMaterial color="#324e6e" metalness={.58} roughness={.34} /></mesh>
    <mesh position={[0, 1.16, .61]}><boxGeometry args={[.8, .31, .06]} /><meshBasicMaterial color="#0a1d2d" /></mesh>
    <mesh position={[0, 1.16, .655]}><boxGeometry args={[.54, .08, .02]} /><meshBasicMaterial color={color} /></mesh>
    {[-.88, .88].map(x => <group key={x} position={[x, .95, 0]}><mesh><boxGeometry args={[.28, .42, 1.5]} /><meshStandardMaterial color="#55718e" metalness={.55} roughness={.34} /></mesh><mesh position={[0, .24, 0]}><boxGeometry args={[.11, .04, 1.3]} /><meshBasicMaterial color={color} /></mesh></group>)}
  </group>;
  if (kind === 'MONITOR') return <group>
    {[-.7, 0, .7].map((x, i) => <mesh key={x} position={[x, 1.05 + i * .12, 0]}><boxGeometry args={[.38, .55 + i * .24, .38]} /><meshStandardMaterial color={i === 1 ? color : '#4b7194'} metalness={.5} roughness={.35} /></mesh>)}
    <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.72, .035, 6, 32]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
  if (kind === 'ROLLBACK') return <group>
    <mesh position={[0, 1.06, 0]}><cylinderGeometry args={[.65, .65, .44, 8]} /><meshStandardMaterial color="#42617d" metalness={.5} roughness={.35} /></mesh>
    <mesh position={[0, 1.33, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.48, .07, 8, 28]} /><meshBasicMaterial color={color} /></mesh>
    <mesh position={[0, 1.34, -.5]}><boxGeometry args={[.14, .32, .18]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
  return <group>
    <mesh position={[0, 1.06, 0]}><boxGeometry args={[1.38, .46, .9]} /><meshStandardMaterial color="#405c77" metalness={.5} roughness={.38} /></mesh>
    <mesh position={[0, 1.31, 0]}><boxGeometry args={[1.18, .05, .7]} /><meshBasicMaterial color={color} transparent opacity={.55} /></mesh>
  </group>;
}

function ExecutionModule({ module, selected, onSelect }: { module: Module; selected: boolean; onSelect: (id: string) => void }) {
  const color = stateColor(module.state);
  return <group position={[module.x, 0, module.z]} onClick={e => { e.stopPropagation(); onSelect(module.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
    <mesh position={[0, .08, 0]}><boxGeometry args={[3.12, .2, 2.34]} /><meshStandardMaterial color="#314c69" metalness={.54} roughness={.36} /></mesh>
    <mesh position={[0, .3, 0]}><boxGeometry args={[2.88, .34, 2.12]} /><meshStandardMaterial color="#172c46" metalness={.42} roughness={.48} /></mesh>
    <mesh position={[0, .55, 0]}><boxGeometry args={[2.58, .17, 1.8]} /><meshStandardMaterial color="#263f5c" metalness={.56} roughness={.35} /></mesh>
    {[-1.35, 1.35].map(x => <mesh key={x} position={[x, .72, 0]}><boxGeometry args={[.13, .38, 2.04]} /><meshStandardMaterial color="#6687a5" metalness={.62} roughness={.31} /></mesh>)}
    <StatusSocket x={-1.51} color={color} /><StatusSocket x={1.51} color={color} />
    <ModuleHardware kind={module.kind} color={color} blocked={module.state === 'BLOCKED' || module.state === 'UNSAFE'} />
    <mesh position={[0, .46, 1.073]}><boxGeometry args={[2.42, .14, .055]} /><meshBasicMaterial color={color} /></mesh>
    {[0, 1, 2, 3].map(i => <mesh key={i} position={[-1.03 + i * .68, .46, 1.113]}><boxGeometry args={[.13, .05, .015]} /><meshBasicMaterial color={i === 0 ? color : '#527692'} /></mesh>)}
    {selected && <mesh position={[0, .015, 0]}><boxGeometry args={[3.32, .045, 2.54]} /><meshBasicMaterial color="#81c2ff" transparent opacity={.8} /></mesh>}
    {(module.state === 'UNSAFE' || module.state === 'UNKNOWN') && <mesh position={[0, 2.33, 0]}><octahedronGeometry args={[.2]} /><meshBasicMaterial color={color} /></mesh>}
    <ModuleLabel name={module.name} state={module.state} />
    <mesh position={[0, .16, -1.22]}><boxGeometry args={[2.55, .055, .04]} /><meshBasicMaterial color="#668dab" /></mesh>
    <mesh position={[0, .13, 1.24]}><boxGeometry args={[2.65, .08, .04]} /><meshBasicMaterial color="#294864" /></mesh>
    <mesh position={[0, .1, -.9]}><boxGeometry args={[.05, .06, .05]} /><meshBasicMaterial color={color} /></mesh>
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

function TopologyOverview({ modules, workflow, onSelect }: { modules: Module[]; workflow: Workflow; onSelect: (id: string) => void }) {
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
  })}{edges.map((e, i) => <TopologyArc key={`execution-${e.source}-${e.target}-${i}`} from={positions.get(e.source)!} to={positions.get(e.target)!} color="#3988c9" />)}{policyEdges.map((e, i) => <TopologyArc key={`policy-${e.source}-${e.target}-${i}`} from={positions.get(e.source)!} to={positions.get(e.target)!} color={modules.find(m => m.id === e.source)?.state === 'UNSAFE' ? '#f07858' : '#876fbc'} />)}</group>;
}

function Installation({ modules, workflow, selected, onSelect, overview }: { modules: Module[]; workflow: Workflow; selected: string | null; onSelect: (id: string) => void; overview: boolean }) {
  const positions = new Map(modules.map(m => [m.id, m]));
  const links = workflow.steps.flatMap(s => [...s.executionGateIds, ...s.dependsOn].map(source => ({ source, target: s.id }))).filter(l => positions.has(l.source) && positions.has(l.target));
  const policyLinks = workflow.policyRules.flatMap(rule => rule.requiredConditionIds.map(source => ({ source, target: rule.subjectStepId }))).filter(l => positions.has(l.source) && positions.has(l.target));
  return <group><Environment />
    {modules.map(m => <ExecutionModule key={m.id} module={m} selected={selected === m.id} onSelect={onSelect} />)}
    {links.map((l, i) => { const a = positions.get(l.source)!; const b = positions.get(l.target)!; return <Route key={`execution-${l.source}-${l.target}-${i}`} from={[a.x + 1.48, .17, a.z]} to={[b.x - 1.48, .17, b.z]} color={selected === l.source || selected === l.target ? '#8bd5ff' : '#4b9fd9'} />; })}
    {policyLinks.map((l, i) => { const a = positions.get(l.source)!; const b = positions.get(l.target)!; return <Route key={`policy-${l.source}-${l.target}-${i}`} from={[a.x + 1.48, .29, a.z]} to={[b.x - 1.48, .29, b.z]} color={a.state === 'UNSAFE' || a.state === 'BLOCKED' ? '#f07858' : '#9d88c7'} thin />; })}
    {overview && <TopologyOverview modules={modules} workflow={workflow} onSelect={onSelect} />}
  </group>;
}

function moduleKind(name: string, actionType?: Workflow['steps'][number]['actionType']): Kind {
  const normalized = name.toLowerCase();
  if (actionType === 'DEPLOY') return 'DEPLOY';
  if (actionType === 'ROLLBACK' || normalized.includes('rollback')) return 'ROLLBACK';
  if (normalized.includes('approval') || actionType === 'APPROVE') return 'APPROVAL';
  if (normalized.includes('test')) return 'TEST';
  if (normalized.includes('migration') || actionType === 'MIGRATE') return 'MIGRATION';
  if (normalized.includes('monitor') || normalized.includes('canary')) return 'MONITOR';
  return actionType ? 'STEP' : 'CONDITION';
}

export default function SpatialScene({ workflow, result, selected, onSelect, overview, reducedMotion, zoom }: Props) {
  const [failed, setFailed] = useState(false);
  const modules = useMemo<Module[]>(() => {
    const items = [...workflow.conditions.map(c => ({ id: c.id, name: c.name, actionType: undefined })), ...workflow.steps.map(s => ({ id: s.id, name: s.name, actionType: s.actionType }))];
    return items.map((item, i) => {
      const condition = workflow.conditions.find(c => c.id === item.id);
      const step = result?.stepResults.find(s => s.stepId === item.id);
      const violated = condition && result?.affectedNodeIds.includes(item.id);
      const state: State = violated ? 'UNSAFE' : condition?.observedValue === null || step?.eligibility === 'UNKNOWN' ? 'UNKNOWN' : condition ? condition.observedValue === condition.expectedValue ? 'SAFE' : 'BLOCKED' : step?.eligibility === 'VIOLATED' ? 'BLOCKED' : step?.executes ? 'SAFE' : 'READY';
      return { id: item.id, name: item.name, x: (i % 2) * 3.7 - 1.85, z: Math.floor(i / 2) * 3.2 - 1.6, state, kind: moduleKind(item.name, item.actionType) };
    });
  }, [workflow, result]);
  if (failed) return <div className="scene-fallback" role="list" aria-label="Workflow modules">{modules.map(m => <button role="listitem" key={m.id} onClick={() => onSelect(m.id)}>{m.name}<span>{m.state}</span></button>)}</div>;
  return <div className="spatial-scene" aria-label="Interactive workflow execution lattice">
    <Canvas frameloop="demand" camera={{ position: [12, 18, 24], fov: 36, near: .1, far: 200 }} dpr={1} gl={{ antialias: true, powerPreference: 'low-power' }} onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', () => setFailed(true))}>
      <color attach="background" args={['#0a1424']} /><fog attach="fog" args={['#0a1424', 32, 85]} />
      <ambientLight intensity={1.2} color="#8eaed1" />
      <directionalLight position={[5, 12, 10]} intensity={2.6} color="#d6e6ff" />
      <directionalLight position={[-8, 6, -4]} intensity={1.1} color="#368dd2" />
      <CameraRig overview={overview} selected={selected} modules={modules} reducedMotion={reducedMotion} zoom={zoom} />
      <Installation modules={modules} workflow={workflow} selected={selected} onSelect={onSelect} overview={overview} />
    </Canvas>
  </div>;
}
