import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect, useMemo, type JSX } from 'react';
import * as THREE from 'three';
import { content } from '../data/load';
import type { Dept } from '../data/schemas';
import { phaseTotals } from '../sim/run';
import { useGame } from '../store/game';
import { castBoard, castUrl, seeded, type CastName } from './cast';
import { Character } from './Character';
import { Inked } from './ink';
import { Prop, type PropName } from './Prop';
import { geo, INK } from './inkCore';
import { InkPost } from './InkPost';

/**
 * The studio, drawn from sim state only: one desk per department in board order (so neighbours on screen are
 * neighbours in the sim), a seated character typing at each staffed desk, bugs that pile up with the project's bug
 * count, and a light that warms with hype. frameloop="demand": an empty studio renders only when state changes; a
 * typing character keeps frames coming (and holds still under prefers-reduced-motion).
 */
const DEPT_COLOR: Record<Dept, string> = {
  code: '#2f6fd6', design: '#b93fc4', art: '#e8661c', audio: '#169c74', qa: '#e9b21a', marketing: '#d8325f',
};
const SPACING = 2.2;
const SCREEN_OFF = '#1c1a24';
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
/**
 * Seated-character fit, measured on the posed models in Blender: wrist 0.385 up and 0.23 forward of the hips, seat
 * underside 0.175, head top ~0.76. Scale 2.16 puts the wrists just above the desk top (0.79) and the seat on the
 * chair seat (0.38). Seated behind the desk facing +z (the camera, the model's native facing).
 */
const CHAR_SCALE = 2.16;
const DESK_TOP = 0.79;
/**
 * Tripo props come normalised to ~1 unit; these fit them to the studio. Desk (0.979 x 0.651 x 0.755) stretches to
 * 1.6 x 0.79 x 0.9. Chair seat measures 0.55 up: x0.69 puts it at the 0.38 seat height, its centre 0.055 forward.
 */
const DESK_SCALE: [number, number, number] = [1.6 / 0.979, DESK_TOP / 0.651, 0.9 / 0.755];
const CHAIR_SCALE = 0.69;
const CHAIR_FWD = 0.055;
const SIGNATURE: Record<Exclude<Dept, 'code'>, { name: PropName; scale: number }> = {
  art: { name: 'drawing_tablet', scale: 0.36 }, audio: { name: 'mixer', scale: 0.4 }, qa: { name: 'bug_jar', scale: 0.24 },
  design: { name: 'sketchbook', scale: 0.38 }, marketing: { name: 'megaphone', scale: 0.3 },
};
/** Desk clutter, rolled per worker: slot 0 is the back-left corner (the only one tall enough for the lamp). */
const CLUTTER: { name: PropName; scale: number; tall?: boolean }[] = [
  { name: 'mug', scale: 0.14 }, { name: 'sticky_notes', scale: 0.25 }, { name: 'succulent', scale: 0.2 }, { name: 'lamp', scale: 0.45, tall: true },
];
const SLOTS: [number, number][] = [[-0.6, 0.22], [-0.6, -0.22], [0.6, -0.22]];

function clutterFor(workerId: string, dept: Dept) {
  const r = seeded(workerId);
  const pool = [...CLUTTER];
  const out: { name: PropName; scale: number; at: [number, number]; spin: number }[] = [];
  SLOTS.forEach((at, slot) => {
    const roll = r(), pick = r(), spin = r(); // always draw three, so one slot's skip never reshuffles the next
    if (dept === 'code' && slot === 0) return; // the second monitor takes the back-left corner
    if (roll < 0.35) return;
    const fits = pool.filter((c) => slot === 0 || !c.tall);
    if (!fits.length) return;
    const c = fits[Math.floor(pick * fits.length)];
    pool.splice(pool.indexOf(c), 1);
    out.push({ name: c.name, scale: c.scale, at, spin: (spin - 0.5) * 1.2 });
  });
  return out;
}

/**
 * A monitor turned to face its worker (+z is the screen in model space; the desk rotates it by pi). The camera sees
 * its back, so a staffed screen's colour shows as a glow panel just in front of the screen, a little larger than the
 * monitor: it peeks out as a rim around the back and above the top. Model space: screen y 0.28..0.77, width 0.98.
 */
