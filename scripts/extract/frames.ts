import { existsSync } from "node:fs";
import path from "node:path";
import { FRAME_SOURCES, type FrameName } from "./config";
import { issue, type Issue } from "./issues";
import type { IconCopy } from "./output";
import type { Frames } from "./schemas";

export interface FramePlan {
  readonly frames: Frames;
  readonly copies: IconCopy[];
  readonly issues: Issue[];
}

const framePath = (name: FrameName): string => `icons/frames/${name}.png`;

export function planFrames(sourceRoot: string, outRoot: string): FramePlan {
  const sources = (Object.entries(FRAME_SOURCES) as [FrameName, string][]).map(([name, relative]) => ({
    name,
    relative,
    from: path.join(sourceRoot, ...relative.split("/")),
  }));
  const present = sources.filter((source) => existsSync(source.from));
  return {
    frames: Object.fromEntries(present.map((source) => [source.name, framePath(source.name)])),
    copies: present.map((source) => ({
      from: source.from,
      to: path.join(outRoot, "public", ...framePath(source.name).split("/")),
    })),
    issues: sources.filter((source) => !existsSync(source.from)).map((source) => issue("missing-frame", source.relative)),
  };
}
