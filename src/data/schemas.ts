import { z } from 'zod';

export const Dept = z.enum(['code', 'design', 'art', 'audio']);
export type Dept = z.infer<typeof Dept>;

/** What an effect changes: the holder's own slot output (before genre weight), or the project's hype / bugs. */
export const Target = z.enum(['output', 'hype', 'bugs']);
export type Target = z.infer<typeof Target>;

export const EffectDef = z.object({
  // always | slot:<dept> | adjacent:<tag> (a neighbouring slot holds a worker with that tag) | phase:<phase id>
  trigger: z.string().regex(/^(always|slot:[a-z]+|adjacent:[a-z_]+|phase:[a-z]+)$/),
  target: Target,
  op: z.enum(['add', 'mul']),
  value: z.number(),
});
export type EffectDef = z.infer<typeof EffectDef>;

export const TraitDef = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  effects: z.array(EffectDef).min(1),
});
export type TraitDef = z.infer<typeof TraitDef>;

export const WorkerDef = z.object({
  id: z.string(),
  name: z.string(),
  salary: z.number().int().positive(), // per week
  tags: z.array(z.string()),
  stats: z.object({
    code: z.number(), design: z.number(), art: z.number(), audio: z.number(),
    hype: z.number(), bugs: z.number(),
  }),
  traits: z.array(z.string()).min(1).max(3),
});
export type WorkerDef = z.infer<typeof WorkerDef>;

export const GenreDef = z.object({
  id: z.string(),
  name: z.string(),
  weights: z.record(Dept, z.number().positive()),
});
export type GenreDef = z.infer<typeof GenreDef>;

export const TrendDef = z.object({
  id: z.string(),
  name: z.string(),
  effects: z.array(EffectDef),
  demand: z.record(z.string(), z.number().nonnegative()).default({}), // per genre id; missing = 1
});
export type TrendDef = z.infer<typeof TrendDef>;

export const PhaseDef = z.object({ id: z.string(), name: z.string(), weeks: z.number().int().positive() });
export type PhaseDef = z.infer<typeof PhaseDef>;

export const TopicDef = z.object({
  id: z.string(),
  name: z.string(),
  fit: z.record(z.string(), z.number().positive()).default({}), // demand multiplier per genre id; missing = 1
});
export type TopicDef = z.infer<typeof TopicDef>;

/** A platform's demand multiplier for each Quarter of the Era it is drawn for (launch, peak, decline...). */
export const PlatformDef = z.object({ id: z.string(), name: z.string(), curve: z.array(z.number().positive()).min(1) });
export type PlatformDef = z.infer<typeof PlatformDef>;

/** Rule twist for a Rival Showdown: changes how YOUR release is scored against the rival's target. */
export const TwistDef = z.object({
  text: z.string(),
  bugPenaltyMul: z.number().nonnegative().default(1),
  qualityMul: z.number().nonnegative().default(1),
  hypeToReview: z.number().default(0), // review += hype x this
});

export const RivalDef = z.object({
  id: z.string(),
  name: z.string(),
  genre: z.string(),                       // preferred genre: where its releases steal demand
  targets: z.array(z.number()).min(1),     // showdown review target per Era (last value repeats)
  twist: TwistDef,
});
export type RivalDef = z.infer<typeof RivalDef>;

export const EventEffect = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cash'), value: z.number() }),
  z.object({ kind: z.literal('burnoutAll'), value: z.number() }),
  z.object({ kind: z.literal('expectation'), value: z.number() }),
  z.object({ kind: z.literal('hype'), value: z.number() }),       // to the running (or next) project
  z.object({ kind: z.literal('bugs'), value: z.number() }),
  z.object({ kind: z.literal('demand'), value: z.number().positive(), genre: z.string().optional() }), // x this Quarter's demand
  z.object({ kind: z.literal('share'), value: z.number().positive() }), // x market share (capped)
]);
export type EventEffect = z.infer<typeof EventEffect>;

export const EventDef = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  choices: z.array(z.object({ label: z.string(), effects: z.array(EventEffect) })).min(1).max(3),
});
export type EventDef = z.infer<typeof EventDef>;

