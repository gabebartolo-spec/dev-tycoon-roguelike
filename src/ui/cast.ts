/**
 * The 8 studio characters (Tripo models, Mixamo auto-rig + the Mixamo "Typing" clip, packed by Blender into
 * public/models). Each staffed desk gets one, picked from the worker id so a worker keeps their look across renders.
 */
export const CAST = ['w_sweater', 'w_headphones', 'w_cardigan', 'w_overalls', 'm_plaid', 'm_gamer', 'm_glasses', 'm_hoodie'] as const;
export type CastName = (typeof CAST)[number];

export const castUrl = (name: CastName) => `${import.meta.env.BASE_URL}models/${name}.glb`;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** One character per worker, in board order; two workers on the board never share a model (probe to the next free). */
export function castBoard(workerIds: (string | null)[]): (CastName | null)[] {
  const used = new Set<CastName>();
  return workerIds.map((id) => {
    if (!id) return null;
    let i = hash(id) % CAST.length;
    for (let k = 0; k < CAST.length && used.has(CAST[i]); k++) i = (i + 1) % CAST.length;
    used.add(CAST[i]);
    return CAST[i];
  });
}
