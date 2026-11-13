import * as THREE from 'three';

/**
 * Ink style: flat cel fill in 3 bands (hatched in the darkest band for flat-colour meshes), with black outlines drawn
 * in screen space by InkPost: furniture at lineWidthPx, characters at the thinner charLineWidthPx.
 */
export const INK = { line: '#17120e', paper: '#efe3c8', lineWidthPx: 2.5, charLineWidthPx: 1.5 }; // characters: thinner, so chin/collar lines don't band across faces
/** Fill defines for painted (textured) models. */
export const MAP_DEFINES: Record<string, string> = { INK_MAP: '' };
export const LIGHT = new THREE.Vector3(0.45, 0.85, 0.35).normalize();

/** Skinning chunks are no-ops unless three compiles the material for a SkinnedMesh (it sets USE_SKINNING). */
const skinned = /* glsl */ `
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>`;
export const fillVert = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
varying vec3 vN; varying vec2 vUv;
void main() {${skinned}
  vN = normalize(mat3(modelMatrix) * objectNormal); vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}`;
export const fillFrag = /* glsl */ `
uniform vec3 uColor; uniform vec3 uLight; uniform vec3 uInk; uniform float uGlow; uniform sampler2D uMap;
varying vec3 vN; varying vec2 vUv;
void main() {
  float d = dot(normalize(vN), uLight);
  #ifdef INK_MAP
  // painted models: the basecolor texture already carries painted shading, and faces tilt down out of the light,
  // so the bands are gentle (-10% / -20%) and there is no hatching
  vec3 base = texture2D(uMap, vUv).rgb;
  float band = d > 0.55 ? 1.0 : d > 0.1 ? 0.9 : 0.8;
  bool hatch = false;
  #else
  vec3 base = uColor;
  float band = d > 0.55 ? 1.0 : d > 0.1 ? 0.78 : 0.58;
  bool hatch = band < 0.6;
  #endif
  vec3 c = base * band;
  if (hatch && uGlow < 0.5) {                    // hatch the shadow band: diagonal ink strokes every 6px
    float h = mod(gl_FragCoord.x + gl_FragCoord.y, 6.0);
    if (h < 1.2) c = mix(c, uInk, 0.7);
  }
  if (uGlow > 0.5) c = base;                  // emissive things (screens) stay flat and bright
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  #ifdef CHAR_MASK
  gl_FragColor.a = 0.5; // tells the screen-space ink pass to draw this silhouette at the thinner character width
  #endif
}`;
const cache = new Map<string, THREE.BufferGeometry>();
/** Shared geometries so every desk reuses one buffer per shape. */
export function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
}
