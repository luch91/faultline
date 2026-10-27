import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export type AtlasPoint = { id: string; name: string; kind: string; x: number; y: number; color: string };
export type AtlasRoute = { id: string; from: AtlasPoint; to: AtlasPoint; color: string; dashed?: boolean };
export type AtlasEvidence = { id: string; x: number; y: number };
type Props = { points: AtlasPoint[]; routes: AtlasRoute[]; evidence: AtlasEvidence[]; selected: string | null; onSelect: (id: string) => void; onReady: () => void; onFailure: () => void };

function hash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise(x: number, y: number) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf); const sy = yf * yf * (3 - 2 * yf);
  const a = THREE.MathUtils.lerp(hash(xi, yi), hash(xi + 1, yi), sx);
  const b = THREE.MathUtils.lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), sx);
  return THREE.MathUtils.lerp(a, b, sy);
}

function relief(x: number, z: number) {
  const broad = noise(x * .065 + 12, z * .065 + 8);
  const detail = noise(x * .18 + 4, z * .18 + 17);
  return (broad - .5) * 2.2 + (detail - .5) * .48;
}

function world(x: number, y: number) {
  const px = (x - 450) / 11;
  const pz = (y - 295) / 13;
  return new THREE.Vector3(px, relief(px, pz), pz);
}

