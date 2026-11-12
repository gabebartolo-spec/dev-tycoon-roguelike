import * as THREE from 'three';

/**
 * Ink style (art test): flat cel fill in 3 bands with screen-space hatching in the darkest band, plus a black
 * outline of one fixed pixel width on every object (the "one line width" rule), drawn as an inverted hull pushed
 * out along smoothed normals in clip space so thin legs and big desks get the same line.
 */
export const INK = { line: '#17120e', paper: '#efe3c8', lineWidthPx: 2.5 };
export const LIGHT = new THREE.Vector3(0.45, 0.85, 0.35).normalize();

export const fillVert = /* glsl */ `
varying vec3 vN;
void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const fillFrag = /* glsl */ `
uniform vec3 uColor; uniform vec3 uLight; uniform vec3 uInk; uniform float uGlow;
varying vec3 vN;
void main() {
  float d = dot(normalize(vN), uLight);
  float band = d > 0.55 ? 1.0 : d > 0.1 ? 0.78 : 0.58;
  vec3 c = uColor * band;
  if (band < 0.6 && uGlow < 0.5) {               // hatch the shadow band: diagonal ink strokes every 6px
    float h = mod(gl_FragCoord.x + gl_FragCoord.y, 6.0);
    if (h < 1.2) c = mix(c, uInk, 0.7);
  }
  if (uGlow > 0.5) c = uColor;                  // emissive things (screens) stay flat and bright
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
export const lineVert = /* glsl */ `
uniform float uWidth; uniform vec2 uRes;
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(projectionMatrix) * mat3(modelViewMatrix) * normal);
  p.xy += normalize(n.xy + 1e-6) * uWidth * 2.0 / uRes * p.w;
  gl_Position = p;
}`;
export const lineFrag = /* glsl */ `uniform vec3 uInk; void main() { gl_FragColor = vec4(uInk, 1.0); }`;

export const res = new THREE.Vector2(800, 260);
export function setInkResolution(w: number, h: number) { res.set(w, h); }

const cache = new Map<string, THREE.BufferGeometry>();
/** Shared geometries so every desk reuses one buffer per shape. */
export function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
}
