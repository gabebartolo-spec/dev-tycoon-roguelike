import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack } from '../data/schemas';
import { generateMarket, techAudience } from './market';
import { defaultOptions, runContent, type RunOptions } from './meta';
import { apply, newRun, phaseTotals, phaseWeeks, type Command, type RunState } from './run';

// Tech build (approved 2026-11-13): Tech platforms with a rise-and-fall audience, partner money, Tech Demo Lab.
const base = ContentPack.parse(raw);
const quiet = (c: ContentPack): ContentPack => ({ ...c, market: { ...c.market, eventChance: 0 } }); // no events mid-test
const labOpts: RunOptions = { studio: 'tech_demo_lab', crunch: 0, unlocks: ['tech'] };
const lab = quiet(runContent(base, labOpts));
const garage = quiet(runContent(base, { studio: 'garage', crunch: 0, unlocks: ['tech'] }));
const plain = quiet(runContent(base, defaultOptions(base)));
const with_ = (c: ContentPack, o: Partial<ContentPack['tech']>): ContentPack => ({ ...c, tech: { ...c.tech, ...o } });

function step(s: RunState, cmd: Command, c: ContentPack): RunState {
  let t = s;
  while (t.event) t = apply(t, { type: 'chooseEvent', choice: 0 }, c)[0];
  return apply(t, cmd, c)[0];
}
/** A run whose every Tech platform launched in Quarter 0 (so `vr` sits at 10% audience in Quarter 0). */
const launched = (s: RunState, at = 0): RunState => ({ ...s, market: { ...s.market, techLaunch: Object.fromEntries(Object.keys(s.market.techLaunch!).map((id) => [id, at])) } });
const start = (s: RunState, c: ContentPack, tech?: string) =>
  step(s, { type: 'startProject', genreId: s.pitch[0].genreId, topicId: s.pitch[0].topicId, ...(tech ? { tech } : {}) }, c);
/** Ship the running project with every roster card on a desk. */
function ship(s0: RunState, c: ContentPack): RunState {
  let s = s0;
  while (s.project && !s.dead && !s.won) {
    const desks = c.departments.filter((d) => d in s.board);
    desks.forEach((d, i) => { const w = s.roster[i % s.roster.length]; if (!s.benched.includes(w)) s = step(s, { type: 'place', dept: d, workerId: w }, c); });
    s = step(s, { type: 'endPhase' }, c);
  }
  return s;
}
const lastSale = (s: RunState) => s.sales.find((x) => x.release === s.releases.length - 1)!;

describe('tech: content is gated', () => {
  it('off: no launch Quarters, the market is unchanged, and a Tech target is refused', () => {
    const off = generateMarket(3, plain);
    expect(off.techLaunch).toBeUndefined();
    const { techLaunch, ...on } = generateMarket(3, garage);
    expect(on).toEqual(off); // drawn last: Tech never shifts the existing market draws
    expect(Object.keys(techLaunch!)).toEqual(['vr', 'ar', 'plastic_instrument', 'motion']);
    const s = launched({ ...newRun(3, plain), market: { ...newRun(3, plain).market, techLaunch } });
    expect(() => start(s, plain, 'vr')).toThrow();
  });
  it('the market platform VR Visor is now Cloud Console (same id)', () => {
    expect(base.platforms.find((p) => p.id === 'vr')!.name).toBe('Cloud Console');
  });
});

describe('tech: platform audience', () => {
  it('rises 10% to 40% and falls back over 7 Quarters, 0 before launch and once dead', () => {
    const m = { ...generateMarket(3, garage), techLaunch: { vr: 2 } };
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => techAudience(m, 'vr', q, garage))).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.3, 0.2, 0.1, 0]);
  });
  it('a platform not on sale (before launch or dead) cannot be targeted', () => {
    const s = newRun(3, garage);
    expect(() => start(launched(s, 5), garage, 'vr')).toThrow(); // launches in Quarter 5; now is Quarter 0
    expect(() => start(launched(s, -7), garage, 'vr')).toThrow(); // dead
    expect(() => start(launched(s), garage, 'vr')).not.toThrow();
    expect(() => apply(launched(s), { type: 'startProject', genreId: s.pitch[0].genreId, topicId: s.pitch[0].topicId, reskin: true, tech: 'vr' }, garage)).toThrow();
  });
});

