import { create } from 'zustand';
import { content } from '../data/load';
import { apply, newRun, type Command, type RunState, type SimEvent } from '../sim/run';

interface GameStore {
  state: RunState;
  /** States since the current phase began; undo pops placements only, never a phase end. */
  history: RunState[];
  lastEvents: SimEvent[];
  dispatch: (cmd: Command) => void;
  undo: () => void;
  newGame: (seed?: number) => void;
}

const freshSeed = () => Math.floor(Math.random() * 2 ** 31); // UI-only: picks a seed, the sim itself never calls random

export const useGame = create<GameStore>((set, get) => ({
  state: newRun(freshSeed(), content),
  history: [],
  lastEvents: [],
  dispatch: (cmd) => {
    const { state, history } = get();
    const [next, events] = apply(state, cmd, content);
    set({ state: next, lastEvents: events, history: cmd.type === 'place' ? [...history, state] : [] });
  },
  undo: () => {
    const { history } = get();
    if (!history.length) return;
    set({ state: history[history.length - 1], history: history.slice(0, -1), lastEvents: [] });
  },
  newGame: (seed = freshSeed()) => set({ state: newRun(seed, content), history: [], lastEvents: [] }),
}));
