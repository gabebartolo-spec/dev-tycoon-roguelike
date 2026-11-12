import { content } from '../data/load';
import { bossOf, eraOf, lastWeek, quarterOf, rivalById, targetFor, thresholdFor } from '../sim/market';
import { runway, weeklyCosts } from '../sim/run';
import { useGame } from '../store/game';
import { money } from './format';

/** Always-on survival readout: cash, runway, strikes, the next Payroll Day threshold and this Era's rival boss. */
export function Hud() {
  const state = useGame((s) => s.state);
  const { economy, calendar } = content;
  const weeks = runway(state, content);
  const q = quarterOf(state.week, content);
  const era = eraOf(q, content);
  const nextPayday = (q + 1) * calendar.weeksPerQuarter + 1;
  const boss = rivalById(bossOf(state.market, era), content);
  const trend = content.trends.find((t) => t.id === state.trendId)!;
  const income = state.sales.reduce((a, x) => a + x.next, 0);
  return (
    <header className="hud" aria-label="Studio status">
      <span>Week {state.week}/{lastWeek(content)} · Era {era + 1} · Q{(q % calendar.quartersPerEra) + 1}</span>
      <span className={state.cash < 0 ? 'neg' : ''}>Cash {money(state.cash)}</span>
      <span className="muted">−{money(weeklyCosts(state, content))}/wk{income ? ` · +${money(income)}/wk sales` : ''}</span>
      <span className={weeks < 8 ? 'neg' : ''}>Runway {weeks === Infinity ? '∞' : `${weeks} wk`}</span>
      <span className={state.strikes ? 'neg' : ''}>Strikes {state.strikes}/{economy.debtStrikes}</span>
      <span className={state.cash < thresholdFor(q, content) ? 'neg' : 'muted'}>Payroll Day wk {nextPayday}: need {money(thresholdFor(q, content))}</span>
      <span>Trend: {trend.name}</span>
      <span>Expectation {state.expectation} · Share ×{state.share.toFixed(2)}</span>
      <span title={boss.twist.text}>Boss: {boss.name}, beat {targetFor(boss, era)} ({boss.twist.text})</span>
    </header>
  );
}
