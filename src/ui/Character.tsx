import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, type JSX } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fillFrag, fillVert, geo, INK, LIGHT, lineFrag, lineVert, res } from './inkCore';

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A rigged character in ink style, playing its baked clip (the Mixamo Typing loop) as-is. `phase` (0..1) offsets the
 * loop so neighbours don't type in lockstep. The outline is a second SkinnedMesh on the same skeleton, so it bends
 * with the body.
 */
export function Character({ url, phase = 0, ...props }: { url: string; phase?: number } & JSX.IntrinsicElements['group']) {
  const gltf = useLoader(GLTFLoader, url);
  const { root, mixer, action } = useMemo(() => {
    const root = clone(gltf.scene);
    const skins: THREE.SkinnedMesh[] = [];
    root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skins.push(o as THREE.SkinnedMesh); });
    for (const m of skins) {
      const map = (m.material as THREE.MeshStandardMaterial).map;
      m.material = new THREE.ShaderMaterial({
        vertexShader: fillVert, fragmentShader: fillFrag, defines: { INK_MAP: '' },
        uniforms: { uColor: { value: new THREE.Color() }, uMap: { value: map }, uLight: { value: LIGHT }, uInk: { value: new THREE.Color(INK.line) }, uGlow: { value: 0 } },
      });
      const hullGeo = geo(`hull:${url}:${m.name}`, () => {
        const g = m.geometry.clone(); g.deleteAttribute('normal'); g.deleteAttribute('uv');
        const h = mergeVertices(g); h.computeVertexNormals(); return h; // weld UV seams so the hull has no cracks
      });
      const hull = new THREE.SkinnedMesh(hullGeo, new THREE.ShaderMaterial({
        vertexShader: lineVert, fragmentShader: lineFrag, side: THREE.BackSide,
        uniforms: { uWidth: { value: INK.charLineWidthPx }, uRes: { value: res }, uInk: { value: new THREE.Color(INK.line) } },
      }));
      hull.position.copy(m.position); hull.quaternion.copy(m.quaternion); hull.scale.copy(m.scale);
      m.parent!.add(hull);
      hull.bind(m.skeleton, m.bindMatrix);
      m.frustumCulled = hull.frustumCulled = false; // bounds come from the T-pose, not the seated pose
    }
    const mixer = new THREE.AnimationMixer(root);
    const clip = gltf.animations[0];
    return { root, mixer, action: clip ? mixer.clipAction(clip) : null };
  }, [gltf, url]);
  useEffect(() => { // start in the effect so StrictMode's mount/unmount/mount leaves it playing
    if (!action) return;
    action.reset().play();
    action.time = phase * action.getClip().duration;
    mixer.update(0);
    return () => { action.stop(); };
  }, [mixer, action, phase]);
  useFrame((state, dt) => {
    if (reducedMotion) return; // hold the first pose
    mixer.update(Math.min(dt, 0.1));
    state.invalidate(); // frameloop="demand": keep frames coming while someone is typing
  });
  return <primitive object={root} {...props} />;
}
