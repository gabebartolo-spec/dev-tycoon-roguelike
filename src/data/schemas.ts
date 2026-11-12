import { z } from 'zod';

export const Stat = z.enum(['code', 'design', 'art', 'sound', 'hype', 'bugs']);
export type Stat = z.infer<typeof Stat>;

export const EffectDef = z.object({
  // "always" applies wherever the worker is placed; "slot:<dept>" only in that department
  trigger: z.string().regex(/^(always|slot:[a-z]+)$/),
  stat: Stat,
  op: z.enum(['add', 'mul']),
  value: z.number(),
});
export type EffectDef = z.infer<typeof EffectDef>;

export const TraitDef = z.object({
  id: z.string(),
  name: z.string(),
  effects: z.array(EffectDef),
});
export type TraitDef = z.infer<typeof TraitDef>;

export const WorkerDef = z.object({
  id: z.string(),
  name: z.string(),
  salary: z.number().int().nonnegative(),
  stats: z.record(Stat, z.number()),
  traits: z.array(z.string()),
});
export type WorkerDef = z.infer<typeof WorkerDef>;

export const TrendDef = z.object({
  id: z.string(),
  genre: z.string(),
  effects: z.array(EffectDef),
});
export type TrendDef = z.infer<typeof TrendDef>;

export const ContentPack = z.object({
  departments: z.array(z.string()),
  traits: z.array(TraitDef),
  workers: z.array(WorkerDef),
  trends: z.array(TrendDef),
  startingCash: z.number(),
});
export type ContentPack = z.infer<typeof ContentPack>;