describe('tech: targeting a platform', () => {
  const s0 = launched(newRun(3, garage));
  it('pays $9,000 partner money and +10 hype at the start', () => {
    const s = start(s0, garage, 'vr');
    expect(s.cash - s0.cash).toBe(9000);
    expect(s.ledger.events).toBe(9000);
    expect(s.project!.hype).toBe(10);
    expect(s.project!.contributions).toContainEqual({ source: 'Launch partner', metric: 'hype', delta: 10 });
  });
  it('Production takes a week longer, not with a Dev Kit card on the board', () => {
    let s = start(s0, garage, 'vr');
    s = { ...s, project: { ...s.project!, phase: garage.phases.findIndex((p) => p.id === 'production') } };
    const plainWeeks = phaseWeeks({ ...s, project: { ...s.project!, tech: undefined } }, garage);
    expect(phaseWeeks(s, garage)).toBe(plainWeeks + 1);
    s = { ...s, roster: [...s.roster, 'hardware_hacker'] };
    s = step(s, { type: 'place', dept: 'code', workerId: 'hardware_hacker' }, garage);
    expect(phaseWeeks(s, garage)).toBe(plainWeeks);
  });
  it('sells to the platform audience at release; the same game untargeted sells to everyone', () => {
    const t = ship(start(s0, garage, 'vr'), garage);
    const r = t.releases[0];
    expect(r.tech).toBe('vr');
    expect(r.review).toBeLessThan(8);
    expect(r.audience).toBe(techAudience(t.market, 'vr', Math.floor((r.week - 1) / garage.calendar.weeksPerQuarter), garage));
    expect(r.audience).toBeGreaterThan(0);
    const noExtra = with_(garage, { hype: 0, extraWeeks: 0 }); // same game, same week: only the audience differs
    const a = ship(start(s0, noExtra, 'vr'), noExtra);
    const b = ship(start(s0, noExtra), noExtra);
    expect(lastSale(a).next / lastSale(b).next).toBeCloseTo(a.releases[0].audience!, 9);
  });
  it('a game reviewing 8+ breaks out and sells to everyone', () => {
    const easy = with_(garage, { breakoutReview: 1 });
    expect(ship(start(s0, easy, 'vr'), easy).releases[0].audience).toBe(1);
  });
});

describe('tech: Tech Demo Lab and rule cards', () => {
  it('Tech Demo Lab starts with the Graphics Programmer; Production is a week longer for every game', () => {
    expect(newRun(3, lab, labOpts).roster[0]).toBe('graphics_programmer');
    expect(lab.phases.find((p) => p.id === 'production')!.weeks).toBe(garage.phases.find((p) => p.id === 'production')!.weeks + 1);
  });
  it('Showcase (x1.25) and Mocap (+2) only work on a Tech game', () => {
    const s = launched({ ...newRun(3, garage), roster: ['graphics_programmer', 'motion_designer'] });
    const place = (t: RunState) => step(step(t, { type: 'place', dept: 'code', workerId: 'graphics_programmer' }, garage), { type: 'place', dept: 'design', workerId: 'motion_designer' }, garage);
    const tech = phaseTotals(place(start(s, garage, 'vr')), garage)!;
    const flat = phaseTotals(place(start(s, garage)), garage)!;
    expect(tech.contributions.some((x) => x.source.includes('Showcase'))).toBe(true);
    expect(tech.contributions.some((x) => x.source.includes('Mocap'))).toBe(true);
    expect(flat.contributions.some((x) => x.source.includes('Showcase') || x.source.includes('Mocap'))).toBe(false);
    expect(tech.quality).toBeGreaterThan(flat.quality);
  });
});
