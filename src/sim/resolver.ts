import type { ContentPack, Dept, EffectDef, WorkerDef } from '../data/schemas';

export type Board = Partial<Record<Dept, string | null>>; // department -> worker id
export type Metric = 'quality' | 'hype' | 'bugs';

/** One line of "why": a named source moved a metric by delta (already weighted). */
export interface Contribution { source: string; metric: Metric; delta: number }

export interface Totals { quality: number; hype: number; bugs: number; contributions: Contribution[] }

export interface ResolveCtx { content: ContentPack; genreId: string; phaseId: string; trendId?: string }

function active(e: EffectDef, dept: Dept, phaseId: string, neighbourTags: Set<string>): boolean {
  const [kind, arg] = e.trigger.split(':');
  if (kind === 'always') return true;
  if (kind === 'slot') return arg === dept;
  if (kind === 'phase') return arg === phaseId;
  if (kind === 'adjacent') return neighbourTags.has(arg);
  return false;
}

/**
 * Pure. For one placement phase:
 *  quality = sum over placed workers of (own dept stat, then output adds, then output muls) x genre weight
 *  hype/bugs = worker base stats, then all adds, then all muls (fixed order keeps stacking predictable)
 */
export function resolve(board: Board, ctx: ResolveCtx): Totals {
  const { content } = ctx;
  const genre = content.genres.find((g) => g.id === ctx.genreId);
  if (!genre) throw new Error(`unknown genre ${ctx.genreId}`);
  const trend = content.trends.find((t) => t.id === ctx.trendId);
  const byId = (id: string): WorkerDef => {
    const w = content.workers.find((x) => x.id === id);
    if (!w) throw new Error(`unknown worker ${id}`);
    return w;
  };

  const contributions: Contribution[] = [];
  const globalAdds: [string, EffectDef][] = [];
  const globalMuls: [string, EffectDef][] = [];
  let quality = 0;
  let hype = 0;
  let bugs = 0;

  const depts = content.departments;
  depts.forEach((dept, i) => {
    const id = board[dept];
    if (!id) return;
    const w = byId(id);
    const neighbourTags = new Set<string>();
    for (const j of [i - 1, i + 1]) {
      const nid = depts[j] !== undefined ? board[depts[j]] : null;
      if (nid) byId(nid).tags.forEach((t) => neighbourTags.add(t));
    }
    const weight = genre.weights[dept] ?? 0;

    const effects: [string, EffectDef][] = [];
    for (const tid of w.traits) {
      const t = content.traits.find((x) => x.id === tid)!;
      for (const e of t.effects) if (active(e, dept, ctx.phaseId, neighbourTags)) effects.push([`${w.name}: ${t.name}`, e]);
    }
    if (trend) for (const e of trend.effects) if (active(e, dept, ctx.phaseId, neighbourTags)) effects.push([`Trend: ${trend.name}`, e]);

    // Own output, weighted by genre.
    let out = w.stats[dept];
    contributions.push({ source: `${w.name} (${dept})`, metric: 'quality', delta: out * weight });
    for (const [src, e] of effects) if (e.target === 'output' && e.op === 'add') {
      out += e.value;
      contributions.push({ source: src, metric: 'quality', delta: e.value * weight });
    }
    for (const [src, e] of effects) if (e.target === 'output' && e.op === 'mul') {
      const before = out;
      out *= e.value;
      contributions.push({ source: src, metric: 'quality', delta: (out - before) * weight });
    }
    quality += Math.max(0, out) * weight;

    if (w.stats.hype) { hype += w.stats.hype; contributions.push({ source: w.name, metric: 'hype', delta: w.stats.hype }); }
    if (w.stats.bugs) { bugs += w.stats.bugs; contributions.push({ source: w.name, metric: 'bugs', delta: w.stats.bugs }); }
    for (const pair of effects) if (pair[1].target !== 'output') (pair[1].op === 'add' ? globalAdds : globalMuls).push(pair);
  });

  for (const [src, e] of globalAdds) {
    if (e.target === 'hype') hype += e.value; else bugs += e.value;
    contributions.push({ source: src, metric: e.target as Metric, delta: e.value });
  }
  for (const [src, e] of globalMuls) {
    const before = e.target === 'hype' ? hype : bugs;
    const after = before * e.value;
    if (e.target === 'hype') hype = after; else bugs = after;
    contributions.push({ source: src, metric: e.target as Metric, delta: after - before });
  }
  return { quality, hype: Math.max(0, hype), bugs: Math.max(0, bugs), contributions };
}

/** Merge contributions with the same source and metric. */
export function mergeContributions(list: Contribution[]): Contribution[] {
  const m = new Map<string, Contribution>();
  for (const c of list) {
    const k = `${c.metric}|${c.source}`;
    const cur = m.get(k);
    if (cur) cur.delta += c.delta; else m.set(k, { ...c });
  }
  return [...m.values()];
}
