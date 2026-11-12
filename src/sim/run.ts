import prand from 'pure-rand';
import type { ContentPack } from '../data/schemas';
import { resolve, type Board } from './resolver';

export interface RunState {
  seed: number;
  week: number;
  cash: number;
  hype: number;
  bugs: number;
  board: Board;
  trendId: string;
  dead: boolean;
}

export type Command =
  | { type: 'place'; dept: string; workerId: string | null }
  | { type: 'endWeek' };

export type SimEvent =
  | { type: 'placed'; dept: string; workerId: string | null }
  | { type: 'weekEnded'; week: number; cashDelta: number }
  | { type: 'bankrupt'; week: number };

export function newRun(seed: number, content: ContentPack): RunState {
  const rng = prand.xoroshiro128plus(seed);
  const [i] = prand.uniformIntDistribution(0, content.trends.length - 1, rng);
  const board: Board = Object.fromEntries(content.departments.map((d) => [d, null]));
  return { seed, week: 1, cash: content.startingCash, hype: 0, bugs: 0, board, trendId: content.trends[i].id, dead: false };
}

/** Pure reducer: never mutates `s`; returns the next state plus events for the UI and 3D view. */
export function apply(s: RunState, cmd: Command, content: ContentPack): [RunState, SimEvent[]] {
  if (s.dead) return [s, []];
  if (cmd.type === 'place') {
    if (!(cmd.dept in s.board)) throw new Error(`unknown dept ${cmd.dept}`);
    const board = { ...s.board };
    for (const d in board) if (cmd.workerId && board[d] === cmd.workerId) board[d] = null; // one slot per worker
    board[cmd.dept] = cmd.workerId;
    return [{ ...s, board }, [{ type: 'placed', dept: cmd.dept, workerId: cmd.workerId }]];
  }
  const t = resolve(s.board, content, s.trendId);
  const payroll = Object.values(s.board)
    .filter((id): id is string => !!id)
    .reduce((sum, id) => sum + content.workers.find((w) => w.id === id)!.salary, 0);
  const cashDelta = -payroll;
  const next: RunState = { ...s, week: s.week + 1, cash: s.cash + cashDelta, hype: s.hype + t.hype, bugs: s.bugs + t.bugs };
  const events: SimEvent[] = [{ type: 'weekEnded', week: s.week, cashDelta }];
  if (next.cash < 0) {
    next.dead = true;
    events.push({ type: 'bankrupt', week: s.week });
  }
  return [next, events];
}
