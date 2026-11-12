import raw from './content.json';
import { ContentPack } from './schemas';
import { defaultOptions, runContent } from '../sim/meta';

/** Validated once at startup; a bad content file fails loudly here, not mid-run. Includes locked unlock content. */
export const baseContent: ContentPack = ContentPack.parse(raw);

/**
 * The current run's pack (base + the run's studio, Crunch Level and unlocks). An ES live binding: the store swaps it
 * when a run starts or loads, so UI code keeps importing `content`. Defaults to what a first-time player gets.
 */
export let content: ContentPack = runContent(baseContent, defaultOptions(baseContent));
export function setRunContent(c: ContentPack) { content = c; }
