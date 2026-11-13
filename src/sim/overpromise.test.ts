import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack } from '../data/schemas';
import { defaultOptions, runContent, type RunOptions } from './meta';
import { apply, newRun, twistedReview, type Command, type RunState } from './run';

// Overpromiser build (approved 2026-11-13): promises at pitch, refunds, fading backlash, Hype Machine.
const base = ContentPack.parse(raw);
const quiet = (c: ContentPack): ContentPack => ({ ...c, market: { ...c.market, eventChance: 0 } }); // no events mid-test
const hmOpts: RunOptions = { studio: 'hype_machine', crunch: 0, unlocks: ['overpromiser'] };
const hm = quiet(runContent(base, hmOpts));
const garage = quiet(runContent(base, { studio: 'garage', crunch: 0, unlocks: ['overpromiser'] }));
const with_ = (c: ContentPack, o: Partial<ContentPack['overpromise']>): ContentPack => ({ ...c, overpromise: { ...c.overpromise, ...o } });
const ALL = ['no_microtransactions', 'bug_free_launch', 'hundreds_of_hours', 'huge_open_world', 'next_gen_graphics', 'game_of_the_year'];

function step(s: RunState, cmd: Command, c: ContentPack): RunState {
  let t = s;
  while (t.event) t = apply(t, { type: 'chooseEvent', choice: 0 }, c)[0];
  return apply(t, cmd, c)[0];
}

/** Ship the first pitch with these promises (offered on purpose), every roster card on a desk (`ceo` at design). */
function ship(s0: RunState, c: ContentPack, promises: string[], ceo?: string): RunState {
  const p = { ...s0.pitch[0], offers: ALL };
  let s = step({ ...s0, pitch: [p] }, { type: 'startProject', genreId: p.genreId, topicId: p.topicId, promises }, c);
  const crew = s.roster.filter((id) => id !== ceo);
  while (s.project && !s.dead && !s.won) {
    const desks = c.departments.filter((d) => d in s.board);
    desks.forEach((d, i) => {
      const w = d === 'design' && ceo ? ceo : crew[i % crew.length];
      if (!s.benched.includes(w)) s = step(s, { type: 'place', dept: d, workerId: w }, c);
    });
    s = step(s, { type: 'endPhase' }, c);
  }
  return s;
}
const last = (s: RunState) => s.releases[s.releases.length - 1];
const lastSale = (s: RunState) => s.sales.find((x) => x.release === s.releases.length - 1)!;

describe('overpromiser: content is gated', () => {
  it('off: default pitches offer no promises and a promise is refused', () => {
    const plain = quiet(runContent(base, defaultOptions(base)));
    const s = newRun(3, plain);
    expect(s.pitch.every((p) => !p.offers)).toBe(true);
    expect(() => apply(s, { type: 'startProject', ...s.pitch[0], promises: ['bug_free_launch'] }, plain)).toThrow();
    expect(ship(newRun(3, plain), plain, []).backlash).toBeUndefined();
  });
  it('on: each pitch offers 3 different promises', () => {
    for (const p of newRun(3, hm, hmOpts).pitch) {
      expect(p.offers).toHaveLength(3);
      expect(new Set(p.offers).size).toBe(3);
    }
  });
});

