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
  cost: number;    // salaries + rent paid while it was in development
  revenue: number; // sales so far
}

/** A released game still selling; `next` is next week's revenue, which decays every week. */
export interface Sale { release: number; next: number }

export type LedgerTag = 'salary' | 'rent' | 'severance' | 'sales';

export interface RunState {
  seed: number;
  rngStep: number; // seeded draws taken so far; draw n has its own stream, so state stays plain JSON
  week: number;
  cash: number;
  roster: string[];
  board: Board;
  trendId: string;
  project: Project | null;
  projectCost: number;
  releases: Release[];
  sales: Sale[];
  ledger: Record<LedgerTag, number>;
  cashHistory: number[]; // cash at the end of each week; index 0 = start
  strikes: number;
  burnout: Record<string, number>;
  benched: string[]; // broke down last phase: cannot be placed this phase
  draft: string[] | null; // hiring offer between projects
  dead: boolean;
  won: boolean;
}

export type Command =
  | { type: 'startProject'; genreId: string }
  | { type: 'place'; dept: Dept; workerId: string | null }
  | { type: 'endPhase' }
  | { type: 'hire'; workerId: string }
  | { type: 'skipDraft' }
  | { type: 'fire'; workerId: string };

export type SimEvent =
  | { type: 'projectStarted'; genreId: string }
  | { type: 'placed'; dept: Dept; workerId: string | null }
  | { type: 'phaseEnded'; phaseId: string; weeks: number; payroll: number; totals: Totals }
  | { type: 'released'; release: Release }
  | { type: 'breakthrough'; workerId: string; quality: number }
  | { type: 'breakdown'; workerId: string; bugs: number }
  | { type: 'payrollDay'; week: number; cash: number; strike: boolean; strikes: number }
  | { type: 'draftOffered'; workerIds: string[] }
  | { type: 'hired'; workerId: string }
  | { type: 'fired'; workerId: string; severance: number }
  | { type: 'bankrupt'; week: number }
  | { type: 'won'; week: number };

/** Draw n of a run uses its own seeded stream, so no generator object lives in state. */
function drawInt(s: RunState, max: number): [number, RunState] {
  const rng = prand.xoroshiro128plus((s.seed ^ Math.imul(s.rngStep + 1, 0x9e3779b1)) | 0);
  const [v] = prand.uniformIntDistribution(0, max, rng);
  return [v, { ...s, rngStep: s.rngStep + 1 }];
}

const salaryOf = (id: string, content: ContentPack) => content.workers.find((w) => w.id === id)!.salary;
const payrollOf = (s: RunState, content: ContentPack) => s.roster.reduce((sum, id) => sum + salaryOf(id, content), 0);
export const weeklyCosts = (s: RunState, content: ContentPack) => payrollOf(s, content) + content.economy.rentPerWeek;

/** Weeks the current cash lasts at current costs, counting sales already earning. Infinity if it never runs out. */
export function runway(s: RunState, content: ContentPack): number {
  let cash = s.cash;
  let sales = s.sales.map((x) => x.next);
  const cost = weeklyCosts(s, content);
  for (let w = 0; w < 520; w++) {
    cash += sales.reduce((a, b) => a + b, 0) - cost;
    if (cash < 0) return w;
    sales = sales.map((x) => x * content.sales.decay).filter((x) => x >= content.sales.minWeekly);
  }
  return Infinity;
}

export function newRun(seed: number, content: ContentPack): RunState {
  let rng = prand.xoroshiro128plus(seed);
  const draw = (max: number) => { const [v, next] = prand.uniformIntDistribution(0, max, rng); rng = next; return v; };
  const trendId = content.trends[draw(content.trends.length - 1)].id;
  const pool = content.workers.map((w) => w.id);
  const roster: string[] = [];
  while (roster.length < content.rosterSize) roster.push(pool.splice(draw(pool.length - 1), 1)[0]);
  const board: Board = Object.fromEntries(content.departments.map((d) => [d, null]));
  return {
    seed, rngStep: 0, week: 1, cash: content.startingCash, roster, board, trendId, project: null, projectCost: 0,
    releases: [], sales: [], ledger: { salary: 0, rent: 0, severance: 0, sales: 0 }, cashHistory: [content.startingCash],
    strikes: 0, burnout: Object.fromEntries(roster.map((id) => [id, 0])), benched: [], draft: null, dead: false, won: false,
  };
}

