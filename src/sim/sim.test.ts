import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack, type EffectDef } from '../data/schemas';
import { forecast, generateMarket } from './market';
import { resolve, type Board } from './resolver';
import { apply, demandFor, launchSales, newRun, postMortem, preview, replay, twistedReview, type Command, type RunState } from './run';

const ECONOMY = { rentPerWeek: 0, debtStrikes: 3, severanceWeeks: 2, rosterMax: 3, draftSize: 3 };
// One-week Quarters, no Era end in sight, flat demand, no events: each rule below can be switched on alone.
const CALENDAR = { weeksPerQuarter: 1, quartersPerEra: 100, eras: 1, payrollThresholds: [0] };
const MARKET = {
  demandStart: [1, 1] as [number, number], demandStep: 0, demandMin: 0.4, demandMax: 1.8,
  rivalsPerRun: 1, rivalEveryQuarters: 1000, rivalSteal: 0.5,
  hitReview: 7, expectationRise: 5, expectationMax: 20,
  shareWin: 1.2, shareLose: 0.8, shareMin: 0.5, shareMax: 1.5, pitchOptions: 1, eventChance: 0,
};
const NO_TWIST = { text: '' };

/** Tiny fixed pack: tests stay valid whatever the real balance numbers become. */
function pack(effects: EffectDef[], extra: Record<string, unknown> = {}): ContentPack {
  return ContentPack.parse({
    departments: ['code', 'design', 'art', 'audio'],
    phases: [{ id: 'prototype', name: 'Prototype', weeks: 1 }, { id: 'polish', name: 'Polish', weeks: 1 }],
    rosterSize: 2,
    startingCash: 1000,
    review: { expectation: 10, bugPenalty: 0.5, min: 1, max: 10 },
    economy: ECONOMY,
    sales: { basePerWeek: 100, hypeScale: 10, reviewExp: 1, decay: 0.5, minWeekly: 10 },
    burnout: { perWeekPlaced: 0, recoverPerWeek: 0, threshold: 100, breakthroughChance: 0.5, breakthroughQuality: 5, breakdownBugs: 5 },
    calendar: CALENDAR,
    market: MARKET,
    topics: [{ id: 't', name: 'T' }],
    platforms: [{ id: 'p', name: 'P', curve: [1] }],
    rivals: [{ id: 'r', name: 'R', genre: 'g', targets: [5], twist: NO_TWIST }],
    events: [{ id: 'e', title: 'E', text: '', choices: [{ label: 'cash', effects: [{ kind: 'cash', value: 50 }] }, { label: 'hype', effects: [{ kind: 'hype', value: 3 }] }] }],
    genres: [{ id: 'g', name: 'G', weights: { code: 1, design: 2, art: 1, audio: 1 } }],
    trends: [{ id: 'none', name: 'None', effects: [] }],
    traits: [{ id: 't', name: 'T', text: '', effects }, { id: 'plain', name: 'Plain', text: '', effects: [{ trigger: 'always', target: 'hype', op: 'add', value: 0 }] }],
    workers: [
      { id: 'a', name: 'A', salary: 100, tags: ['coder'], stats: { code: 4, design: 2, art: 0, audio: 0, hype: 0, bugs: 1 }, traits: ['t'] },
      { id: 'b', name: 'B', salary: 100, tags: ['artist'], stats: { code: 0, design: 0, art: 3, audio: 0, hype: 0, bugs: 0 }, traits: ['plain'] },
    ],
    ...extra,
  });
}
const ctx = (c: ContentPack, phaseId = 'prototype') => ({ content: c, genreId: 'g', phaseId, trendId: 'none' });
const pitchCmd = (s: RunState, i = 0): Command => ({ type: 'startProject', ...s.pitch[i] });

describe('content', () => {
  it('real content pack validates', () => {
    const c = ContentPack.parse(raw);
    expect(c.workers).toHaveLength(12);
    expect(c.traits).toHaveLength(16);
    expect(c.genres).toHaveLength(4);
    expect(c.events).toHaveLength(20);
    expect(c.rivals).toHaveLength(6);
  });
  it('rejects a worker with an unknown trait', () => {
    const bad = { ...(raw as object), workers: [{ ...(raw as { workers: object[] }).workers[0], traits: ['nope'] }] };
    expect(() => ContentPack.parse(bad)).toThrow(/unknown trait/);
  });
  it('rejects a rival or event pointing at an unknown genre', () => {
    expect(() => pack([], { rivals: [{ id: 'r', name: 'R', genre: 'nope', targets: [5], twist: NO_TWIST }] })).toThrow(/unknown genre/);
    expect(() => pack([], { events: [{ id: 'e', title: 'E', text: '', choices: [{ label: 'x', effects: [{ kind: 'demand', value: 2, genre: 'nope' }] }] }] })).toThrow(/unknown genre/);
  });
});

