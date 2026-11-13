import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { INK } from './inkCore';

const vert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const DIRS = 12;
const frag = /* glsl */ `
uniform sampler2D uColor; uniform sampler2D uDepth; uniform vec2 uTexel; uniform float uRadius; uniform float uCharRadius; uniform float uThresh;
uniform vec3 uInk; varying vec2 vUv;
float D(vec2 o) { return texture2D(uDepth, vUv + o * uTexel).r; }
// how strongly the depth steps across a pair of samples straddling this pixel at radius r: the second difference
// cancels plain slopes (a tilted floor or desk top), so only steps between surfaces (silhouettes, overlaps) count.
// The nearer sample owns the edge; a character (alpha < 1) only owns it out to the thinner character radius.
float edgeAt(float r, float c) {
  float e = 0.0;
  for (int i = 0; i < ${DIRS}; i++) {
    float a = 3.14159265 * float(i) / float(${DIRS});
    vec2 o = vec2(cos(a), sin(a)) * r;
    float da = D(o), db = D(-o);
    vec2 near = da < db ? o : -o;
    float owner = texture2D(uColor, vUv + near * uTexel).a < 0.75 ? uCharRadius : uRadius;
    if (r <= owner + 0.5) e = max(e, abs(da + db - 2.0 * c));
  }
  return smoothstep(uThresh, uThresh * 2.0, e);
}
void main() {
  vec3 col = texture2D(uColor, vUv).rgb;
  float c = D(vec2(0.0));
  // three radii, averaged: the line's outer boundary falls off over a pixel instead of stepping (anti-aliased)
  float prop = (edgeAt(uRadius - 0.5, c) + edgeAt(uRadius, c) + edgeAt(uRadius + 0.5, c)) / 3.0;
  float chr = (edgeAt(uCharRadius - 0.5, c) + edgeAt(uCharRadius, c) + edgeAt(uCharRadius + 0.5, c)) / 3.0;
  float ink = max(prop, chr);
  // uInk is linear (THREE.Color); the target decodes to linear on sampling, so encode once for the screen
  gl_FragColor = vec4(mix(col, uInk, ink), 1.0);
  #include <colorspace_fragment>
}`;

/**
 * Screen-space ink outline (replaces the inverted-hull lines when SCREEN_LINES is on). The scene renders to a target
 * with a depth texture; a full-screen pass draws ink wherever depth steps between surfaces, so every silhouette gets
 * one even, anti-aliased line regardless of how lumpy the mesh is. Depth is linear in the orthographic camera, so the
 * threshold is a world distance.
 */
export function InkPost({ widthPx = INK.lineWidthPx, stepWorld = 0.06 }: { widthPx?: number; stepWorld?: number }) {
  const { gl, scene, camera, size } = useThree();
  const dpr = gl.getPixelRatio();
  const rt = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(1, 1, { samples: 0, colorSpace: THREE.SRGBColorSpace });
    t.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
    return t;
  }, []);
  const quad = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
      uniforms: {
        uColor: { value: rt.texture }, uDepth: { value: rt.depthTexture }, uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 1 }, uCharRadius: { value: 1 }, uThresh: { value: 0.001 }, uInk: { value: new THREE.Color(INK.line) },
      },
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
    q.frustumCulled = false;
    return q;
  }, [rt]);
  const quadCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  useEffect(() => {
    const w = Math.floor(size.width * dpr), h = Math.floor(size.height * dpr);
    rt.setSize(w, h);
    const u = (quad.material as THREE.ShaderMaterial).uniforms;
    u.uTexel.value.set(1 / w, 1 / h);
    u.uRadius.value = (widthPx * dpr) / 2; // samples straddle the edge, so the line is ~widthPx wide in CSS pixels
    u.uCharRadius.value = (INK.charLineWidthPx * dpr) / 2;
    const cam = camera as THREE.OrthographicCamera;
    u.uThresh.value = stepWorld / (cam.far - cam.near);
  }, [size, dpr, rt, quad, widthPx, stepWorld, camera]);
  useEffect(() => () => rt.dispose(), [rt]);
  useFrame(() => {
    gl.setRenderTarget(rt);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(quad, quadCam);
  }, 1);
  return null;
}
