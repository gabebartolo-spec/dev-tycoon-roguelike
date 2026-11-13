import { useFrame, useLoader } from '@react-three/fiber';
import { useEffect, useMemo, type JSX } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fillFrag, fillVert, INK, LIGHT, MAP_DEFINES } from './inkCore';

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A rigged character in ink style, playing its baked clip (the Mixamo Typing loop) as-is. `phase` (0..1) offsets the
 * loop so neighbours don't type in lockstep. CHAR_MASK tags its pixels so InkPost outlines it at the character width.
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
        vertexShader: fillVert, fragmentShader: fillFrag, defines: { ...MAP_DEFINES, CHAR_MASK: '' },
        uniforms: { uColor: { value: new THREE.Color() }, uMap: { value: map }, uLight: { value: LIGHT }, uInk: { value: new THREE.Color(INK.line) }, uGlow: { value: 0 } },
      });
      m.frustumCulled = false; // bounds come from the T-pose, not the seated pose
    }
    const mixer = new THREE.AnimationMixer(root);
    const clip = gltf.animations[0];
    return { root, mixer, action: clip ? mixer.clipAction(clip) : null };
  }, [gltf]);
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
