/**
 * The game version the extracted data matches. The unpacked files do not carry it, so it is read from the game's
 * MicrosoftGame.config (`<Identity … Version="1.1.3.0" />`) and written to shared/game-version.json and the READMEs.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Where the Xbox app installs the game, unless GAME_DIR says otherwise. */
export const DEFAULT_GAME_DIR = "C:\\XboxGames\\Minecraft Dungeons II\\Content";
export const CONFIG_NAME = "MicrosoftGame.config";
export const VERSION_FILE = "shared/game-version.json";
export const README_FILES = ["README.md", "README.zh-TW.md"];

const VERSION = /^\d+(\.\d+)+$/;

/** The version in a MicrosoftGame.config, if it names one. */
export function configVersion(xml: string): string | undefined {
  const identity = /<Identity\b[^>]*>/.exec(xml)?.[0];
  const version = identity === undefined ? undefined : /\bVersion="([^"]*)"/.exec(identity)?.[1];
  return version !== undefined && VERSION.test(version) ? version : undefined;
}

/** `text` with every mention of version `from` replaced by `to`. */
export const withReadmeVersion = (text: string, from: string, to: string): string => text.split(from).join(to);

/**
 * The config files to try, in order: one copied next to the unpacked files (it matches them for sure), then the
 * installed game, which may be newer than an old unpack.
 */
export const configCandidates = (sourceRoot: string, gameDir: string | undefined): string[] => [
  path.join(sourceRoot, CONFIG_NAME),
  path.join(gameDir ?? DEFAULT_GAME_DIR, CONFIG_NAME),
];

export interface VersionUpdate {
  readonly version: string;
  readonly previous: string;
  readonly config: string;
}

/** Reads the version from the first config found and writes it into the repository; undefined when none is found. */
export async function updateGameVersion(projectRoot: string, sourceRoot: string, gameDir: string | undefined): Promise<VersionUpdate | undefined> {
  const config = configCandidates(sourceRoot, gameDir).find((file) => existsSync(file));
  if (config === undefined) return undefined;
  const version = configVersion(await readFile(config, "utf8"));
  if (version === undefined) throw new Error(`${config} 沒有可用的 <Identity Version="…">`);
  const versionPath = path.join(projectRoot, VERSION_FILE);
  const previous = (JSON.parse(await readFile(versionPath, "utf8")) as { version: string }).version;
  if (previous !== version) {
    await writeFile(versionPath, `${JSON.stringify({ version }, null, 2)}\n`);
    for (const readme of README_FILES) {
      const file = path.join(projectRoot, readme);
      await writeFile(file, withReadmeVersion(await readFile(file, "utf8"), previous, version));
    }
  }
  return { version, previous, config };
}
