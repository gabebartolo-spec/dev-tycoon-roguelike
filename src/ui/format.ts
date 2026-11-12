import { content } from '../data/load';

export const workerById = (id: string) => content.workers.find((w) => w.id === id)!;
export const traitById = (id: string) => content.traits.find((t) => t.id === id)!;
const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
export const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));
