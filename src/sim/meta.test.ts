import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack } from '../data/schemas';
import { playBot } from './bot';
import { buy, defaultOptions, emptyMeta, optionsFor, parseMeta, recordRun, reputationFor, runContent, studiosAvailable, type Meta } from './meta';
import { apply, newRun, replay, type Command, type RunState } from './run';

const base = ContentPack.parse(raw);
const rich: Meta = { ...emptyMeta(), reputation: 1000 };

describe('meta: a first run with empty meta is the plain game', () => {
  it('default options only remove unlock-gated workers and genres; every other value is untouched', () => {
    const c = runContent(base, defaultOptions(base));
    const gatedW = new Set(base.unlocks.flatMap((u) => u.workers));
    const gatedG = new Set(base.unlocks.flatMap((u) => u.genres));
    expect(c).toEqual({ ...base, workers: base.workers.filter((w) => !gatedW.has(w.id)), genres: base.genres.filter((g) => !gatedG.has(g.id)) });
    expect(c.workers.map((w) => w.id)).not.toContain('gus');
    expect(c.genres.map((g) => g.id)).not.toContain('strategy');
  });
  it('optionsFor(emptyMeta) is the default options, so the first run is identical', () => {
    const o = optionsFor(emptyMeta(), base.studios[0].id, 0, base);
    expect(o).toEqual(defaultOptions(base));
    expect(playBot(3, runContent(base, o))).toEqual(playBot(3, runContent(base, defaultOptions(base))));
  });
});

describe('meta: unlocks apply only at run start', () => {
  it('buying an unlock mid-run changes nothing in that run; the save replays from its own options', () => {
    const opts = optionsFor(emptyMeta(), 'garage', 0, base);
    const c = runContent(base, opts);
    let s: RunState = newRun(4, c, opts);
    const log: Command[] = [];
    const step = (cmd: Command) => { s = apply(s, cmd, c)[0]; log.push(cmd); };
    step({ type: 'startProject', ...s.pitch[0] });
    const meta = buy(rich, 'veterans', base); // bought while the run is going
    expect(meta.unlocked).toContain('veterans');
    for (let i = 0; i < 3; i++) { if (s.event) step({ type: 'chooseEvent', choice: 0 }); step({ type: 'endPhase' }); }
    expect(s.options.unlocks).toEqual([]);
    expect(s.draft ?? []).not.toContain('gus');
    expect(replay({ version: 3, seed: 4, options: opts, commands: log }, base)).toEqual(s);
  });
  it('the unlock shows up in the next run (on vs off)', () => {
    const off = runContent(base, defaultOptions(base));
    const on = runContent(base, optionsFor(buy(rich, 'veterans', base), 'garage', 0, base));
    expect(off.workers.some((w) => w.id === 'ivy')).toBe(false);
    expect(on.workers.some((w) => w.id === 'ivy')).toBe(true);
    const g = runContent(base, optionsFor(buy(rich, 'genre_strategy', base), 'garage', 0, base));
    expect(g.genres.some((x) => x.id === 'strategy')).toBe(true);
  });
});

describe('meta: starting studios (D-1 tradeoffs)', () => {
  it('a locked studio cannot be picked; buying its unlock makes it available', () => {
    expect(() => optionsFor(emptyMeta(), 'open_source', 0, base)).toThrow(/locked/);
    const m = buy(rich, 'studio_open_source', base);
    expect(studiosAvailable(m, base).map((s) => s.id)).toEqual(['garage', 'open_source']);
  });
  it('Open-Source Engine: cheaper rent, weaker code weight, longer Prototype (each on vs off)', () => {
    const off = runContent(base, defaultOptions(base));
    const on = runContent(base, { ...defaultOptions(base), studio: 'open_source' });
    expect(on.economy.rentPerWeek).toBe(off.economy.rentPerWeek - 200);
    expect(on.genres[0].weights.code).toBeCloseTo(off.genres[0].weights.code! * 0.9);
    expect(on.genres[0].weights.design).toBe(off.genres[0].weights.design);
    expect(on.phases[0].weeks).toBe(off.phases[0].weeks + 1);
    expect(on.phases[1].weeks).toBe(off.phases[1].weeks);
  });
  it('every non-default studio has at least one upside and one downside mod', () => {
    for (const s of base.studios.slice(1)) expect(s.mods.length).toBeGreaterThanOrEqual(2);
  });
});