function Monitor({ glow, screen, ...props }: { glow: string | null; screen: string } & JSX.IntrinsicElements['group']) {
  return (
    <group {...props}>
      <Prop name="monitor" screen={screen} />
      {glow && <Inked geometry={box(1.12, 0.6, 0.01)} color={glow} glow position={[0, 0.53, 0.3]} />}
    </group>
  );
}

function Desk({ x, dept, workerId, cast, phase }: { x: number; dept: Dept; workerId: string | null; cast: CastName | null; phase: number }) {
  const staffed = !!workerId;
  const screen = staffed ? DEPT_COLOR[dept] : SCREEN_OFF;
  const glow = staffed ? DEPT_COLOR[dept] : null;
  const clutter = useMemo(() => (workerId ? clutterFor(workerId, dept) : []), [workerId, dept]);
  const sig = dept === 'code' ? null : SIGNATURE[dept];
  return (
    <group position={[x, 0, 0]}>
      <Prop name="desk" scale={DESK_SCALE} />
      {dept === 'code' ? (
        <>
          <Monitor glow={glow} screen={screen} scale={0.52} position={[-0.29, DESK_TOP, 0.2]} rotation={[0, Math.PI - 0.2, 0]} />
          <Monitor glow={glow} screen={screen} scale={0.52} position={[0.29, DESK_TOP, 0.2]} rotation={[0, Math.PI + 0.2, 0]} />
        </>
      ) : (
        <Monitor glow={glow} screen={screen} scale={0.6} position={[0, DESK_TOP, 0.2]} rotation={[0, Math.PI, 0]} />
      )}
      {sig && <Prop name={sig.name} scale={sig.scale} position={[0.58, DESK_TOP, 0.18]} rotation={[0, -0.3, 0]} />}
      <Prop name="keyboard" scale={0.5} position={[0, DESK_TOP, -0.2]} rotation={[0, Math.PI, 0]} />
      {clutter.map((c) => <Prop key={c.name} name={c.name} scale={c.scale} position={[c.at[0], DESK_TOP, c.at[1]]} rotation={[0, c.spin, 0]} />)}
      <Inked geometry={box(1.5, 0.02, 0.12)} color={DEPT_COLOR[dept]} position={[0, 0.02, 0.9]} />
      {/* empty desk: chair pushed in under the desk; staffed: pulled out with the worker seated on it */}
      <Prop name="chair" scale={CHAIR_SCALE} position={[0, 0, staffed ? -0.75 - CHAIR_FWD : -0.3]} />
      {staffed && cast && <Suspense fallback={null}><Character url={castUrl(cast)} phase={phase} scale={CHAR_SCALE} position={[0, 0, -0.75]} /></Suspense>}
    </group>
  );
}

/** Room pieces in the gaps beside and between the desks, left to right; the middle gap sits under the window. */
const ROOM: { name: PropName; scale: number; wall?: boolean }[] = [
  { name: 'water_cooler', scale: 0.8 }, { name: 'server_rack', scale: 1.4 }, { name: 'whiteboard', scale: 0.9, wall: true },
  { name: 'phone_rack', scale: 0.85 }, { name: 'floor_plant', scale: 1.0 }, { name: 'floor_plant', scale: 0.9 },
];
const WALL_Z = -1.6;
const SKY_LOW = new THREE.Color('#8f9499');
const SKY_HIGH = new THREE.Color('#7cc4ee');
const FRAME = '#7a4a2a';

