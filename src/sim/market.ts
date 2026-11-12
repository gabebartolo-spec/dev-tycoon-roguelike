import prand from 'pure-rand';
import type { ContentPack, RivalDef } from '../data/schemas';

/** One Quarter of the generated market, fixed at run start. Runtime effects (rivals, events) apply on top. */
export interface QuarterMarket { trendId: string; demand: Record<string, number> }

/** The run's "dungeon": generated once from the seed, so two seeds give two different markets. */
export interface Market {
  quarters: QuarterMarket[];
  rivals: string[];    // rival ids in this run; the Era boss is rivals[era % length]
  platforms: string[]; // platform id per Era
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Its own seeded stream (not the run's draw counter), so generating the market never shifts other rolls. */
export function generateMarket(seed: number, content: ContentPack): Market {
  const { market: M, calendar: C } = content;
  let rng = prand.xoroshiro128plus((seed ^ 0x5eed5eed) | 0);
  const int = (max: number) => { const [v, n] = prand.uniformIntDistribution(0, max, rng); rng = n; return v; };
  const unit = () => int(10000) / 10000;
  const pick = <T,>(xs: T[]) => xs[int(xs.length - 1)];

  const total = C.eras * C.quartersPerEra;
  let demand = Object.fromEntries(content.genres.map((g) => [g.id, round2(M.demandStart[0] + unit() * (M.demandStart[1] - M.demandStart[0]))]));
  const quarters: QuarterMarket[] = [];
  for (let q = 0; q < total; q++) {
    if (q > 0) demand = Object.fromEntries(Object.entries(demand).map(([g, d]) =>
      [g, round2(Math.min(M.demandMax, Math.max(M.demandMin, d + (unit() * 2 - 1) * M.demandStep)))]));
    quarters.push({ trendId: pick(content.trends).id, demand });
  }
  const pool = content.rivals.map((r) => r.id);
  const rivals: string[] = [];
  while (rivals.length < M.rivalsPerRun) rivals.push(pool.splice(int(pool.length - 1), 1)[0]);
  const platforms = Array.from({ length: C.eras }, () => pick(content.platforms).id);
  return { quarters, rivals, platforms };
}

export const quarterOf = (week: number, content: ContentPack) => Math.floor((week - 1) / content.calendar.weeksPerQuarter);
export const eraOf = (quarter: number, content: ContentPack) => Math.floor(quarter / content.calendar.quartersPerEra);
export const lastWeek = (content: ContentPack) => 1 + content.calendar.eras * content.calendar.quartersPerEra * content.calendar.weeksPerQuarter;
export const thresholdFor = (quarter: number, content: ContentPack) => {
  const t = content.calendar.payrollThresholds;
  return t[Math.min(quarter, t.length - 1)];
};

export const rivalById = (id: string, content: ContentPack): RivalDef => content.rivals.find((r) => r.id === id)!;
export const bossOf = (market: Market, era: number) => market.rivals[era % market.rivals.length];
export const targetFor = (rival: RivalDef, era: number) => rival.targets[Math.min(era, rival.targets.length - 1)];

/** Which rivals release in a Quarter (fixed schedule; the genre they hit can change at runtime). */
export const rivalsReleasing = (market: Market, quarter: number, content: ContentPack) =>
  market.rivals.filter((_, i) => quarter % content.market.rivalEveryQuarters === i % content.market.rivalEveryQuarters);

export function platformMul(market: Market, quarter: number, content: ContentPack): number {
  const era = Math.min(eraOf(quarter, content), market.platforms.length - 1);
  const p = content.platforms.find((x) => x.id === market.platforms[era])!;
  const qi = quarter % content.calendar.quartersPerEra;
  return p.curve[Math.min(qi, p.curve.length - 1)];
}

export type Direction = 'up' | 'flat' | 'down';

/** Fogged forecast: next Quarter's direction per genre (no numbers), plus which rivals are due. */
export function forecast(market: Market, quarter: number, content: ContentPack): { genres: Record<string, Direction>; rivals: string[] } | null {
  const next = market.quarters[quarter + 1];
  if (!next) return null;
  const now = market.quarters[quarter].demand;
  const genres = Object.fromEntries(Object.entries(next.demand).map(([g, d]) =>
    [g, d - now[g] > 0.05 ? 'up' : d - now[g] < -0.05 ? 'down' : 'flat'] as const));
  return { genres, rivals: rivalsReleasing(market, quarter + 1, content) };
}
