import { create } from 'zustand';
import { baseContent, content, setRunContent } from '../data/load';
import { buy, defaultOptions, optionsFor, parseMeta, recordRun, reputationFor, runContent, type Meta, type RepLine, type RunOptions } from '../sim/meta';
import { apply, newRun, replay, type Command, type RunState, type Save, type SimEvent } from '../sim/run';

interface GameStore {
  state: RunState;
  /** Command log since the run began; with the seed and options it is the mid-run save. */
  log: Command[];
  /** Log lengths at each undoable placement since the phase began; undo never crosses a phase end. */
  undoMarks: { state: RunState; logLen: number }[];
  lastEvents: SimEvent[];
  error: string | null;
  meta: Meta;
  /** meta.json was corrupt or from a newer build and was reset: tell the player once. */
  metaRecovered: boolean;
  /** Studio Hub open (between runs). */
  hub: boolean;
  /** Reputation the last finished run earned, line by line. */
  lastRep: { total: number; lines: RepLine[] } | null;
  dispatch: (cmd: Command) => void;
  undo: () => void;
  openHub: () => void;
  buyUnlock: (id: string) => void;
  startRun: (studio: string, crunch: number, seed?: number) => void;
}

const SAVE_KEY = 'dtr.save.v3';
const META_KEY = 'dtr.meta';
const freshSeed = () => Math.floor(Math.random() * 2 ** 31); // UI-only: picks a seed, the sim itself never calls random

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage off: still plays */ } };

function persist(seed: number, options: RunOptions, log: Command[]) {
  write(SAVE_KEY, JSON.stringify({ version: 3, seed, options, commands: log } satisfies Save));
}

function begin(seed: number, options: RunOptions): RunState {
  const c = runContent(baseContent, options);
  setRunContent(c);
  return newRun(seed, c, options);
}

/** Resume the saved run, or (no save, or it is over) open the Hub on a fresh default run. */
function load(): { state: RunState; log: Command[]; hub: boolean } {
  try {
    const save = JSON.parse(read(SAVE_KEY) ?? 'null') as Save | null;
    if (save?.version === 3) {
      const state = replay(save, baseContent);
      setRunContent(runContent(baseContent, save.options));
      if (!state.dead && !state.won) return { state, log: save.commands, hub: false };
    }
  } catch { /* corrupt or old save: start fresh */ }
  return { state: begin(freshSeed(), defaultOptions(baseContent)), log: [], hub: true };
}

const loadedMeta = parseMeta(read(META_KEY));

export const useGame = create<GameStore>((set, get) => ({
  ...load(),
  undoMarks: [],
  lastEvents: [],
  error: null,
  meta: loadedMeta.meta,
  metaRecovered: loadedMeta.recovered,
  lastRep: null,
  dispatch: (cmd) => {
    const { state, log, undoMarks, meta } = get();
    try {

      const [next, events] = apply(state, cmd, content); // the run's pack, set at run start
      const nextLog = [...log, cmd];
      persist(next.seed, next.options, nextLog);
      const ended = (next.dead || next.won) && !(state.dead || state.won);
      const nextMeta = ended ? recordRun(meta, next, baseContent) : meta;
      if (ended) write(META_KEY, JSON.stringify(nextMeta));
      set({
        state: next, log: nextLog, lastEvents: events, error: null, meta: nextMeta,
        lastRep: ended ? reputationFor(next, baseContent) : get().lastRep,
        undoMarks: cmd.type === 'place' ? [...undoMarks, { state, logLen: log.length }] : [],
      });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  undo: () => {
    const { undoMarks, log } = get();
    const mark = undoMarks[undoMarks.length - 1];
    if (!mark) return;
    const nextLog = log.slice(0, mark.logLen);
    persist(mark.state.seed, mark.state.options, nextLog);
    set({ state: mark.state, log: nextLog, undoMarks: undoMarks.slice(0, -1), lastEvents: [] });
  },
  openHub: () => set({ hub: true, error: null }),
  buyUnlock: (id) => {
    try {
      const meta = buy(get().meta, id, baseContent);
      write(META_KEY, JSON.stringify(meta));
      set({ meta, error: null });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  startRun: (studio, crunch, seed = freshSeed()) => {
    try {
      const options = optionsFor(get().meta, studio, crunch, baseContent);
      persist(seed, options, []);
      set({ state: begin(seed, options), log: [], undoMarks: [], lastEvents: [], error: null, hub: false, metaRecovered: false });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));