/** The back wall with a window whose weather follows hype: sun at high hype, grey sky and rain at low. */
function BackWall({ width, warm, gaps }: { width: number; warm: number; gaps: number[] }) {
  const sky = useMemo(() => '#' + SKY_LOW.clone().lerp(SKY_HIGH, warm).getHexString(), [warm]);
  const mid = Math.floor(gaps.length / 2);
  const W = 1.5, H = 0.62, Y = 1.05;
  const frame: [number, number, number, number][] = [
    [0, H / 2 + 0.03, W + 0.12, 0.06], [0, -H / 2 - 0.03, W + 0.12, 0.06], [-W / 2 - 0.03, 0, 0.06, H], [W / 2 + 0.03, 0, 0.06, H],
    [0, 0, 0.04, H], [0, 0, W, 0.04],
  ];
  return (
    <group>
      <Inked geometry={box(width + 14, 3, 0.1)} color="#e4d6b8" position={[0, 1.5, WALL_Z - 0.05]} />
      <group position={[gaps[mid], Y, WALL_Z + 0.01]}>
        <Inked geometry={box(W, H, 0.02)} color={sky} glow />
        {warm > 0.5 && <Inked geometry={geo('sun', () => new THREE.CircleGeometry(0.11, 24))} color="#ffd34a" glow position={[0.42, 0.12, 0.015]} />}
        {warm < 0.3 && Array.from({ length: 14 }, (_, i) => (
          <Inked key={i} geometry={box(0.012, 0.13, 0.005)} color="#5d6b78" glow
            position={[-W / 2 + 0.08 + ((i * 0.37) % 1) * (W - 0.16), (((i * 0.61) % 1) - 0.5) * (H - 0.18), 0.015]} rotation={[0, 0, 0.35]} />
        ))}
        {frame.map(([fx, fy, fw, fh], i) => <Inked key={i} geometry={box(fw, fh, 0.06)} color={FRAME} position={[fx, fy, 0.03]} />)}
      </group>
      {gaps.map((gx, i) => {
        if (i === mid) return <Prop key={i} name="posters" scale={0.6} position={[gx, 0, WALL_Z + 0.45]} />;
        const p = ROOM[(i < mid ? i : i - 1) % ROOM.length];
        return p.wall
          ? <Prop key={i} name={p.name} scale={p.scale} position={[gx, 0.4, WALL_Z + 0.12]} />
          : <Prop key={i} name={p.name} scale={p.scale} position={[gx, 0, WALL_Z + 0.5]} />;
      })}
    </group>
  );
}

/** Orthographic zoom that fits every desk across and the desks plus floor down, for any canvas size. */
function Fit({ width }: { width: number }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    camera.zoom = Math.min(size.width / (width + 2.6), size.height / 3.1);
    camera.lookAt(0, 0.75, 0.3); // a little back from the desks: room above for heads
    camera.updateProjectionMatrix();
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
  const gaps = useMemo(() => [-width / 2 - 1.25, ...depts.slice(1).map((_, i) => (i + 0.5) * SPACING - width / 2), width / 2 + 1.25], [width, depts]);
  const ids = depts.map((d) => board[d] ?? null);
  const castKey = ids.join('|');
  const cast = useMemo(() => castBoard(castKey.split('|').map((id) => id || null)), [castKey]);
  const warm = Math.min(1, hype / 30); // 0 = cool floor, 1 = full hype glow
  // the colours R3F's ACES tone mapping used to make of #d9cdb3 -> #f4b25c; untone-mapped so the ink pass (which draws
  // into a target, where three skips tone mapping) shows the same floor
  const floor = useMemo(() => new THREE.Color('#d5cfc1').lerp(new THREE.Color('#ddc7a1'), warm).getStyle(), [warm]);
  return (
    <div className="studio-view" aria-label={`Studio: ${depts.filter((d) => board[d]).length} desks staffed, ${bugs} bugs, hype ${Math.round(hype)}`} role="img">
      <Canvas frameloop="demand" dpr={[1, 2]} orthographic camera={{ position: [0, 5, 7.5], near: 0.1, far: 50 }}>
        <Fit width={width} />
        <InkPost />
        <color attach="background" args={[INK.paper]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.6]}><planeGeometry args={[width + 14, 5]} /><meshBasicMaterial color={floor} toneMapped={false} /></mesh>
        <Suspense fallback={null}>
          <BackWall width={width} warm={warm} gaps={gaps} />
          {depts.map((d, i) => <Desk key={d} x={i * SPACING - width / 2} dept={d} workerId={board[d] ?? null} cast={cast[i]} phase={(i * 0.37) % 1} />)}
        </Suspense>
        {spots.slice(0, bugs).map((p, i) => (
          <Inked key={i} geometry={geo('bug', () => new THREE.TetrahedronGeometry(0.14))} color="#e0312b" position={p} rotation={[0, i, 0]} />
        ))}
      </Canvas>
    </div>
  );
}
