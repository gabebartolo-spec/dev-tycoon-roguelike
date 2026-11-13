import { useLoader } from '@react-three/fiber';
import { useMemo, type JSX } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fillFrag, fillVert, INK, LIGHT, MAP_DEFINES } from './inkCore';

export type PropName =
  | 'bug_jar' | 'chair' | 'desk' | 'drawing_tablet' | 'floor_plant' | 'keyboard' | 'lamp' | 'megaphone' | 'mixer'
  | 'monitor' | 'mug' | 'phone_rack' | 'posters' | 'server_rack' | 'sketchbook' | 'sticky_notes' | 'succulent'
  | 'water_cooler' | 'whiteboard';

/** The monitor panel's rear face (split out as "back" in Blender): flat dark plastic, never lit by the screen colour. */
const BEZEL = '#2b2832';

const propUrl = (name: PropName) => `${import.meta.env.BASE_URL}models/props/${name}.glb`;

/**
 * A painted Tripo prop (public/models/props) in ink style: its basecolor texture in the gentle painted bands, plus a
 * furniture-weight (2.5px) outline from InkPost. A mesh named "screen" (split out of the monitor in Blender) is drawn
 * flat in `screen` instead of its texture, so a monitor can glow in a department colour or sit dark; "back" is its rear face.
 */
export function Prop({ name, screen, ...props }: { name: PropName; screen?: string } & JSX.IntrinsicElements['group']) {
  const gltf = useLoader(GLTFLoader, propUrl(name));
  const root = useMemo(() => {
    const root = gltf.scene.clone();
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    for (const m of meshes) {
      const isScreen = m.name === 'screen', isBack = m.name === 'back';
      const map = (m.material as THREE.MeshStandardMaterial).map;
      m.material = new THREE.ShaderMaterial({
        vertexShader: fillVert, fragmentShader: fillFrag, defines: isScreen || isBack ? {} : MAP_DEFINES,
        side: THREE.DoubleSide, // decimation flips a few faces; single-sided they'd be holes
        uniforms: {
          uColor: { value: new THREE.Color(isBack ? BEZEL : screen ?? '#1c1a24') }, uMap: { value: map }, uLight: { value: LIGHT },
          uInk: { value: new THREE.Color(INK.line) }, uGlow: { value: isScreen ? 1 : 0 },
        },
      });
    }
    return root;
  }, [gltf, screen]);
  return <primitive object={root} {...props} />;
}
