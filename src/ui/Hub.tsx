import { useState } from 'react';
import { baseContent } from '../data/load';
import { studiosAvailable } from '../sim/meta';
import { useGame } from '../store/game';

/** Studio Hub, between runs: spend reputation on unlocks, then pick a starting studio and a Crunch Level. */
export function Hub() {
  const { meta, metaRecovered, buyUnlock, startRun } = useGame();
  const studios = studiosAvailable(meta, baseContent);
  const [studio, setStudio] = useState(studios[0].id);
  const [crunch, setCrunch] = useState(meta.crunchMax);
  return (
    <section className="hub">
      <h2>Studio Hub</h2>
      {metaRecovered && <div className="error" role="alert">Your progress file could not be read, so it was reset.</div>}
      <p>Reputation <b>{meta.reputation}</b> <span className="muted">· {meta.runs} runs · {meta.wins} wins · {meta.earned} earned in total</span></p>

      <h3>Unlocks</h3>
      <p className="muted">Every unlock adds an option with a cost. Nothing is a flat boost. Unlocks you buy apply from your next run.</p>
      <div className="genres">
        {baseContent.unlocks.map((u) => {
          const owned = meta.unlocked.includes(u.id);
          return (
            <div key={u.id} className={`cell unlock${owned ? ' owned' : ''}`}>
              <b>{u.name}</b>
              <p className="muted">{u.text}</p>
              {owned ? <span className="pos">Owned</span>
                : <button disabled={meta.reputation < u.cost} onClick={() => buyUnlock(u.id)}>Unlock ({u.cost} rep)</button>}
            </div>
          );
        })}
      </div>

      <h3>Starting studio</h3>
      <div className="genres" role="radiogroup" aria-label="Starting studio">
        {studios.map((s) => (
          <button key={s.id} role="radio" aria-checked={studio === s.id} className={`genre${studio === s.id ? ' picked' : ''}`} onClick={() => setStudio(s.id)}>
            <b>{s.name}</b><span>{s.text}</span>
          </button>
        ))}
      </div>

      <h3>Crunch Level</h3>
      <label>
        <select value={crunch} onChange={(e) => setCrunch(Number(e.target.value))}>
          {Array.from({ length: meta.crunchMax + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? '0: standard' : `${n}: ${baseContent.crunch[n - 1].text}`}</option>)}
        </select>
      </label>
      {crunch > 0 && (
        <ul className="muted">{baseContent.crunch.slice(0, crunch).map((l, i) => <li key={i}>{i + 1}. {l.text}</li>)}</ul>
      )}
      <p className="muted">
        {meta.crunchMax < baseContent.crunch.length ? `Win at Crunch ${meta.crunchMax} to unlock Crunch ${meta.crunchMax + 1}. ` : ''}
        Higher levels earn +{Math.round(baseContent.meta.crunchRepBonus * 100)}% reputation each.
      </p>
      <button className="primary" onClick={() => startRun(studio, crunch)}>Start run</button>
    </section>
  );
}
