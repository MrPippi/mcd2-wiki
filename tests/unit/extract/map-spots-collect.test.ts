import { describe, expect, it } from "vitest";
import { collectSpots, type RawObject } from "../../../scripts/map-spots/collect";

const ref = (name: string) => ({ ObjectName: `Class'Overworld:PersistentLevel.${name}'` });
const tag = (TagName: string) => ({ TagName });
const component = (name: string, owner: string, x: number, y: number, extra: Record<string, unknown> = {}): RawObject => ({
  Name: name,
  Type: "SceneComponent",
  Outer: ref(owner),
  Properties: { RelativeLocation: { X: x, Y: y, Z: 0 }, ...extra },
});

const stormVolume = (owner: string, area: string, slot: number, x: number, y: number): RawObject[] => [
  {
    Name: owner,
    Type: "SpawnVolume",
    Properties: { SpawnDataTag: tag("SW.SpawnDefinition.Storminator"), SpawnIdentityTag: tag(`SW.SpawnIdentity.${area}.Storminator.${slot}`) },
  },
  component("CollisionComp", owner, x, y),
  // Another component of the same actor, which must not be mistaken for the slot's position.
  component("Billboard", owner, 1, 1),
];

const chest = (owner: string, type: string, name: string, x: number, y: number): RawObject[] => [
  { Name: owner, Type: type, Properties: { TypeTag: tag(`SW.LootActor.TalismansChest.${name}`), RootComponent: ref(`${owner}.Root`) } },
  component("Root", owner, x, y),
  // A trigger attached to the root has a relative position and is never the root.
  component("Trigger", owner, 150, 350, { AttachParent: ref(`${owner}.Root`) }),
];

const door = (owner: string, visual: string, doorway: string, size: string, x: number, y: number): RawObject[] => [
  {
    Name: owner,
    Type: "BP_SpicewoodTeleportDoor_C",
    Properties: {
      TeleportDoorVisualType: visual,
      Doorways: [tag(doorway)],
      DefaultSize: tag(`SW.ProceduralArea.Size.${size}`),
      RootComponent: ref(`${owner}.Root`),
    },
  },
  component("Root", owner, x, y),
];

describe("collectSpots", () => {
  it("reads a Soul Storm slot's area, number and CollisionComp position", () => {
    const { storm } = collectSpots([stormVolume("Vol_A", "Forest.A1", 3, 7050, 68950)]);
    expect(storm).toEqual([{ area: "SW.Area.Forest.A1", slot: 3, x: 7050, y: 68950 }]);
  });

  it("ignores adjacent spawns, other spawn tags and volumes without a position", () => {
    const adjacent: RawObject = {
      Name: "Adj",
      Type: "SpawnVolume",
      Properties: { SpawnDataTag: tag("SW.SpawnDefinition.StorminatorAdjacent"), SpawnIdentityTag: tag("SW.SpawnIdentity.Forest.A1.Storminator.1") },
    };
    const lone: RawObject = {
      Name: "Lone",
      Type: "SpawnVolume",
      Properties: { SpawnDataTag: tag("SW.SpawnDefinition.Storminator"), SpawnIdentityTag: tag("SW.SpawnIdentity.Forest.A1.Storminator.2") },
    };
    expect(collectSpots([[adjacent, component("CollisionComp", "Adj", 1, 2), lone]]).storm).toEqual([]);
  });

  it("finds talisman chests whatever the actor class, at the root component", () => {
    const cells = [chest("Map_1", "SWMapActor", "EmeraldIncrease", -79300, 250600), chest("Hidden_1", "BP_Chest_Hidden_C", "RangedBuff", 27250, 60400)];
    expect(collectSpots(cells).talismanChests).toEqual([
      { chest: "EmeraldIncrease", x: -79300, y: 250600 },
      { chest: "RangedBuff", x: 27250, y: 60400 },
    ]);
  });

  it("finds dungeon doors with their doorway and size, and leaves rift doors out", () => {
    const cell = [
      ...door("D1", "ETeleportDoorVisualType::Dungeon", "SW.Doorway.PlainsA2.Dungeon.5", "Small", 1000, 2000),
      ...door("R1", "ETeleportDoorVisualType::Rift", "SW.Doorway.ForestA1.Rift.8", "Small", 5, 6),
    ];
    expect(collectSpots([cell]).dungeons).toEqual([{ doorway: "SW.Doorway.PlainsA2.Dungeon.5", size: "Small", x: 1000, y: 2000 }]);
  });

  it("sorts each kind and merges every cell", () => {
    const first = [...stormVolume("A", "Plains.A1", 2, 1, 1), ...stormVolume("B", "Forest.A1", 1, 2, 2)];
    const second = stormVolume("C", "Forest.A1", 10, 3, 3);
    expect(collectSpots([first, second]).storm.map((slot) => `${slot.area}#${slot.slot}`)).toEqual(["SW.Area.Forest.A1#1", "SW.Area.Forest.A1#10", "SW.Area.Plains.A1#2"]);
  });
});
