import { z } from 'zod';

export const Dept = z.enum(['code', 'design', 'art', 'audio', 'qa', 'marketing']);
/** Stats a worker has; support departments (QA, Marketing) read one of these instead of their own. */
export const CoreDept = z.enum(['code', 'design', 'art', 'audio']);
export type CoreDept = z.infer<typeof CoreDept>;
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
    code: z.number(), design: z.number(), art: z.number(), audio: z.number(),  // no qa/marketing stat: support depts read a core stat
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

/** A run-start change to the content pack (starting studios and Crunch Levels). Applied once, in runContent(). */
export const Mod = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cash'), add: z.number() }),                 // starting cash
  z.object({ kind: z.literal('rent'), add: z.number() }),                 // per week
  z.object({ kind: z.literal('salary'), mul: z.number().positive() }),
  z.object({ kind: z.literal('deptWeight'), dept: Dept, mul: z.number().positive() }), // every genre's weight for dept
  z.object({ kind: z.literal('phaseWeeks'), phase: z.string(), add: z.number().int() }),
  z.object({ kind: z.literal('threshold'), mul: z.number().nonnegative(), add: z.number().default(0) }),
  z.object({ kind: z.literal('expectation'), add: z.number() }),
  z.object({ kind: z.literal('rivalTarget'), add: z.number() }),
  z.object({ kind: z.literal('eventChance'), add: z.number() }),
  z.object({ kind: z.literal('rosterSize'), add: z.number().int() }),
  z.object({ kind: z.literal('burnout'), mul: z.number().positive() }),  // burnout gained per placed week
  z.object({ kind: z.literal('sales'), mul: z.number().positive() }),    // base weekly sales
  z.object({ kind: z.literal('decay'), mul: z.number().positive() }),    // sales decay factor (lower = faster)
  z.object({ kind: z.literal('pitchOptions'), add: z.number().int() }),
  z.object({ kind: z.literal('rivalSteal'), add: z.number() }),
  z.object({ kind: z.literal('shareMax'), mul: z.number().positive() }),
  z.object({ kind: z.literal('strikes'), add: z.number().int() }),
  z.object({ kind: z.literal('startWorker'), id: z.string() }),
  z.object({ kind: z.literal('rentFreeUpTo'), value: z.number().int().nonnegative() }), // rent 0 while roster <= value          // this worker is on the starting roster
]);
export type Mod = z.infer<typeof Mod>;

export const StudioDef = z.object({ id: z.string(), name: z.string(), text: z.string(), mods: z.array(Mod) });
export type StudioDef = z.infer<typeof StudioDef>;

/** Studio Hub unlock bought with reputation. Workers/genres it grants are out of the run until it is bought. */
/**
 * A support department: the worker placed there adds no quality. Their `stat` (plus output traits) is turned into
 * hype or bugs at `perPoint` per point (negative bugs = bugs fixed). Genre weights do not apply.
 */
export const SupportDef = z.object({ dept: Dept, stat: CoreDept, metric: z.enum(['hype', 'bugs']), perPoint: z.number() });
export type SupportDef = z.infer<typeof SupportDef>;

export const UnlockDef = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  cost: z.number().int().nonnegative(),
  workers: z.array(z.string()).default([]),
  genres: z.array(z.string()).default([]),
  studio: z.string().optional(),
  departments: z.array(Dept).default([]), // board slots added by this unlock
  mods: z.array(Mod).default([]),         // run-start costs that come with it (e.g. upkeep)
  events: z.array(z.string()).default([]), // events that join the deck
});
export type UnlockDef = z.infer<typeof UnlockDef>;