describe('resolver triggers (on vs off)', () => {
  it('quality is own dept stat x genre weight', () => {
    const c = pack([{ trigger: 'always', target: 'hype', op: 'add', value: 0 }]);
    expect(resolve({ code: 'a' }, ctx(c)).quality).toBe(4);   // code weight 1
    expect(resolve({ design: 'a' }, ctx(c)).quality).toBe(4); // design stat 2 x weight 2
  });
  it('slot: applies only in that department', () => {
    const c = pack([{ trigger: 'slot:code', target: 'hype', op: 'add', value: 3 }]);
    expect(resolve({ code: 'a' }, ctx(c)).hype).toBe(3);
    expect(resolve({ design: 'a' }, ctx(c)).hype).toBe(0);
  });
  it('adjacent: applies only beside a worker with the tag', () => {
    const c = pack([{ trigger: 'adjacent:artist', target: 'output', op: 'add', value: 2 }]);
    expect(resolve({ design: 'a', art: 'b' }, ctx(c)).quality).toBe((2 + 2) * 2 + 3); // beside B
    expect(resolve({ code: 'a', art: 'b' }, ctx(c)).quality).toBe(4 + 3);            // not adjacent
  });
  it('phase: applies only in that phase', () => {
    const c = pack([{ trigger: 'phase:polish', target: 'bugs', op: 'add', value: 5 }]);
    expect(resolve({ code: 'a' }, ctx(c, 'polish')).bugs).toBe(6);
    expect(resolve({ code: 'a' }, ctx(c, 'prototype')).bugs).toBe(1);
  });
  it('adds apply before muls, whatever the list order', () => {
    const c = pack([
      { trigger: 'always', target: 'bugs', op: 'mul', value: 0.5 },
      { trigger: 'always', target: 'bugs', op: 'add', value: 3 },
    ]);
    expect(resolve({ code: 'a' }, ctx(c)).bugs).toBe(2); // (1 + 3) * 0.5
  });
  it('contributions add up to the totals', () => {
    const c = ContentPack.parse(raw);
    const board: Board = { code: 'ada', design: 'mo', art: 'rin', audio: 'kai' };
    const t = resolve(board, { content: c, genreId: 'rpg', phaseId: 'production', trendId: 'indie_darling' });
    const sum = (m: string) => t.contributions.filter((x) => x.metric === m).reduce((s, x) => s + x.delta, 0);
    expect(sum('quality')).toBeCloseTo(t.quality);
    expect(sum('hype')).toBeCloseTo(t.hype);
    expect(sum('bugs')).toBeCloseTo(t.bugs);
  });
});

