import { content } from './data/load';
import { forecast, quarterOf, rivalById } from './sim/market';
import { demandFor } from './sim/run';
import { useGame } from './store/game';
import { RunScreen } from './ui/RunScreen';
import { Coach } from './ui/Coach';
import { Between } from './ui/Between';
import { Hud } from './ui/Hud';
import { PostMortem } from './ui/PostMortem';
import { Hub } from './ui/Hub';
import { Review } from "./ui/ReviewReveal";

const ARROW = { up: '▲', flat: '▬', down: '▼' } as const;

/** Fogged market map: this Quarter's demand per genre (exact), next Quarter's direction only, and rivals due. */
function MarketMap() {
  const state = useGame((s) => s.state);
  const q = quarterOf(state.week, content);
  const f = forecast(state.market, q, content);
  return (
    <section className="market" aria-label="Market">
      <h2>Market</h2>
      <div className="genres">
        {content.genres.map((g) => {
          const chasing = Object.entries(state.rivalGenres).filter(([, x]) => x === g.id).map(([r]) => rivalById(r, content).name);
          return (
            <div key={g.id} className="cell">
              <b>{g.name}</b> ×{(state.demand[g.id] ?? 1).toFixed(2)}
              {f && <span className={f.genres[g.id] === 'down' ? 'neg' : f.genres[g.id] === 'up' ? 'pos' : 'muted'}> {ARROW[f.genres[g.id]]} next Q</span>}
              {chasing.length > 0 && <div className="muted">rivals: {chasing.join(', ')}</div>}
            </div>
          );
        })}
      </div>
      {f && <p className="muted">Releasing next Quarter: {f.rivals.length ? f.rivals.map((r) => rivalById(r, content).name).join(', ') : 'nobody'}</p>}
    </section>
  );
}

function EventCard() {
  const { state, dispatch } = useGame();
  const e = content.events.find((x) => x.id === state.event);
  if (!e) return null;
  return (
    <section className="event" role="dialog" aria-label={e.title}>
      <h2>{e.title}</h2>
      <p>{e.text}</p>
      <div className="genres">
        {e.choices.map((c, i) => <button key={i} onClick={() => dispatch({ type: 'chooseEvent', choice: i })}>{c.label}</button>)}
      </div>
    </section>
  );
}

function PitchPicker() {
  const { state, dispatch } = useGame();
  return (
    <section className="picker">
      <h2>Pitch a new game</h2>
      <p className="muted">Demand = genre market × topic fit × trend × platform × your share. Output is weighted by genre.</p>
      <div className="genres">
        {state.pitch.map((p) => {
          const g = content.genres.find((x) => x.id === p.genreId)!;
          const t = content.topics.find((x) => x.id === p.topicId)!;
          return (
            <button key={p.genreId + p.topicId} className="genre" onClick={() => dispatch({ type: 'startProject', ...p })}>
              <b>{t.name} {g.name}</b>
              <span>demand ×{demandFor(state, p, content).toFixed(2)}</span>
              {content.departments.map((d) => <span key={d}>{d} ×{g.weights[d]}</span>)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Showdowns() {
  const shows = useGame((s) => s.state.showdowns);
  if (!shows.length) return null;
  return (
    <section className="review">
      <h2>Rival showdowns</h2>
      {shows.map((x) => (
        <div key={x.era} className={x.won ? 'pos' : 'neg'}>
          Era {x.era + 1} vs {rivalById(x.rivalId, content).name}: yours {x.yours ?? 'no release'} vs target {x.target}, {x.won ? 'won (share up)' : 'lost (a strike)'}
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const { state, error, hub } = useGame();
  const over = state.dead || state.won;
  return (
    <main>
      <h1>Dev Tycoon Roguelike <span className="muted">M5 juice · seed {state.seed} · {content.studios.find((s) => s.id === state.options.studio)?.name} · Crunch {state.options.crunch}</span></h1>
      <Coach />
      {!hub && <Hud />}
      {error && <div className="error" role="alert">{error}</div>}
      {!hub && !over && <EventCard />}
      {hub ? <Hub /> : over ? <PostMortem /> : state.project ? <RunScreen /> : (<><Showdowns /><Review /><MarketMap /><Between /><PitchPicker /></>)}
    </main>
  );
}
