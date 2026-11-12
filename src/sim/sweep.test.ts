import { describe, expect, it } from 'vitest';
import { content } from '../data/load'; // the default run pack (locked content removed)
import { playBot } from './bot';

const SEEDS = Number(import.meta.env.SWEEP ?? 0); // vitest copies process.env into import.meta.env

describe('bot', () => {
  it('a bot run ends (win or bankruptcy) and is deterministic', () => {
    const a = playBot(11, content);
    expect(a.dead || a.won).toBe(true);
    expect(playBot(11, content)).toEqual(a);
  });
});

/** Balance sweep: `SWEEP=1000 npx vitest run sweep`. Groups seeds by type (Era 1 boss, Era 1 platform). */
describe.skipIf(!SEEDS)('sweep', () => {
  it(`win rates over ${SEEDS} seeds`, () => {
    const groups = new Map<string, { n: number; wins: number }>();
    const ends: number[] = [];
    let wins = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const s = playBot(seed, content);
      ends.push(s.week);
      if (s.won) wins++;
      for (const key of [`boss:${s.market.rivals[0]}`, `platform:${s.market.platforms[0]}`]) {
        const g = groups.get(key) ?? { n: 0, wins: 0 };
        groups.set(key, { n: g.n + 1, wins: g.wins + (s.won ? 1 : 0) });
      }
    }
    ends.sort((a, b) => a - b);
    const lines = [...groups].sort().map(([k, g]) => `${k.padEnd(22)} ${String(g.n).padStart(4)} seeds  ${((100 * g.wins) / g.n).toFixed(1)}% win`);
    console.log(`overall ${((100 * wins) / SEEDS).toFixed(1)}% win, median end week ${ends[ends.length >> 1]}\n${lines.join('\n')}`);
    for (const g of groups.values()) {
      expect(g.wins / g.n).toBeLessThanOrEqual(0.9);
      expect(g.wins / g.n).toBeGreaterThanOrEqual(0.05);
    }
  });
});
