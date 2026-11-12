import { z } from 'zod';
import type { ContentPack, Mod } from '../data/schemas';
import type { RunState } from './run';

/**
 * Meta-progression (M4). Everything permanent reaches a run through RunOptions, and RunOptions only acts in
 * runContent() at run start: the run then plays on that fixed content pack, so buying an unlock mid-run changes
 * nothing until the next run, and empty options leave the pack exactly as a first-time player gets it.
 */
export interface RunOptions { studio: string; crunch: number; unlocks: string[] }

export const defaultOptions = (content: ContentPack): RunOptions => ({ studio: content.studios[0].id, crunch: 0, unlocks: [] });

export const META_VERSION = 1;
const MetaSchema = z.object({
  version: z.literal(META_VERSION),
  reputation: z.number().int().nonnegative(), // unspent
  earned: z.number().int().nonnegative(),     // lifetime
  unlocked: z.array(z.string()),
  crunchMax: z.number().int().nonnegative(),  // highest Crunch Level you may pick
  runs: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
});
export type Meta = z.infer<typeof MetaSchema>;

export const emptyMeta = (): Meta => ({ version: META_VERSION, reputation: 0, earned: 0, unlocked: [], crunchMax: 0, runs: 0, wins: 0 });

/** Step migrations: MIGRATIONS[n] turns a version-n object into version n+1. Version 0 = unversioned. */
const MIGRATIONS: Record<number, (m: Record<string, unknown>) => Record<string, unknown>> = {
  0: (m) => ({ ...emptyMeta(), ...m, version: 1 }),
};

/** Parse saved meta.json text. Missing, corrupt, or from a newer build: start empty and say so. */
export function parseMeta(text: string | null): { meta: Meta; recovered: boolean } {
  if (text === null) return { meta: emptyMeta(), recovered: false };
  try {
    let m = JSON.parse(text) as Record<string, unknown>;
    if (typeof m !== 'object' || m === null || Array.isArray(m)) throw new Error('not an object');
    let v = typeof m.version === 'number' ? m.version : 0;
    while (v < META_VERSION) {
      if (!MIGRATIONS[v]) throw new Error(`no migration from ${v}`);
      m = MIGRATIONS[v](m);
      v++;
    }
    return { meta: MetaSchema.parse(m), recovered: false };
  } catch {
    return { meta: emptyMeta(), recovered: true };
  }
}

export const studiosAvailable = (meta: Meta, content: ContentPack) =>
  content.studios.filter((s, i) => i === 0 || content.unlocks.some((u) => u.studio === s.id && meta.unlocked.includes(u.id)));

/**
 * Options for a run the player may actually start with this meta (throws otherwise). `leaveOut` drops owned unlocks
 * from this run (e.g. skip a department and its upkeep), so owning an unlock never forces its cost on you.
 */
export function optionsFor(meta: Meta, studio: string, crunch: number, content: ContentPack, leaveOut: string[] = []): RunOptions {
  if (!studiosAvailable(meta, content).some((s) => s.id === studio)) throw new Error(`studio locked: ${studio}`);
  if (crunch < 0 || crunch > meta.crunchMax) throw new Error(`crunch locked: ${crunch}`);
  const studioUnlock = content.unlocks.find((u) => u.studio === studio);
  if (studioUnlock && leaveOut.includes(studioUnlock.id)) throw new Error('cannot leave out the chosen studio');
  return { studio, crunch, unlocks: meta.unlocked.filter((id) => !leaveOut.includes(id)) };
}

export function buy(meta: Meta, unlockId: string, content: ContentPack): Meta {
  const u = content.unlocks.find((x) => x.id === unlockId);
  if (!u) throw new Error(`unknown unlock ${unlockId}`);
  if (meta.unlocked.includes(u.id)) throw new Error('already unlocked');
  if (meta.reputation < u.cost) throw new Error('not enough reputation');
  return { ...meta, reputation: meta.reputation - u.cost, unlocked: [...meta.unlocked, u.id] };
}

/** Studio valuation at the end of a run: cash plus a few weeks of current sales income. */
export const valuation = (s: RunState, content: ContentPack) =>
  Math.max(0, Math.round(s.cash + content.meta.salesWeeksValued * s.sales.reduce((a, x) => a + x.next, 0)));

export interface RepLine { label: string; rep: number }

/** Reputation a finished run earns, line by line: valuation, hits, showdowns won, Quarters survived, the win. */
export function reputationFor(s: RunState, content: ContentPack): { total: number; lines: RepLine[] } {
  const M = content.meta;
  const quarters = Math.floor((s.week - 1) / content.calendar.weeksPerQuarter);
  const lines: RepLine[] = [
    { label: 'Valuation', rep: Math.floor(valuation(s, content) / M.valuationPerRep) },
    { label: 'Hits', rep: s.releases.filter((r) => r.review >= content.market.hitReview).length * M.repPerHit },
    { label: 'Showdowns won', rep: s.showdowns.filter((x) => x.won).length * M.repPerShowdown },
    { label: 'Quarters survived', rep: quarters * M.repPerQuarter },
    { label: 'Won the run', rep: s.won ? M.repForWin : 0 },
  ];
  const base = lines.reduce((a, l) => a + l.rep, 0);
  const total = Math.floor(base * (1 + s.options.crunch * M.crunchRepBonus));
  if (total > base) lines.push({ label: `Crunch ${s.options.crunch} bonus`, rep: total - base });
  return { total, lines };
}

