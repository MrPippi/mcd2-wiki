import { existsSync } from "node:fs";
import path from "node:path";
import { issue, type Issue, type IssueType } from "./issues";
import type { IconCopy } from "./output";

export interface AssetPlan {
  /** Published path (relative to the site base) for each asset that exists. */
  readonly paths: Record<string, string>;
  readonly copies: IconCopy[];
  readonly issues: Issue[];
}

/**
 * Plans copying fixed UI art (frames, category icons) from source-data to public/icons/<dir>/<key>.png.
 * Missing files are reported with `missingType` and left out of `paths`, so the site can fall back.
 */
export function planAssets(
  sourceRoot: string,
  outRoot: string,
  sources: Readonly<Record<string, string>>,
  dir: string,
  missingType: IssueType,
): AssetPlan {
  const assets = Object.entries(sources).map(([key, relative]) => ({
    key,
    relative,
    from: path.join(sourceRoot, ...relative.split("/")),
    published: `icons/${dir}/${key}.png`,
  }));
  const present = assets.filter((asset) => existsSync(asset.from));
  return {
    paths: Object.fromEntries(present.map((asset) => [asset.key, asset.published])),
    copies: present.map((asset) => ({ from: asset.from, to: path.join(outRoot, "public", ...asset.published.split("/")) })),
    issues: assets.filter((asset) => !existsSync(asset.from)).map((asset) => issue(missingType, asset.relative)),
  };
}
