/** The shapes of the drop model file (src/data/drop-models.json) and of a drop query. Types only, shared by the extractor and the site. */

/** Rarity index: 0 Common, 1 Rare, 2 Special, 3 Unique. */
export type RarityIndex = 0 | 1 | 2 | 3;
/** s = Set, a = Add, m = Multiply. */
export type RarityOpName = "s" | "a" | "m";
export type RarityOp = readonly [rarity: RarityIndex, op: RarityOpName, weight: number];
export type RarityFactors = readonly [number, number, number, number];

/** What a drop can be: a site item, or a currency the site has no page for (it only takes weight in a pool). */
export interface DropItem {
  /** "<category>/<slug>" as loot-sources.json keys items; "~<tag>" for something without a page. */
  readonly key: string;
  /** Items of one group block each other in a slot's recent-drop history. */
  readonly group: string;
  /** Index of the Unique variant a Unique rarity roll turns this base item into. */
  readonly sub?: number;
  /**
   * The rarities the item can roll, as a bit mask (1 Common, 2 Rare, 4 Special, 8 Unique); none for what has no rarity (books,
   * talismans, currencies). A mask of 8 is an item that only exists as Unique.
   */
  readonly allowed?: number;
  readonly opaque?: true;
}

export interface DropSlotRule {
  /** How many of the latest drops block their group again; 0 for none. */
  readonly history: number;
  /** An item the slot already gave cannot come again. */
  readonly oneOfAKind: boolean;
}

/** One loot slot of a profile: guaranteed draws plus random rolls that each succeed with `chance`, from a pool of (item index, weight). */
export interface DropSlot {
  /** Lower-cased slot name ("item", "enchantedbook", "talismans", "specialgear"); the key into DropFile.slots. */
  readonly slot: string;
  readonly guaranteed: number;
  readonly rolls: number;
  readonly chance: number;
  /** Key into DropFile.pools. */
  readonly pool: string;
}

export interface DropProfile {
  readonly slots: readonly DropSlot[];
  readonly rarity: readonly RarityOp[];
}

export interface DropSource {
  /** The loot-sources id ("chest:FancyChest", "mob:PiggyBank") or "quest:<quest id>:<reward batch>". */
  readonly id: string;
  readonly kind: "chest" | "quest" | "mob" | "regular";
  /** A quest reward batch given on the first completion only. */
  readonly first?: true;
  /** The game data does not say where this chest appears; it is listed for every area whose pool has the item. */
  readonly unplaced?: true;
  /** Where it can happen: the area source id ("area:SW.Area.Plains.A1", "bookPool:...") or "" for none, and the profile that applies there. */
  readonly contexts: readonly (readonly [area: string, profile: string])[];
}

export interface DropFile {
  /** Threat levels, and for each the factor of Common, Rare, Special and Unique rarity weights. */
  readonly levels: readonly number[];
  readonly rarityFactors: readonly RarityFactors[];
  /** Rarity rows each difficulty adds. */
  readonly difficulties: Readonly<Record<string, readonly RarityOp[]>>;
  readonly slots: Readonly<Record<string, DropSlotRule>>;
  readonly items: readonly DropItem[];
  readonly pools: Readonly<Record<string, readonly (readonly [item: number, weight: number])[]>>;
  readonly profiles: Readonly<Record<string, DropProfile>>;
  readonly sources: readonly DropSource[];
}

export type TargetRarity = "any" | "common" | "rare" | "special" | "unique";

export interface DropSelection {
  readonly level: number;
  readonly difficulty: string;
  readonly rarity: TargetRarity;
}

export interface DropRow {
  readonly source: string;
  readonly area: string;
  readonly probability: number;
}
