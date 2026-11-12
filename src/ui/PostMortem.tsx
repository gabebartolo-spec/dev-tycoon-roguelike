import { content } from '../data/load';
import { postMortem } from '../sim/run';
import { useGame } from '../store/game';
import { money } from './format';

function CashGraph({ points }: { points: number[] }) {
  const w = 600, h = 160, pad = 4;
  const min = Math.min(0, ...points), max = Math.max(0, ...points);
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (h - 2 * pad);
  const path = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="cash-graph" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Cash over ${points.length - 1} weeks, from ${money(points[0])} to ${money(points[points.length - 1])}`}>
      <line x1={pad} x2={w - pad} y1={y(0)} y2={y(0)} className="zero" />
      <path d={path} className="line" />
    </svg>
  );
}

/** End of run: cash graph, top 3 causes of death, best project. */
export function PostMortem() {
  const { state, newGame } = useGame();
  const pm = postMortem(state, content);
  const genre = (id: string) => content.genres.find((g) => g.id === id)!.name;
  return (
    <section className="review" aria-live="polite">
      <h2>{state.won ? `You survived to week ${state.week}!` : `Bankrupt in week ${state.week}`}</h2>
      <p className="muted">{state.releases.length} games released · {money(state.ledger.sales)} total sales · final cash {money(state.cash)}</p>
      <CashGraph points={pm.cashHistory} />
      <div className="why">
        <div>
          <h3>{state.won ? 'Biggest costs' : 'What killed the studio'}</h3>
          {pm.causes.map((c) => <div key={c.label} className="neg">{money(c.amount)} {c.label}</div>)}
        </div>
        <div>
          <h3>Best project</h3>
          {pm.best ? <div>{genre(pm.best.genreId)}, week {pm.best.week}: review {pm.best.review}/10, earned {money(pm.best.revenue)} on {money(pm.best.cost)} cost</div> : <div className="muted">nothing shipped</div>}
        </div>
      </div>
      <button className="primary" onClick={() => newGame()}>New run</button>
    </section>
  );
}
