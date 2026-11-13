import { useMemo, type JSX } from 'react';
import * as THREE from 'three';
import { fillFrag, fillVert, INK, LIGHT } from './inkCore';

/** A mesh in ink style: pass the geometry and a flat colour (InkPost draws its outline). */
export function Inked({ geometry, color, glow = false, ...props }: {
  geometry: THREE.BufferGeometry; color: string; glow?: boolean;
} & JSX.IntrinsicElements['group']) {
  const fill = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: fillVert, fragmentShader: fillFrag,
    uniforms: { uColor: { value: new THREE.Color(color) }, uLight: { value: LIGHT }, uInk: { value: new THREE.Color(INK.line) }, uGlow: { value: glow ? 1 : 0 } },
  }), [color, glow]);
  return (
    <group {...props}>
      <mesh geometry={geometry} material={fill} />
    </group>
  );
}
