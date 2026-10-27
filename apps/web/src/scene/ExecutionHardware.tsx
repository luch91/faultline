import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export type HardwareKind = 'APPROVAL' | 'TEST' | 'MIGRATION' | 'DEPLOY' | 'MONITOR' | 'ROLLBACK' | 'CONDITION' | 'STEP';

type BlockProps = {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
};

function ChamferedBlock({ size, position, color, metalness = .47, roughness = .4, emissive = '#000000' }: BlockProps) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => {
    const cut = Math.min(.11, width / 8, height / 8);
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 + cut, -height / 2);
    shape.lineTo(width / 2 - cut, -height / 2);
    shape.lineTo(width / 2, -height / 2 + cut);
    shape.lineTo(width / 2, height / 2 - cut);
    shape.lineTo(width / 2 - cut, height / 2);
    shape.lineTo(-width / 2 + cut, height / 2);
    shape.lineTo(-width / 2, height / 2 - cut);
    shape.lineTo(-width / 2, -height / 2 + cut);
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, { depth: depth - .06, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .025, bevelThickness: .03, curveSegments: 1 });
    result.translate(0, 0, -depth / 2 + .03);
    result.computeVertexNormals();
    return result;
  }, [width, height, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} castShadow receiveShadow><meshStandardMaterial color={color} metalness={metalness} roughness={roughness} emissive={emissive} emissiveIntensity={.08} /></mesh>;
}

function Fastener({ position }: { position: [number, number, number] }) {
  return <group position={position} rotation={[Math.PI / 2, 0, 0]}>
    <mesh castShadow><cylinderGeometry args={[.052, .052, .025, 8]} /><meshStandardMaterial color="#92a6b6" metalness={.75} roughness={.32} /></mesh>
    <mesh position={[0, .016, 0]}><boxGeometry args={[.052, .007, .012]} /><meshBasicMaterial color="#243e55" /></mesh>
  </group>;
}

function VentBank({ position, count = 5 }: { position: [number, number, number]; count?: number }) {
  return <group position={position}>{Array.from({ length: count }, (_, i) => <mesh key={i} position={[(i - (count - 1) / 2) * .16, 0, 0]}>
    <boxGeometry args={[.095, .018, .03]} /><meshBasicMaterial color="#071322" />
  </mesh>)}</group>;
}

function Signal({ position, color }: { position: [number, number, number]; color: string }) {
  return <group position={position}>
    <mesh><cylinderGeometry args={[.115, .115, .04, 12]} /><meshStandardMaterial color="#0a1928" metalness={.55} roughness={.4} /></mesh>
    <mesh position={[0, .026, 0]}><cylinderGeometry args={[.072, .072, .015, 12]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.5} roughness={.32} /></mesh>
  </group>;
}

