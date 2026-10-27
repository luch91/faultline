import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Workflow, EvaluationResult } from '@faultline/contracts';

type Props = { workflow: Workflow; result: EvaluationResult | null; selected: string | null; onSelect: (id: string) => void; overview: boolean; reducedMotion: boolean };
type Module = { id: string; name: string; x: number; z: number; state: 'SAFE' | 'UNSAFE' | 'UNKNOWN' | 'BLOCKED' | 'READY' };

function panelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#526e96';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(228,239,255,.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 24) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(221,237,255,.8)';
  ctx.strokeRect(2, 2, 252, 252);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function CameraRig({ overview, selected, modules, reducedMotion }: { overview: boolean; selected: string | null; modules: Module[]; reducedMotion: boolean }) {
  const { camera, invalidate } = useThree();
  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  useEffect(() => { invalidate(); }, [overview, selected, modules, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    const chosen = modules.find(m => m.id === selected);
    const focus = overview ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(chosen?.x ?? 0, 0, chosen?.z ?? 0);
    const destination = overview ? new THREE.Vector3(13, 19, 24) : new THREE.Vector3(focus.x + 5.5, 7.6, focus.z + 10);
    const t = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.2);
    camera.position.lerp(destination, t);
    target.current.lerp(focus, t);
    look.current.copy(target.current);
    camera.lookAt(look.current);
    if (camera.position.distanceTo(destination) > .01 || target.current.distanceTo(focus) > .01) invalidate();
  });
  return null;
}

function Cable({ from, to, color }: { from: [number, number, number]; to: [number, number, number]; color: string }) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...from); const b = new THREE.Vector3(...to);
    const mid = new THREE.Vector3(b.x, a.y, a.z);
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid, b]), 28, .018, 5, false);
  }, [from, to]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshBasicMaterial color={color} /></mesh>;
}

function ModuleLabel({ name, state }: { name: string; state: Module['state'] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0b1a2c'; ctx.fillRect(0, 0, 512, 80);
    ctx.strokeStyle = state === 'UNSAFE' ? '#f07858' : '#6a9cc9'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, 508, 76);
    ctx.fillStyle = '#e5f2ff'; ctx.font = 'bold 25px Arial'; ctx.fillText(name.length > 24 ? `${name.slice(0, 23)}...` : name, 20, 39);
    ctx.fillStyle = state === 'UNSAFE' ? '#ff9983' : '#9dc7e9'; ctx.font = '17px Arial'; ctx.fillText(state, 20, 66);
    return new THREE.CanvasTexture(canvas);
  }, [name, state]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={[0, 1.45, 0]} scale={[2.5, .39, 1]}><spriteMaterial map={texture} transparent depthWrite={false} /></sprite>;
}

