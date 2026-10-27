import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type CameraState = 'OVERVIEW' | 'APPROACH' | 'INSTALLATION' | 'MODULE_FOCUS' | 'COUNTERFACTUAL' | 'SAFEGUARD' | 'RETURN';

type CameraModule = { id: string; x: number; z: number };
type Props = { state: CameraState; selected: string | null; modules: CameraModule[]; zoom: number; reducedMotion: boolean };

const settings: Record<CameraState, { offset: [number, number, number]; fov: number; duration: number; selectedWeight: number }> = {
  OVERVIEW: { offset: [14, 19, 26], fov: 36, duration: 1.15, selectedWeight: 0 },
  APPROACH: { offset: [5.7, 8.1, 11.8], fov: 37, duration: 1.05, selectedWeight: .2 },
  INSTALLATION: { offset: [4.35, 6.1, 8.7], fov: 36, duration: .85, selectedWeight: .29 },
  MODULE_FOCUS: { offset: [4.4, 6.2, 8.9], fov: 36, duration: .85, selectedWeight: .34 },
  COUNTERFACTUAL: { offset: [4.2, 6, 8.55], fov: 36, duration: .72, selectedWeight: .34 },
  SAFEGUARD: { offset: [4.25, 6, 8.65], fov: 36, duration: .72, selectedWeight: .34 },
  RETURN: { offset: [14, 19, 26], fov: 36, duration: 1.2, selectedWeight: 0 },
};

const easeInOut = (value: number) => value * value * (3 - 2 * value);

export function CameraDirector({ state, selected, modules, zoom, reducedMotion }: Props) {
  const { camera, invalidate, size } = useThree();
  const transition = useRef({ elapsed: 0, startPosition: camera.position.clone(), startTarget: new THREE.Vector3(), startFov: (camera as THREE.PerspectiveCamera).fov });
  const currentTarget = useRef(new THREE.Vector3());
  useEffect(() => {
    transition.current = { elapsed: 0, startPosition: camera.position.clone(), startTarget: currentTarget.current.clone(), startFov: (camera as THREE.PerspectiveCamera).fov };
    invalidate();
  }, [camera, invalidate, modules, reducedMotion, selected, size.height, size.width, state, zoom]);
  useFrame((_, delta) => {
    const config = settings[state];
    const chosen = modules.find(item => item.id === selected);
    const target = new THREE.Vector3((chosen?.x ?? 0) * config.selectedWeight, state === 'OVERVIEW' || state === 'RETURN' ? 0 : -.23, (chosen?.z ?? 0) * config.selectedWeight);
    const aspect = size.width / Math.max(size.height, 1);
    const viewportFactor = state === 'OVERVIEW' || state === 'RETURN' ? 1 : Math.max(.84, Math.min(1.03, 2 / aspect));
    const offset = new THREE.Vector3(...config.offset).multiplyScalar(zoom * viewportFactor);
    const destination = target.clone().add(offset);
    const t = reducedMotion ? 1 : Math.min(1, (transition.current.elapsed += delta) / config.duration);
    const eased = easeInOut(t);
    camera.position.lerpVectors(transition.current.startPosition, destination, eased);
    currentTarget.current.lerpVectors(transition.current.startTarget, target, eased);
    camera.lookAt(currentTarget.current);
    const perspective = camera as THREE.PerspectiveCamera;
    const nextFov = THREE.MathUtils.lerp(transition.current.startFov, config.fov, eased);
    if (Math.abs(perspective.fov - nextFov) > .001) { perspective.fov = nextFov; perspective.updateProjectionMatrix(); }
    if (t < 1) invalidate();
  });
  return null;
}
