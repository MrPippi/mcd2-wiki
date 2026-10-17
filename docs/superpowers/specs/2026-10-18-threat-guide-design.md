# Threat & difficulty guide — design

PR ① of three (② per-threat affix odds, ③ drop odds). Builds the curve-table reading those two reuse.

## Source

- `source-data/CurveTables/CT_*.json`: CUE4Parse CurveTable exports from `/Game/Spicewood/GameplayLogic/` (and `AttributeCurves/CT_AttributeAdjustments`). Shape: `[{Type:"CurveTable", Name, CurveTableMode:"SimpleCurves"|"RichCurves", Rows:{<row>:{InterpMode?, Keys:[{Time,Value,InterpMode?...}], PreInfinityExtrap?, PostInfinityExtrap?}}}]`.
  - SimpleCurves: row-level `InterpMode` numeric (0 linear, 1 constant/step; treat any other as reported issue). RichCurves: per-key `InterpMode` string (`RCIM_Linear`, `RCIM_Constant`; `RCIM_Cubic` → report, fall back to linear).
  - Extrapolation: constant beyond end keys (the exports use 4 = constant; anything else → report, still clamp).
- References come from DataTables, never hard-coded curve names:
  - `DT_GameBalanceDefinition` row `SecondPass`: `GameBalanceDefinition.GlobalDifficultyScalingSettings.{Outgoing,Incoming}DamageModifierCurve`, `ItemCreatorConstants.RarityChanceMap[SW.Rarity.*]`, `ItemCreatorConstants.EffectChanceScalingCurves[SW.Effect.Tier.1..3]`, `CharacterLevelsPerThreat`.
    - `Active` row has no curves; we use `SecondPass` and flag it unconfirmed (which row the game runs is not in the data; atlas notes recommended level = max(threat−1,0)×5 which matches SecondPass `CharacterLevelsPerThreat` 5).
  - `DT_DifficultyDefinition` (Normal/Low/High): `DifficultyScalar`, `DifficultyCurve{Incoming,Outgoing}Damage {CurveTable, RowName}`, `Icon`, texts (Name, Description, Description.DifficultyDamageReceived/Dealt — use whatever keys exist via LOCTABLE).
    - Normal references row `NormalDifficultyMultiplier`, absent from CT_DifficultySettings → value 1, flagged unconfirmed + issue in extract-report.
  - `DT_RarityChanceDefinition` row whose TypeTag/name is the low-difficulty one (Multiply Special 0, Unique 0) → "low difficulty drops no Special/Unique".
  - `DT_WorldActorDefinition` → `CT_MobSpawnSettings` rows (variant spawn chance min/max, soul-stated & miniboss spawn cost min/max). Find refs by walking for `{CurveTable, RowName}`.
- Curve ref format: `/Script/Engine.CurveTable'/Game/Spicewood/GameplayLogic/CT_X.CT_X'` → file `CT_X.json` (search CurveTables dir recursively by basename).

## Extractor

- `scripts/extract/curve-tables.ts`: zod schema, `loadCurveTables(sourceRoot)`, `parseCurveRef`, `evaluateCurve(curve, t)`, `sampleThreat(curve, 1..20)`. Missing CurveTables dir → empty + issue (site still builds; guide section hidden).
- `scripts/extract/guides-threat.ts`: builds `threat` + `difficulty` sections into `guides.json` (extend `GuidesDataSchema` in guides-schema.ts). Register tables in `GUIDE_TABLE_FILES`.
- Output per threat level 1..20: `{level, recommendedLevel, attackPower, damageResistance, effectTiers:[t1,t2,t3], rarity:{common,rare,special,unique}, mobVariantChance:{min,max}, soulStatedCost:{min,max}, minibossCost:{min,max}}` (omit fields whose ref is missing, report issue).
- Difficulty: `[{id:"low"|"normal"|"high", scalar, name: Localized, description: Localized, received?:Localized, dealt?:Localized, incoming, outgoing, noRareDrops?: boolean, icon?}]`.

## Page

- `src/pages/[lang]/guides/threat.astro` via `GUIDES` in src/lib/guides.ts (hub test count 5 → 6). Title/summary i18n keys in zh.json + en.json; prefer game strings via ui-game-keys.json where a game string exists (e.g. threat/difficulty labels).
- Sections: difficulty cards (game texts + multipliers + low-difficulty drop note); threat table 1–20 (sticky header, horizontally scrollable on phone); short notes: tier II from threat 3, III from 6, no tier I at 20 — derive these thresholds from the data (first level with factor > 0 / last with factor 0), not literals.
- `GuideUnconfirmed` notes for SecondPass choice and the missing Normal row (guides-status.json flag `threatBalanceRow`).

## Tests

- Unit: curve evaluation (linear/step/clamp/RichCurve) with fixtures; expected integers from atlas cross-check: Tier1 at 9..20 = 1,1,.9,.8,.7,.6,.5,.4,.3,.2,.1,0; Tier2 at 9..12 = .7,.8,.9,1; Tier3 at 9..15 = .4,.5,.6,.7,.8,.9,1; Rarity threat1 common1 rare.6 special0 unique0, threat20 .5/.5/1/1.
- Unit: guides-threat builder with helper rows; schema; missing-ref issues.
- Component render test for the page; hub count.
- Integration pipeline test includes a CurveTables fixture.

## Docs

`docs/MAINTAINING.md`: CT export path (`Spicewood/Content/Spicewood/GameplayLogic/CT_*.json` → `source-data/CurveTables/`).
