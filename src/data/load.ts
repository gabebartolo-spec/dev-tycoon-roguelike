import raw from './content.json';
import { ContentPack } from './schemas';

/** Validated once at startup; a bad content file fails loudly here, not mid-run. */
export const content: ContentPack = ContentPack.parse(raw);
