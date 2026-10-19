import { withBase } from "../url";
import type { WorldKey } from "../../../shared/map/worlds";

/** Leaflet tile URL for a world, written by `npm run tiles` to public/map/<world>/<z>/<x>/<y>.webp. */
export const tileUrlTemplate = (base: string, world: WorldKey): string => withBase(base, `map/${world}/{z}/{x}/{y}.webp`);

/** The zoom-0 tile holds the whole world in 256px: the no-JavaScript fallback and the home page preview. */
export const overviewTile = (world: WorldKey): string => `map/${world}/0/0/0.webp`;

/** The pixelated tab picture of a world, written by `npm run tiles` to public/map/tabs/<world>.webp. */
export const tabArt = (world: WorldKey): string => `map/tabs/${world}.webp`;

/** The game's Z and X keycap glyphs shown beside the world tabs, written to public/map/keys/<key>.png. */
export const keyGlyph = (key: "z" | "x"): string => `map/keys/${key}.png`;
