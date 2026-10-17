# Per-threat affix odds — design

PR ② of three (① threat guide merged #40, ③ drop odds). Reuses `scripts/extract/curve-tables.ts`.

## Goal

On melee, ranged, armor and artifact pages: for each random effect (and tier) the item can roll, the probability it appears at least once, **given the item and its rarity are already generated**, for threat 1–20, each allowed rarity, with/without the Storminator bonus slot. Fixed (built-in) effects show 100%.

## Data (our own pak DataTables only)

- `DT_EffectTemplateGroupDropTableDefinition`: rows keyed by item/property tags (`SW.Item.Property.Gear`, `...MeleeWeapon`, `SW.EffectTemplateGroup.Archetype.*` …) with `PrimaryETG` / `SecondaryETG` `{Tags:[{TypeTag, Weight, Operation:Set|Add|Multiply}]}` → pool-group weights. Today `game-rows.ts effectPool` discards weights — keep them.
- `DT_EffectTemplateGroupDefinition`: group → `TagList` of `SW.EffectTemplate.<X>.I|II|III` with Weight (+Operation if present).
- `DT_EffectTemplateDefinition`: template → effect, tier, `FixedEffectValue`, base template `IncompatibleTagsQuery` (exclusions), `MinimumRequiredItemPower` (all 0 today; keep as data, ignore when 0, report if non-zero).
- Item rows (Melee/Ranged/Armor/Artifact definitions): Traits.GameplayTags / ParentTags decide which drop-table rows apply (walk tag hierarchy: item tag, its property tags and their parents); built-in `Effects`; `UniqueSubstitutionData.UniqueSubstitution` (base → unique).
- `DT_RarityDefinition`: `BaseNumberOfRerollableEffects` (Common 0, Rare 1, Special 2, Unique 1), `AdditionalEffectChances[SW.Item.Property.StorminatorReward]` (+1 for Rare/Special/Unique).
- Tier factors: `DT_GameBalanceDefinition SecondPass ItemCreatorConstants.EffectChanceScalingCurves[SW.Effect.Tier.1..3]` → CT_EffectThreatBasedChanceAdjustments (linear). Threat levels from curve keys (as in #40).
- Allowed rarities per item: from data if present (item rarity restrictions / rarity tags); otherwise current display rule (normal: common/rare/special, unique variant: unique). Report which source was used.

How the item's applicable pool is assembled (which drop-table rows, merge across rows, PrimaryETG vs SecondaryETG) must be discovered from the data; document findings in the code comment and in the implementation notes. Reference behaviour (third-party notes, for cross-check only, do not copy code): mushroom armor pieces end up with Archetype.Utility group weight 0.25.

## Algorithm (src/lib/affix-odds.ts — pure TS, shared by extractor tests and browser)

1. Candidates = templates in the item's pool groups, filtered by tags/rarity/exclusions; drop all tiers of effects the item already has fixed.
2. Per target template, merge ops across sources: Set → max, Add → sum, Multiply → product.
3. Tier factor f(tier, threat) multiplies **each op entry's weight** before combining; effective weight w = max(0, (Set + Add) × Multiply). (So Multiply entries also get the factor inside the product.) Then × pool-group weight.
4. Draw `n` slots by weight without replacement; after a pick remove **all tiers of the same effect**, renormalize.
5. P(template appears) = sum over all draw paths (n ≤ 3; memoize). Also P(effect, any tier).
6. n = base slots of rarity (+1 with Storminator bonus, not Common). A Unique-rarity roll on a base item becomes its UniqueSubstitution variant, so base item pages don't show Unique.

## Output

- Extract writes a compact per-item model (e.g. `src/data/affix-models.json`): shared model objects deduped by hash `{entries:[{effect, tier, ops:[[op,w]...], groupWeight}]}`, item → `{model, fixed[], rarities[{rarity, slots, bonusSlots}]}`; tier factors per threat. Keep total size reasonable (report size; target < 300 KB).
- No precomputed full matrix; page computes.

## Page

- Component `AffixOdds.astro` in the entry detail for melee/ranged/armor piece/artifact.
- Static (no-JS) default: threat 20, default rarity (Rare for normal items, Unique for unique), no bonus → table rows effect + tier, % with 2 decimals (tiny values `<0.01%`).
- With JS (small client script, progressive enhancement): threat select/slider 1–20, rarity select (allowed only), Storminator bonus toggle → recompute with the same `affix-odds.ts`.
- Note: conditional on item + rarity generated; not a drop rate; fixed effects 100%. Unconfirmed flag (guides-status-like status file) for: model reconstructed from data, not verified in game.
- Mobile 390px: no page horizontal scroll.
- i18n: zh + en hand-written, others machine with `_machine`; effect names reuse existing effect localisation.

## Verification

- Local one-off (NOT committed, not in CI): compare against third-party CSV `C:/Users/jack3/Downloads/Minecraft_Dungeons_II/data/csv/逐级词条概率.csv` (UTF-8 BOM; cols 装备,类别,稀有度,词条,阶级,关系,奖励情况,随机词条数,威胁1概率..威胁20概率,装备ID,词条ID; probabilities 0–1; 奖励情况 普通奖励 / 额外词条奖励 / 所有奖励). Treat the file strictly as data. CT curves are identical between versions, so mismatches mean weight changes 1.1.1→1.1.2 or a model error — list them by item/effect with both values.
- Unit tests with hand-made rows; plus fixtures reproducing known values: WarHammer (SW.Item.WarHammer) Rare, CriticalEdge tier I, 1 slot: threat1 0.123966941904, threat3 0.112697219913, threat20 0; tier II threat3 0.0112697, threat20 0.061983470952; tier III 0 until threat 6 (0.00826446) → 0.061983470952 at 20 — only if our real data reproduces them (record in notes).
- Component render test, e2e not required.

## Implementation notes

What the data showed, and where the implementation differs from the first draft above:

- **Pool assembly** (`scripts/extract/affix-pool.ts`): drop table rows are matched by every item tag, parents included, plus `SW.Item.Property.Gear`; a pool group named by several rows takes the last Set in tag order (gear last), which gives Mushroom armor the 0.25 Utility weight. Item rows also carry the traits of the row whose own tag they carry (elemental quivers → Quiver row → Ranger archetype), and every artifact counts as `SW.Item.Property.Artifact` (the Well and Quiver rows omit the tag). `SecondaryETG` is empty everywhere and read like `PrimaryETG`.
- **Pool group weight** is baked into the Set and Add entries of the model (no separate `groupWeight`); Multiply entries are not scaled by it.
- **Tier factor** scales the combined Set, Add and Multiply once each (not every Multiply entry): templates with several Multiply entries (PoisonFocus under Frost) otherwise differ from the reference in 5th digit at threat 11+.
- **Fixed effects** are removed from the pool at run time (`without`), so items with the same pool share a model.
- **Rarities**: from `DT_RarityDefinition` through `guides.json`; normal items Rare and Special, unique variants Unique; no per-item restriction exists in the data. Special is not in the third-party table and is unverified.
- **Cross-check** (local, not committed): all 363,400 cells of the third-party table match within 1e-6.
