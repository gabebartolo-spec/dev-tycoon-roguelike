import prand from 'pure-rand';
import type { ContentPack, Dept, EventEffect } from '../data/schemas';
import {
  bossOf, eraOf, generateMarket, lastWeek, platformMul, quarterOf, rivalById, rivalsReleasing, targetFor, thresholdFor,
  type Market,
} from './market';
import { defaultOptions, runContent, type RunOptions } from './meta';
import { mergeContributions, resolve, type Board, type Contribution, type Totals } from './resolver';

export interface Project {
  genreId: string;
  topicId: string;
  phase: number; // index into content.phases
  quality: number;
  hype: number;
  bugs: number;
  contributions: Contribution[];
  usedAi?: boolean; // an AI card worked a phase: the shipped game leaves tech debt
  solo?: boolean;   // every phase so far was worked only by solo cards: the shipped game gets the Long Tail
  reskin?: boolean; // Shovelware: a reskin of the last game (skipped Prototype; impulse floor, saturation, lost share)
  bundled?: boolean; // a Bundle Ready card worked a phase: sells more, fades faster
}

export interface ReviewLine { source: string; impact: number } // impact on the 1-10 review score

export interface Release {
  genreId: string;
  topicId: string;
  week: number;
  review: number;
  expectation: number; // the bar it was judged against
  quality: number;
  hype: number;
  bugs: number;
  best: ReviewLine[];
  worst: ReviewLine[];
  cost: number;    // salaries + rent paid while it was in development
  revenue: number; // sales so far
}

/** A released game still selling; `next` is next week's revenue, which decays every week. */
export interface Sale { release: number; next: number; decay?: number } // decay: own weekly factor (Long Tail)

export interface Pitch { genreId: string; topicId: string }

export interface Showdown { era: number; rivalId: string; target: number; yours: number | null; won: boolean }

export type LedgerTag = 'salary' | 'rent' | 'severance' | 'sales' | 'events';