function terrainGeometry() {
  const geometry = new THREE.PlaneGeometry(150, 150, 220, 220);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i); const z = position.getZ(i);
    position.setY(i, relief(x, z));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function terrainTexture() {
  const size = 384;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const wx = (x / (size - 1) - .5) * 150;
    const wz = (y / (size - 1) - .5) * 150;
    const warpX = wx + (noise(wx * .19 + 7, wz * .19 + 19) - .5) * 5;
    const warpZ = wz + (noise(wx * .19 + 41, wz * .19 + 3) - .5) * 5;
    const broad = noise(warpX * .065 + 31, warpZ * .065 + 25) * .69 + noise(warpX * .14 + 9, warpZ * .14 + 23) * .31;
    const fine = noise(wx * .54 + 14, wz * .54 + 38);
    const grain = noise(wx * 1.5 + 50, wz * 1.5 + 4);
    const land = THREE.MathUtils.smoothstep(broad, .45, .51);
    const elevation = relief(wx, wz);
    const contour = land > .32 && Math.abs((elevation + 5) % .27 - .135) < .012 ? 1 : 0;
    const fracture = Math.abs(noise(wx * .12 + 79, wz * .12 + 8) - .5) < .008 ? -4 : 0;
    const detail = (fine - .5) * 16 + (grain - .5) * 8 + contour + fracture;
    const offset = (y * size + x) * 4;
    data[offset] = Math.max(0, Math.round(17 + land * 17 + detail));
    data[offset + 1] = Math.max(0, Math.round(27 + land * 22 + detail));
    data[offset + 2] = Math.max(0, Math.round(48 + land * 27 + detail));
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function Terrain() {
  const geometry = useMemo(terrainGeometry, []);
  const texture = useMemo(terrainTexture, []);
  useEffect(() => () => { geometry.dispose(); texture.dispose(); }, [geometry, texture]);
  return <mesh geometry={geometry} receiveShadow><meshBasicMaterial map={texture} /></mesh>;
}

function routePoint(route: AtlasRoute, t: number) {
  const reverse = 1 - t;
  const controlX = (route.from.x + route.to.x) / 2;
  const controlY = Math.min(route.from.y, route.to.y) - 105;
  return { x: reverse * reverse * route.from.x + 2 * reverse * t * controlX + t * t * route.to.x, y: reverse * reverse * route.from.y + 2 * reverse * t * controlY + t * t * route.to.y };
}

function RouteField({ routes }: { routes: AtlasRoute[] }) {
  const samples = useMemo(() => routes.filter(route => !route.dashed).flatMap(route => {
    const seed = [...route.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return Array.from({ length: 16 }, (_, index) => .04 + index * .06).map((t, index) => {
      const point = routePoint(route, t);
      return { x: point.x + Math.sin(seed * .13 + index * 2.3) * 26, y: point.y + Math.cos(seed * .19 + index * 1.7) * 30, scale: index % 5 === 0 ? .68 : .44, color: route.color };
    });
  }), [routes]);
  const blue = samples.filter(sample => sample.color === '#71aee5');
  const purple = samples.filter(sample => sample.color !== '#71aee5' && sample.color !== '#d77b70');
  const coral = samples.filter(sample => sample.color === '#d77b70');
  return <>{[[blue, '#70b4ea'], [purple, '#9780c4'], [coral, '#ed8777']].map(([items, color]) => <ArcInstances key={color as string} items={items as typeof samples} color={color as string} />)}</>;
}

function ArcInstances({ items, color }: { items: Array<{ x: number; y: number; scale: number }>; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const shellRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.TorusGeometry(1.35, .11, 7, 24, Math.PI), []);
  const shellGeometry = useMemo(() => new THREE.SphereGeometry(1.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95, toneMapped: false }), [color]);
  const shellMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#29415f', emissive: '#10233b', emissiveIntensity: .28, roughness: .77, metalness: .15, transparent: true, opacity: .72, side: THREE.DoubleSide }), []);
  useEffect(() => {
    const mesh = ref.current; const shell = shellRef.current; if (!mesh || !shell) return;
    const object = new THREE.Object3D();
    items.forEach((item, index) => {
      const position = world(item.x, item.y);
      object.position.set(position.x, position.y + .13, position.z);
      object.scale.setScalar(item.scale); object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
      shell.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    shell.instanceMatrix.needsUpdate = true;
  }, [items]);
  useEffect(() => () => { geometry.dispose(); shellGeometry.dispose(); material.dispose(); shellMaterial.dispose(); }, [geometry, shellGeometry, material, shellMaterial]);
  return <group><instancedMesh ref={shellRef} args={[shellGeometry, shellMaterial, items.length]} frustumCulled={false} /><instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} /></group>;
}

function EntityMarker({ point, selected, onSelect }: { point: AtlasPoint; selected: boolean; onSelect: (id: string) => void }) {
  const position = world(point.x, point.y);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: point.color, emissive: point.color, emissiveIntensity: selected ? 1.8 : .8, metalness: .22, roughness: .38 }), [point.color, selected]);
  const label = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(7, 16, 31, .86)'; context.fillRect(0, 0, 320, 64);
      context.strokeStyle = selected ? '#7cbbea' : '#365675'; context.lineWidth = 3; context.strokeRect(1.5, 1.5, 317, 61);
      context.fillStyle = '#d9e8f4'; context.font = '27px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle';
      const name = point.name.length > 19 ? `${point.name.slice(0, 18)}...` : point.name;
      context.fillText(name, 160, 32);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    return { texture, spriteMaterial };
  }, [point.name, selected]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => { label.spriteMaterial.dispose(); label.texture.dispose(); }, [label]);
  return <group position={[position.x, position.y, position.z]} onClick={event => { event.stopPropagation(); onSelect(point.id); }} onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
    <mesh position={[0, .05, 0]} rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[.17, .23, .11, 10]} /><meshStandardMaterial color="#263d59" roughness={.7} metalness={.2} /></mesh>
    <mesh position={[0, .06, 0]}><sphereGeometry args={[1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#29435e" emissive="#10253e" emissiveIntensity={.3} metalness={.2} roughness={.67} transparent opacity={.78} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, .06, 0]} material={material} scale={selected ? 1.2 : 1}><torusGeometry args={[1.3, .12, 8, 28, Math.PI]} /></mesh>
    <mesh position={[0, .09, 0]}><sphereGeometry args={[.09, 8, 8]} /><meshBasicMaterial color={point.color} toneMapped={false} /></mesh>
    <sprite position={[0, 1.35, 0]} scale={[2.9, .58, 1]} material={label.spriteMaterial} />
    {selected && <pointLight position={[0, .4, .2]} intensity={1.2} distance={3.8} color={point.color} />}
  </group>;
}

function EvidenceMarker({ point }: { point: AtlasEvidence }) {
  const position = world(point.x, point.y);
  return <group position={[position.x, position.y, position.z]}>
    <mesh position={[0, .38, 0]}><coneGeometry args={[.17, .72, 4]} /><meshStandardMaterial color="#2e8f9e" emissive="#38a3b0" emissiveIntensity={.65} metalness={.2} roughness={.5} transparent opacity={.78} /></mesh>
    <mesh position={[0, .03, 0]}><sphereGeometry args={[.06, 6, 6]} /><meshBasicMaterial color="#75ccd0" /></mesh>
  </group>;
}

function GroundRoutes({ routes }: { routes: AtlasRoute[] }) {
  const lines = useMemo(() => routes.map(route => {
    const points = Array.from({ length: 20 }, (_, index) => { const point = routePoint(route, index / 19); const position = world(point.x, point.y); position.y += .05; return position; });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: route.color, transparent: true, opacity: .09 });
    return { id: route.id, geometry, material, object: new THREE.Line(geometry, material) };
  }), [routes]);
  useEffect(() => () => lines.forEach(line => { line.geometry.dispose(); line.material.dispose(); }), [lines]);
  return <>{lines.map(line => <primitive key={line.id} object={line.object} />)}</>;
}

export default function AtlasScene({ points, routes, evidence, selected, onSelect, onReady, onFailure }: Props) {
  return <div className="atlas-3d" aria-label="Interactive 3D workflow topology">
    <Canvas frameloop="demand" camera={{ position: [0, 55, 34], fov: 46, near: .1, far: 180 }} dpr={Math.min(window.devicePixelRatio || 1, 1)} gl={{ antialias: true, powerPreference: 'low-power' }} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', onFailure); onReady(); }}>
      <color attach="background" args={['#0a1428']} />
      <fog attach="fog" args={['#0a1428', 75, 145]} />
      <hemisphereLight args={['#6688ae', '#06101e', .72]} />
      <ambientLight intensity={.3} color="#6f8ead" />
      <directionalLight position={[-8, 14, 6]} intensity={1.7} color="#94b4d5" />
      <directionalLight position={[12, 7, -10]} intensity={.6} color="#456d9b" />
      <Terrain />
      <GroundRoutes routes={routes} />
      <RouteField routes={routes} />
      {evidence.map(point => <EvidenceMarker key={point.id} point={point} />)}
      {points.map(point => <EntityMarker key={point.id} point={point} selected={selected === point.id} onSelect={onSelect} />)}
    </Canvas>
  </div>;
}
