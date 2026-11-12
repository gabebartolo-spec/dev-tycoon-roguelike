import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack, type EffectDef } from '../data/schemas';
import { resolve, type Board } from './resolver';
import { apply, launchSales, newRun, postMortem, preview, replay, type Command, type RunState } from './run';

const ECONOMY = { rentPerWeek: 0, payrollEveryWeeks: 1, debtStrikes: 3, winWeek: 1000, weeksPerQuarter: 13, severanceWeeks: 2, rosterMax: 3, draftSize: 3 };

/** Tiny fixed pack: tests stay valid whatever the real balance numbers become. */
function pack(effects: EffectDef[], extra: Partial<ContentPack> = {}): ContentPack {
  return ContentPack.parse({
    departments: ['code', 'design', 'art', 'audio'],
    phases: [{ id: 'prototype', name: 'Prototype', weeks: 1 }, { id: 'polish', name: 'Polish', weeks: 1 }],
    rosterSize: 2,
    startingCash: 1000,
    review: { expectation: 10, bugPenalty: 0.5, min: 1, max: 10 },
    economy: ECONOMY,
    sales: { basePerWeek: 100, hypeScale: 10, reviewExp: 1, decay: 0.5, minWeekly: 10 },
    burnout: { perWeekPlaced: 0, recoverPerWeek: 0, threshold: 100, breakthroughChance: 0.5, breakthroughQuality: 5, breakdownBugs: 5 },
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

describe('content', () => {
  it('real content pack validates', () => {
    const c = ContentPack.parse(raw);
    expect(c.workers).toHaveLength(12);
    expect(c.traits).toHaveLength(16);
    expect(c.genres).toHaveLength(4);
  });
  it('rejects a worker with an unknown trait', () => {
    const bad = { ...(raw as object), workers: [{ ...(raw as { workers: object[] }).workers[0], traits: ['nope'] }] };
    expect(() => ContentPack.parse(bad)).toThrow(/unknown trait/);
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
  const play = (seed: number, cmds: Command[]) => cmds.reduce<RunState>((s, cmd) => apply(s, cmd, c)[0], newRun(seed, c));

  it('same seed + commands replays identically', () => {
    const s0 = newRun(42, c);
    const cmds: Command[] = [
      { type: 'startProject', genreId: 'rpg' },
      { type: 'place', dept: 'code', workerId: s0.roster[0] },
      { type: 'endPhase' }, { type: 'endPhase' }, { type: 'endPhase' },
    ];
    expect(play(42, cmds)).toEqual(play(42, cmds));
  });

  it('a project runs three phases then releases with a review and its reasons', () => {
    let s = newRun(7, c);
    s = apply(s, { type: 'startProject', genreId: 'action' }, c)[0];
    c.departments.forEach((d, i) => { s = apply(s, { type: 'place', dept: d, workerId: s.roster[i] }, c)[0]; });
    let events: ReturnType<typeof apply>[1] = [];
    for (let i = 0; i < 3; i++) [s, events] = apply(s, { type: 'endPhase' }, c);
    const rel = events.find((e) => e.type === 'released');
    expect(rel).toBeDefined();
    expect(s.project).toBeNull();
    expect(s.week).toBe(1 + 3 + 5 + 2);
    const r = s.releases[0];
    expect(r.review).toBeGreaterThanOrEqual(1);
    expect(r.review).toBeLessThanOrEqual(10);
    expect(r.best.length).toBeGreaterThan(0);
  });

  it('placing a worker moves them out of their old slot', () => {
    let s = apply(newRun(1, c), { type: 'startProject', genreId: 'rpg' }, c)[0];
    const w = s.roster[0];
    s = apply(s, { type: 'place', dept: 'code', workerId: w }, c)[0];
    s = apply(s, { type: 'place', dept: 'art', workerId: w }, c)[0];
    expect(s.board.code).toBeNull();
    expect(s.board.art).toBe(w);
  });

  it('preview equals the real change and does not mutate state', () => {
    const s = apply(newRun(3, c), { type: 'startProject', genreId: 'puzzle' }, c)[0];
    const snapshot = JSON.stringify(s);
    const d = preview(s, { type: 'place', dept: 'design', workerId: s.roster[0] }, c)!;
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(d.quality).toBeGreaterThanOrEqual(0);
  });

  it('replays a save (seed + command log) bit-for-bit', () => {
    const s0 = newRun(9, c);
    const cmds: Command[] = [{ type: 'startProject', genreId: 'rpg' }];
    c.departments.forEach((d, i) => cmds.push({ type: 'place', dept: d, workerId: s0.roster[i] }));
    for (let p = 0; p < 4; p++) cmds.push({ type: 'endPhase' }, { type: 'endPhase' }, { type: 'endPhase' }, { type: 'skipDraft' }, { type: 'startProject', genreId: 'action' });
    const live = play(9, cmds);
    expect(live.releases.length).toBeGreaterThan(1);
    const save = JSON.parse(JSON.stringify({ version: 1, seed: 9, commands: cmds }));
    expect(JSON.stringify(replay(save, c))).toBe(JSON.stringify(live));
  });
});

describe('survival loop (M2)', () => {
  const noop: EffectDef[] = [{ trigger: 'always', target: 'hype', op: 'add', value: 0 }];
  const start = (c: ContentPack) => apply(newRun(1, c), { type: 'startProject', genreId: 'g' }, c)[0];

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

  it('no strike when cash is non-negative on Payroll Day', () => {
    const c = pack(noop);
    expect(apply(start(c), { type: 'endPhase' }, c)[0].strikes).toBe(0);
  });

  it('a release sells from the next week and decays; a higher review sells more', () => {
    const c = pack(noop);
    let s = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
    s = apply(apply(s, { type: 'endPhase' }, c)[0], { type: 'endPhase' }, c)[0];
    const r = s.releases[0];
    const first = launchSales(r, 'none', c);
    expect(s.sales[0].next).toBeCloseTo(first);
    s = apply(s, { type: 'startProject', genreId: 'g' }, c)[0];
    s = apply(s, { type: 'endPhase' }, c)[0];
    expect(s.ledger.sales).toBe(Math.round(first));
    expect(s.releases[0].revenue).toBe(Math.round(first));
    expect(s.sales[0].next).toBeCloseTo(first * 0.5);
    expect(launchSales({ ...r, review: 8 }, 'none', c)).toBeGreaterThan(launchSales({ ...r, review: 4 }, 'none', c));
  });

  it('trend demand scales sales for its genre', () => {
    const on = pack(noop, { trends: [{ id: 'none', name: 'N', effects: [], demand: { g: 2 } }] });
    expect(launchSales({ genreId: 'g', hype: 0, review: 5 }, 'none', on)).toBe(100);
    expect(launchSales({ genreId: 'g', hype: 0, review: 5 }, 'none', pack(noop))).toBe(50);
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
    expect(apply(s, { type: 'startProject', genreId: 'g' }, c)[0].draft).toBeNull();
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

  it('below the threshold nothing rolls', () => {
    const c = pack(noop, { burnout: { perWeekPlaced: 10, recoverPerWeek: 0, threshold: 100, breakthroughChance: 0, breakthroughQuality: 5, breakdownBugs: 5 } });
    const s0 = apply(start(c), { type: 'place', dept: 'code', workerId: 'a' }, c)[0];
    const [s, ev] = apply(s0, { type: 'endPhase' }, c);
    expect(s.burnout.a).toBe(10);
    expect(ev.some((e) => e.type === 'breakdown')).toBe(false);
  });

  it('surviving to winWeek wins and freezes the run', () => {
    const c = pack(noop, { economy: { ...ECONOMY, winWeek: 2 } });
    const [s, ev] = apply(start(c), { type: 'endPhase' }, c);
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
