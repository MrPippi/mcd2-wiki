/** Picks the map spots out of parsed World Partition cells. Pure, so the unit tests feed it small hand-made cells. */

export interface RawObject {
  readonly Name: string;
  readonly Type?: string;
  readonly Outer?: { readonly ObjectName?: string };
  readonly Properties?: Readonly<Record<string, unknown>>;
}

export interface Cm {
  readonly x: number;
  readonly y: number;
}

export interface StormSlot extends Cm {
  /** Area tag of the slot's SpawnIdentityTag, e.g. SW.Area.Forest.A1. */
  readonly area: string;
  readonly slot: number;
}

export interface TalismanChestSpot extends Cm {
  /** Tag suffix after SW.LootActor.TalismansChest., e.g. SpeedIncrement. */
  readonly chest: string;
}

export interface DungeonSpot extends Cm {
  readonly doorway: string;
  readonly size: "Small" | "Medium" | "Large";
}

export interface MapSpots {
  readonly storm: StormSlot[];
  readonly talismanChests: TalismanChestSpot[];
  readonly dungeons: DungeonSpot[];
}

const STORM_TAG = "SW.SpawnDefinition.Storminator";
const IDENTITY = /^SW\.SpawnIdentity\.(.+)\.Storminator\.(\d+)$/;
const CHEST_PREFIX = "SW.LootActor.TalismansChest.";
const DUNGEON_DOOR = "ETeleportDoorVisualType::Dungeon";
const SIZE_TAG = /^SW\.ProceduralArea\.Size\.(Small|Medium|Large)$/;
const STORM_COMPONENT = "CollisionComp";

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
const tagOf = (value: unknown): string | undefined => {
  const tag = record(value)?.TagName;
  return typeof tag === "string" ? tag : undefined;
};
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** The dotted path inside a reference like Class'Level.Parent.Name'. */
const lastSegments = (reference: unknown): string[] => {
  const name = record(reference)?.ObjectName;
  const inner = typeof name === "string" ? /'([^']*)'$/.exec(name)?.[1] : undefined;
  return inner ? inner.split(".") : [];
};
const outerName = (object: RawObject): string | undefined => lastSegments(object.Outer).at(-1);

/** World position of a component; a component attached to a parent has a relative one, so it is skipped. */
function locationOf(component: RawObject | undefined): Cm | undefined {
  const location = record(component?.Properties?.RelativeLocation);
  const x = num(location?.X);
  const y = num(location?.Y);
  return x === undefined || y === undefined || record(component?.Properties?.AttachParent) ? undefined : { x, y };
}

/** Components by owning actor, so each actor's parts are found without rescanning the cell. */
const componentsByActor = (cell: readonly RawObject[]): ReadonlyMap<string, RawObject[]> => {
  const map = new Map<string, RawObject[]>();
  for (const object of cell) {
    const owner = outerName(object);
    if (owner) map.set(owner, [...(map.get(owner) ?? []), object]);
  }
  return map;
};

const rootLocation = (actor: RawObject, parts: readonly RawObject[]): Cm | undefined => {
  const rootName = lastSegments(actor.Properties?.RootComponent).at(-1);
  return locationOf(parts.find((part) => part.Name === rootName));
};

function stormSlot(actor: RawObject, parts: readonly RawObject[]): StormSlot | undefined {
  if (actor.Type !== "SpawnVolume" || tagOf(actor.Properties?.SpawnDataTag) !== STORM_TAG) return undefined;
  const match = IDENTITY.exec(tagOf(actor.Properties?.SpawnIdentityTag) ?? "");
  const at = locationOf(parts.find((part) => part.Name === STORM_COMPONENT));
  return match && at ? { area: `SW.Area.${match[1]}`, slot: Number(match[2]), ...at } : undefined;
}

function talismanChest(actor: RawObject, parts: readonly RawObject[]): TalismanChestSpot | undefined {
  const tag = tagOf(actor.Properties?.TypeTag);
  const at = rootLocation(actor, parts);
  return tag?.startsWith(CHEST_PREFIX) && at ? { chest: tag.slice(CHEST_PREFIX.length), ...at } : undefined;
}

function dungeonDoor(actor: RawObject, parts: readonly RawObject[]): DungeonSpot | undefined {
  if (actor.Properties?.TeleportDoorVisualType !== DUNGEON_DOOR) return undefined;
  const doorway = Array.isArray(actor.Properties.Doorways) ? tagOf(actor.Properties.Doorways[0]) : undefined;
  const size = SIZE_TAG.exec(tagOf(actor.Properties.DefaultSize) ?? "")?.[1] as DungeonSpot["size"] | undefined;
  const at = rootLocation(actor, parts);
  return doorway && size && at ? { doorway, size, ...at } : undefined;
}

const compact = <T>(values: readonly (T | undefined)[]): T[] => values.filter((value): value is T => value !== undefined);

const byStorm = (a: StormSlot, b: StormSlot): number => a.area.localeCompare(b.area, "en") || a.slot - b.slot;
const byChest = (a: TalismanChestSpot, b: TalismanChestSpot): number => a.chest.localeCompare(b.chest, "en");
const byDoorway = (a: DungeonSpot, b: DungeonSpot): number => a.doorway.localeCompare(b.doorway, "en", { numeric: true });

export function collectSpots(cells: readonly (readonly RawObject[])[]): MapSpots {
  const perActor = cells.flatMap((cell) => {
    const parts = componentsByActor(cell);
    return cell.map((actor) => ({ actor, parts: parts.get(actor.Name) ?? [] }));
  });
  return {
    storm: compact(perActor.map(({ actor, parts }) => stormSlot(actor, parts))).sort(byStorm),
    talismanChests: compact(perActor.map(({ actor, parts }) => talismanChest(actor, parts))).sort(byChest),
    dungeons: compact(perActor.map(({ actor, parts }) => dungeonDoor(actor, parts))).sort(byDoorway),
  };
}
