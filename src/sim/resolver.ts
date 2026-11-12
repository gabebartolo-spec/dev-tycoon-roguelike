import type { ContentPack, EffectDef, Stat } from '../data/schemas';

export type Board = Record<string, string | null>; // department -> worker id
export type Totals = Record<Stat, number>;

const ZERO: Totals = { code: 0, design: 0, art: 0, sound: 0, hype: 0, bugs: 0 };

/** Pure: sums base stats, then all adds, then all muls (fixed order = predictable stacking). */
export function resolve(board: Board, content: ContentPack, trendId?: string): Totals {
  const totals: Totals = { ...ZERO };
  const adds: EffectDef[] = [];
  const muls: EffectDef[] = [];
  const collect = (effects: EffectDef[], dept: string) => {
    for (const e of effects) {
      if (e.trigger !== 'always' && e.trigger !== `slot:${dept}`) continue;
      (e.op === 'add' ? adds : muls).push(e);
    }
  };
  const trend = content.trends.find((t) => t.id === trendId);

  for (const [dept, workerId] of Object.entries(board)) {
    if (!workerId) continue;
    const w = content.workers.find((x) => x.id === workerId);
    if (!w) throw new Error(`unknown worker ${workerId}`);
    for (const [stat, v] of Object.entries(w.stats)) totals[stat as Stat] += v ?? 0;
    for (const tid of w.traits) {
      const t = content.traits.find((x) => x.id === tid);
      if (!t) throw new Error(`unknown trait ${tid}`);
      collect(t.effects, dept);
    }
    if (trend) collect(trend.effects, dept);
  }
  for (const e of adds) totals[e.stat] += e.value;
  for (const e of muls) totals[e.stat] *= e.value;
  return totals;
}
