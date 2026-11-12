import { useDraggable } from '@dnd-kit/core';
import { signed, traitById, workerById } from './format';

export function TraitChip({ id }: { id: string }) {
  const t = traitById(id);
  return <span className="trait" title={t.text}>{t.name}<span className="trait-text">{t.text}</span></span>;
}

export function WorkerCard({ id, selected, onSelect, compact, static: still, burnout }: {
  id: string; selected?: boolean; onSelect?: () => void; compact?: boolean; static?: boolean; burnout?: number;
}) {
  const w = workerById(id);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `worker:${id}`, data: { workerId: id }, disabled: still });
  const s = w.stats;
  return (
    <div
      ref={still ? undefined : setNodeRef}
      {...(still ? {} : listeners)}
      {...(still ? {} : attributes)}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(); }}
      aria-pressed={selected}
      aria-label={`${w.name}, ${w.traits.map((t) => traitById(t).name).join(', ')}`}
      className={`card ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${compact ? 'compact' : ''} ${still ? 'static' : ''}`}
    >
      {burnout !== undefined && (
        <div className="burnout" title={`Burnout ${Math.round(burnout)}`} aria-label={`Burnout ${Math.round(burnout)}`}><span style={{ width: `${Math.min(100, burnout)}%` }} /></div>
      )}
      <div className="card-head"><b>{w.name}</b><span className="muted">${w.salary}/wk</span></div>
      <div className="stats">
        <span>C{s.code}</span><span>D{s.design}</span><span>A{s.art}</span><span>S{s.audio}</span>
        {s.hype ? <span className="hype">H{s.hype}</span> : null}
        {s.bugs ? <span className="bugs">B{s.bugs}</span> : null}
      </div>
      <div className="tags">{w.tags.join(' · ')}</div>
      {!compact && <div className="traits">{w.traits.map((t) => <TraitChip key={t} id={t} />)}</div>}
    </div>
  );
}

export function Delta({ q, h, b }: { q: number; h: number; b: number }) {
  return (
    <span className="delta">
      <span className={q >= 0 ? 'pos' : 'neg'}>Q {signed(q)}</span>
      <span className={h >= 0 ? 'pos' : 'neg'}>H {signed(h)}</span>
      <span className={b <= 0 ? 'pos' : 'neg'}>B {signed(b)}</span>
    </span>
  );
}