function Installation({ modules, workflow, selected, onSelect, overview }: { modules: Module[]; workflow: Workflow; selected: string | null; onSelect: (id: string) => void; overview: boolean }) {
  const texture = useMemo(panelTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const positions = new Map(modules.map(m => [m.id, m]));
  const links = workflow.steps.flatMap(s => [...s.executionGateIds, ...s.dependsOn].map(source => ({ source, target: s.id })) ).filter(l => positions.has(l.source) && positions.has(l.target));
  return <group>
    <gridHelper args={[80, 80, '#1d3854', '#182838']} position={[0, -.12, 0]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.16, 0]}><planeGeometry args={[80, 80]} /><meshStandardMaterial color="#0b1425" roughness={1} /></mesh>
    <group position={[-7, 0, -1]}>
      <mesh position={[0, 1.2, 0]}><boxGeometry args={[1.8, 2.1, 1.1]} /><meshStandardMaterial color="#1b3350" metalness={.5} roughness={.5} /></mesh>
      <mesh position={[0, 1.6, .57]}><boxGeometry args={[1.1, .32, .035]} /><meshBasicMaterial color="#102639" /></mesh>
      <pointLight position={[0, 1.5, 1]} color="#3c9ff5" intensity={4} distance={5} />
    </group>
    {modules.map(m => {
      const color = m.state === 'UNSAFE' ? '#f07858' : m.state === 'UNKNOWN' ? '#e7b861' : m.state === 'BLOCKED' ? '#8c6c66' : m.state === 'SAFE' ? '#4bc9b6' : '#67aaff';
      return <group key={m.id} position={[m.x, 0, m.z]} onClick={e => { e.stopPropagation(); onSelect(m.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
        {[0, 1, 2, 3].map(i => <group key={i} position={[(i % 2) * 1.43 - .72, .53, Math.floor(i / 2) * 1.08 - .54]} rotation={[-.29, 0, 0]}>
          <mesh><boxGeometry args={[1.34, .055, 1.02]} /><meshStandardMaterial color={selected === m.id ? '#7fbae9' : '#3f668b'} metalness={.6} roughness={.3} emissive={color} emissiveIntensity={selected === m.id ? .35 : .08} /></mesh>
          <mesh position={[0, .06, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.25, .93]} /><meshBasicMaterial map={texture} color={m.state === 'UNSAFE' ? '#f5a99d' : '#d8e8ff'} /></mesh>
          <mesh position={[0, -.32, 0]}><boxGeometry args={[.04, .65, .04]} /><meshStandardMaterial color="#8093a9" /></mesh>
        </group>)}
        <mesh position={[0, .035, 0]}><boxGeometry args={[3.1, .05, 2.3]} /><meshBasicMaterial color={color} transparent opacity={selected === m.id ? .75 : .18} /></mesh>
        {(m.state === 'UNSAFE' || selected === m.id) && <mesh position={[0, 2.05, 0]}><octahedronGeometry args={[.2]} /><meshBasicMaterial color={color} /></mesh>}
        <ModuleLabel name={m.name} state={m.state} />
      </group>;
    })}
    {links.map((l, i) => {
      const a = positions.get(l.source)!; const b = positions.get(l.target)!;
      return <Cable key={`${l.source}-${l.target}-${i}`} from={[a.x, .03, a.z]} to={[b.x, .03, b.z]} color={selected === l.source || selected === l.target ? '#68baff' : '#245d9d'} />;
    })}
    <Cable from={[-7, .03, -1]} to={[modules[0]?.x ?? 0, .03, modules[0]?.z ?? 0]} color="#368fe6" />
    {overview && modules.map(m => <mesh key={`beacon-${m.id}`} position={[m.x, 2.6, m.z]}><sphereGeometry args={[.09, 8, 8]} /><meshBasicMaterial color={m.state === 'UNSAFE' ? '#f07858' : '#6ebaf4'} /></mesh>)}
  </group>;
}

export default function SpatialScene({ workflow, result, selected, onSelect, overview, reducedMotion }: Props) {
  const [failed, setFailed] = useState(false);
  const modules = useMemo<Module[]>(() => {
    const items = [...workflow.conditions.map(c => ({ id: c.id, name: c.name })), ...workflow.steps.map(s => ({ id: s.id, name: s.name }))];
    return items.map((item, i) => {
      const condition = workflow.conditions.find(c => c.id === item.id);
      const step = result?.stepResults.find(s => s.stepId === item.id);
      const violated = condition && result?.affectedNodeIds.includes(item.id);
      const state: Module['state'] = violated ? 'UNSAFE' : condition?.observedValue === null || step?.eligibility === 'UNKNOWN' ? 'UNKNOWN' : condition ? condition.observedValue === condition.expectedValue ? 'SAFE' : 'BLOCKED' : step?.eligibility === 'VIOLATED' ? 'BLOCKED' : step?.executes ? 'SAFE' : 'READY';
      return { ...item, x: (i % 2) * 3.55 - 1.8, z: Math.floor(i / 2) * 2.85 - 1.45, state };
    });
  }, [workflow, result]);
  if (failed) return <div className="scene-fallback" role="list" aria-label="Workflow modules">{modules.map(m => <button role="listitem" key={m.id} onClick={() => onSelect(m.id)}>{m.name}<span>{m.state}</span></button>)}</div>;
  return <div className="spatial-scene" aria-label="Interactive workflow execution lattice">
    <Canvas frameloop="demand" camera={{ position: [12, 18, 24], fov: 36, near: .1, far: 200 }} dpr={1} gl={{ antialias: false, powerPreference: 'low-power' }} onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', () => setFailed(true))}>
      <color attach="background" args={['#0b1425']} />
      <fog attach="fog" args={['#0b1425', 25, 75]} />
      <ambientLight intensity={1.6} color="#a1bee6" />
      <directionalLight position={[5, 12, 10]} intensity={2.8} color="#c8dcff" />
      <CameraRig overview={overview} selected={selected} modules={modules} reducedMotion={reducedMotion} />
      <Installation modules={modules} workflow={workflow} selected={selected} onSelect={onSelect} overview={overview} />
    </Canvas>
  </div>;
}
