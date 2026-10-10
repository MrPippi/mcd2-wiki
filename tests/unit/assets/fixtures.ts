import type { AssetRecord } from "../../../scripts/assets/record";
import { parseRules } from "../../../scripts/assets/rules";

export const testRules = parseRules({
  extensions: ["png"],
  groups: { equipment: "裝備", ui: "介面 UI", map: "地圖", other: "其他" },
  rules: [],
});

export const record = (overrides: Partial<AssetRecord>): AssetRecord => ({
  path: "Assets/X/T_X.png",
  name: "T_X.png",
  group: "other",
  sub: "X",
  detail: "",
  matched: true,
  kind: "texture",
  usage: "unused",
  published: [],
  change: "same",
  bytes: 1024,
  ...overrides,
});