describe('run', () => {
  const c = ContentPack.parse(raw);
  /** Plays commands, answering any event with choice 0 so scripted runs never stall. */
  const play = (seed: number, cmds: ((s: RunState) => Command)[]) => cmds.reduce<RunState>((s, f) => {
    if (s.event) s = apply(s, { type: 'chooseEvent', choice: 0 }, c)[0];
    return apply(s, f(s), c)[0];
  }, newRun(seed, c));
  const project = (): ((s: RunState) => Command)[] => [(s) => pitchCmd(s), () => ({ type: 'endPhase' }), () => ({ type: 'endPhase' }), () => ({ type: 'endPhase' }), () => ({ type: 'skipDraft' })];

  it('same seed + commands replays identically', () => {
    const cmds = [...project(), ...project()];
    expect(play(42, cmds)).toEqual(play(42, cmds));
  });

  it('a project runs three phases then releases with a review and its reasons', () => {
    let s = newRun(7, c);
    s = apply(s, pitchCmd(s), c)[0];
    c.departments.forEach((d, i) => { s = apply(s, { type: 'place', dept: d, workerId: s.roster[i] }, c)[0]; });
    let events: ReturnType<typeof apply>[1] = [];
    for (let i = 0; i < 3; i++) [s, events] = apply(s, { type: 'endPhase' }, c);
    expect(events.find((e) => e.type === 'released')).toBeDefined();
    expect(s.project).toBeNull();
    expect(s.week).toBe(1 + 3 + 5 + 2);
    const r = s.releases[0];
    expect(r.review).toBeGreaterThanOrEqual(1);
    expect(r.review).toBeLessThanOrEqual(10);
    expect(r.best.length).toBeGreaterThan(0);
    expect(s.pitch).toHaveLength(3);
  });

  it('only a pitched genre + topic can start', () => {
    const s = newRun(1, c);
    const unpitched = c.topics.find((t) => !s.pitch.some((p) => p.topicId === t.id))!;
    expect(() => apply(s, { type: 'startProject', genreId: s.pitch[0].genreId, topicId: unpitched.id }, c)).toThrow(/not pitched/);
  });

  it('placing a worker moves them out of their old slot', () => {
    let s = newRun(1, c);
    s = apply(s, pitchCmd(s), c)[0];
    const w = s.roster[0];
    s = apply(s, { type: 'place', dept: 'code', workerId: w }, c)[0];
    s = apply(s, { type: 'place', dept: 'art', workerId: w }, c)[0];
    expect(s.board.code).toBeNull();
    expect(s.board.art).toBe(w);
  });

  it('preview equals the real change and does not mutate state', () => {
    let s = newRun(3, c);
    s = apply(s, pitchCmd(s), c)[0];
    const snapshot = JSON.stringify(s);
    const d = preview(s, { type: 'place', dept: 'design', workerId: s.roster[0] }, c)!;
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(d.quality).toBeGreaterThanOrEqual(0);
  });

  it('replays a save (seed + command log) bit-for-bit', () => {
    const log: Command[] = [];
    let s = newRun(9, c);
    const step = (cmd: Command) => { log.push(cmd); s = apply(s, cmd, c)[0]; };
    for (let p = 0; p < 6 && !s.dead && !s.won; p++) {
      step(pitchCmd(s));
      c.departments.forEach((d, i) => step({ type: 'place', dept: d, workerId: s.roster[i] }));
      for (let ph = 0; ph < 3 && !s.dead && !s.won; ph++) {
        if (s.event) step({ type: 'chooseEvent', choice: 0 });
        step({ type: 'endPhase' });
      }
      if (s.event) step({ type: 'chooseEvent', choice: 0 });
      if (s.draft) step({ type: 'skipDraft' });
    }
    expect(s.releases.length).toBeGreaterThan(1);
    const save = JSON.parse(JSON.stringify({ version: 2, seed: 9, commands: log }));
    expect(JSON.stringify(replay(save, c))).toBe(JSON.stringify(s));
  });
});

