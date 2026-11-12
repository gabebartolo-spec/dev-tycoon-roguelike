import { content } from '../data/load';
import { useGame } from '../store/game';
import { money, workerById } from './format';
import { WorkerCard } from './widgets';

/** Between projects: the 1-of-N hiring draft and the roster with firing (severance shown up front). */
export function Between() {
  const { state, dispatch } = useGame();
  const { economy } = content;
  const full = state.roster.length >= economy.rosterMax;
  return (
    <>
      {state.draft && (
        <section className="review" aria-label="Hiring draft">
          <h2>Hiring draft: pick one <span className="muted">({state.roster.length}/{economy.rosterMax} staff)</span></h2>
          <div className="tray">
            {state.draft.map((id) => (
              <div key={id} className="offer">
                <WorkerCard id={id} static />
                <button className="primary" disabled={full} onClick={() => dispatch({ type: 'hire', workerId: id })}>
                  Hire {workerById(id).name} (+{money(workerById(id).salary)}/wk)
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => dispatch({ type: 'skipDraft' })}>Skip</button>
        </section>
      )}
      <section className="review" aria-label="Studio roster">
        <h2>Your studio</h2>
        <div className="tray">
          {state.roster.map((id) => {
            const severance = workerById(id).salary * economy.severanceWeeks;
            return (
              <div key={id} className="offer">
                <WorkerCard id={id} static burnout={state.burnout[id]} />
                <button disabled={state.roster.length <= 1} onClick={() => dispatch({ type: 'fire', workerId: id })}>
                  Fire (severance {money(severance)})
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
