import type { RunState } from '../sim/run';

/**
 * Fixed seed: a fully staffed first project reviews 9.5+ on any of its three pitches (searched over seeds 1-3000),
 * so a newcomer who follows the coach lands a hit. Empty desks still cost: no seed lifts a partial board past ~4.5.
 */
export const TUTORIAL_SEED = 2167;

/** Steps the player passes by reading (no action moves them on); the tutorial ends once all are dismissed. */
export const READ_ONLY = ['phases', 'review', 'payroll'];

/** Finished only when every read step was dismissed: a null step mid-project just means "nothing to say yet". */
export const tutorialFinished = (done: Set<string>) => READ_ONLY.every((id) => done.has(id));

export interface Step { id: string; title: string; text: string; warn?: boolean }

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** Department ids as the slot headers show them (QA is an acronym). */
const deptName = (d: string) => (d === 'qa' ? 'QA' : d[0].toUpperCase() + d.slice(1));

/**
 * The coach's current step, read from run state alone (no step counter to drift): the tutorial
 * follows whatever the player actually did, and reloading mid-run shows the right step.
 */
export function tutorialStep(s: RunState, done: Set<string>): Step | null {
  const placed = Object.values(s.board).filter(Boolean).length;
  const empty = Object.keys(s.board).filter((d) => !s.board[d as keyof typeof s.board]);
  const free = s.roster.filter((id) => !Object.values(s.board).includes(id) && !s.benched.includes(id)).length;
  if (s.event) return { id: 'event', title: 'An event', text: 'Each Quarter can open with an event. Every choice has a cost and a payoff: read both, then pick one.' };
  if (!s.project && s.releases.length === 0)
    return { id: 'pitch', title: 'Pick a game', text: 'Each pitch is a genre plus a topic. Higher market demand means more sales. Pick one to start.' };
  if (s.project && s.project.phase === 0 && placed === 0)
    return { id: 'place', title: 'Staff your desks', text: 'Drag a worker onto a department, or click their card and then a slot. The green numbers show what they would add before you commit.' };
  if (s.project && s.project.phase > 0 && !done.has('phases'))
    return { id: 'phases', title: 'A new phase', text: 'Each phase weights departments differently. Re-place your team, then end the phase. After the last phase the game ships.' };
  // Empty desks while someone could sit there: the review is quality against expectation, and an empty desk adds none.
  if (s.project && empty.length > 0 && free > 0)
    return { id: 'empty', warn: true, title: `${empty.length} empty desk${empty.length > 1 ? 's' : ''}`,
      text: `${list(empty.map(deptName))} ${empty.length > 1 ? 'have' : 'has'} nobody. An empty desk adds no quality, and a thin game reviews badly. Fill every desk you can before ending the phase.` };
  if (s.project && s.project.phase === 0)
    return { id: 'adjacent', title: 'Neighbours matter', text: 'Some traits fire for the desk beside them: try swapping neighbours and watch the green numbers. Then press End Prototype. Each phase costs its weeks of salary and rent.' };
  if (!s.project && s.releases.length > 0 && !done.has('review'))
    return { id: 'review', title: 'Your review', text: 'The score is quality against the market\'s expectation, plus hype, minus bugs. "Helped" and "Hurt" show exactly why. Sales then pay out every week.' };
  if (done.has('review') && !done.has('payroll'))
    return { id: 'payroll', title: 'Payroll Day', text: 'At the end of each Quarter you must hold the cash shown in the top bar. Miss it three times and the studio folds. Survive to week 145 to win.' };
  return null;
}
