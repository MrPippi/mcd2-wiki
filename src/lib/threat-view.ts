/** The threat table's columns and two-row header, built from whichever parts of the threat data exist. Server-side only. */
import { RARITIES, type ThreatRow } from "../../scripts/extract/guides-schema";
import { formatMultiplier, formatNumber, formatRange, formatShare, rarityName, roman } from "./guides";
import { t, type Lang, type UiKey } from "./i18n";

export interface ThreatColumn {
  readonly id: string;
  readonly label: string;
  /** The header over this column and its neighbours of the same group; none for a column that stands alone. */
  readonly group?: UiKey;
  /** The cell text for a row; undefined when the row lacks the value. */
  readonly value: (row: ThreatRow) => string | undefined;
}

/** A cell of the header's first row; `column` is set for a stand-alone column, which spans both header rows. */
export interface HeaderCell {
  readonly label: string;
  readonly span: number;
  readonly column?: ThreatColumn;
}

const TIERS = [0, 1, 2] as const;

function allColumns(lang: Lang): ThreatColumn[] {
  const number = (value: number): string => formatNumber(value, lang);
  const share = (value: number): string => formatShare(value, lang);
  return [
    { id: "recommended", label: t(lang, "guideColRecLevel"), value: (row) => (row.recommendedLevel === undefined ? undefined : number(row.recommendedLevel)) },
    { id: "attack", label: t(lang, "guideColAttackMod"), value: (row) => (row.attackPower === undefined ? undefined : formatMultiplier(row.attackPower, lang)) },
    { id: "resistance", label: t(lang, "guideColResistanceMod"), value: (row) => (row.damageResistance === undefined ? undefined : formatMultiplier(row.damageResistance, lang)) },
    ...TIERS.map((index): ThreatColumn => ({
      id: `tier-${index + 1}`, label: roman(index + 1), group: "guideGroupEffects", value: (row) => { const factor = row.effectTiers?.[index]; return factor === undefined ? undefined : number(factor); },
    })),
    ...RARITIES.map((rarity): ThreatColumn => ({
      id: `rarity-${rarity}`, label: rarityName(rarity, lang), group: "guideGroupRarity", value: (row) => { const factor = row.rarity?.[rarity]; return factor === undefined ? undefined : number(factor); },
    })),
    { id: "variant", label: t(lang, "guideColVariant"), group: "guideGroupMobs", value: (row) => row.mobVariantChance && formatRange(row.mobVariantChance, share) },
    { id: "soul-stated", label: t(lang, "guideColSoulStated"), group: "guideGroupMobs", value: (row) => row.soulStatedCost && formatRange(row.soulStatedCost, number) },
    { id: "miniboss", label: t(lang, "guideColMiniboss"), group: "guideGroupMobs", value: (row) => row.minibossCost && formatRange(row.minibossCost, number) },
  ];
}

/** Only the columns at least one row has a value for: a part missing from the data leaves no empty column. */
export const threatColumns = (rows: readonly ThreatRow[], lang: Lang): ThreatColumn[] =>
  allColumns(lang).filter((column) => rows.some((row) => column.value(row) !== undefined));

/** The header's first row: each group once over its columns, every other column alone. */
export function headerCells(columns: readonly ThreatColumn[], lang: Lang): HeaderCell[] {
  return columns.reduce<HeaderCell[]>((cells, column) => {
    const last = cells[cells.length - 1];
    if (column.group && last && !last.column && last.label === t(lang, column.group)) return [...cells.slice(0, -1), { ...last, span: last.span + 1 }];
    return [...cells, column.group ? { label: t(lang, column.group), span: 1 } : { label: column.label, span: 1, column }];
  }, []);
}