/** Bank a finished run: reputation, run counts, and the next Crunch Level after a win at your highest. */
export function recordRun(meta: Meta, s: RunState, content: ContentPack): Meta {
  if (!s.dead && !s.won) throw new Error('run not over');
  const rep = reputationFor(s, content).total;
  const nextCrunch = s.won && s.options.crunch === meta.crunchMax && meta.crunchMax < content.crunch.length ? meta.crunchMax + 1 : meta.crunchMax;
  return { ...meta, reputation: meta.reputation + rep, earned: meta.earned + rep, runs: meta.runs + 1, wins: meta.wins + (s.won ? 1 : 0), crunchMax: nextCrunch };
}

function applyMod(c: ContentPack, m: Mod): ContentPack {
  switch (m.kind) {
    case 'cash': return { ...c, startingCash: c.startingCash + m.add };
    case 'rent': return { ...c, economy: { ...c.economy, rentPerWeek: Math.max(0, c.economy.rentPerWeek + m.add) } };
    case 'salary': return { ...c, workers: c.workers.map((w) => ({ ...w, salary: Math.round(w.salary * m.mul) })) };
    case 'deptWeight': return { ...c, genres: c.genres.map((g) => ({ ...g, weights: { ...g.weights, [m.dept]: (g.weights[m.dept] ?? 1) * m.mul } })) };
    case 'phaseWeeks': return { ...c, phases: c.phases.map((p) => (p.id === m.phase ? { ...p, weeks: Math.max(1, p.weeks + m.add) } : p)) };
    case 'threshold': return { ...c, calendar: { ...c.calendar, payrollThresholds: c.calendar.payrollThresholds.map((v) => Math.round(v * m.mul + m.add)) } };
    case 'expectation': return { ...c, review: { ...c.review, expectation: c.review.expectation + m.add } };
    case 'rivalTarget': return { ...c, rivals: c.rivals.map((r) => ({ ...r, targets: r.targets.map((t) => t + m.add) })) };
    case 'eventChance': return { ...c, market: { ...c.market, eventChance: Math.min(1, Math.max(0, c.market.eventChance + m.add)) } };
    case 'reskin': return { ...c, shovelware: { ...c.shovelware, reskin: true } };
    case 'rentFreeUpTo': return { ...c, economy: { ...c.economy, rentFreeUpTo: m.value } };
    case 'rosterSize': return { ...c, rosterSize: Math.max(1, c.rosterSize + m.add) };
    case 'burnout': return { ...c, burnout: { ...c.burnout, perWeekPlaced: c.burnout.perWeekPlaced * m.mul } };
    case 'sales': return { ...c, sales: { ...c.sales, basePerWeek: c.sales.basePerWeek * m.mul } };
    case 'decay': return { ...c, sales: { ...c.sales, decay: c.sales.decay * m.mul } };
    case 'pitchOptions': return { ...c, market: { ...c.market, pitchOptions: Math.max(1, c.market.pitchOptions + m.add) } };
    case 'rivalSteal': return { ...c, market: { ...c.market, rivalSteal: Math.min(1, Math.max(0, c.market.rivalSteal + m.add)) } };
    case 'shareMax': return { ...c, market: { ...c.market, shareMax: Math.max(c.market.shareMin, c.market.shareMax * m.mul) } };
    case 'strikes': return { ...c, economy: { ...c.economy, debtStrikes: Math.max(1, c.economy.debtStrikes + m.add) } };
    case 'startWorker': return c.startWorkers.includes(m.id) ? c : { ...c, startWorkers: [...c.startWorkers, m.id] };
  }
}

/** The run's pack: locked workers, genres and departments removed, then studio, owned-unlock and Crunch Level mods. */
export function runContent(base: ContentPack, o: RunOptions): ContentPack {
  const studio = base.studios.find((s) => s.id === o.studio);
  if (!studio) throw new Error(`unknown studio ${o.studio}`);
  const owned = base.unlocks.filter((u) => o.unlocks.includes(u.id));
  const lockedWorkers = new Set(base.unlocks.flatMap((u) => u.workers).filter((w) => !owned.some((u) => u.workers.includes(w))));
  const lockedDepts = new Set(base.unlocks.flatMap((u) => u.departments).filter((d) => !owned.some((u) => u.departments.includes(d))));
  const lockedGenres = new Set(base.unlocks.flatMap((u) => u.genres).filter((g) => !owned.some((u) => u.genres.includes(g))));
  const lockedEvents = new Set(base.unlocks.flatMap((u) => u.events).filter((e) => !owned.some((u) => u.events.includes(e))));
  let c: ContentPack = {
    ...base,
    workers: base.workers.filter((w) => !lockedWorkers.has(w.id)),
    genres: base.genres.filter((g) => !lockedGenres.has(g.id)),
    events: base.events.filter((e) => !lockedEvents.has(e.id)),
    departments: base.departments.filter((d) => !lockedDepts.has(d)),
  };
  const mods = [...studio.mods, ...owned.flatMap((u) => u.mods), ...base.crunch.slice(0, o.crunch).flatMap((l) => l.mods)];
  c = mods.reduce(applyMod, c);
  return c;
}
