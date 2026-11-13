import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack } from '../data/schemas';
import { defaultOptions, runContent, type RunOptions } from './meta';
import { apply, newRun, type Command, type RunState } from './run';

// Shovelware build (approved 2026-11-13): reskins, impulse floor, saturation, lost share, asset packs, Bundle Broker.
const base = ContentPack.parse(raw);
const opts: RunOptions = { studio: 'asset_flip_farm', crunch: 0, unlocks: ['shovelware'] };
const quiet = (c: ContentPack): ContentPack => ({ ...c, market: { ...c.market, eventChance: 0 } }); // no events mid-test
const sw = quiet(runContent(base, opts));
const FLIP = { code: 'code_pack', design: 'flipper', art: 'art_pack', audio: 'audio_pack' };

function step(s: RunState, cmd: Command, c = sw): RunState {
  let t = s;
  while (t.event) t = apply(t, { type: 'chooseEvent', choice: 0 }, c)[0];
  return apply(t, cmd, c)[0];
}

/** Start a project (a pitch, or a reskin of the last game) and ship it with `board` placed every phase. */
function ship(s0: RunState, c = sw, reskin = false, board: Record<string, string> = FLIP): RunState {
  const last = s0.releases[s0.releases.length - 1];
  const topic = c.topics.find((t) => t.id !== last?.topicId)!.id;
  let s = step(s0, reskin ? { type: 'startProject', genreId: last.genreId, topicId: topic, reskin: true } : { type: 'startProject', ...s0.pitch[0] }, c);
  while (s.project && !s.dead && !s.won) {
    for (const [dept, w] of Object.entries(board)) if (!s.benched.includes(w)) s = step(s, { type: 'place', dept: dept as never, workerId: w }, c);
    s = step(s, { type: 'endPhase' }, c);
  }
  return s;
}
const lastSale = (s: RunState) => s.sales.find((x) => x.release === s.releases.length - 1)!;

describe('shovelware: content is gated', () => {
  it('the default pack has no asset packs, no shovelware events and no reskins', () => {
    const plain = quiet(runContent(base, defaultOptions(base)));
    expect(plain.workers.some((w) => w.tags.includes('asset'))).toBe(false);
    expect(plain.events.map((e) => e.id)).not.toContain('bundle_deal');
    const s = ship(newRun(3, plain), plain, false, { code: newRun(3, plain).roster[0] });
    expect(() => apply(s, { type: 'startProject', genreId: s.releases[0].genreId, topicId: plain.topics.find((t) => t.id !== s.releases[0].topicId)!.id, reskin: true }, plain)).toThrow();
  });
  it('Asset Flip Farm starts with the three packs and The Flipper', () => {
    expect(newRun(3, sw, opts).roster.slice(0, 4)).toEqual(['code_pack', 'art_pack', 'audio_pack', 'flipper']);
  });
});

describe('shovelware: asset packs', () => {
  const garage = quiet(runContent(base, { studio: 'garage', crunch: 0, unlocks: ['shovelware'] }));
  it('on: hiring a pack costs its one-time price', () => {
    const s = { ...newRun(3, garage), draft: ['code_pack'] };
    expect(step(s, { type: 'hire', workerId: 'code_pack' }, garage).cash).toBe(s.cash - 1500);
  });
  it('off: hiring a salaried card costs nothing up front', () => {
    const s = { ...newRun(3, garage), draft: ['flipper'] };
    expect(step(s, { type: 'hire', workerId: 'flipper' }, garage).cash).toBe(s.cash);
  });
  it('packs never burn out; The Flipper does', () => {
    const s = ship(newRun(3, sw, opts));
    expect(s.burnout.code_pack).toBe(0);
    expect(s.burnout.flipper).toBeGreaterThan(0);
  });
});