describe('meta: Crunch Levels', () => {
  it('level N applies exactly entries 1..N, stacking', () => {
    const at = (n: number) => runContent(base, { ...defaultOptions(base), crunch: n });
    expect(at(0).calendar.payrollThresholds).toEqual(base.calendar.payrollThresholds);
    expect(at(1).calendar.payrollThresholds).toEqual(base.calendar.payrollThresholds.map((v) => Math.round(v * 1.1)));
    expect(at(1).review.expectation).toBe(base.review.expectation);
    expect(at(2).review.expectation).toBe(base.review.expectation + 5);
    expect(at(14).economy.debtStrikes).toBe(base.economy.debtStrikes);
    expect(at(15).economy.debtStrikes).toBe(base.economy.debtStrikes - 1);
    expect(base.crunch).toHaveLength(15);
  });
  it('winning at your highest level unlocks the next; losing never removes progress', () => {
    const won = { ...newRun(1, base), won: true, options: { ...defaultOptions(base), crunch: 0 } };
    const lost = { ...won, won: false, dead: true };
    const m1 = recordRun(emptyMeta(), won, base);
    expect(m1.crunchMax).toBe(1);
    expect(recordRun(m1, lost, base).crunchMax).toBe(1);
    expect(recordRun(m1, won, base).crunchMax).toBe(1); // a win below your highest level does not skip ahead
    expect(() => optionsFor(m1, 'garage', 2, base)).toThrow(/crunch locked/);
  });
});

describe('meta: reputation', () => {
  it('comes from valuation plus milestones, with a Crunch bonus', () => {
    const s = { ...newRun(1, base), cash: 21000, week: 25, won: true };
    const r = reputationFor(s, base);
    expect(r.lines.find((l) => l.label === 'Valuation')!.rep).toBe(10);
    expect(r.lines.find((l) => l.label === 'Quarters survived')!.rep).toBe(2);
    expect(r.total).toBe(10 + 2 + base.meta.repForWin);
    const hard = reputationFor({ ...s, options: { ...s.options, crunch: 5 } }, base);
    expect(hard.total).toBe(Math.floor(r.total * 1.5));
  });
  it('recordRun banks it and buy spends it', () => {
    const s = { ...newRun(1, base), cash: 40000, dead: true };
    const m = recordRun(emptyMeta(), s, base);
    expect(m.reputation).toBe(reputationFor(s, base).total);
    expect(m.runs).toBe(1);
    expect(() => buy(emptyMeta(), 'veterans', base)).toThrow(/not enough/);
    expect(() => recordRun(emptyMeta(), newRun(1, base), base)).toThrow(/not over/);
  });
});

describe('meta.json: versioned, migrated, corruption-safe', () => {
  it('missing file is an empty meta', () => {
    expect(parseMeta(null)).toEqual({ meta: emptyMeta(), recovered: false });
  });
  it('round-trips', () => {
    const m = { ...emptyMeta(), reputation: 7, unlocked: ['veterans'] };
    expect(parseMeta(JSON.stringify(m)).meta).toEqual(m);
  });
  it('migrates an unversioned (v0) file', () => {
    const { meta, recovered } = parseMeta(JSON.stringify({ reputation: 5, unlocked: ['veterans'] }));
    expect(recovered).toBe(false);
    expect(meta).toEqual({ ...emptyMeta(), reputation: 5, unlocked: ['veterans'] });
  });
  it('corrupt, wrong-shaped or newer files fall back to empty and report it', () => {
    for (const text of ['{nope', '[]', '"x"', JSON.stringify({ version: 1, reputation: -3 }), JSON.stringify({ version: 99 })])
      expect(parseMeta(text)).toEqual({ meta: emptyMeta(), recovered: true });
  });
});
