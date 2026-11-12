import { content } from './data/load';
import { useGame } from './store/game';
import { RunScreen } from './ui/RunScreen';
import { money, signed } from './ui/format';
import { Between } from './ui/Between';
import { Hud } from './ui/Hud';
import { PostMortem } from './ui/PostMortem';

function GenrePicker() {
  const dispatch = useGame((s) => s.dispatch);
  return (
    <section className="picker">
      <h2>Pitch a new game</h2>
      <p className="muted">Each department's output is multiplied by the genre's weight.</p>
      <div className="genres">
        {content.genres.map((g) => (
          <button key={g.id} className="genre" onClick={() => dispatch({ type: 'startProject', genreId: g.id })}>
            <b>{g.name}</b>
            {content.departments.map((d) => <span key={d}>{d} ×{g.weights[d]}</span>)}
          </button>
        ))}
      </div>
    </section>
  );
}

function Review() {
  const { state } = useGame();
  const r = state.releases[state.releases.length - 1];
  if (!r) return null;
  const genre = content.genres.find((g) => g.id === r.genreId)!;
  return (
    <section className="review" aria-live="polite">
      <h2>Last release: {genre.name}, review <span className="score">{r.review}/10</span></h2>
      <p className="muted">Cost {money(r.cost)} · sales so far {money(r.revenue)} · Quality {r.quality.toFixed(1)} vs expectation {content.review.expectation} · Hype {r.hype.toFixed(1)} · Bugs {r.bugs.toFixed(1)}</p>
      <div className="why">
        <div><h3>Helped</h3>{r.best.map((l) => <div key={l.source} className="pos">{signed(l.impact)} {l.source}</div>)}</div>
        <div><h3>Hurt</h3>{r.worst.length ? r.worst.map((l) => <div key={l.source} className="neg">{signed(l.impact)} {l.source}</div>) : <div className="muted">nothing</div>}</div>
      </div>
    </section>
  );
}

export default function App() {
  const { state, error } = useGame();
  const over = state.dead || state.won;
  return (
    <main>
      <h1>Dev Tycoon Roguelike <span className="muted">M2 survival loop · seed {state.seed}</span></h1>
      <Hud />
      {error && <div className="error" role="alert">{error}</div>}
      {over ? <PostMortem /> : state.project ? <RunScreen /> : (<><Review /><Between /><GenrePicker /></>)}
    </main>
  );
}