/** Advance `weeks` weeks: costs, sales, Payroll Days with debt strikes (D-2), bankruptcy and the win check. */
function tick(s0: RunState, weeks: number, content: ContentPack): [RunState, SimEvent[]] {
  const { economy, sales: S } = content;
  let s = s0;
  const events: SimEvent[] = [];
  for (let i = 0; i < weeks && !s.dead && !s.won; i++) {
    const salary = payrollOf(s, content);
    const rent = economy.rentPerWeek;
    const releases = s.releases.map((r) => ({ ...r }));
    let income = 0;
    for (const sale of s.sales) {
      const amount = Math.round(sale.next);
      income += amount;
      releases[sale.release].revenue += amount;
    }
    const sales = s.sales.map((x) => ({ ...x, next: x.next * S.decay })).filter((x) => x.next >= S.minWeekly);
    const cash = s.cash - salary - rent + income;
    s = {
      ...s, week: s.week + 1, cash, releases, sales,
      projectCost: s.project ? s.projectCost + salary + rent : s.projectCost,
      ledger: { ...s.ledger, salary: s.ledger.salary + salary, rent: s.ledger.rent + rent, sales: s.ledger.sales + income },
      cashHistory: [...s.cashHistory, cash],
    };
    if (s.week % economy.payrollEveryWeeks === 0) {
      const strike = s.cash < 0;
      if (strike) s = { ...s, strikes: s.strikes + 1 };
      events.push({ type: 'payrollDay', week: s.week, cash: s.cash, strike, strikes: s.strikes });
      if (s.strikes >= economy.debtStrikes) {
        s = { ...s, dead: true };
        events.push({ type: 'bankrupt', week: s.week });
      }
    }
    if (!s.dead && s.week >= economy.winWeek) {
      s = { ...s, won: true };
      events.push({ type: 'won', week: s.week });
    }
  }
  return [s, events];
}

function offerDraft(s0: RunState, content: ContentPack): [RunState, SimEvent[]] {
  let s = s0;
  const pool = content.workers.map((w) => w.id).filter((id) => !s.roster.includes(id));
  const offer: string[] = [];
  while (offer.length < content.economy.draftSize && pool.length) {
    let i: number;
    [i, s] = drawInt(s, pool.length - 1);
    offer.push(pool.splice(i, 1)[0]);
  }
  if (!offer.length) return [s, []];
  return [{ ...s, draft: offer }, [{ type: 'draftOffered', workerIds: offer }]];
}

