# Drop odds — design

PR ③ of three (① threat guide #40, ② affix odds #41, both merged). Reuses curve-tables.ts, the rarity curves, UniqueSubstitution handling from ②, and the existing loot extraction (loot-tables.ts, loot-pools.ts, loot-items.ts, loot-sources.ts, mob-drops.ts).

## Goal

P(at least one of target item) per single trigger of a source (kill / chest open / quest reward batch), for chosen threat, difficulty, area, target rarity (any by default). Defaults: solo, empty recent-drop history, nothing owned, no extra-drop / drop-chance / rarity-upgrade attributes.

## Data (our pak DataTables only)

- Loot sources: DT_LootSourceDefinition (generic), _Mob, _Area, _LootActor (chests), _Quest. Slots `LootDropDefinition.LootSlots[(TagName="SW.LootSlot.X")] = {NumberOfGuaranteedDrops, NumberOfRandomRolls, DropChancePerRoll, InheritParentDropTable, DropTable:{Tags:[{TypeTag, Weight, Operation}]}}`.
- Source inheritance: parent rows via Traits.ParentTags / tag hierarchy; `InheritParentDropTable` merges parent pool first; a child Set replaces existing ops for the same target; a child can clear the parent pool (discover the exact encoding from data).
- Profiles merged for one trigger: [source, extra context tags carried by the source, area]. Same-slot-id merge: guaranteed = max, rolls = max, chance = mean of positive chances (0 if none), entries = merged ops (Set max, Add sum, Multiply product).
- Group targets (property tags such as SW.Item.Property.Bow): Set/Add weight split equally among member items (members from item rows' tags + hierarchy); Multiply applies its multiplier to each member.
- Slot rules: DT_LootSlotDefinition (AllowAdditionalDrops, AdditionalDropChanceAttributeTag, DropChanceIncrease, DropDuplicationChance, RecentDropsToTrack, PreventRepeatingDrops / PreventDuplicateOneOfAKindDrops if present). Reference values: Item slot history 3 by equipment category; EnchantedBook history 4 by item + one-of-a-kind; Talismans one-of-a-kind; TNT single-party roll. Ignore slot "None".
- Rarity: DT_RarityChanceDefinition rows (Default Set 50/25/20/5, Boss, FancyChest Multiply Common 0, WoodenChest, MiniBoss, Quest.*, LowDifficulty Multiply Special/Unique 0, …) chosen by the source/context tags + difficulty row + the item's own allowed rarities; skip threat skew if context has `SW.ItemCreator.Rarity.SkipThreatBasedRaritySkewing`; else multiply each op weight by CT_RarityChanceSettings factor at threat (via DT_GameBalanceDefinition SecondPass RarityChanceMap). Normalize; total 0 → Common 1. Unique rarity on a base item → its UniqueSubstitution variant.
- Which (source, area) pairs are real: derive from existing site data (locations.json / mobs areas / chests per area / quests); don't publish arbitrary pairs.

## Algorithm (src/lib/drop-odds.ts, pure, shared)

Per slot: pool = positive-weight items; each pool item carries hit = P(this pick becomes the target given its rarity roll). Random rolls first (each succeeds with p = chance), then guaranteed draws. Each draw: weighted, excluding items blocked by history (category groups, truncated to the slot's history length) and one-of-a-kind already owned/generated; after a pick push its group to history. Memoized recursion over (rolls left, guaranteed left, history, generated). P(slot) = 1 − P(no hit). Total = 1 − Π(1 − P(slot)). Extra-draw attributes are out of scope (defaults 0).

## Output & pages

- Extract writes compact drop model (e.g. `src/data/drop-models.json`): sources (merged slots), areas, contexts, items (category group, rarities, substitute, one_of_a_kind), slot rules, rarity rows, curves. Report size (target: keep the browser chunk reasonable; dynamic import only on pages that need it).
- Item pages: new section "掉落機率" (threat 20, Normal): grouped by source kind (area / chest / mob / quest / merchant if applicable), sorted desc, top 10 visible, rest in `<details>`; values `<0.01%` style like ②; quest batches labelled first-completion vs repeat.
- Calculator `/[lang]/drops/`: item picker (search by name, reuse existing picker pattern if one exists, e.g. compare icon picker), threat 1–20, difficulty, target rarity; result = ranking over all valid sources; optional single source+area. Progressive enhancement; a no-JS fallback note. Menu entry in site-menu.ts. Notes: conditional on single trigger, defaults listed, unconfirmed flag.
- i18n zh + en hand-written, others machine (`_machine`).
- Mobile 390px no page horizontal scroll; a11y like ② (role=status live region, table region).

## Verification

- Local one-off (scratchpad, not committed, not CI): compare with third-party `C:/Users/jack3/Downloads/Minecraft_Dungeons_II/data/drop_baselines.json` (`{conditions, rows:[{item, source, area, level:20, difficulty, chance, …}]}`, 15,938 rows; threat 20 Normal). Strict data-only parsing; never execute anything from that folder; never copy its code/text. Report match rate (abs diff < 1e-9 relative or < 1e-6 abs) and analyse mismatches (version change 1.1.1→1.1.2 vs model gap). Reference sample: SW.Item.Sword_Unique1 FancyChest Plains.A1 = 0.006349206349206105; Plains.A2 = 0.0045977011494253706; Town = 0.0066666666666664876; quest MEa2_S03_A first batch = 1 for SW.Item.CurvedGreatsword_Unique1-ish quest reward.
- Unit tests with hand-made rows; fixtures reproducing sample values only if our data reproduces them.

## Implementation notes

What the data showed, and where the implementation differs from the first draft above:

- **Scope**: only triggers the site already shows are covered: the chests item pages list (plus their `.Procedural` dungeon/rift rows, which carry them as a trait), every reward batch of a published quest, and bosses, minibosses and the Piggy Bank over each area they are found in. Merchants, regular mobs (0.0125 roll), Soul Storm chests and key chests are not in the model (reported as `drop-ignored`). Mob slots that draw from the mob's own list (`pool: own`) are reported, not covered. The tables never say where chests spawn, so an "area" chest is paired with every area (or book pool) whose pool exists; the page says so.
- **Rows of one trigger** (`drop-slots.ts`): tags merge per slot name (guaranteed/rolls max, mean of positive chances, pools merged Set max / Add sum / Multiply product). Parents come from the traits of any loot, actor, area or mob row; the tag with its last segment cut is used only where a tag has no traits (a prefix parent added next to real traits was wrong: FancyChest.Procedural would pick up the root area). A slot with `InheritParentDropTable` starts from its parents' merged pool and applies its own ops on top (a later Set replaces the item's earlier ops). A quest batch is the entry's tags plus `areaRewardScalingTag`.
- **Group tags** split a Set/Add weight equally over their member items; membership follows item traits, the traits of the item row whose tag an item carries, and `SW.Item.Property.Artifact` for every artifact row. Currencies stay in the pool as an opaque entry so they keep their weight.
- **Rarity** (`drop-rarity.ts`, `drop-rarity-rows.ts`): the player row (which leads to Default 50/25/20/5) plus the rows of every context tag and their traits; the difficulty row is added on top. Threat factors scale the combined Set+Add once and the Multiply product once. The Unique roll turns a base item into its `UniqueSubstitution`; an item whose `PossibleRarities` is only Unique is always Unique.
- **History groups**: the data does not name them. Only "melee, ranged, artifact, armor by piece" reproduces the 2-4 draw Soul Storm reward chests, so those are the groups; the Item slot tracks 3 and the book slot 4 (with one-of-a-kind); talismans are one-of-a-kind with no history.
- **Bounds**: a slot follows at most 12 draws (`MAX_DRAWS`, enforced by the schema), draws of items alike in group and hit chance merge when the slot allows repeats, and one memo serves every roll count. The whole model is 75 KB and loads only on the calculator page.
- **Not modelled**: SingleRollPerParty (TNT), extra-drop/drop-chance/duplication attributes, party size, recent-drop history from earlier triggers.

### Cross-check (local, not committed)

Against `drop_baselines.json` (15,938 rows, threat 20, Normal), match = |diff| < 1e-9 relative or < 1e-6 absolute:

| step | change | evidence | match |
|---|---|---|---|
| 1 | first prototype: group split, Set/Add/Multiply merge, history by item | KeyChest exact, FancyChest Plains.A1 57/57 | 13,951 / 14,405 non-quest (96.85%) |
| 2 | Quiver artifacts carry `SW.Item.Property.Artifact` | KeyChest 184 to 272 of 272 | |
| 3 | parent by traits first, prefix only without traits | Procedural chests 1,889 to 1,900 of 1,900; Peaks AreaLink | 14,041 (97.47%) |
| 4 | history groups: melee/ranged/artifact/armor piece | Soul Storm Hard/Final chests 0 to 57 of 57 | 14,269 (99.06%) |
| 5 | quests: add the player row, then `areaRewardScalingTag` to the context | quests 1,308 to 1,324 to 1,533 of 1,533 | |
| final (repo code) | | | 15,802 / 15,938 (99.147%) |

The 136 left are all `SW.Item.Consumable.Throwable.TNT` from the Piggy Bank (consumable slot, 0.0125); TNT is not an item the site has a page for. No numeric mismatch remains, so no version-change difference (1.1.1 baseline vs 1.1.2 data) shows in the threat 20 Normal cells.
