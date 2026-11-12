import { create } from 'zustand';

const KEY = 'dtr.tutorial';
const load = (): { on: boolean; done: string[] } => { try { return JSON.parse(localStorage.getItem(KEY) ?? '') ; } catch { return { on: false, done: [] }; } };
const save = (v: { on: boolean; done: string[] }) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage off */ } };

/** Tutorial flag and dismissed steps, kept apart from the sim: the run itself is an ordinary seeded run. */
export const useTutorial = create<{ on: boolean; done: string[]; start: () => void; dismiss: (id: string) => void; stop: () => void }>((set, get) => ({
  ...load(),
  start: () => { save({ on: true, done: [] }); set({ on: true, done: [] }); },
  dismiss: (id) => { const v = { on: true, done: [...get().done, id] }; save(v); set(v); },
  stop: () => { save({ on: false, done: [] }); set({ on: false, done: [] }); },
}));