describe('survival loop (M2)', () => {
  const noop: EffectDef[] = [{ trigger: 'always', target: 'hype', op: 'add', value: 0 }];
  const start = (c: ContentPack) => { const s = newRun(1, c); return apply(s, pitchCmd(s), c)[0]; };

  it('each phase advances its weeks and charges salary + rent weekly into the ledger', () => {
    const c = pack(noop, { economy: { ...ECONOMY, rentPerWeek: 50 } });
    const [s] = apply(start(c), { type: 'endPhase' }, c);
    expect(s.week).toBe(2);
    expect(s.cash).toBe(1000 - 200 - 50);
    expect(s.ledger).toMatchObject({ salary: 200, rent: 50 });
    expect(s.cashHistory).toEqual([1000, 750]);
  });

  it('D-2: a missed Payroll Day is a strike; the third ends the run, not the first', () => {
    const c = pack(noop, { startingCash: 100, phases: [{ id: 'prototype', name: 'P', weeks: 1 }, { id: 'polish', name: 'Q', weeks: 5 }] });
    let [s, ev] = apply(start(c), { type: 'endPhase' }, c);
    expect(s.strikes).toBe(1);
    expect(s.dead).toBe(false);
    expect(ev.some((e) => e.type === 'payrollDay' && e.strike)).toBe(true);
    [s, ev] = apply(s, { type: 'endPhase' }, c);
    expect(s.strikes).toBe(3);
    expect(s.dead).toBe(true);
    expect(s.week).toBe(4); // dies on the third Payroll Day; the rest of the phase never runs
    expect(ev.filter((e) => e.type === 'bankrupt')).toHaveLength(1);
  });

  it('Payroll Day checks the Quarter threshold, not just zero', () => {
    const on = pack(noop, { calendar: { ...CALENDAR, payrollThresholds: [900] } });
    expect(apply(start(on), { type: 'endPhase' }, on)[0].strikes).toBe(1);  // 800 < 900
    const off = pack(noop, { calendar: { ...CALENDAR, payrollThresholds: [700] } });
    expect(apply(start(off), { type: 'endPhase' }, off)[0].strikes).toBe(0);
  });

  it('a release sells from the next week and decays; a higher review sells more', () => {
    const c = pack(noop);
    let s = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
    s = apply(apply(s, { type: 'endPhase' }, c)[0], { type: 'endPhase' }, c)[0];
    const r = s.releases[0];
    const first = launchSales(r, 1, c);
    expect(s.sales[0].next).toBeCloseTo(first);
    s = apply(s, pitchCmd(s), c)[0];
    s = apply(s, { type: 'endPhase' }, c)[0];
    expect(s.ledger.sales).toBe(Math.round(first));
    expect(s.releases[0].revenue).toBe(Math.round(first));
    expect(s.sales[0].next).toBeCloseTo(first * 0.5);
    expect(launchSales({ ...r, review: 8 }, 1, c)).toBeGreaterThan(launchSales({ ...r, review: 4 }, 1, c));
  });

  it('a release offers a hiring draft; hire adds to the roster, startProject clears it', () => {
    const c = pack(noop, { rosterSize: 1 });
    let s = start(c);
    s = apply(apply(s, { type: 'endPhase' }, c)[0], { type: 'endPhase' }, c)[0];
    expect(s.draft).toHaveLength(1);
    const other = s.draft![0];
    expect(s.roster).not.toContain(other);
    const [hired] = apply(s, { type: 'hire', workerId: other }, c);
    expect(hired.roster).toContain(other);
    expect(hired.draft).toBeNull();
    expect(() => apply(s, { type: 'hire', workerId: 'zzz' }, c)).toThrow();
    expect(apply(s, pitchCmd(s), c)[0].draft).toBeNull();
  });

  it('firing pays severance and clears the slot', () => {
    const c = pack(noop);
    let s = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
    s = apply(s, { type: 'fire', workerId: 'a' }, c)[0];
    expect(s.roster).toEqual(['b']);
    expect(s.board.code).toBeNull();
    expect(s.cash).toBe(1000 - 200);
    expect(s.ledger.severance).toBe(200);
    expect(() => apply(s, { type: 'fire', workerId: 'b' }, c)).toThrow(/last/);
  });

  it('burnout: at the threshold a seeded roll gives breakthrough (+quality) or breakdown (bugs, benched)', () => {
    for (const [chance, kind] of [[1, 'breakthrough'], [0, 'breakdown']] as const) {
      const c = pack(noop, { burnout: { perWeekPlaced: 100, recoverPerWeek: 0, threshold: 100, breakthroughChance: chance, breakthroughQuality: 5, breakdownBugs: 5 } });
      const s0 = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
      const [s, ev] = apply(s0, { type: 'endPhase' }, c);
      expect(ev.some((e) => e.type === kind)).toBe(true);
      expect(s.burnout).toEqual({ a: 0, b: 0 });
      if (kind === 'breakdown') {
        expect(s.benched).toEqual(['a']);
        expect(s.board.code).toBeNull();
        expect(() => apply(s, { type: 'place', dept: 'code', workerId: 'a' }, c)).toThrow(/benched/);
        expect(s.project!.bugs).toBe(1 + 5);
      } else {
        expect(s.project!.quality).toBe(4 + 5);
      }
    }
  });

  it('below the burnout threshold nothing rolls', () => {
    const c = pack(noop, { burnout: { perWeekPlaced: 10, recoverPerWeek: 0, threshold: 100, breakthroughChance: 0, breakthroughQuality: 5, breakdownBugs: 5 } });
    const s0 = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
    const [s, ev] = apply(s0, { type: 'endPhase' }, c);
    expect(s.burnout.a).toBe(10);
    expect(ev.some((e) => e.type === 'breakdown')).toBe(false);
  });

  it('surviving the last Era wins and freezes the run', () => {
    const c = pack(noop, { calendar: { ...CALENDAR, quartersPerEra: 1 }, rivals: [{ id: 'r', name: 'R', genre: 'g', targets: [0], twist: NO_TWIST }] });
    let s = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
    // Era 1 ends after one week; with nothing released the showdown is lost (a strike), but the run is won.
    const [after, ev] = apply(s, { type: 'endPhase' }, c);
    s = after;
    expect(s.won).toBe(true);
    expect(ev.some((e) => e.type === 'won')).toBe(true);
    expect(apply(s, { type: 'endPhase' }, c)[0]).toBe(s);
  });

  it('post-mortem ranks the top 3 drains and picks the best project', () => {
    const c = pack(noop);
    let s = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
    s = apply(apply(s, { type: 'endPhase' }, c)[0], { type: 'endPhase' }, c)[0];
    const pm = postMortem(s, c);
    expect(pm.causes[0].label).toBe('Salaries');
    expect(pm.causes.length).toBeLessThanOrEqual(3);
    expect(pm.best).toBe(s.releases[0]);
    expect(pm.cashHistory).toHaveLength(3);
  });
});

