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

export const ContentPack = z.object({
  departments: z.array(Dept).min(1),
  phases: z.array(PhaseDef).min(1),
  rosterSize: z.number().int().positive(),
  startingCash: z.number(),
  review: z.object({ expectation: z.number().positive(), bugPenalty: z.number().nonnegative(), min: z.number(), max: z.number() }),
  economy: z.object({
    rentPerWeek: z.number().nonnegative(),
    payrollEveryWeeks: z.number().int().positive(), // a Payroll Day falls on every multiple of this week
    debtStrikes: z.number().int().positive(),       // D-2: the Nth missed Payroll Day ends the run
    winWeek: z.number().int().positive(),           // survive to this week to win
    weeksPerQuarter: z.number().int().positive(),
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
  traits: z.array(TraitDef),
  workers: z.array(WorkerDef),
  genres: z.array(GenreDef).min(1),
  trends: z.array(TrendDef).min(1),
}).superRefine((c, ctx) => {
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
