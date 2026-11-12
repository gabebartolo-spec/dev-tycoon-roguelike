import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { content } from '../data/load';
import type { Dept } from '../data/schemas';
import { phaseTotals } from '../sim/run';
import { useGame } from '../store/game';
import { Inked } from './ink';
import { geo, INK, setInkResolution } from './inkCore';

/**
 * The studio, drawn from sim state only: one desk per department in board order (so neighbours on screen are
 * neighbours in the sim), a pawn at each staffed desk, bugs that pile up with the project's bug count, and a
 * light that warms with hype. frameloop="demand": it renders when state changes, never on an idle loop.
 */
const DEPT_COLOR: Record<Dept, string> = {
  code: '#2f6fd6', design: '#b93fc4', art: '#e8661c', audio: '#169c74', qa: '#e9b21a', marketing: '#d8325f',
};
const SPACING = 2.2;
const MAX_BUGS = 40;

/** Seeded positions so bugs stay put as the count grows (a bug never jumps when another is added). */
function bugSpots(n: number, width: number) {
  const spots: [number, number, number][] = [];
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) spots.push([(r() - 0.5) * width, 0.1, 0.95 + r() * 0.55]);
  return spots;
}

const box = (w: number, h: number, d: number) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const legs: [number, number][] = [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]];

function Desk({ x, dept, staffed }: { x: number; dept: Dept; staffed: boolean }) {
  return (
    <group position={[x, 0, 0]}>
      <Inked geometry={box(1.6, 0.08, 0.9)} color="#c98a4b" position={[0, 0.75, 0]} />
      {legs.map(([lx, lz], i) => <Inked key={i} geometry={box(0.07, 0.74, 0.07)} color="#7a4a2a" position={[lx, 0.37, lz]} />)}
      <Inked geometry={box(0.8, 0.5, 0.05)} color={staffed ? DEPT_COLOR[dept] : '#3b3340'} glow={staffed} position={[0, 1.1, -0.25]} />
      <Inked geometry={box(0.1, 0.12, 0.05)} color="#3b3340" position={[0, 0.82, -0.25]} />
      <Inked geometry={box(1.5, 0.02, 0.12)} color={DEPT_COLOR[dept]} outline={false} position={[0, 0.02, 0.9]} />
      {staffed && (
        <group position={[0, 0, 0.75]}>
          <Inked geometry={box(0.5, 0.06, 0.5)} color="#5a4a5e" position={[0, 0.45, 0]} />
          <Inked geometry={geo('cap', () => new THREE.CapsuleGeometry(0.2, 0.4, 4, 12))} color={DEPT_COLOR[dept]} position={[0, 0.85, 0.05]} />
          <Inked geometry={geo('head', () => new THREE.SphereGeometry(0.17, 16, 12))} color="#f2c48d" position={[0, 1.38, 0.05]} />
        </group>
      )}
    </group>
  );
}

/** Orthographic zoom that fits every desk across and the desks plus floor down, for any canvas size. */
function Fit({ width }: { width: number }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    camera.zoom = Math.min(size.width / (width + 2.6), size.height / 3.1);
    camera.lookAt(0, 0.75, 0.5);
    camera.updateProjectionMatrix();
    setInkResolution(size.width, size.height);
    invalidate();
  }, [camera, size, width, invalidate]);
  return null;
}

export default function StudioView() {
  const board = useGame((s) => s.state.board);
  const state = useGame((s) => s.state);
  const project = state.project;
  const now = project ? phaseTotals(state, content) : null; // live: includes this phase's placements
  const depts = content.departments;
  const width = (depts.length - 1) * SPACING;
  const bugs = Math.min(MAX_BUGS, Math.round((project?.bugs ?? 0) + (now?.bugs ?? 0)));
  const hype = (project?.hype ?? 0) + (now?.hype ?? 0);
  const spots = useMemo(() => bugSpots(MAX_BUGS, width + 1.5), [width]);
  const warm = Math.min(1, hype / 30); // 0 = cool floor, 1 = full hype glow
  const floor = useMemo(() => new THREE.Color('#d9cdb3').lerp(new THREE.Color('#f4b25c'), warm * 0.6).getStyle(), [warm]);
  return (
    <div className="studio-view" aria-label={`Studio: ${depts.filter((d) => board[d]).length} desks staffed, ${bugs} bugs, hype ${Math.round(hype)}`} role="img">
      <Canvas frameloop="demand" dpr={[1, 2]} orthographic camera={{ position: [0, 5, 7.5], near: 0.1, far: 50 }}>
        <Fit width={width} />
        <color attach="background" args={[INK.paper]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.6]}><planeGeometry args={[width + 4, 5]} /><meshBasicMaterial color={floor} /></mesh>
        {depts.map((d, i) => <Desk key={d} x={i * SPACING - width / 2} dept={d} staffed={!!board[d]} />)}
        {spots.slice(0, bugs).map((p, i) => (
          <Inked key={i} geometry={geo('bug', () => new THREE.TetrahedronGeometry(0.14))} color="#e0312b" position={p} rotation={[0, i, 0]} />
        ))}
      </Canvas>
    </div>
  );
}