/** First-week revenue of a release: hype x review x the current trend's demand for its genre. */
export function launchSales(r: Pick<Release, 'genreId' | 'hype' | 'review'>, trendId: string, content: ContentPack): number {
  const S = content.sales;
  const demand = content.trends.find((t) => t.id === trendId)!.demand[r.genreId] ?? 1;
  return S.basePerWeek * (1 + Math.max(0, r.hype) / S.hypeScale) * (r.review / 10) ** S.reviewExp * demand;
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

export function reviewOf(p: Project, content: ContentPack): Omit<Release, 'genreId' | 'week' | 'cost' | 'revenue'> {
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

/** Burnout after a phase: placed workers wear down, the rest recover; at the threshold a seeded roll decides. */
function burnoutPhase(s0: RunState, project0: Project, weeks: number, content: ContentPack): [RunState, Project, SimEvent[]] {
  const B = content.burnout;
  let s = s0;
  let project = project0;
  const events: SimEvent[] = [];
  const placed = new Set(Object.values(s.board).filter(Boolean) as string[]);
  const burnout: Record<string, number> = {};
  const benched: string[] = [];
  for (const id of s.roster) {
    const was = s.burnout[id] ?? 0;
    const b = placed.has(id) ? was + B.perWeekPlaced * weeks : Math.max(0, was - B.recoverPerWeek * weeks);
    burnout[id] = b < B.threshold ? b : 0;
    if (b < B.threshold) continue;
    let roll: number;
    [roll, s] = drawInt(s, 9999);
    const name = content.workers.find((w) => w.id === id)!.name;
    if (roll < B.breakthroughChance * 10000) {
      project = { ...project, quality: project.quality + B.breakthroughQuality, contributions: [...project.contributions, { source: `${name}: breakthrough`, metric: 'quality', delta: B.breakthroughQuality }] };
      events.push({ type: 'breakthrough', workerId: id, quality: B.breakthroughQuality });
    } else {
      project = { ...project, bugs: project.bugs + B.breakdownBugs, contributions: [...project.contributions, { source: `${name}: breakdown`, metric: 'bugs', delta: B.breakdownBugs }] };
      benched.push(id);
      events.push({ type: 'breakdown', workerId: id, bugs: B.breakdownBugs });
    }
  }
  const board: Board = Object.fromEntries(Object.entries(s.board).map(([d, w]) => [d, w && benched.includes(w) ? null : w]));
  return [{ ...s, burnout, benched, board }, project, events];
}

/** Pure reducer: never mutates `s`; returns the next state plus events for the UI and 3D view. */
export function apply(s: RunState, cmd: Command, content: ContentPack): [RunState, SimEvent[]] {
  if (s.dead || s.won) return [s, []];
  switch (cmd.type) {
    case 'startProject': {
      if (s.project) throw new Error('project already running');
      if (!content.genres.some((g) => g.id === cmd.genreId)) throw new Error(`unknown genre ${cmd.genreId}`);
      const project: Project = { genreId: cmd.genreId, phase: 0, quality: 0, hype: 0, bugs: 0, contributions: [] };
      return [{ ...s, project, projectCost: 0, draft: null }, [{ type: 'projectStarted', genreId: cmd.genreId }]];
    }
    case 'place': {
      if (!(cmd.dept in s.board)) throw new Error(`unknown dept ${cmd.dept}`);
      if (cmd.workerId && !s.roster.includes(cmd.workerId)) throw new Error(`not on roster ${cmd.workerId}`);
      if (cmd.workerId && s.benched.includes(cmd.workerId)) throw new Error(`benched ${cmd.workerId}`);
      const board: Board = { ...s.board };
      for (const d of Object.keys(board) as Dept[]) if (cmd.workerId && board[d] === cmd.workerId) board[d] = null; // one slot per worker
      board[cmd.dept] = cmd.workerId;
      return [{ ...s, board }, [{ type: 'placed', dept: cmd.dept, workerId: cmd.workerId }]];
    }
    case 'hire': {
      if (!s.draft?.includes(cmd.workerId)) throw new Error(`not offered ${cmd.workerId}`);
      if (s.roster.length >= content.economy.rosterMax) throw new Error('roster full');
      return [
        { ...s, roster: [...s.roster, cmd.workerId], burnout: { ...s.burnout, [cmd.workerId]: 0 }, draft: null },
        [{ type: 'hired', workerId: cmd.workerId }],
      ];
    }
    case 'skipDraft':
      return [{ ...s, draft: null }, []];
    case 'fire': {
      if (!s.roster.includes(cmd.workerId)) throw new Error(`not on roster ${cmd.workerId}`);
      if (s.roster.length <= 1) throw new Error('cannot fire the last worker');
      const severance = Math.round(salaryOf(cmd.workerId, content) * content.economy.severanceWeeks);
      const board: Board = Object.fromEntries(Object.entries(s.board).map(([d, w]) => [d, w === cmd.workerId ? null : w]));
      const burnout = { ...s.burnout };
      delete burnout[cmd.workerId];
      return [{
        ...s, board, burnout, cash: s.cash - severance,
        roster: s.roster.filter((id) => id !== cmd.workerId),
        benched: s.benched.filter((id) => id !== cmd.workerId),
        ledger: { ...s.ledger, severance: s.ledger.severance + severance },
      }, [{ type: 'fired', workerId: cmd.workerId, severance }]];
    }
    case 'endPhase': {
      if (!s.project) throw new Error('no project');
      const phase = content.phases[s.project.phase];
      const totals = phaseTotals(s, content)!;
      const [afterBurnout, project, burnEvents] = burnoutPhase(s, {
        ...s.project,
        phase: s.project.phase + 1,
        quality: s.project.quality + totals.quality,
        hype: s.project.hype + totals.hype,
        bugs: s.project.bugs + totals.bugs,
        contributions: [...s.project.contributions, ...totals.contributions],
      }, phase.weeks, content);
      const [ticked, tickEvents] = tick({ ...afterBurnout, project }, phase.weeks, content);
      let next = ticked;
      const events: SimEvent[] = [
        { type: 'phaseEnded', phaseId: phase.id, weeks: phase.weeks, payroll: next.projectCost - s.projectCost, totals },
        ...burnEvents, ...tickEvents,
      ];
      if (!next.dead && !next.won && project.phase >= content.phases.length) {
        const release: Release = { genreId: project.genreId, week: next.week, ...reviewOf(project, content), cost: next.projectCost, revenue: 0 };
        next = {
          ...next, project: null, benched: [], releases: [...next.releases, release],
          sales: [...next.sales, { release: next.releases.length, next: launchSales(release, next.trendId, content) }],
        };
        events.push({ type: 'released', release });
        let draftEvents: SimEvent[];
        [next, draftEvents] = offerDraft(next, content);
        events.push(...draftEvents);
      }
      return [next, events];
    }
  }
}

/** Mid-run save: the seed and the command log. Loading replays it, so a save is bit-for-bit the run. */
export interface Save { version: 1; seed: number; commands: Command[] }

export function replay(save: Save, content: ContentPack): RunState {
  return save.commands.reduce<RunState>((s, cmd) => apply(s, cmd, content)[0], newRun(save.seed, content));
}

export interface Cause { label: string; amount: number }
export interface PostMortem { causes: Cause[]; best: Release | null; cashHistory: number[] }

/** Top 3 drains on cash: running costs next to flops (development cost minus revenue). */
export function postMortem(s: RunState, content: ContentPack): PostMortem {
  const genre = (id: string) => content.genres.find((g) => g.id === id)!.name;
  const causes: Cause[] = [
    { label: 'Salaries', amount: s.ledger.salary },
    { label: 'Rent', amount: s.ledger.rent },
    { label: 'Severance', amount: s.ledger.severance },
    ...s.releases.map((r, i) => ({ label: `Flop: ${genre(r.genreId)} #${i + 1} (review ${r.review})`, amount: r.cost - r.revenue })),
  ].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 3);
  const best = s.releases.reduce<Release | null>((a, r) => (!a || r.review > a.review || (r.review === a.review && r.revenue > a.revenue) ? r : a), null);
  return { causes, best, cashHistory: s.cashHistory };
}
