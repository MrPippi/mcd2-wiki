import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { SPLASH_SOURCE, SPLASH_TARGET } from "../../../shared/config";
import { issue } from "../issues";
import { defineStep } from "../step";

/** Copies the splash art into the site sources; a missing file is reported, and the home page goes without it. */
export const splashStep = defineStep({
  name: "splash",
  needs: {},
  writes: [],
  async run({ options }) {
    const from = path.join(options.sourceRoot, ...SPLASH_SOURCE.split("/"));
    if (!existsSync(from)) return { value: undefined, issues: [issue("missing-brand", SPLASH_SOURCE)] };
    const to = path.join(options.outRoot, ...SPLASH_TARGET.split("/"));
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
    return { value: undefined };
  },
});
