import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack, type EffectDef } from '../data/schemas';
import { resolve, type Board } from './resolver';
import { apply, newRun, preview, type Command, type RunState } from './run';

/** Tiny fixed pack: tests stay valid whatever the real balance numbers become. */
function pack(effects: EffectDef[], extra: Partial<ContentPack> = {}): ContentPack {
  return ContentPack.parse({
    departments: ['code', 'design', 'art', 'audio'],
    phases: [{ id: 'prototype', name: 'Prototype', weeks: 1 }, { id: 'polish', name: 'Polish', weeks: 1 }],
    rosterSize: 2,
    startingCash: 1000,
    review: { expectation: 10, bugPenalty: 0.5, min: 1, max: 10 },
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

  it('goes bankrupt when payroll exceeds cash', () => {
    const tiny = ContentPack.parse({ ...(raw as object), startingCash: 100 });
    let s = apply(newRun(1, tiny), { type: 'startProject', genreId: 'rpg' }, tiny)[0];
    const [next, events] = apply(s, { type: 'endPhase' }, tiny);
    s = next;
    expect(s.dead).toBe(true);
    expect(events.some((e) => e.type === 'bankrupt')).toBe(true);
  });
});
