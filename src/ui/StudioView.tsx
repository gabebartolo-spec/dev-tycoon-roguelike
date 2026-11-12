import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { content } from '../data/load';
import type { Dept } from '../data/schemas';
import { phaseTotals } from '../sim/run';
import { useGame } from '../store/game';

/**
 * The studio, drawn from sim state only: one desk per department in board order (so neighbours on screen are
 * neighbours in the sim), a pawn at each staffed desk, bugs that pile up with the project's bug count, and a
 * light that warms with hype. frameloop="demand": it renders when state changes, never on an idle loop.
 */
const DEPT_COLOR: Record<Dept, string> = {
  code: '#4c6ef5', design: '#be4bdb', art: '#f76707', audio: '#12b886', qa: '#fab005', marketing: '#e64980',
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

function Desk({ x, dept, staffed }: { x: number; dept: Dept; staffed: boolean }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow><boxGeometry args={[1.6, 0.08, 0.9]} /><meshStandardMaterial color="#8d6e52" /></mesh>
      {[[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.37, lz]} castShadow><boxGeometry args={[0.07, 0.74, 0.07]} /><meshStandardMaterial color="#5c4636" /></mesh>
      ))}
      <mesh position={[0, 1.1, -0.25]} castShadow><boxGeometry args={[0.8, 0.5, 0.05]} /><meshStandardMaterial color="#222" emissive={staffed ? DEPT_COLOR[dept] : '#000'} emissiveIntensity={staffed ? 0.6 : 0} /></mesh>
      <mesh position={[0, 0.82, -0.25]}><boxGeometry args={[0.1, 0.12, 0.05]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[0, 0.02, 0.9]} receiveShadow><boxGeometry args={[1.5, 0.02, 0.12]} /><meshStandardMaterial color={DEPT_COLOR[dept]} /></mesh>
      {staffed && (
        <group position={[0, 0, 0.75]}>
          <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.5, 0.06, 0.5]} /><meshStandardMaterial color="#444" /></mesh>
          <mesh position={[0, 0.85, 0.05]} castShadow><capsuleGeometry args={[0.2, 0.4, 4, 8]} /><meshStandardMaterial color={DEPT_COLOR[dept]} /></mesh>
          <mesh position={[0, 1.38, 0.05]} castShadow><sphereGeometry args={[0.17, 12, 10]} /><meshStandardMaterial color="#f1c27d" /></mesh>
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
  const warm = Math.min(1, hype / 30); // 0 = cool office light, 1 = full hype glow
  return (
    <div className="studio-view" aria-label={`Studio: ${depts.filter((d) => board[d]).length} desks staffed, ${bugs} bugs, hype ${Math.round(hype)}`} role="img">
      <Canvas frameloop="demand" shadows dpr={[1, 2]} orthographic camera={{ position: [0, 5, 7.5], near: 0.1, far: 50 }}>
        <Fit width={width} />
        <color attach="background" args={['#1b1b22']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 6, 4]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[0, 3, 1.5]} intensity={6 * warm} distance={12} color="#ff9f43" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.6]} receiveShadow><planeGeometry args={[width + 4, 5]} /><meshStandardMaterial color="#3a3a44" /></mesh>
        {depts.map((d, i) => <Desk key={d} x={i * SPACING - width / 2} dept={d} staffed={!!board[d]} />)}
        {spots.slice(0, bugs).map((p, i) => (
          <mesh key={i} position={p} rotation={[0, i, 0]}><tetrahedronGeometry args={[0.14]} /><meshStandardMaterial color="#e03131" emissive="#e03131" emissiveIntensity={0.4} /></mesh>
        ))}
      </Canvas>
    </div>
  );
}
