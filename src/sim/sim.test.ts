import { describe, expect, it } from 'vitest';
import raw from '../data/content.json';
import { ContentPack } from '../data/schemas';
import { resolve } from './resolver';
import { apply, newRun, type Command } from './run';

const content = ContentPack.parse(raw);

describe('resolver', () => {
  it('Spaghetti Coder adds code and bugs', () => {
    const t = resolve({ code: 'ada', design: null, art: null, sound: null }, content);
    expect(t.code).toBe(7);
    expect(t.bugs).toBe(2);
  });

  it('UI Wizard multiplies hype only in the design slot (synergy on vs off)', () => {
    expect(resolve({ code: null, design: 'mo', art: null, sound: null }, content).hype).toBe(3);
    expect(resolve({ code: 'mo', design: null, art: null, sound: null }, content).hype).toBe(2);
  });

  it('applies adds before muls', () => {
    // Rin: base bugs 1, Perfectionist halves; Ada adds 2 -> (1 + 2) * 0.5
    const t = resolve({ code: 'ada', design: null, art: 'rin', sound: null }, content);
    expect(t.bugs).toBe(1.5);
  });
});

describe('run', () => {
  it('same seed + commands replays identically', () => {
    const cmds: Command[] = [{ type: 'place', dept: 'code', workerId: 'ada' }, { type: 'endWeek' }, { type: 'endWeek' }];
    const play = () => cmds.reduce((s, c) => apply(s, c, content)[0], newRun(42, content));
    expect(play()).toEqual(play());
  });

  it('goes bankrupt when payroll exceeds cash', () => {
    let s = newRun(1, content);
    for (const [dept, id] of [['code', 'ada'], ['design', 'mo'], ['art', 'rin']] as const)
      s = apply(s, { type: 'place', dept, workerId: id }, content)[0];
    let events: ReturnType<typeof apply>[1] = [];
    while (!s.dead) [s, events] = apply(s, { type: 'endWeek' }, content);
    expect(events.some((e) => e.type === 'bankrupt')).toBe(true);
    expect(s.week).toBe(6); // 10000 / 2400 per week -> broke after week 5
  });
});
