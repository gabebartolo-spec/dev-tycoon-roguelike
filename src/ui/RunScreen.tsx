import { DndContext, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { content } from '../data/load';
import type { Dept } from '../data/schemas';
import { phaseTotals, preview, weeklyCosts } from '../sim/run';
import { useGame } from '../store/game';
import { money, signed } from './format';
import { Delta, WorkerCard } from './widgets';

function Slot({ dept, workerId, ghost, onActivate }: { dept: Dept; workerId: string | null; ghost: ReturnType<typeof preview>; onActivate: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${dept}`, data: { dept } });
  const genreId = useGame((s) => s.state.project?.genreId);
  const weight = content.genres.find((g) => g.id === genreId)?.weights[dept] ?? 0;
  const support = content.support.find((s) => s.dept === dept);
  const label = support ? `${support.stat} → ${support.perPoint > 0 ? "+" : ""}${support.perPoint} ${support.metric}/pt` : `×${weight}`;
  return (
    <div ref={setNodeRef} className={`slot ${isOver ? 'over' : ''}`}>
      <button className="slot-head" onClick={onActivate} aria-label={`${dept} slot, ${label}. Place selected worker`}>
        <b>{dept === "qa" ? "QA" : dept}</b><span className="muted support-rule">{label}</span>
      </button>
      {workerId ? <WorkerCard id={workerId} compact /> : <div className="empty">drop a worker</div>}
      <div className="ghost">{ghost ? <Delta q={ghost.quality} h={ghost.hype} b={ghost.bugs} /> : ' '}</div>
    </div>
  );
}

export function RunScreen() {
  const { state, dispatch, undo, undoMarks } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ dept: Dept; workerId: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const project = state.project!;
  const phase = content.phases[project.phase];
  const genre = content.genres.find((g) => g.id === project.genreId)!;
  const now = phaseTotals(state, content)!;
  const placed = new Set(Object.values(state.board).filter(Boolean) as string[]);
  const tray = state.roster.filter((id) => !placed.has(id) && !state.benched.includes(id));

  // Ghost deltas: the dragged card over a slot, or the selected card previewed on every slot.
  const ghostFor = (dept: Dept) => {
    const workerId = hover?.dept === dept ? hover.workerId : !hover ? selected : null;
    if (!workerId || state.board[dept] === workerId) return null;
    return preview(state, { type: 'place', dept, workerId }, content);
  };

  const onDragOver = (e: DragOverEvent) => {
    const dept = e.over?.data.current?.dept as Dept | undefined;
    const workerId = e.active.data.current?.workerId as string;
    setHover(dept ? { dept, workerId } : null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const dept = e.over?.data.current?.dept as Dept | undefined;
    if (dept) dispatch({ type: 'place', dept, workerId: e.active.data.current?.workerId as string });
    setHover(null);
    setSelected(null);
  };
  const placeSelected = (dept: Dept) => {
    if (!selected) return;
    dispatch({ type: 'place', dept, workerId: selected });
    setSelected(null);
  };

  return (
    <DndContext sensors={sensors} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setHover(null)}>
      <section className="totals">
        <div><b>{genre.name}</b> · {phase.name} ({project.phase + 1}/{content.phases.length}, {phase.weeks} wk, −{money(weeklyCosts(state, content) * phase.weeks)})</div>
        <div>Project so far: <Delta q={project.quality} h={project.hype} b={project.bugs} /></div>
        <div>This phase: <Delta q={now.quality} h={now.hype} b={now.bugs} /></div>
      </section>

      <section className="board" aria-label="Project board" style={{ "--slots": content.departments.length } as React.CSSProperties}>
        {content.departments.map((d) => (
          <Slot key={d} dept={d} workerId={state.board[d] ?? null} ghost={ghostFor(d)} onActivate={() => placeSelected(d)} />
        ))}
      </section>

      <section className="tray" aria-label="Roster">
        {tray.map((id) => <WorkerCard key={id} id={id} burnout={state.burnout[id]} selected={selected === id} onSelect={() => setSelected(selected === id ? null : id)} />)}
        {tray.length === 0 && <div className="muted">Everyone is placed.</div>}
        {state.benched.map((id) => <div key={id} className="offer"><WorkerCard id={id} static /><span className="neg">Burnt out: back next phase</span></div>)}
      </section>

      <footer className="controls">
        <button onClick={undo} disabled={!undoMarks.length}>Undo</button>
        <button className="primary" onClick={() => dispatch({ type: 'endPhase' })}>
          End {phase.name} → Q {signed(now.quality)}, H {signed(now.hype)}, B {signed(now.bugs)}
        </button>
      </footer>
    </DndContext>
  );
}