export const ContentPack = z.object({
  departments: z.array(Dept).min(1),
  phases: z.array(PhaseDef).min(1),
  support: z.array(SupportDef).default([]),
  rosterSize: z.number().int().positive(),
  startingCash: z.number(),
  startWorkers: z.array(z.string()).default([]), // fixed starting hires (set by startWorker mods); the rest is drawn
  /** AI cards: workers with this tag never burn out, leave tech debt, and improve each Era (New Model Drops). */
  ai: z.object({
    tag: z.string(),
    debt: z.number().min(0).max(1), // share of a shipped game's bugs that carries into the next game
    statPerEra: z.number(),         // + to the card's best stat per Era
    salaryPerEra: z.number(),       // + weekly salary per Era
  }).default({ tag: 'ai', debt: 0.15, statPerEra: 1, salaryPerEra: 20 }),
  /** Solo cards: workers with this tag can sit on several desks (each extra desk lengthens the phase); a game made
   *  only by solo cards sells with a slower decay (Long Tail). */
  solo: z.object({
    tag: z.string(),
    weeksPerHat: z.number().int().nonnegative(), // + weeks to a phase per extra desk one solo card holds
    decay: z.number().min(0).max(1),             // weekly sales factor for an all-solo game (base is sales.decay)
  }).default({ tag: 'solo', weeksPerHat: 1, decay: 0.92 }),
  review: z.object({ expectation: z.number().positive(), bugPenalty: z.number().nonnegative(), min: z.number(), max: z.number() }),
  economy: z.object({
    rentPerWeek: z.number().nonnegative(),
    rentFreeUpTo: z.number().int().nonnegative().default(0), // no rent while the roster is this small (Bedroom)
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
  meta: z.object({
    valuationPerRep: z.number().positive(), // reputation = valuation / this, plus milestones
    salesWeeksValued: z.number().nonnegative(), // valuation = cash + this x weekly sales income
    repPerHit: z.number().nonnegative(),
    repPerShowdown: z.number().nonnegative(),
    repPerQuarter: z.number().nonnegative(),
    repForWin: z.number().nonnegative(),
    crunchRepBonus: z.number().nonnegative(), // reputation x (1 + level x this)
  }),
  studios: z.array(StudioDef).min(1),  // first one is the default, always available
  unlocks: z.array(UnlockDef),
  crunch: z.array(z.object({ text: z.string(), mods: z.array(Mod).min(1) })), // level N applies entries 1..N
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
  const studioIds = new Set(c.studios.map((s) => s.id));
  for (const u of c.unlocks) {
    if (u.studio && !studioIds.has(u.studio)) ctx.addIssue({ code: 'custom', message: `unlock ${u.id}: unknown studio ${u.studio}` });
    for (const w of u.workers) if (!c.workers.some((x) => x.id === w)) ctx.addIssue({ code: 'custom', message: `unlock ${u.id}: unknown worker ${w}` });
    for (const e of u.events) if (!c.events.some((x) => x.id === e)) ctx.addIssue({ code: 'custom', message: `unlock ${u.id}: unknown event ${e}` });
    for (const g of u.genres) if (!genreIds.has(g)) ctx.addIssue({ code: 'custom', message: `unlock ${u.id}: unknown genre ${g}` });
  }
  if (c.unlocks.some((u) => u.studio === c.studios[0].id)) ctx.addIssue({ code: 'custom', message: 'the default studio cannot be locked' });
  for (const u of c.unlocks) for (const d of u.departments) if (!c.departments.includes(d)) ctx.addIssue({ code: 'custom', message: `unlock ${u.id}: department ${d} not on the board` });
  for (const s of c.support) if (!c.departments.includes(s.dept)) ctx.addIssue({ code: 'custom', message: `support ${s.dept}: not on the board` });
  for (const d of c.departments) if (!CoreDept.safeParse(d).success && !c.support.some((s) => s.dept === d)) ctx.addIssue({ code: 'custom', message: `department ${d} needs a support rule` });
  for (const m of [...c.studios, ...c.crunch, ...c.unlocks].flatMap((x) => x.mods))
    if (m.kind === 'phaseWeeks' && !phaseIds.has(m.phase)) ctx.addIssue({ code: 'custom', message: `mod: bad phase ${m.phase}` });
    else if (m.kind === 'startWorker' && !c.workers.some((w) => w.id === m.id)) ctx.addIssue({ code: 'custom', message: `mod: unknown worker ${m.id}` });
  if (c.rosterSize > c.economy.rosterMax) ctx.addIssue({ code: 'custom', message: 'rosterSize > rosterMax' });
  if (c.rosterSize > c.workers.length) ctx.addIssue({ code: 'custom', message: 'rosterSize > workers' });
});
export type ContentPack = z.infer<typeof ContentPack>;
