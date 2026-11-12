import prand from 'pure-rand';
import type { ContentPack, Dept } from '../data/schemas';
import { mergeContributions, resolve, type Board, type Contribution, type Totals } from './resolver';

export interface Project {
  genreId: string;
  phase: number; // index into content.phases
  quality: number;
  hype: number;
  bugs: number;
  contributions: Contribution[];
}

export interface ReviewLine { source: string; impact: number } // impact on the 1-10 review score

export interface Release {
  genreId: string;
  week: number;
  review: number;
  quality: number;
  hype: number;
  bugs: number;
  best: ReviewLine[];
  worst: ReviewLine[];
}

export interface RunState {
  seed: number;
  week: number;
  cash: number;
  roster: string[];
  board: Board;
  trendId: string;
  project: Project | null;
  releases: Release[];
  dead: boolean;
}

export type Command =
  | { type: 'startProject'; genreId: string }
  | { type: 'place'; dept: Dept; workerId: string | null }
  | { type: 'endPhase' };

export type SimEvent =
  | { type: 'projectStarted'; genreId: string }
  | { type: 'placed'; dept: Dept; workerId: string | null }
  | { type: 'phaseEnded'; phaseId: string; weeks: number; payroll: number; totals: Totals }
  | { type: 'released'; release: Release }
  | { type: 'bankrupt'; week: number };

export function newRun(seed: number, content: ContentPack): RunState {
  let rng = prand.xoroshiro128plus(seed);
  const draw = (max: number) => { const [v, next] = prand.uniformIntDistribution(0, max, rng); rng = next; return v; };
  const trendId = content.trends[draw(content.trends.length - 1)].id;
  const pool = content.workers.map((w) => w.id);
  const roster: string[] = [];
  while (roster.length < content.rosterSize) roster.push(pool.splice(draw(pool.length - 1), 1)[0]);
  const board: Board = Object.fromEntries(content.departments.map((d) => [d, null]));
  return { seed, week: 1, cash: content.startingCash, roster, board, trendId, project: null, releases: [], dead: false };
}

/** Totals the current board would produce if the phase ended now. */
export function phaseTotals(s: RunState, content: ContentPack): Totals | null {
  if (!s.project) return null;
  return resolve(s.board, { content, genreId: s.project.genreId, phaseId: content.phases[s.project.phase].id, trendId: s.trendId });
}

/** Pure preview: apply a command to a copy and diff this phase's totals. */
export function preview(s: RunState, cmd: Command, content: ContentPack): { quality: number; hype: number; bugs: number } | null {
  const before = phaseTotals(s, content);
  const [next] = apply(s, cmd, content);
  const after = phaseTotals(next, content);
  if (!before || !after) return null;
  return { quality: after.quality - before.quality, hype: after.hype - before.hype, bugs: after.bugs - before.bugs };
}

export function reviewOf(p: Project, content: ContentPack): Omit<Release, 'genreId' | 'week'> {
  const { expectation, bugPenalty, min, max } = content.review;
  const raw = (10 * p.quality) / expectation - p.bugs * bugPenalty;
  const review = Math.round(Math.min(max, Math.max(min, raw)) * 10) / 10;
  const lines: ReviewLine[] = mergeContributions(p.contributions)
    .filter((c) => c.metric !== 'hype')
    .map((c) => ({ source: c.source, impact: c.metric === 'quality' ? (10 * c.delta) / expectation : -c.delta * bugPenalty }));
  const sorted = [...lines].sort((a, b) => b.impact - a.impact);
  return {
    review, quality: p.quality, hype: p.hype, bugs: p.bugs,
    best: sorted.filter((l) => l.impact > 0).slice(0, 3),
    worst: sorted.filter((l) => l.impact < 0).reverse().slice(0, 3),
  };
}

/** Pure reducer: never mutates `s`; returns the next state plus events for the UI and 3D view. */
export function apply(s: RunState, cmd: Command, content: ContentPack): [RunState, SimEvent[]] {
  if (s.dead) return [s, []];
  switch (cmd.type) {
    case 'startProject': {
      if (s.project) throw new Error('project already running');
      if (!content.genres.some((g) => g.id === cmd.genreId)) throw new Error(`unknown genre ${cmd.genreId}`);
      const project: Project = { genreId: cmd.genreId, phase: 0, quality: 0, hype: 0, bugs: 0, contributions: [] };
      return [{ ...s, project }, [{ type: 'projectStarted', genreId: cmd.genreId }]];
    }
    case 'place': {
      if (!(cmd.dept in s.board)) throw new Error(`unknown dept ${cmd.dept}`);
      if (cmd.workerId && !s.roster.includes(cmd.workerId)) throw new Error(`not on roster ${cmd.workerId}`);
      const board: Board = { ...s.board };
      for (const d of Object.keys(board) as Dept[]) if (cmd.workerId && board[d] === cmd.workerId) board[d] = null; // one slot per worker
      board[cmd.dept] = cmd.workerId;
      return [{ ...s, board }, [{ type: 'placed', dept: cmd.dept, workerId: cmd.workerId }]];
    }
    case 'endPhase': {
      if (!s.project) throw new Error('no project');
      const phase = content.phases[s.project.phase];
      const totals = phaseTotals(s, content)!;
      const payroll = phase.weeks * s.roster.reduce((sum, id) => sum + content.workers.find((w) => w.id === id)!.salary, 0);
      const project: Project = {
        ...s.project,
        phase: s.project.phase + 1,
        quality: s.project.quality + totals.quality,
        hype: s.project.hype + totals.hype,
        bugs: s.project.bugs + totals.bugs,
        contributions: [...s.project.contributions, ...totals.contributions],
      };
      let next: RunState = { ...s, week: s.week + phase.weeks, cash: s.cash - payroll, project };
      const events: SimEvent[] = [{ type: 'phaseEnded', phaseId: phase.id, weeks: phase.weeks, payroll, totals }];
      if (project.phase >= content.phases.length) {
        const release: Release = { genreId: project.genreId, week: next.week, ...reviewOf(project, content) };
        next = { ...next, project: null, releases: [...s.releases, release] };
        events.push({ type: 'released', release });
      }
      if (next.cash < 0) { // M2 replaces this with 3 debt strikes (D-2)
        next = { ...next, dead: true };
        events.push({ type: 'bankrupt', week: next.week });
      }
      return [next, events];
    }
  }
}
