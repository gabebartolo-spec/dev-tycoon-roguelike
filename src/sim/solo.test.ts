import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack } from '../data/schemas';
import { defaultOptions, runContent, type RunOptions } from './meta';
import { apply, newRun, phaseWeeks, type Command, type RunState } from './run';

// Solo dev build (approved 2026-11-13): wearing every hat, Long Tail, Bedroom studio.
const base = ContentPack.parse(raw);
const opts: RunOptions = { studio: 'bedroom', crunch: 0, unlocks: ['solo_dev'] };
const solo = runContent(base, opts);
const ALL = { code: 'auteur', design: 'auteur', art: 'auteur', audio: 'auteur' };

/** Apply a command, answering any pending event with its first choice first. */
function step(s: RunState, cmd: Command, c = solo): RunState {
  let t = s;
  while (t.event) t = apply(t, { type: 'chooseEvent', choice: 0 }, c)[0];
  return apply(t, cmd, c)[0];
}

/** Ship one project with the given board (dept -> worker) placed every phase. */
function ship(s0: RunState, board: Record<string, string>, c = solo): RunState {
  let s = step(s0, { type: 'startProject', ...s0.pitch[0] }, c);
  for (let p = 0; p < c.phases.length; p++) {
    for (const [dept, w] of Object.entries(board)) if (!s.benched.includes(w)) s = step(s, { type: 'place', dept: dept as never, workerId: w }, c);
    s = step(s, { type: 'endPhase' }, c);
  }
  return s;
}

describe('solo dev: content is gated', () => {
  it('the default pack has no solo cards or solo events', () => {
    const plain = runContent(base, defaultOptions(base));
    expect(plain.workers.some((w) => w.tags.includes('solo'))).toBe(false);
    expect(plain.events.map((e) => e.id)).not.toContain('seventy_hour_weeks');
  });
  it('Bedroom: you start alone with The Auteur, no rent and $20k less cash', () => {
    const s = newRun(3, solo, opts);
    expect(s.roster).toEqual(['auteur']);
    expect(s.cash).toBe(base.startingCash - 20000);
    expect(solo.economy.rentPerWeek).toBe(0);
  });
});

describe('solo dev: wearing every hat', () => {
  it('on: a solo card holds all four desks and each extra desk adds a week to the phase', () => {
    let s = step(newRun(3, solo, opts), { type: 'startProject', ...newRun(3, solo, opts).pitch[0] });
    for (const [d, w] of Object.entries(ALL)) s = step(s, { type: 'place', dept: d as never, workerId: w });
    expect(Object.values(s.board)).toEqual(['auteur', 'auteur', 'auteur', 'auteur']);
    expect(phaseWeeks(s, solo)).toBe(solo.phases[0].weeks + 3);
    const week = s.week;
    s = step(s, { type: 'endPhase' });
    expect(s.week).toBe(week + solo.phases[0].weeks + 3);
    expect(s.burnout.auteur).toBe(solo.burnout.perWeekPlaced * (solo.phases[0].weeks + 3));
  });
  it('off: weeksPerHat 0 keeps the base phase length', () => {
    const c = { ...solo, solo: { ...solo.solo, weeksPerHat: 0 } };
    let s = step(newRun(3, c, opts), { type: 'startProject', ...newRun(3, c, opts).pitch[0] }, c);
    for (const [d, w] of Object.entries(ALL)) s = step(s, { type: 'place', dept: d as never, workerId: w }, c);
    expect(phaseWeeks(s, c)).toBe(c.phases[0].weeks);
  });
  it('off: a card without the solo tag still moves desk instead of doubling up', () => {
    const s0 = { ...newRun(3, solo, opts), roster: ['auteur', 'contract_artist'] };
    let s = step(s0, { type: 'startProject', ...s0.pitch[0] });
    s = step(s, { type: 'place', dept: 'art', workerId: 'contract_artist' });
    s = step(s, { type: 'place', dept: 'code', workerId: 'contract_artist' });
    expect(s.board.art).toBeNull();
    expect(s.board.code).toBe('contract_artist');
    expect(phaseWeeks(s, solo)).toBe(solo.phases[0].weeks);
  });
});

describe('solo dev: Long Tail', () => {
  it('on: a game made only by solo cards sells with the slower decay', () => {
    const s = ship(newRun(3, solo, opts), ALL);
    const sale = s.sales.find((x) => x.release === 0)!;
    expect(sale.decay).toBe(0.92);
  });
  it('off: one non-solo card on the board ends it for that game', () => {
    const s0 = { ...newRun(3, solo, opts), roster: ['auteur', 'contract_artist'], burnout: { auteur: 0, contract_artist: 0 } };
    const s = ship(s0, { code: 'auteur', design: 'auteur', art: 'contract_artist', audio: 'auteur' });
    expect(s.sales.find((x) => x.release === 0)?.decay).toBeUndefined();
  });
  it('on: the slower decay is what the next week pays', () => {
    let s = ship(newRun(3, solo, opts), ALL);
    const before = s.sales.find((x) => x.release === 0)!.next;
    s = step(s, { type: 'startProject', ...s.pitch[0] });
    const weeks = phaseWeeks(s, solo); // the board carries over, so the hats (and their weeks) do too
    s = step(s, { type: 'endPhase' });
    expect(s.sales.find((x) => x.release === 0)!.next).toBeCloseTo(before * 0.92 ** weeks, 5);
  });
});