describe('market dungeon (M3)', () => {
  const noop: EffectDef[] = [{ trigger: 'always', target: 'hype', op: 'add', value: 0 }];
  const real = ContentPack.parse(raw);
  const start = (c: ContentPack) => { const s = newRun(1, c); return apply(s, pitchCmd(s), c)[0]; };

  it('the market is generated from the seed: same seed same market, different seeds differ', () => {
    expect(generateMarket(5, real)).toEqual(generateMarket(5, real));
    const a = JSON.stringify(generateMarket(5, real).quarters.map((q) => q.demand));
    const b = JSON.stringify(generateMarket(6, real).quarters.map((q) => q.demand));
    expect(a).not.toBe(b);
    const m = generateMarket(5, real);
    expect(m.quarters).toHaveLength(12);
    expect(new Set(m.rivals).size).toBe(3);
    for (const q of m.quarters) for (const d of Object.values(q.demand)) { expect(d).toBeGreaterThanOrEqual(0.4); expect(d).toBeLessThanOrEqual(1.8); }
  });

  it('demand = genre x topic fit x platform x trend x share', () => {
    const c = pack(noop, { topics: [{ id: 't', name: 'T', fit: { g: 1.5 } }], platforms: [{ id: 'p', name: 'P', curve: [2] }] });
    const s = newRun(1, c);
    expect(demandFor(s, { genreId: 'g', topicId: 't' }, c)).toBeCloseTo(3);
    expect(demandFor({ ...s, share: 0.5 }, { genreId: 'g', topicId: 't' }, c)).toBeCloseTo(1.5);
  });

  it('a scheduled rival release steals its genre demand that Quarter', () => {
    const on = pack(noop, { market: { ...MARKET, rivalEveryQuarters: 1 } });
    const s = apply(start(on), { type: 'endPhase' }, on)[0]; // Quarter 2 starts; rival r releases in g
    expect(s.demand.g).toBeCloseTo(0.5);
    const off = pack(noop);
    expect(apply(start(off), { type: 'endPhase' }, off)[0].demand.g).toBe(1);
  });

  it('rivals copy a hit: a rival chasing another genre switches to yours', () => {
    const c = pack(noop, {
      genres: [{ id: 'g', name: 'G', weights: { code: 5, design: 2, art: 1, audio: 1 } }, { id: 'h', name: 'H', weights: { code: 1, design: 1, art: 1, audio: 1 } }],
      rivals: [{ id: 'r', name: 'R', genre: 'h', targets: [5], twist: NO_TWIST }],
    });
    let s = newRun(1, c);
    s = apply({ ...s, pitch: [{ genreId: 'g', topicId: 't' }] }, { type: 'startProject', genreId: 'g', topicId: 't' }, c)[0];
    s = apply(s, { type: 'place', dept: 'code', workerId: 'a' }, c)[0]; // quality 20 vs expectation 10: review 10
    s = apply(apply(s, { type: 'endPhase' }, c)[0], { type: 'endPhase' }, c)[0];
    expect(s.releases[0].review).toBeGreaterThanOrEqual(7);
    expect(s.rivalGenres.r).toBe('g');
    expect(s.expectation).toBe(15); // the bar rose by expectationRise after the hit
  });

  it('expectation is capped (snowball guard) and a flop does not raise it', () => {
    const c = pack(noop, { genres: [{ id: 'g', name: 'G', weights: { code: 5, design: 2, art: 1, audio: 1 } }] });
    let s = { ...start(c), expectation: 18 };
    s = apply(s, { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
    s = apply(apply(s, { type: 'endPhase' }, c)[0], { type: 'endPhase' }, c)[0];
    expect(s.expectation).toBe(20);
    const flop = pack(noop);
    const f = apply(apply(start(flop), { type: 'endPhase' }, flop)[0], { type: 'endPhase' }, flop)[0];
    expect(f.releases[0].review).toBeLessThan(7);
    expect(f.expectation).toBe(10);
  });

  it('Rival Showdown: your best release this Era, under the twist, must beat the target (D-4)', () => {
    const era = { ...CALENDAR, quartersPerEra: 3, eras: 2 };
    const run = (target: number, twist: object) => {
      const c = pack(noop, { calendar: era, rivals: [{ id: 'r', name: 'R', genre: 'g', targets: [target], twist: { text: '', ...twist } }] });
      let s = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
      s = apply(apply(s, { type: 'endPhase' }, c)[0], { type: 'endPhase' }, c)[0]; // released week 3, Era ends week 4
      s = apply(s, pitchCmd(s), c)[0];
      return apply(s, { type: 'endPhase' }, c);
    };
    // A placed for both phases: quality 8, bugs 2, expectation 10 -> plain review 8 - 1 = 7
    const [win, ev] = run(6, {});
    expect(ev.find((e) => e.type === 'showdown')).toMatchObject({ showdown: { yours: 7, target: 6, won: true } });
    expect(win.share).toBeCloseTo(1.2);
    expect(win.strikes).toBe(0);
    const [lose] = run(6, { bugPenaltyMul: 3 }); // twist: 8 - 3 = 5 < 6
    expect(lose.showdowns[0]).toMatchObject({ yours: 5, won: false });
    expect(lose.share).toBeCloseTo(0.8);
    expect(lose.strikes).toBe(1);
  });

  it('market share from showdowns is capped at shareMax', () => {
    expect(twistedReview({ quality: 10, hype: 0, bugs: 0, expectation: 10 }, pack(noop))).toBe(10);
    const capped = pack(noop, { calendar: { ...CALENDAR, quartersPerEra: 2, eras: 2 }, market: { ...MARKET, shareWin: 2 }, rivals: [{ id: 'r', name: 'R', genre: 'g', targets: [0], twist: NO_TWIST }] });
    let s = { ...start(capped), share: 1.4 };
    s = apply(s, { type: 'place', dept: 'code', workerId: 'a' }, capped)[0];
    s = apply(apply(s, { type: 'endPhase' }, capped)[0], { type: 'endPhase' }, capped)[0]; // ships in the Era's last week
    expect(s.showdowns[0].won).toBe(true);
    expect(s.share).toBe(1.5);
  });

  it('events: drawn at a new Quarter, block other commands, and apply the chosen effects', () => {
    const c = pack(noop, { market: { ...MARKET, eventChance: 1 } });
    const [s] = apply(start(c), { type: 'endPhase' }, c);
    expect(s.event).toBe('e');
    expect(() => apply(s, { type: 'endPhase' }, c)).toThrow(/event/);
    const [cash] = apply(s, { type: 'chooseEvent', choice: 0 }, c);
    expect(cash.cash).toBe(s.cash + 50);
    expect(cash.ledger.events).toBe(50);
    expect(cash.event).toBeNull();
    const [hype] = apply(s, { type: 'chooseEvent', choice: 1 }, c);
    expect(hype.project!.hype).toBe(s.project!.hype + 3);
    const off = pack(noop);
    expect(apply(start(off), { type: 'endPhase' }, off)[0].event).toBeNull();
  });

  it('event hype with no project running carries into the next project', () => {
    const c = pack(noop, { market: { ...MARKET, eventChance: 1 } });
    let s = apply(apply(start(c), { type: 'endPhase' }, c)[0], { type: 'chooseEvent', choice: 0 }, c)[0];
    s = apply(s, { type: 'endPhase' }, c)[0]; // releases; a new event is drawn
    s = apply(s, { type: 'chooseEvent', choice: 1 }, c)[0];
    expect(s.carry.hype).toBe(3);
    s = apply(s, pitchCmd(s), c)[0];
    expect(s.project!.hype).toBe(3);
    expect(s.carry.hype).toBe(0);
  });

  it('the forecast shows direction only, and which rivals are due', () => {
    const m = generateMarket(3, real);
    const f = forecast(m, 0, real)!;
    for (const g of real.genres) expect(['up', 'flat', 'down']).toContain(f.genres[g.id]);
    expect(f.rivals.length).toBeGreaterThan(0);
    expect(forecast(m, 11, real)).toBeNull();
  });
});