describe('overpromiser: taking promises', () => {
  it('Hype Machine starts with the Visionary CEO and needs at least one promise', () => {
    const s = newRun(3, hm, hmOpts);
    expect(s.roster[0]).toBe('visionary_ceo');
    expect(() => apply(s, { type: 'startProject', genreId: s.pitch[0].genreId, topicId: s.pitch[0].topicId }, hm)).toThrow();
    expect(() => apply(s, { type: 'startProject', genreId: s.pitch[0].genreId, topicId: s.pitch[0].topicId, promises: [s.pitch[0].offers![0]] }, hm)).not.toThrow();
  });
  it('a promise must be offered, taken once, and at most 3', () => {
    const s0 = newRun(3, garage);
    const p = s0.pitch[0];
    const go = (promises: string[], pitch = p) => () => apply({ ...s0, pitch: [pitch] }, { type: 'startProject', genreId: p.genreId, topicId: p.topicId, promises }, garage);
    expect(go([ALL.find((id) => !p.offers!.includes(id))!])).toThrow();
    expect(go([p.offers![0], p.offers![0]])).toThrow();
    expect(go(ALL.slice(0, 4), { ...p, offers: ALL })).toThrow();
    expect(go(ALL.slice(0, 3), { ...p, offers: ALL })).not.toThrow();
  });
  it('on: each promise adds +12 hype at the start', () => {
    const s0 = newRun(3, garage);
    const p = { ...s0.pitch[0], offers: ALL };
    const s = step({ ...s0, pitch: [p] }, { type: 'startProject', genreId: p.genreId, topicId: p.topicId, promises: ALL.slice(0, 2) }, garage);
    expect(s.project!.hype).toBe(24);
  });
});

describe('overpromiser: broken promises', () => {
  const broke = ship(newRun(3, garage), garage, ['game_of_the_year']);
  it('a game reviewing under the bar breaks the promise', () => {
    expect(last(broke).review).toBeLessThan(9);
    expect(last(broke).broken).toEqual(['game_of_the_year']);
  });
  it('on: each broken promise refunds 20% of all its sales; off (refund 0): none', () => {
    const off = ship(newRun(3, garage), with_(garage, { refund: 0 }), ['game_of_the_year']);
    expect(lastSale(broke).next / lastSale(off).next).toBeCloseTo(0.8, 9);
  });
  it('a kept promise costs nothing', () => {
    const low = { ...garage, promises: garage.promises.map((p) => ({ ...p, bar: 1 })) }; // every promise is kept
    const easy = ship(newRun(3, low), low, []);
    const kept = ship(newRun(3, low), low, ['no_microtransactions']);
    expect(last(kept).broken).toBeUndefined();
    expect(kept.backlash).toBe(0);
    expect(lastSale(kept).next).toBeGreaterThan(lastSale(easy).next);
  });
  it('on: the next game reviews 1 lower per broken promise', () => {
    expect(broke.backlash).toBe(1);
    const next = ship(broke, garage, []);
    const r = last(next);
    expect(r.backlash).toBe(1);
    expect(r.review).toBeCloseTo(Math.max(1, twistedReview({ ...r, backlash: 0 }, garage) - 1), 1);
  });
  it('each game shipped clears 1 point; a game reviewing 8+ clears it all', () => {
    expect(ship({ ...broke, backlash: 2.5 }, garage, []).backlash).toBe(1.5);
    expect(ship({ ...broke, backlash: 2.5 }, with_(garage, { redeemReview: 1 }), []).backlash).toBe(0);
  });
});

describe('overpromiser: rule cards', () => {
  const s0 = { ...newRun(3, garage), roster: [...newRun(3, garage).roster, 'visionary_ceo', 'pr_manager', 'apology_writer'] };
  it('Keynote: the CEO adds +5 hype per promise', () => {
    const on = ship(s0, garage, ['no_microtransactions', 'bug_free_launch'], 'visionary_ceo');
    const off = ship(s0, with_(garage, { keynoteHype: 0 }), ['no_microtransactions', 'bug_free_launch'], 'visionary_ceo');
    expect(last(on).hype - last(off).hype).toBe(10);
  });
  it('Spin: the PR Manager halves the refund to 10%', () => {
    const on = ship(s0, garage, ['game_of_the_year'], 'pr_manager');
    const off = ship(s0, with_(garage, { spinRefund: 0 }), ['game_of_the_year'], 'pr_manager');
    expect(lastSale(on).next / lastSale(off).next).toBeCloseTo(0.9, 9);
  });
  it('Notes App Apology: a broken promise costs -0.5 review', () => {
    expect(ship(s0, garage, ['game_of_the_year'], 'apology_writer').backlash).toBe(0.5);
    expect(ship(s0, garage, ['game_of_the_year']).backlash).toBe(1);
  });
});
