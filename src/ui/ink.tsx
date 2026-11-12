import { useMemo, type JSX } from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fillFrag, fillVert, INK, LIGHT, lineFrag, lineVert, res } from './inkCore';

/** A mesh in ink style: pass the geometry and a flat colour. */
export function Inked({ geometry, color, glow = false, outline = true, ...props }: {
  geometry: THREE.BufferGeometry; color: string; glow?: boolean; outline?: boolean;
} & JSX.IntrinsicElements['group']) {
  const fill = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: fillVert, fragmentShader: fillFrag,
    uniforms: { uColor: { value: new THREE.Color(color) }, uLight: { value: LIGHT }, uInk: { value: new THREE.Color(INK.line) }, uGlow: { value: glow ? 1 : 0 } },
  }), [color, glow]);
  const hull = useMemo(() => {
    const g = geometry.clone(); g.deleteAttribute('normal'); g.deleteAttribute('uv');
    const m = mergeVertices(g); m.computeVertexNormals(); return m; // smoothed normals: no cracks at box corners
  }, [geometry]);
  const line = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: lineVert, fragmentShader: lineFrag, side: THREE.BackSide,
    uniforms: { uWidth: { value: INK.lineWidthPx }, uDepthPush: { value: 0 }, uRes: { value: res }, uInk: { value: new THREE.Color(INK.line) } },
  }), []);
  return (
    <group {...props}>
      <mesh geometry={geometry} material={fill} />
      {outline && <mesh geometry={hull} material={line} />}
    </group>
  );
}
