/** The game version the extracted data matches. Not in the exported files, so a maintainer sets it in game-version.json. */
import { z } from "zod";
import raw from "../../scripts/extract/game-version.json";

export const GameVersionSchema = z.object({ version: z.string().regex(/^[0-9A-Za-z._-]{1,32}$/) });

export const GAME_VERSION: string = GameVersionSchema.parse(raw).version;
