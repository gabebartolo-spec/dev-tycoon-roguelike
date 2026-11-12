import { content } from '../data/load';
import { runway, weeklyCosts } from '../sim/run';
import { useGame } from '../store/game';
import { money } from './format';

/** Always-on survival readout: cash, runway, strikes and the next Payroll Day. */
export function Hud() {
  const state = useGame((s) => s.state);
  const { economy } = content;
  const weeks = runway(state, content);
  const nextPayday = Math.ceil((state.week + 1) / economy.payrollEveryWeeks) * economy.payrollEveryWeeks;
  const quarter = Math.floor((state.week - 1) / economy.weeksPerQuarter) + 1;
  const trend = content.trends.find((t) => t.id === state.trendId)!;
  const income = state.sales.reduce((a, x) => a + x.next, 0);
  return (
    <header className="hud" aria-label="Studio status">
      <span>Week {state.week}/{economy.winWeek} · Q{quarter}</span>
      <span className={state.cash < 0 ? 'neg' : ''}>Cash {money(state.cash)}</span>
      <span className="muted">−{money(weeklyCosts(state, content))}/wk{income ? ` · +${money(income)}/wk sales` : ''}</span>
      <span className={weeks < 8 ? 'neg' : ''}>Runway {weeks === Infinity ? '∞' : `${weeks} wk`}</span>
      <span className={state.strikes ? 'neg' : ''}>Strikes {state.strikes}/{economy.debtStrikes}</span>
      <span className="muted">Payroll Day: wk {nextPayday}</span>
      <span>Trend: {trend.name}</span>
    </header>
  );
}