export interface RunState {
  seed: number;
  options: RunOptions; // meta choices fixed at run start (studio, Crunch Level, unlocks owned)
  rngStep: number; // seeded draws taken so far; draw n has its own stream, so state stays plain JSON
  week: number;
  cash: number;
  roster: string[];
  board: Board;
  market: Market;
  trendId: string;
  demand: Record<string, number>; // this Quarter's genre demand after rivals and events
  share: number;                  // market share multiplier on all sales (capped)
  flipShare?: number;             // Shovelware lost share: x on all sales, cut by low-review reskins, back to 1 by a good game
  expectation: number;            // the review bar; rises after each hit
  rivalGenres: Record<string, string>; // genre each rival is chasing now (copies your hits)
  pitch: Pitch[];
  event: string | null;           // event id waiting for a choice
  carry: { hype: number; bugs: number; debt?: number }; // event effects (and AI tech debt) waiting for the next project
  project: Project | null;
  projectCost: number;
  releases: Release[];
  sales: Sale[];
  showdowns: Showdown[];
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
  | { type: 'startProject'; genreId: string; topicId: string; reskin?: boolean } // reskin: any topic, last game's genre
  | { type: 'place'; dept: Dept; workerId: string | null }
  | { type: 'endPhase' }
  | { type: 'hire'; workerId: string }
  | { type: 'skipDraft' }
  | { type: 'fire'; workerId: string }
  | { type: 'chooseEvent'; choice: number };

export type SimEvent =
  | { type: 'projectStarted'; genreId: string; topicId: string }
  | { type: 'placed'; dept: Dept; workerId: string | null }
  | { type: 'phaseEnded'; phaseId: string; weeks: number; payroll: number; totals: Totals }
  | { type: 'released'; release: Release; hit: boolean }
  | { type: 'breakthrough'; workerId: string; quality: number }
  | { type: 'breakdown'; workerId: string; bugs: number }
  | { type: 'payrollDay'; week: number; cash: number; threshold: number; strike: boolean; strikes: number }
  | { type: 'showdown'; showdown: Showdown }
  | { type: 'quarterStarted'; quarter: number; rivalReleases: { rivalId: string; genreId: string }[] }
  | { type: 'eventDrawn'; eventId: string }
  | { type: 'eventChosen'; eventId: string; choice: number }
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const isAi = (id: string, content: ContentPack) => !!content.workers.find((w) => w.id === id)?.tags.includes(content.ai.tag);
export const isSolo = (id: string, content: ContentPack) => !!content.workers.find((w) => w.id === id)?.tags.includes(content.solo.tag);

/** Wearing every hat: a solo card on several desks adds weeksPerHat to the phase for each desk past the first. */
export function hatWeeks(board: Board, content: ContentPack): number {
  const desks = new Map<string, number>();
  for (const id of Object.values(board)) if (id) desks.set(id, (desks.get(id) ?? 0) + 1);
  return Math.max(0, ...[...desks.values()].map((n) => n - 1)) * content.solo.weeksPerHat;
}

/** Weeks the current phase takes with this board (base weeks plus hats). */
export const phaseWeeks = (s: RunState, content: ContentPack) =>
  s.project ? content.phases[s.project.phase].weeks + hatWeeks(s.board, content) : 0;

/**
 * New Model Drops: from Era 2 on, every AI card has +statPerEra on its best stat and +salaryPerEra salary per Era.
 * Pure; returns the pack untouched in Era 1 or when no AI card exists. Apply once to the run's pack, never twice.
 */
export function withModels(content: ContentPack, week: number): ContentPack {
  const A = content.ai;
  const era = Math.min(content.calendar.eras - 1, eraOf(quarterOf(week, content), content));
  if (era <= 0 || (A.statPerEra === 0 && A.salaryPerEra === 0) || !content.workers.some((w) => w.tags.includes(A.tag))) return content;
  return {
    ...content,
    workers: content.workers.map((w) => {
      if (!w.tags.includes(A.tag)) return w;
      const best = (['code', 'design', 'art', 'audio'] as const).reduce((a, k) => (w.stats[k] > w.stats[a] ? k : a), 'code' as const);
      return { ...w, salary: w.salary + A.salaryPerEra * era, stats: { ...w.stats, [best]: w.stats[best] + A.statPerEra * era } };
    }),
  };
}

const hasTag = (id: string, tag: string, content: ContentPack) => !!content.workers.find((w) => w.id === id)?.tags.includes(tag);
export const isAsset = (id: string, content: ContentPack) => hasTag(id, content.shovelware.assetTag, content);
const isBundler = (id: string, content: ContentPack) => !!content.workers.find((w) => w.id === id)?.traits.includes(content.shovelware.bundleTrait);

/** Shovelware: can the next project be a reskin of the last release (same genre, a different topic)? */
export function canReskin(s: RunState, topicId: string, content: ContentPack): boolean {
  const last = s.releases[s.releases.length - 1];
  return content.shovelware.reskin && !!last && last.topicId !== topicId && content.topics.some((t) => t.id === topicId);
}

const salaryOf = (id: string, content: ContentPack) => content.workers.find((w) => w.id === id)!.salary;
const payrollOf = (s: RunState, content: ContentPack) => {
  const c = withModels(content, s.week);
  return s.roster.reduce((sum, id) => sum + salaryOf(id, c), 0);
};
/** Rent this week: none while the roster is no bigger than rentFreeUpTo (working from the bedroom). */
export const rentOf = (s: RunState, content: ContentPack) => (s.roster.length <= content.economy.rentFreeUpTo ? 0 : content.economy.rentPerWeek);
export const weeklyCosts = (s: RunState, content: ContentPack) => payrollOf(s, content) + rentOf(s, content);

/** Weeks the current cash lasts at current costs, counting sales already earning. Infinity if it never runs out. */
export function runway(s: RunState, content: ContentPack): number {
  let cash = s.cash;
  let sales = s.sales.map((x) => x.next);
  const cost = weeklyCosts(s, content);
  for (let w = 0; w < 520; w++) {
    cash += sales.reduce((a, b) => a + b, 0) - cost;
    if (cash < 0) return w;
    sales = sales.map((x, i) => x * (s.sales[i]?.decay ?? content.sales.decay)).filter((x) => x >= content.sales.minWeekly);
  }
  return Infinity;
}

function drawPitch(s0: RunState, content: ContentPack): RunState {
  let s = s0;
  const pitch: Pitch[] = [];
  for (let i = 0; i < content.market.pitchOptions; i++) {
    let g: number, t: number;
    [g, s] = drawInt(s, content.genres.length - 1);
    [t, s] = drawInt(s, content.topics.length - 1);
    pitch.push({ genreId: content.genres[g].id, topicId: content.topics[t].id });
  }
  return { ...s, pitch };
}

/** Start Quarter q: its trend and demand, scheduled rival releases steal demand, maybe draw an event. */
function startQuarter(s0: RunState, q: number, content: ContentPack): [RunState, SimEvent[]] {
  const qm = s0.market.quarters[q];
  const demand = { ...qm.demand };
  const rivalReleases = rivalsReleasing(s0.market, q, content).map((rivalId) => ({ rivalId, genreId: s0.rivalGenres[rivalId] }));
  for (const r of rivalReleases) demand[r.genreId] = demand[r.genreId] * (1 - content.market.rivalSteal);
  let s: RunState = { ...s0, trendId: qm.trendId, demand };
  const events: SimEvent[] = [{ type: 'quarterStarted', quarter: q, rivalReleases }];
  const [roll, s1] = drawInt(s, 9999);
  s = s1;
  if (roll < content.market.eventChance * 10000) {
    let i: number;
    [i, s] = drawInt(s, content.events.length - 1);
    s = { ...s, event: content.events[i].id };
    events.push({ type: 'eventDrawn', eventId: content.events[i].id });
  }
  return [s, events];
}

/** `content` must already be the run's pack (runContent); `options` is recorded for the save and reputation. */
export function newRun(seed: number, content: ContentPack, options: RunOptions = defaultOptions(content)): RunState {
  let rng = prand.xoroshiro128plus(seed);
  const draw = (max: number) => { const [v, next] = prand.uniformIntDistribution(0, max, rng); rng = next; return v; };
  const fixed = content.startWorkers.filter((id) => content.workers.some((w) => w.id === id)).slice(0, content.rosterSize);
  const pool = content.workers.map((w) => w.id).filter((id) => !fixed.includes(id));
  const roster: string[] = [...fixed];
  while (roster.length < content.rosterSize) roster.push(pool.splice(draw(pool.length - 1), 1)[0]);
  const board: Board = Object.fromEntries(content.departments.map((d) => [d, null]));
  const market = generateMarket(seed, content);
  const s: RunState = {
    seed, options, rngStep: 0, week: 1, cash: content.startingCash, roster, board, market,
    trendId: market.quarters[0].trendId, demand: { ...market.quarters[0].demand }, share: 1,
    expectation: content.review.expectation,
    rivalGenres: Object.fromEntries(market.rivals.map((id) => [id, rivalById(id, content).genre])),
    pitch: [], event: null, carry: { hype: 0, bugs: 0 },
    project: null, projectCost: 0, releases: [], sales: [], showdowns: [],
    ledger: { salary: 0, rent: 0, severance: 0, sales: 0, events: 0 }, cashHistory: [content.startingCash],
    strikes: 0, burnout: Object.fromEntries(roster.map((id) => [id, 0])), benched: [], draft: null, dead: false, won: false,
  };
  return drawPitch(s, content); // Quarter 1 has no rival releases or event: the first Quarter is a calm start
}

/** Review score of a release under a rival's twist (or plain, without one). */
export function twistedReview(r: Pick<Release, 'quality' | 'hype' | 'bugs' | 'expectation'>, content: ContentPack, rivalId?: string): number {
  const t = rivalId ? rivalById(rivalId, content).twist : { qualityMul: 1, bugPenaltyMul: 1, hypeToReview: 0 };
  const { bugPenalty, min, max } = content.review;
  const raw = (10 * r.quality * t.qualityMul) / r.expectation - r.bugs * bugPenalty * t.bugPenaltyMul + r.hype * t.hypeToReview;
  return Math.round(clamp(raw, min, max) * 10) / 10;
}

/** End of Era: your best release this Era (scored with the rival's twist) must beat the rival's target (D-4). */
function showdown(s0: RunState, era: number, content: ContentPack): [RunState, SimEvent[]] {
  const M = content.market;
  const wpe = content.calendar.weeksPerQuarter * content.calendar.quartersPerEra;
  const from = 1 + era * wpe;
  const rivalId = bossOf(s0.market, era);
  const target = targetFor(rivalById(rivalId, content), era);
  const scores = s0.releases.filter((r) => r.week > from && r.week <= from + wpe).map((r) => twistedReview(r, content, rivalId));
  // A game finished in the Era's last week ships this week: it counts before the release is booked.
  const p = s0.project;
  if (p && p.phase >= content.phases.length) scores.push(twistedReview({ ...p, expectation: s0.expectation }, content, rivalId));
  const yours = scores.length ? Math.max(...scores) : null;
  const won = yours !== null && yours > target;
  const result: Showdown = { era, rivalId, target, yours, won };
  let s: RunState = {
    ...s0, showdowns: [...s0.showdowns, result],
    share: clamp(s0.share * (won ? M.shareWin : M.shareLose), M.shareMin, M.shareMax),
    strikes: won ? s0.strikes : s0.strikes + 1,
  };
  const events: SimEvent[] = [{ type: 'showdown', showdown: result }];
  if (s.strikes >= content.economy.debtStrikes) {
    s = { ...s, dead: true };
    events.push({ type: 'bankrupt', week: s.week });
  }
  return [s, events];
}

/** Advance `weeks` weeks: costs and sales weekly; at each Quarter end Payroll Day, Era end showdown, then the next Quarter. */
function tick(s0: RunState, weeks: number, content: ContentPack): [RunState, SimEvent[]] {
  const { economy, sales: S, calendar: C } = content;
  let s = s0;
  const events: SimEvent[] = [];
  for (let i = 0; i < weeks && !s.dead && !s.won; i++) {
    const salary = payrollOf(s, content);
    const rent = rentOf(s, content);
    const releases = s.releases.map((r) => ({ ...r }));
    let income = 0;
    for (const sale of s.sales) {
      const amount = Math.round(sale.next);
      income += amount;
      releases[sale.release].revenue += amount;
    }
    const sales = s.sales.map((x) => ({ ...x, next: x.next * (x.decay ?? S.decay) })).filter((x) => x.next >= S.minWeekly);
    const cash = s.cash - salary - rent + income;
    s = {
      ...s, week: s.week + 1, cash, releases, sales,
      projectCost: s.project ? s.projectCost + salary + rent : s.projectCost,
      ledger: { ...s.ledger, salary: s.ledger.salary + salary, rent: s.ledger.rent + rent, sales: s.ledger.sales + income },
      cashHistory: [...s.cashHistory, cash],
    };
    if ((s.week - 1) % C.weeksPerQuarter !== 0) continue;
    // Payroll Day: the Quarter that just ended must close at or above its threshold (D-2).
    const ended = quarterOf(s.week, content) - 1;
    const threshold = thresholdFor(ended, content);
    const strike = s.cash < threshold;
    if (strike) s = { ...s, strikes: s.strikes + 1 };
    events.push({ type: 'payrollDay', week: s.week, cash: s.cash, threshold, strike, strikes: s.strikes });
    if (s.strikes >= economy.debtStrikes) {
      s = { ...s, dead: true };
      events.push({ type: 'bankrupt', week: s.week });
      break;
    }
    if ((ended + 1) % C.quartersPerEra === 0) {
      let ev: SimEvent[];
      [s, ev] = showdown(s, eraOf(ended, content), content);
      events.push(...ev);
      if (s.dead) break;
    }
    if (s.week >= lastWeek(content)) {
      s = { ...s, won: true };
      events.push({ type: 'won', week: s.week });
      break;
    }
    let ev: SimEvent[];
    [s, ev] = startQuarter(s, ended + 1, content);
    events.push(...ev);
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

/** Demand multiplier a pitch would launch into right now: genre demand x topic fit x platform x trend x share. */
export function demandFor(s: RunState, p: Pitch, content: ContentPack): number {
  const topic = content.topics.find((t) => t.id === p.topicId)!;
  const trend = content.trends.find((t) => t.id === s.trendId)!;
  return (s.demand[p.genreId] ?? 1) * (topic.fit[p.genreId] ?? 1) * (trend.demand[p.genreId] ?? 1)
    * platformMul(s.market, quarterOf(s.week, content), content) * s.share * (s.flipShare ?? 1);
}

/** First-week revenue of a release: hype x review x demand. */
export function launchSales(r: Pick<Release, 'hype' | 'review'>, demand: number, content: ContentPack): number {
  const S = content.sales;
  return S.basePerWeek * (1 + Math.max(0, r.hype) / S.hypeScale) * (r.review / 10) ** S.reviewExp * demand;
}

/** Totals the current board would produce if the phase ended now. */
export function phaseTotals(s: RunState, content: ContentPack): Totals | null {
  if (!s.project) return null;
  return resolve(s.board, { content: withModels(content, s.week), genreId: s.project.genreId, phaseId: content.phases[s.project.phase].id, trendId: s.trendId });
}

/** Pure preview: apply a command to a copy and diff this phase's totals. */
export function preview(s: RunState, cmd: Command, content: ContentPack): { quality: number; hype: number; bugs: number } | null {
  const before = phaseTotals(s, content);
  const [next] = apply(s, cmd, content);
  const after = phaseTotals(next, content);
  if (!before || !after) return null;
  return { quality: after.quality - before.quality, hype: after.hype - before.hype, bugs: after.bugs - before.bugs };
}

export function reviewOf(p: Project, expectation: number, content: ContentPack): Pick<Release, 'review' | 'quality' | 'hype' | 'bugs' | 'best' | 'worst' | 'expectation'> {
  const { bugPenalty } = content.review;
  const review = twistedReview({ quality: p.quality, hype: p.hype, bugs: p.bugs, expectation }, content);
  const lines: ReviewLine[] = mergeContributions(p.contributions)
    .filter((c) => c.metric !== 'hype')
    .map((c) => ({ source: c.source, impact: c.metric === 'quality' ? (10 * c.delta) / expectation : -c.delta * bugPenalty }));
  const sorted = [...lines].sort((a, b) => b.impact - a.impact);
  return {
    review, expectation, quality: p.quality, hype: p.hype, bugs: p.bugs,
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
    if (isAi(id, content) || isAsset(id, content)) { burnout[id] = 0; continue; } // AI cards and asset packs never burn out
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

function applyEffect(s: RunState, f: EventEffect, source: string, content: ContentPack): RunState {
  const M = content.market;
  switch (f.kind) {
    case 'cash': return { ...s, cash: s.cash + f.value, ledger: { ...s.ledger, events: s.ledger.events + f.value } };
    case 'burnoutAll': return { ...s, burnout: Object.fromEntries(Object.entries(s.burnout).map(([id, b]) => [id, Math.max(0, b + f.value)])) };
    case 'expectation': return { ...s, expectation: clamp(s.expectation + f.value, content.review.expectation / 2, M.expectationMax) };
    case 'share': return { ...s, share: clamp(s.share * f.value, M.shareMin, M.shareMax) };
    case 'demand': return {
      ...s, demand: Object.fromEntries(Object.entries(s.demand).map(([g, d]) => [g, !f.genre || f.genre === g ? d * f.value : d])),
    };
    case 'bundle': { // sell the back catalogue: cash now for a share of what every selling game would still earn
      const releases = s.releases.map((r) => ({ ...r }));
      let total = 0;
      for (const x of s.sales) {
        let left = 0;
        for (let w = x.next; w >= content.sales.minWeekly; w *= x.decay ?? content.sales.decay) left += w;
        const amount = Math.round(left * f.value);
        releases[x.release].revenue += amount;
        total += amount;
      }
      return { ...s, releases, sales: [], cash: s.cash + total, ledger: { ...s.ledger, sales: s.ledger.sales + total } };
    }
    case 'hype':
    case 'bugs': {
      if (!s.project) return { ...s, carry: { ...s.carry, [f.kind]: s.carry[f.kind] + f.value } };
      const metric = f.kind;
      return { ...s, project: { ...s.project, [metric]: s.project[metric] + f.value, contributions: [...s.project.contributions, { source, metric, delta: f.value }] } };
    }
  }
}

/** Pure reducer: never mutates `s`; returns the next state plus events for the UI and 3D view. */
export function apply(s: RunState, cmd: Command, content: ContentPack): [RunState, SimEvent[]] {
  if (s.dead || s.won) return [s, []];
  if (s.event && cmd.type !== 'chooseEvent') throw new Error('resolve the event first');
  switch (cmd.type) {
    case 'chooseEvent': {
      const def = content.events.find((e) => e.id === s.event);
      if (!def) throw new Error('no event');
      const choice = def.choices[cmd.choice];
      if (!choice) throw new Error(`bad choice ${cmd.choice}`);
      const next = choice.effects.reduce<RunState>((acc, f) => applyEffect(acc, f, `Event: ${def.title}`, content), { ...s, event: null });
      return [next, [{ type: 'eventChosen', eventId: def.id, choice: cmd.choice }]];
    }
    case 'startProject': {
      if (s.project) throw new Error('project already running');
      if (cmd.reskin) {
        if (!canReskin(s, cmd.topicId, content)) throw new Error(`cannot reskin as ${cmd.topicId}`);
        if (cmd.genreId !== s.releases[s.releases.length - 1].genreId) throw new Error('a reskin keeps the last game\'s genre');
      } else if (!s.pitch.some((p) => p.genreId === cmd.genreId && p.topicId === cmd.topicId)) throw new Error(`not pitched ${cmd.genreId}/${cmd.topicId}`);
      const contributions: Contribution[] = [];
      if (s.carry.hype) contributions.push({ source: 'Events', metric: 'hype', delta: s.carry.hype });
      if (s.carry.bugs) contributions.push({ source: 'Events', metric: 'bugs', delta: s.carry.bugs });
      const debt = s.carry.debt ?? 0;
      if (debt) contributions.push({ source: 'Tech debt', metric: 'bugs', delta: debt });
      const project: Project = {
        genreId: cmd.genreId, topicId: cmd.topicId, phase: cmd.reskin ? 1 : 0, quality: 0, hype: s.carry.hype, bugs: s.carry.bugs + debt, contributions,
        ...(cmd.reskin ? { reskin: true } : {}),
      };
      return [{ ...s, project, projectCost: 0, draft: null, carry: { hype: 0, bugs: 0 } }, [{ type: 'projectStarted', genreId: cmd.genreId, topicId: cmd.topicId }]];
    }
    case 'place': {
      if (!(cmd.dept in s.board)) throw new Error(`unknown dept ${cmd.dept}`);
      if (cmd.workerId && !s.roster.includes(cmd.workerId)) throw new Error(`not on roster ${cmd.workerId}`);
      if (cmd.workerId && s.benched.includes(cmd.workerId)) throw new Error(`benched ${cmd.workerId}`);
      const board: Board = { ...s.board };
      // One desk per worker, except solo cards, which can wear several hats (see hatWeeks).
      if (cmd.workerId && !isSolo(cmd.workerId, content)) for (const d of Object.keys(board) as Dept[]) if (board[d] === cmd.workerId) board[d] = null;
      board[cmd.dept] = cmd.workerId;
      return [{ ...s, board }, [{ type: 'placed', dept: cmd.dept, workerId: cmd.workerId }]];
    }
    case 'hire': {
      if (!s.draft?.includes(cmd.workerId)) throw new Error(`not offered ${cmd.workerId}`);
      if (s.roster.length >= content.economy.rosterMax) throw new Error('roster full');
      const price = content.workers.find((w) => w.id === cmd.workerId)!.price; // asset packs: paid once, no salary
      return [
        {
          ...s, roster: [...s.roster, cmd.workerId], burnout: { ...s.burnout, [cmd.workerId]: 0 }, draft: null,
          ...(price ? { cash: s.cash - price, ledger: { ...s.ledger, salary: s.ledger.salary + price } } : {}),
        },
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
      const weeks = phaseWeeks(s, content);
      const placed = Object.values(s.board).filter(Boolean) as string[];
      const totals = phaseTotals(s, content)!;
      const [afterBurnout, built, burnEvents] = burnoutPhase(s, {
        ...s.project,
        phase: s.project.phase + 1,
        quality: s.project.quality + totals.quality,
        hype: s.project.hype + totals.hype,
        bugs: s.project.bugs + totals.bugs,
        contributions: [...s.project.contributions, ...totals.contributions],
        usedAi: s.project.usedAi || placed.some((id) => isAi(id, content)),
        solo: (s.project.solo ?? true) && placed.every((id) => isSolo(id, content)), // an empty desk (a benched solo dev) keeps it
        ...(s.project.bundled || placed.some((id) => isBundler(id, content)) ? { bundled: true } : {}),
      }, weeks, content);
      const [ticked, tickEvents] = tick({ ...afterBurnout, project: built }, weeks, content);
      let next = ticked;
      const events: SimEvent[] = [
        { type: 'phaseEnded', phaseId: phase.id, weeks, payroll: next.projectCost - s.projectCost, totals },
        ...burnEvents, ...tickEvents,
      ];
      const project = next.project!; // events during the tick may have added hype/bugs
      if (!next.dead && !next.won && project.phase >= content.phases.length) {
        const M = content.market;
        const release: Release = {
          genreId: project.genreId, topicId: project.topicId, week: next.week,
          ...reviewOf(project, next.expectation, content), cost: next.projectCost, revenue: 0,
        };
        const hit = release.review >= M.hitReview;
        const demand = demandFor(next, project, content);
        const SW = content.shovelware;
        // Shovelware: a reskin sells as an impulse buy (review floor) and floods its genre; a good game wins share back.
        const sold = { hype: release.hype, review: project.reskin ? Math.max(release.review, SW.impulseFloor) : release.review };
        const launch = launchSales(sold, demand, content) * (project.bundled ? SW.bundleSales : 1);
        const decay = project.bundled ? SW.bundleDecay : project.solo ? content.solo.decay : undefined;
        const flipShare = project.reskin && release.review < SW.restoreReview ? Math.max(SW.shareMin, (next.flipShare ?? 1) * SW.shareLoss)
          : release.review >= SW.restoreReview && next.flipShare !== undefined ? 1 : next.flipShare;
        // Rivals react to a hit: the first rival chasing another genre switches to yours.
        const copycat = hit ? next.market.rivals.find((id) => next.rivalGenres[id] !== project.genreId) : undefined;
        // Tech debt: a game an AI card worked on hands part of its bugs to the next game.
        const debt = project.usedAi ? Math.round(project.bugs * content.ai.debt * 10) / 10 : 0;
        next = {
          ...next, project: null, benched: [], releases: [...next.releases, release],
          carry: debt ? { ...next.carry, debt: (next.carry.debt ?? 0) + debt } : next.carry,
          sales: [...next.sales, { release: next.releases.length, next: launch, ...(decay !== undefined ? { decay } : {}) }],
          ...(flipShare !== undefined ? { flipShare } : {}),
          demand: project.reskin ? { ...next.demand, [project.genreId]: next.demand[project.genreId] * (1 - SW.saturation) } : next.demand,
          expectation: hit ? Math.min(M.expectationMax, next.expectation + M.expectationRise) : next.expectation,
          rivalGenres: copycat ? { ...next.rivalGenres, [copycat]: project.genreId } : next.rivalGenres,
        };
        events.push({ type: 'released', release, hit });
        next = drawPitch(next, content);
        let draftEvents: SimEvent[];
        [next, draftEvents] = offerDraft(next, content);
        events.push(...draftEvents);
      }
      return [next, events];
    }
  }
}

/** Mid-run save: the seed and the command log. Loading replays it, so a save is bit-for-bit the run. */
export interface Save { version: 3; seed: number; options: RunOptions; commands: Command[] }

/** Rebuild a run from its save; `base` is the unmodified pack, the save's options rebuild the run's pack. */
export function replay(save: Save, base: ContentPack): RunState {
  const content = runContent(base, save.options);
  return save.commands.reduce<RunState>((s, cmd) => apply(s, cmd, content)[0], newRun(save.seed, content, save.options));
}

export interface Cause { label: string; amount: number }
export interface PostMortem { causes: Cause[]; best: Release | null; cashHistory: number[] }

/** Top 3 drains on cash: running costs, events, lost showdowns and flops (development cost minus revenue). */
export function postMortem(s: RunState, content: ContentPack): PostMortem {
  const name = (id: string) => content.genres.find((g) => g.id === id)!.name;
  const causes: Cause[] = [
    { label: 'Salaries', amount: s.ledger.salary },
    { label: 'Rent', amount: s.ledger.rent },
    { label: 'Severance', amount: s.ledger.severance },
    { label: 'Events', amount: -s.ledger.events },
    ...s.releases.map((r, i) => ({ label: `Flop: ${name(r.genreId)} #${i + 1} (review ${r.review})`, amount: r.cost - r.revenue })),
  ].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 3);
  for (const sd of s.showdowns.filter((x) => !x.won))
    causes.push({ label: `Lost to ${rivalById(sd.rivalId, content).name} (${sd.yours ?? 'no release'} vs ${sd.target}): a strike`, amount: 0 });
  const best = s.releases.reduce<Release | null>((a, r) => (!a || r.review > a.review || (r.review === a.review && r.revenue > a.revenue) ? r : a), null);
  return { causes, best, cashHistory: s.cashHistory };
}
