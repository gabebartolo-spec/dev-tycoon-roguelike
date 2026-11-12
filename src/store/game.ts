import { create } from 'zustand';
import { content } from '../data/load';
import { apply, newRun, replay, type Command, type RunState, type Save, type SimEvent } from '../sim/run';

interface GameStore {
  state: RunState;
  /** Command log since the run began; with the seed it is the mid-run save. */
  log: Command[];
  /** Log lengths at each undoable placement since the phase began; undo never crosses a phase end. */
  undoMarks: { state: RunState; logLen: number }[];
  lastEvents: SimEvent[];
  error: string | null;
  dispatch: (cmd: Command) => void;
  undo: () => void;
  newGame: (seed?: number) => void;
}

const SAVE_KEY = 'dtr.save.v2';
const freshSeed = () => Math.floor(Math.random() * 2 ** 31); // UI-only: picks a seed, the sim itself never calls random

function persist(seed: number, log: Command[]) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, seed, commands: log } satisfies Save)); } catch { /* storage off: run still plays */ }
}

function load(): { state: RunState; log: Command[] } {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as Save | null;
    if (save?.version === 2) return { state: replay(save, content), log: save.commands };
  } catch { /* corrupt or old save: start fresh */ }
  return { state: newRun(freshSeed(), content), log: [] };
}

export const useGame = create<GameStore>((set, get) => ({
  ...load(),
  undoMarks: [],
  lastEvents: [],
  error: null,
  dispatch: (cmd) => {
    const { state, log, undoMarks } = get();
    try {
      const [next, events] = apply(state, cmd, content);
      const nextLog = [...log, cmd];
      persist(next.seed, nextLog);
      set({ state: next, log: nextLog, lastEvents: events, error: null, undoMarks: cmd.type === 'place' ? [...undoMarks, { state, logLen: log.length }] : [] });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  undo: () => {
    const { undoMarks, log } = get();
    const mark = undoMarks[undoMarks.length - 1];
    if (!mark) return;
    const nextLog = log.slice(0, mark.logLen);
    persist(mark.state.seed, nextLog);
    set({ state: mark.state, log: nextLog, undoMarks: undoMarks.slice(0, -1), lastEvents: [] });
  },
  newGame: (seed = freshSeed()) => {
    persist(seed, []);
    set({ state: newRun(seed, content), log: [], undoMarks: [], lastEvents: [], error: null });
  },
}));
