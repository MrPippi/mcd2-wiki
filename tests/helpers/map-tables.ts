/** Small hand-made map DataTable rows in the game's export shape, using real coordinates from the game. */
import type { MapTables } from "../../scripts/extract/map-tables";
import { makeLocales, ns } from "./locales";

const vec = (X: number, Y: number) => ({ X, Y, Z: 0 });
const tag = (TagName: string) => ({ TagName });

const region = (Name: string, minX: number, minY: number, maxX: number, maxY: number, dims: number, ratio: number) => ({
  Name,
  RegionData: {
    FancyMapSizeRatio: { X: ratio },
    Bounds: { MapDims: { X: dims }, MinPos: vec(minX, minY), MaxPos: vec(maxX, maxY) },
  },
});

const teleport = (Name: string, IdTag: string, AreaTag: string, Type: string, X: number, Y: number) => ({
  Name,
  IdTag: tag(IdTag),
  AreaTag: tag(AreaTag),
  Type,
  Location: vec(X, Y),
});

const area = (TagName: string, key: string, AreaIcon?: string) => ({
  Name: TagName,
  TypeTag: tag(TagName),
  TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': { Text: `LOCTABLE("DT_AreaDefinition.csv", "${key}")` } } },
  ...(AreaIcon ? { AreaIcon } : {}),
});

export const MAP_TABLES: MapTables = {
  regions: [
    region("Camp", -2713, -173, -2243, 109, 472, 0.78666666666666663),
    region("Overworld", -599, -172, 444, 1371, 1544, 0.965),
    region("Sift", -1093, 1552, -539, 2894, 1344, 0.96),
  ],
  teleports: [
    teleport("Townportal_portal", "SW.TeleportPoint.TownPortal.PortalLocation", "SW.Area.Town", "Area", 13845, -8750),
    teleport("Townportal_player1", "SW.TeleportPoint.TownPortal.PlayerLocation.1", "SW.Area.Town", "Area", 13850, -9350),
    teleport("Rift1", "SW.TeleportPoint.Forest.A1.Rifts.1", "SW.Area.Forest.A1", "Area", 16300, 43800),
    teleport("ForestA1-Outpost", "SW.TeleportPoint.Forest.A1.Outpost.MinecartStation", "SW.Area.Forest.A1", "Area", 13100, 61100),
    teleport("CarapaceA1-North", "SW.TeleportPoint.Carapace.A1.North.MinecartStation", "SW.Area.Carapace.A1", "Area", -72500, 243800),
    teleport("Lost", "Sw.TeleportPoint.Lost.MinecartStation", "SW.Area.Forest.A1", "Tile", -200000, -200000),
    teleport("Nowhere", "Sw.TeleportPoint.Nowhere.MinecartStation", "SW.Area.Unknown", "Area", 0, 0),
    teleport("DebugRift", "SW.TeleportPoint.Forest.A1.Rifts.99", "SW.Area.Forest.A1", "Debug", 0, 0),
  ],
  exploration: [
    // Case differs from the teleport's IdTag on purpose: the game mixes "MinecartStation" and "MineCartStation".
    { Name: "ForestA1-Outpost", TeleportTag: tag("SW.TeleportPoint.Forest.A1.Outpost.MineCartStation") },
    { Name: "CarapaceA1-North", TeleportTag: tag("SW.TeleportPoint.Carapace.A1.North.MinecartStation") },
    { Name: "Lost", TeleportTag: tag("Sw.TeleportPoint.Lost.MinecartStation") },
    { Name: "Nowhere", TeleportTag: tag("Sw.TeleportPoint.Nowhere.MinecartStation") },
    { Name: "Missing", TeleportTag: tag("SW.TeleportPoint.Missing.MinecartStation") },
  ],
  merchants: [
    {
      Name: "TheTownBlacksmithComplete",
      MarkerType: "Blacksmith",
      Location: vec(16451.924232, -10210.710687),
      MerchantName: 'LOCTABLE("VendorLabels.csv", "vendor_blacksmith_titleshort")',
      MerchantDescription: 'LOCTABLE("VendorLabels.csv", "vendor_blacksmith_mappin_tooltip")',
    },
  ],
  areas: [
    area("SW.Area.Town", "SW_Area_Town_SW_TextEntry_Name", "/OreUI/UI/Icons/Location/AreaIcons/T_UI_Icon_BraveHaven.T_UI_Icon_BraveHaven"),
    area("SW.Area.Forest.A1", "SW_Area_Forest_A1_SW_TextEntry_Name", "None"),
    area("SW.Area.Carapace.A1", "SW_Area_Carapace_A1_SW_TextEntry_Name"),
  ],
};

export const MAP_LOCALES = makeLocales({
  [ns("WorldMapLabels")]: {
    worldmap_dimension_overworld: ["Overworld", "主世界"],
    worldmap_dimension_wellspring: ["The Sift", "隙浮"],
    worldmap_dimension_camp: ["Camp", "營地"],
    worldmap_tooltip_title_rift: ["Rift", "裂隙"],
    worldmap_tooltip_description_rift: ["Enter to find loot.", "進入以尋找戰利品。"],
  },
  [ns("SettingsLabels")]: { Input_TownPortal: ["Teleport Statue", "傳送雕像"] },
  [ns("VendorLabels")]: {
    vendor_blacksmith_titleshort: ["Blacksmith", "鐵匠"],
    vendor_blacksmith_mappin_tooltip: ["Upgrade your gear.", "強化裝備。"],
  },
  [ns("DT_AreaDefinition")]: {
    SW_Area_Town_SW_TextEntry_Name: ["Brave Haven", "英雄港"],
    SW_Area_Forest_A1_SW_TextEntry_Name: ["Howling Woods", "咆哮森林"],
    SW_Area_Carapace_A1_SW_TextEntry_Name: ["Humbler Huskland", "轟鳴蟲殼骸之地"],
  },
});