export const ContentPack = z.object({
  departments: z.array(Dept).min(1),
  phases: z.array(PhaseDef).min(1),
  rosterSize: z.number().int().positive(),
  startingCash: z.number(),
  review: z.object({ expectation: z.number().positive(), bugPenalty: z.number().nonnegative(), min: z.number(), max: z.number() }),
  economy: z.object({
    rentPerWeek: z.number().nonnegative(),
    debtStrikes: z.number().int().positive(),       // D-2: the Nth strike ends the run
    severanceWeeks: z.number().nonnegative(),
    rosterMax: z.number().int().positive(),
    draftSize: z.number().int().positive(),
  }),
  sales: z.object({
    basePerWeek: z.number().nonnegative(),
    hypeScale: z.number().nonnegative(),  // revenue x (1 + hype / hypeScale)
    reviewExp: z.number().nonnegative(),  // revenue x (review / 10) ^ reviewExp
    decay: z.number().gt(0).lt(1),        // per week after release
    minWeekly: z.number().nonnegative(),  // sales stop below this
  }),
  burnout: z.object({
    perWeekPlaced: z.number().nonnegative(),
    recoverPerWeek: z.number().nonnegative(),
    threshold: z.number().positive(),
    breakthroughChance: z.number().min(0).max(1),
    breakthroughQuality: z.number(),
    breakdownBugs: z.number(),
  }),
  calendar: z.object({
    weeksPerQuarter: z.number().int().positive(),
    quartersPerEra: z.number().int().positive(),
    eras: z.number().int().positive(),
    payrollThresholds: z.array(z.number()).min(1), // cash needed on each Quarter's Payroll Day (last value repeats)
  }),
  market: z.object({
    demandStart: z.tuple([z.number().positive(), z.number().positive()]), // per-genre start range
    demandStep: z.number().nonnegative(),  // max random-walk move per Quarter
    demandMin: z.number().positive(),
    demandMax: z.number().positive(),
    rivalsPerRun: z.number().int().positive(),
    rivalEveryQuarters: z.number().int().positive(), // each rival releases this often
    rivalSteal: z.number().min(0).max(1),          // a rival release cuts its genre's demand by this, that Quarter
    hitReview: z.number(),                         // a review at or above this is a hit
    expectationRise: z.number().nonnegative(),     // expectation bar rise after a hit
    expectationMax: z.number().positive(),
    shareWin: z.number().positive(),               // x market share for beating a rival
    shareLose: z.number().positive(),
    shareMin: z.number().positive(),
    shareMax: z.number().positive(),               // snowball cap
    pitchOptions: z.number().int().positive(),
    eventChance: z.number().min(0).max(1),         // chance of an event at each new Quarter
  }),
  topics: z.array(TopicDef).min(1),
  platforms: z.array(PlatformDef).min(1),
  rivals: z.array(RivalDef).min(1),
  events: z.array(EventDef).min(1),
  traits: z.array(TraitDef),
  workers: z.array(WorkerDef),
  genres: z.array(GenreDef).min(1),
  trends: z.array(TrendDef).min(1),
}).superRefine((c, ctx) => {
  const genreIds = new Set(c.genres.map((g) => g.id));
  for (const r of c.rivals) if (!genreIds.has(r.genre)) ctx.addIssue({ code: 'custom', message: `rival ${r.id}: unknown genre ${r.genre}` });
  for (const t of c.topics) for (const g of Object.keys(t.fit)) if (!genreIds.has(g)) ctx.addIssue({ code: 'custom', message: `topic ${t.id}: unknown genre ${g}` });
  for (const e of c.events) for (const ch of e.choices) for (const f of ch.effects)
    if (f.kind === 'demand' && f.genre && !genreIds.has(f.genre)) ctx.addIssue({ code: 'custom', message: `event ${e.id}: unknown genre ${f.genre}` });
  if (c.market.rivalsPerRun > c.rivals.length) ctx.addIssue({ code: 'custom', message: 'rivalsPerRun > rivals' });
  const traitIds = new Set(c.traits.map((t) => t.id));
  for (const w of c.workers)
    for (const t of w.traits)
      if (!traitIds.has(t)) ctx.addIssue({ code: 'custom', message: `worker ${w.id}: unknown trait ${t}` });
  const phaseIds = new Set(c.phases.map((p) => p.id));
  for (const t of c.traits)
    for (const e of t.effects) {
      const [kind, arg] = e.trigger.split(':');
      if (kind === 'slot' && !c.departments.includes(arg as Dept)) ctx.addIssue({ code: 'custom', message: `${t.id}: bad slot ${arg}` });
      if (kind === 'phase' && !phaseIds.has(arg)) ctx.addIssue({ code: 'custom', message: `${t.id}: bad phase ${arg}` });
    }
  for (const t of c.trends)
    for (const g of Object.keys(t.demand))
      if (!c.genres.some((x) => x.id === g)) ctx.addIssue({ code: 'custom', message: `trend ${t.id}: unknown genre ${g}` });
  if (c.rosterSize > c.economy.rosterMax) ctx.addIssue({ code: 'custom', message: 'rosterSize > rosterMax' });
  if (c.rosterSize > c.workers.length) ctx.addIssue({ code: 'custom', message: 'rosterSize > workers' });
});
export type ContentPack = z.infer<typeof ContentPack>;
