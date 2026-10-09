import type { RawEntry } from "./group-entries";
import { ExtractError, issue, type Issue } from "./issues";
import { armorPieceOf, toSlug, variantOf } from "./keys";
import { renderMarkup, stripMarkup } from "./render-markup";
import type { Entry, Localized } from "./schemas";

interface Rendered {
  readonly value: Localized;
  readonly issues: Issue[];
}

function renderLocalized(value: Localized, where: string): Rendered {
  const zh = renderMarkup(value.zh, "zh");
  const en = renderMarkup(value.en, "en");
  const warnings = [...new Set([...zh.warnings, ...en.warnings])];
  return {
    value: { zh: zh.html, en: en.html },
    issues: warnings.map((warning) => issue("markup-warning", `${where}: ${warning}`)),
  };
}

export function assembleEntry(raw: RawEntry, icon?: string): { entry: Entry; issues: Issue[] } {
  const where = `${raw.category}:${raw.id}`;
  const description = raw.description ? renderLocalized(raw.description, where) : undefined;
  const descriptionLong = raw.descriptionLong ? renderLocalized(raw.descriptionLong, where) : undefined;
  const unlock = raw.unlock ? renderLocalized(raw.unlock, where) : undefined;
  const armorPiece = raw.category === "armor" ? armorPieceOf(raw.id) : undefined;
  const entry: Entry = {
    id: raw.id,
    slug: toSlug(raw.id),
    category: raw.category,
    variant: variantOf(raw.id),
    release: raw.release,
    name: { zh: stripMarkup(raw.name.zh), en: stripMarkup(raw.name.en) },
    ...(description ? { description: description.value } : {}),
    ...(descriptionLong ? { descriptionLong: descriptionLong.value } : {}),
    ...(unlock ? { unlock: unlock.value } : {}),
    ...(icon ? { icon } : {}),
    ...(armorPiece ? { armorPiece } : {}),
    ...(raw.untranslated.length > 0 ? { untranslated: [...raw.untranslated] } : {}),
    links: {},
  };
  return {
    entry,
    issues: [...(description?.issues ?? []), ...(descriptionLong?.issues ?? []), ...(unlock?.issues ?? [])],
  };
}

export function assertUniqueSlugs(entries: readonly Entry[]): void {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const entry of entries) {
    const key = `${entry.category}/${entry.slug}`;
    const previous = seen.get(key);
    if (previous) duplicates.push(`${key}（${previous}、${entry.id}）`);
    else seen.set(key, entry.id);
  }
  if (duplicates.length > 0) throw new ExtractError(`slug 衝突：${duplicates.join("；")}`);
}