function Socket({ x, z, color }: { x: number; z: number; color: string }) {
  return <group position={[x, .54, z]} rotation={[0, 0, Math.PI / 2]}>
    <mesh castShadow><cylinderGeometry args={[.24, .24, .18, 12]} /><meshStandardMaterial color="#30475d" metalness={.68} roughness={.34} /></mesh>
    <mesh position={[0, .105, 0]}><cylinderGeometry args={[.16, .16, .025, 12]} /><meshStandardMaterial color="#091b2c" metalness={.3} roughness={.54} /></mesh>
    <mesh position={[0, .124, 0]}><torusGeometry args={[.13, .018, 5, 16]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
}

function SharedChassis({ color }: { color: string }) {
  return <group>
    <mesh position={[0, .012, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.38, 2.56]} /><meshBasicMaterial color="#030a13" transparent opacity={.38} depthWrite={false} /></mesh>
    <ChamferedBlock size={[3.14, .23, 2.34]} position={[0, .12, 0]} color="#344e67" metalness={.62} roughness={.37} />
    <ChamferedBlock size={[2.94, .31, 2.13]} position={[0, .34, 0]} color="#14283c" metalness={.46} roughness={.46} />
    <ChamferedBlock size={[2.65, .16, 1.87]} position={[0, .57, 0]} color="#2d4962" metalness={.58} roughness={.35} />
    {[-1.34, 1.34].map(x => <group key={x} position={[x, .75, 0]}>
      <mesh castShadow><boxGeometry args={[.13, .38, 2.08]} /><meshStandardMaterial color="#5b7187" metalness={.69} roughness={.28} /></mesh>
      <mesh position={[0, .2, 0]}><boxGeometry args={[.045, .025, 1.87]} /><meshBasicMaterial color="#83a7c0" /></mesh>
    </group>)}
    <Socket x={-1.55} z={-.54} color={color} /><Socket x={1.55} z={-.54} color={color} />
    <Socket x={-1.55} z={.54} color={color} /><Socket x={1.55} z={.54} color={color} />
    <mesh position={[0, .455, 1.08]}><boxGeometry args={[2.5, .17, .045]} /><meshStandardMaterial color="#0b1b2c" metalness={.41} roughness={.52} /></mesh>
    {[-.72, 0, .72].map(x => <mesh key={x} position={[x, .455, 1.11]}><boxGeometry args={[.54, .075, .02]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.26} roughness={.34} /></mesh>)}
    <VentBank position={[-.73, .35, 1.085]} count={4} />
    <VentBank position={[.73, .35, 1.085]} count={4} />
    {[-1.25, 1.25].flatMap(x => [-.91, .91].map(z => <Fastener key={`${x}-${z}`} position={[x, .68, z]} />))}
  </group>;
}

function ApprovalGate({ color, blocked }: { color: string; blocked: boolean }) {
  return <group>
    {[-.84, .84].map(x => <group key={x} position={[x, 0, 0]}>
      <ChamferedBlock size={[.38, .92, 1.25]} position={[0, 1.14, 0]} color="#506b80" metalness={.64} roughness={.31} />
      <ChamferedBlock size={[.29, .57, .96]} position={[0, 1.15, .19]} color="#172d43" metalness={.45} roughness={.44} />
      <mesh position={[0, 1.22, .69]}><boxGeometry args={[.16, .35, .035]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.24} /></mesh>
      <Fastener position={[0, 1.49, .66]} /><Fastener position={[0, .88, .66]} />
    </group>)}
    <ChamferedBlock size={[1.92, .24, .4]} position={[0, 1.69, -.42]} color="#71889c" metalness={.67} roughness={.29} />
    <mesh position={[0, blocked ? 1.01 : 1.4, .18]} castShadow><boxGeometry args={[1.45, .35, .19]} /><meshStandardMaterial color="#47647b" metalness={.58} roughness={.34} /></mesh>
    <mesh position={[0, blocked ? 1.02 : 1.41, .291]}><boxGeometry args={[1.18, .075, .025]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.38} /></mesh>
    <mesh position={[0, .94, -.42]}><boxGeometry args={[1.41, .07, .17]} /><meshStandardMaterial color="#93aabb" metalness={.67} roughness={.27} /></mesh>
    <Signal position={[0, 1.86, -.42]} color={color} />
  </group>;
}

function TestRunner({ color }: { color: string }) {
  return <group>
    {[-.76, 0, .76].map((x, i) => <group key={x} position={[x, 0, 0]}>
      <ChamferedBlock size={[.57, .68, 1.37]} position={[0, 1.02, 0]} color={i === 1 ? '#41617b' : '#314c65'} metalness={.58} roughness={.34} />
      <mesh position={[0, 1.39, 0]}><boxGeometry args={[.4, .035, 1.2]} /><meshStandardMaterial color={i === 1 ? color : '#7799b2'} emissive={i === 1 ? color : '#000000'} emissiveIntensity={.25} metalness={.52} roughness={.32} /></mesh>
      <mesh position={[0, .98, .7]}><boxGeometry args={[.25, .18, .03]} /><meshStandardMaterial color="#0a1c2c" metalness={.3} roughness={.51} /></mesh>
      <mesh position={[0, .98, .72]}><boxGeometry args={[.17, .055, .01]} /><meshBasicMaterial color={color} /></mesh>
      <VentBank position={[0, 1.23, .695]} count={3} />
      <Fastener position={[0, 1.38, .56]} />
    </group>)}
    <ChamferedBlock size={[2.35, .18, .3]} position={[0, 1.51, -.62]} color="#6d879d" metalness={.66} roughness={.28} />
    <mesh position={[0, 1.53, -.44]}><boxGeometry args={[1.8, .035, .035]} /><meshBasicMaterial color={color} /></mesh>
    <Signal position={[-.97, .71, .75]} color={color} /><Signal position={[.97, .71, .75]} color={color} />
  </group>;
}

function MigrationCheck({ color }: { color: string }) {
  return <group>
    {[-.73, 0, .73].map((x, i) => <group key={x} position={[x, 1.08, 0]}>
      <mesh castShadow><cylinderGeometry args={[.31, .31, .5, 16]} /><meshStandardMaterial color="#36516d" metalness={.64} roughness={.32} /></mesh>
      <mesh position={[0, .255, 0]}><cylinderGeometry args={[.33, .33, .06, 16]} /><meshStandardMaterial color="#8299ac" metalness={.67} roughness={.3} /></mesh>
      <mesh position={[0, .29, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.24, .025, 6, 20]} /><meshBasicMaterial color={i === 1 ? color : '#608bab'} /></mesh>
      <mesh position={[0, -.25, 0]}><cylinderGeometry args={[.34, .34, .055, 16]} /><meshStandardMaterial color="#91a4b3" metalness={.69} roughness={.27} /></mesh>
      <mesh position={[0, 0, .306]}><boxGeometry args={[.15, .24, .018]} /><meshStandardMaterial color="#0c2234" metalness={.42} roughness={.49} /></mesh>
      <mesh position={[0, .06, .322]}><boxGeometry args={[.08, .035, .008]} /><meshBasicMaterial color={color} /></mesh>
    </group>)}
    <ChamferedBlock size={[2.2, .3, .25]} position={[0, .89, -.59]} color="#647f95" metalness={.63} roughness={.29} />
    <mesh position={[0, 1.11, -.58]}><boxGeometry args={[1.78, .035, .09]} /><meshBasicMaterial color={color} /></mesh>
    <VentBank position={[0, .71, .82]} count={6} />
  </group>;
}

function DeploymentController({ color, blocked }: { color: string; blocked: boolean }) {
  return <group>
    <ChamferedBlock size={[1.28, .86, 1.31]} position={[0, 1.16, -.02]} color="#3f5c74" metalness={.61} roughness={.35} />
    <ChamferedBlock size={[.91, .39, .08]} position={[0, 1.22, .67]} color="#112337" metalness={.33} roughness={.48} />
    <mesh position={[0, 1.23, .722]}><boxGeometry args={[.57, .08, .013]} /><meshBasicMaterial color={color} /></mesh>
    <mesh position={[0, 1.69, -.03]}><boxGeometry args={[.87, .025, .93]} /><meshStandardMaterial color="#7d98aa" metalness={.67} roughness={.28} /></mesh>
    <mesh position={[0, 1.724, -.03]}><boxGeometry args={[.69, .015, .76]} /><meshStandardMaterial color="#203a4d" metalness={.52} roughness={.42} /></mesh>
    {[-.25, 0, .25].map(x => <mesh key={x} position={[x, 1.738, -.03]}><boxGeometry args={[.07, .012, .58]} /><meshStandardMaterial color={x === 0 ? color : '#6d8da5'} emissive={x === 0 ? color : '#000000'} emissiveIntensity={.19} metalness={.42} roughness={.39} /></mesh>)}
    {[-.95, .95].map(x => <group key={x} position={[x, 0, 0]}>
      <ChamferedBlock size={[.29, .46, 1.68]} position={[0, .99, 0]} color="#698197" metalness={.67} roughness={.29} />
      <mesh position={[0, 1.25, 0]}><boxGeometry args={[.085, .025, 1.42]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.25} /></mesh>
      <mesh position={[0, .88, .87]}><boxGeometry args={[.15, .2, .035]} /><meshStandardMaterial color="#142b3d" metalness={.36} roughness={.45} /></mesh>
    </group>)}
    <ChamferedBlock size={[1.55, .19, .36]} position={[0, .91, -.81]} color="#536e85" metalness={.61} roughness={.33} />
    <mesh position={[0, .93, -.61]}><boxGeometry args={[blocked ? .95 : .38, .08, .025]} /><meshBasicMaterial color={color} /></mesh>
    {[-.38, .38].map(x => <group key={x} position={[x, 1.13, .72]}>
      <mesh><boxGeometry args={[.2, .12, .03]} /><meshStandardMaterial color="#6a8499" metalness={.67} roughness={.31} /></mesh>
      <mesh position={[0, 0, .022]}><boxGeometry args={[.09, .055, .01]} /><meshBasicMaterial color={color} /></mesh>
    </group>)}
    <Signal position={[-.38, 1.72, -.39]} color={color} /><Signal position={[.38, 1.72, -.39]} color={blocked ? '#c87866' : '#5eb8a9'} />
    <VentBank position={[0, 1.04, .71]} count={4} />
  </group>;
}

function SecondaryHardware({ kind, color }: { kind: HardwareKind; color: string }) {
  return <group>
    <ChamferedBlock size={[1.52, .5, 1.09]} position={[0, 1.02, 0]} color={kind === 'MONITOR' ? '#3d6278' : '#465f77'} metalness={.55} roughness={.39} />
    <mesh position={[0, 1.31, 0]}><boxGeometry args={[1.22, .035, .78]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.25} /></mesh>
    <VentBank position={[0, .91, .565]} />
  </group>;
}

export function ExecutionHardware({ kind, color, blocked }: { kind: HardwareKind; color: string; blocked: boolean }) {
  return <group>
    <SharedChassis color={color} />
    {kind === 'APPROVAL' ? <ApprovalGate color={color} blocked={blocked} />
      : kind === 'TEST' ? <TestRunner color={color} />
        : kind === 'MIGRATION' ? <MigrationCheck color={color} />
          : kind === 'DEPLOY' ? <DeploymentController color={color} blocked={blocked} />
            : <SecondaryHardware kind={kind} color={color} />}
  </group>;
}