describe('shovelware: reskins', () => {
  const first = ship(newRun(3, sw, opts));
  it('a reskin needs a release, the same genre and a new topic', () => {
    const s0 = newRun(3, sw, opts);
    expect(() => apply(s0, { type: 'startProject', genreId: 'action', topicId: sw.topics[0].id, reskin: true }, sw)).toThrow();
    const r = first.releases[0];
    expect(() => apply(first, { type: 'startProject', genreId: r.genreId, topicId: r.topicId, reskin: true }, sw)).toThrow();
    const other = sw.genres.find((g) => g.id !== r.genreId)!.id;
    expect(() => apply(first, { type: 'startProject', genreId: other, topicId: sw.topics.find((t) => t.id !== r.topicId)!.id, reskin: true }, sw)).toThrow();
  });
  it('on: a reskin skips Prototype', () => {
    const r = first.releases[0];
    const s = step(first, { type: 'startProject', genreId: r.genreId, topicId: sw.topics.find((t) => t.id !== r.topicId)!.id, reskin: true });
    expect(s.project!.phase).toBe(1);
  });
  it('on: a reskin sells as if it reviewed at least 5; off (floor 0): its own review', () => {
    const off = { ...sw, shovelware: { ...sw.shovelware, impulseFloor: 0 } };
    const a = ship(first, sw, true);
    const b = ship(first, off, true);
    const review = a.releases[1].review;
    expect(review).toBeLessThan(5);
    expect(lastSale(a).next / lastSale(b).next).toBeCloseTo((5 / review) ** 2, 5);
  });
  it('on: a reskin cuts its genre demand 10% for the rest of the Quarter; off (saturation 0): no cut', () => {
    const off = { ...sw, shovelware: { ...sw.shovelware, saturation: 0 } };
    const g = first.releases[0].genreId;
    expect(ship(first, sw, true).demand[g] / ship(first, off, true).demand[g]).toBeCloseTo(0.9, 9);
  });
  it('on: a reskin under review 7 costs 5% of all sales, down to half', () => {
    const s = ship(first, sw, true);
    expect(s.flipShare).toBeCloseTo(0.95, 9);
    expect(ship(s, sw, true).flipShare).toBeCloseTo(0.95 ** 2, 9);
    expect(ship({ ...s, flipShare: 0.51 }, sw, true).flipShare).toBe(0.5);
  });
  it('off: a full game never touches lost share; a game at the restore review wins it all back', () => {
    expect(first.flipShare).toBeUndefined();
    const easy = { ...sw, shovelware: { ...sw.shovelware, restoreReview: 1 } };
    expect(ship({ ...first, flipShare: 0.6 }, easy).flipShare).toBe(1);
  });
});

describe('shovelware: Bundle Broker and the bundle deal', () => {
  const s0 = { ...newRun(3, sw, opts), roster: [...newRun(3, sw, opts).roster, 'bundle_broker'] };
  const board = { ...FLIP, design: 'bundle_broker' };
  it('on: a game the broker works on sells 20% more and fades at 0.8 a week', () => {
    const off = { ...sw, shovelware: { ...sw.shovelware, bundleSales: 1 } };
    const a = ship(s0, sw, false, board);
    expect(lastSale(a).decay).toBe(0.8);
    expect(lastSale(a).next / lastSale(ship(s0, off, false, board)).next).toBeCloseTo(1.2, 9);
  });
  it('off: without the broker the sale keeps the base decay', () => {
    expect(lastSale(ship(s0)).decay).toBeUndefined();
  });
  it('taking the deal pays half of what the catalogue would still earn and ends its sales; declining keeps them', () => {
    const s = { ...ship(s0), event: 'bundle_deal' };
    let left = 0;
    for (const x of s.sales) for (let w = x.next; w >= sw.sales.minWeekly; w *= x.decay ?? sw.sales.decay) left += w;
    const took = apply(s, { type: 'chooseEvent', choice: 0 }, sw)[0];
    expect(took.sales).toEqual([]);
    expect(took.cash - s.cash).toBeCloseTo(left * 0.5, -1);
    const kept = apply(s, { type: 'chooseEvent', choice: 1 }, sw)[0];
    expect(kept.sales).toEqual(s.sales);
    expect(kept.cash).toBe(s.cash);
  });
});
