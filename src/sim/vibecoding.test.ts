import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack } from '../data/schemas';
import { defaultOptions, runContent, type RunOptions } from './meta';
import { apply, newRun, phaseTotals, withModels, type Command, type RunState } from './run';

// Vibecoding build (approved 2026-11-13): AI cards, tech debt, New Model Drops, Weekend Project studio.
const base = ContentPack.parse(raw);
const opts: RunOptions = { studio: 'weekend_project', crunch: 0, unlocks: ['vibecoding'] };
const vibe = runContent(base, opts);
const AI_IDS = ['autocomplete', 'coding_agent', 'image_model'];

/** Apply a command, answering any pending event with its first choice first. */
function step(s: RunState, cmd: Command, c = vibe): RunState {
  let t = s;
  while (t.event) t = apply(t, { type: 'chooseEvent', choice: 0 }, c)[0];
  return apply(t, cmd, c)[0];
}

/** Ship one project with the given board (dept -> worker) held for every phase. */
function ship(s0: RunState, board: Record<string, string>, c = vibe): RunState {
  let s = step(s0, { type: 'startProject', ...s0.pitch[0] }, c);
  for (let p = 0; p < c.phases.length; p++) {
    for (const [dept, w] of Object.entries(board)) if (!s.benched.includes(w)) s = step(s, { type: 'place', dept: dept as never, workerId: w }, c);
    s = step(s, { type: 'endPhase' }, c);
  }
  return s;
}

describe('vibecoding: content is gated', () => {
  it('the default pack has no AI cards, vibecoding events or Weekend Project start', () => {
    const plain = runContent(base, defaultOptions(base));
    expect(plain.workers.some((w) => w.tags.includes('ai'))).toBe(false);
    expect(plain.events.map((e) => e.id)).not.toContain('agent_deleted_prod');
    expect(plain.startWorkers).toEqual([]);
  });
  it('the unlock adds the cards and events; Weekend Project starts with a Coding Agent, -$10k and a shorter Prototype', () => {
    expect(vibe.workers.map((w) => w.id)).toEqual(expect.arrayContaining(AI_IDS));
    expect(vibe.events.map((e) => e.id)).toContain('vibe_jam');
    const s = newRun(5, vibe, opts);
    expect(s.roster[0]).toBe('coding_agent');
    expect(s.roster).toHaveLength(vibe.rosterSize);
    expect(new Set(s.roster).size).toBe(s.roster.length);
    expect(s.cash).toBe(base.startingCash - 10000);
    expect(vibe.phases[0].weeks).toBe(base.phases[0].weeks - 1);
  });
});

describe('vibecoding: AI cards never burn out', () => {
  it('on: a placed AI card stays at 0 while a placed human gains burnout', () => {
    let s = newRun(5, vibe, opts);
    const human = s.roster.find((id) => !AI_IDS.includes(id))!;
    s = step(s, { type: 'startProject', ...s.pitch[0] });
    s = step(s, { type: 'place', dept: 'code', workerId: 'coding_agent' });
    s = step(s, { type: 'place', dept: 'design', workerId: human });
    s = step(s, { type: 'endPhase' });
    expect(s.burnout.coding_agent).toBe(0);
    expect(s.burnout[human]).toBeGreaterThan(0);
  });
  it('off: the same card without the AI tag rule burns out like anyone', () => {
    const c = { ...vibe, ai: { ...vibe.ai, tag: 'not-a-tag' } };
    let s = newRun(5, c, opts);
    s = step(s, { type: 'startProject', ...s.pitch[0] }, c);
    s = step(s, { type: 'place', dept: 'code', workerId: 'coding_agent' }, c);
    s = step(s, { type: 'endPhase' }, c);
    expect(s.burnout.coding_agent).toBeGreaterThan(0);
  });
});

describe('vibecoding: tech debt', () => {
  it('on: a game an AI card worked on hands 15% of its bugs to the next game', () => {
    const s = ship(newRun(5, vibe, opts), { code: 'coding_agent' });
    const shipped = s.releases[0];
    expect(shipped.bugs).toBeGreaterThan(0);
    expect(s.carry.debt).toBeCloseTo(Math.round(shipped.bugs * 0.15 * 10) / 10, 5);
    const next = step(s, { type: 'startProject', ...s.pitch[0] });
    expect(next.project!.contributions).toContainEqual({ source: 'Tech debt', metric: 'bugs', delta: s.carry.debt });
    expect(next.project!.bugs).toBeCloseTo(s.carry.bugs + s.carry.debt!, 5);
    expect(next.carry.debt).toBeUndefined();
  });
  it('off: a game with no AI card on the board leaves no debt', () => {
    const s0 = newRun(5, vibe, opts);
    const human = s0.roster.find((id) => !AI_IDS.includes(id))!;
    const s = ship(s0, { code: human });
    expect(s.carry.debt ?? 0).toBe(0);
  });
  it('off: debt 0 leaves no debt even with AI cards', () => {
    const c = { ...vibe, ai: { ...vibe.ai, debt: 0 } };
    const s = ship(newRun(5, c, opts), { code: 'coding_agent' }, c);
    expect(s.carry.debt ?? 0).toBe(0);
  });
});

describe('vibecoding: New Model Drops', () => {
  const wpe = vibe.calendar.weeksPerQuarter * vibe.calendar.quartersPerEra;
  const card = (c: typeof vibe, id: string) => c.workers.find((w) => w.id === id)!;
  it('on: AI cards gain +1 best stat and +$20/wk per Era; humans are untouched', () => {
    expect(withModels(vibe, 1)).toBe(vibe); // Era 1: unchanged
    const era2 = withModels(vibe, 1 + wpe);
    const era3 = withModels(vibe, 1 + 2 * wpe);
    expect(card(era2, 'coding_agent').stats.code).toBe(8);
    expect(card(era3, 'coding_agent').stats.code).toBe(9);
    expect(card(era3, 'image_model').stats.art).toBe(7);
    expect(card(era2, 'coding_agent').salary).toBe(120);
    expect(card(era3, 'grumpy_senior')).toEqual(card(vibe, 'grumpy_senior'));
  });
  it('on: the boost reaches the board through phaseTotals', () => {
    let s = newRun(5, vibe, opts);
    s = step(s, { type: 'startProject', ...s.pitch[0] });
    s = step(s, { type: 'place', dept: 'code', workerId: 'coding_agent' });
    const now = phaseTotals(s, vibe)!.quality;
    const later = phaseTotals({ ...s, week: 1 + wpe }, vibe)!.quality;
    expect(later).toBeGreaterThan(now);
  });
  it('off: statPerEra and salaryPerEra 0 leave the cards as written', () => {
    const c = { ...vibe, ai: { ...vibe.ai, statPerEra: 0, salaryPerEra: 0 } };
    expect(withModels(c, 1 + 2 * wpe)).toBe(c);
  });
});
