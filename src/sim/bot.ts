import type { ContentPack } from '../data/schemas';
import { apply, demandFor, newRun, phaseTotals, type RunState } from './run';

/**
 * Headless greedy player for balance sweeps (not used by the game). Pitches the highest-demand option, fills each
 * slot with the worker who adds the most review points, answers events with their first choice, hires while cash is
 * comfortable. Deterministic: same seed, same run.
 */
export function playBot(seed: number, content: ContentPack, maxCommands = 2000): RunState {
  let s = newRun(seed, content);
  const step = (cmd: Parameters<typeof apply>[1]) => { s = apply(s, cmd, content)[0]; };
  const score = (t: RunState) => {
    const x = phaseTotals(t, content);
    return x ? (10 * x.quality) / t.expectation - x.bugs * content.review.bugPenalty + x.hype * 0.05 : 0;
  };
  for (let n = 0; n < maxCommands && !s.dead && !s.won; n++) {
    if (s.event) { step({ type: 'chooseEvent', choice: 0 }); continue; }
    if (!s.project) {
      if (s.draft && s.roster.length < 6 && s.cash > 30000) step({ type: 'hire', workerId: s.draft[0] });
      const best = [...s.pitch].sort((a, b) => demandFor(s, b, content) - demandFor(s, a, content))[0];
      step({ type: 'startProject', ...best });
      continue;
    }
    for (const dept of content.departments) {
      let bestState = s;
      let bestScore = score(s);
      for (const w of s.roster) {
        if (s.benched.includes(w)) continue;
        const [t] = apply(s, { type: 'place', dept, workerId: w }, content);
        if (score(t) > bestScore + 1e-9) { bestScore = score(t); bestState = t; }
      }
      s = bestState;
    }
    step({ type: 'endPhase' });
  }
  return s;
}
