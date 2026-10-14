# Minecraft Dungeons II Wiki

**English** · [繁體中文](README.zh-TW.md)

A fan-made reference for **Minecraft Dungeons II**, built straight from the game's own data and text, in 16 languages. The data matches **game version 1.1.2.0**.

**[Open the wiki →](https://mrpippi.github.io/mcd2-wiki/)**

![The wiki's home page in English](docs/images/en-home.webp)

## What you can look up

| Section | What's in it |
| --- | --- |
| **Melee and ranged weapons** | Damage, stagger, reach and knockback for every hit of the combo, the weapon's role and weight, and every effect it can roll at levels I, II and III |
| **Armor** | Every set and each of its pieces, with the slot, description and unique variant |
| **Artifacts** | Cooldown, soul cost, duration and area, plus the effects they can roll |
| **Talismans** | The value at each level and the XP needed to reach the next one |
| **Enchantments** | Values at levels I, II and III, and which enchantment books carry them |
| **Effects** | Every effect with its values at each level |
| **Bestiary** | Health, toughness, resistances, soul yield and drops for each mob, including the Soul-corrupted versions, and the areas where they spawn |
| **World map** | The Overworld, the Sift and the Camp, with minecart stations, rifts, teleport statues, merchants and area names |
| **Soul Storms** | A live countdown to the current and next storm in your time zone, the area rotation, Storm Generator difficulty, health and shields, and what the reward chests drop. The times are worked out from the game data and are marked as estimates until confirmed in game |
| **Build Planner** | Pick your weapons, armor, artifacts and talismans, then share the build as a link (it opens the same build) or download it as an image for social media |
| **Weapon Compare** | Up to three weapons side by side: combo damage, fire rate, reach, stagger, built-in bonus and the effects each can roll, with the best value marked; share it as a link |
| **Guides** | Game mechanics from the game's own data: vendor upgrade costs and unlocks, enchanting costs, rarity effects and drop weights, secret talismans, currency caps and recommended level by story stage; anything the data cannot explain is marked unconfirmed |
| **Quests** | Every core quest in story order, side quests by region, Echo Golem quests and boss replays, each with its objectives, prerequisites, the quests it unlocks, first-completion and repeat rewards, emeralds by quest size, and the mobs you fight. Item pages name the quest a reward comes from |
| **Locations** | One page per region with its area icon and the player level the game sets for it (where the game has them), a link to its spot on the map where the map marks it, the places inside it, the monsters found there by kind, its quests and its area loot. Mob and quest pages link to the region |
| **Bosses** | The 10 bosses and 6 mini-bosses in story order, with health, region, and the core quest and boss replay each one appears in, where the game data names them |
| **Achievements** | All Steam achievements with global unlock rates. Hidden ones stay hidden until you choose to reveal how to unlock them |

Item pages also list where an item comes from: quest rewards, chests, merchants or enchantment book pools.

![An item page: stats, rollable effects and where to get it](docs/images/en-item.webp)

## Handy features

- **Two languages side by side.** Turn on **Bilingual** to show each name and description in a second language as well: Traditional Chinese on the English site, English on every other site. It's useful when a friend plays in another language, or when a guide uses English names.
- **Search everything.** Search by name in your language or in English, from any page.
- **Filter lists.** Type to narrow a category, or show only Normal or Unique items.
- **Share a map view.** The map's address keeps the world, zoom and position, so you can send someone the exact spot. You can also filter the markers or search for a place.
- **Works on phones.** Every page is laid out for small screens.

![The world map with minecart stations, rifts and merchants](docs/images/en-map.webp)

![The bestiary, grouped into bosses, minibosses, mobs and variants](docs/images/en-bestiary.webp)

## Languages

繁體中文 · 简体中文 · English · 日本語 · 한국어 · Deutsch · Français · Español · Italiano · Português (Brasil) · Русский · Polski · Nederlands · Svenska · Türkçe · Українська

Item names, descriptions and other game text come from the game's own localization, so they match what you see in the game. The site's own wording (menus, labels, notes) is hand-written in Traditional Chinese and English and machine-translated into the other languages. Where a translation was found to be wrong, that line falls back to English.

## Good to know

- **Numbers are base values from the game files.** Difficulty, party size and gear power change what you see in a run.
- **Some things aren't in the game data.** For example, swing timings and damage per second live in animation files, so the wiki doesn't show them. Entries whose numbers can't be worked out from the data are left out rather than guessed.
- **When the game updates,** the wiki is updated by extracting the new game files again.

## Found a mistake?

Open an [issue](https://github.com/MrPippi/mcd2-wiki/issues) and include the page link and what you saw in the game. A screenshot helps.

## For contributors

How the data is extracted, how the map tiles are built and how to run the site locally: see [docs/MAINTAINING.md](docs/MAINTAINING.md) (in Traditional Chinese).

```bash
npm install
npm run dev
```

## Disclaimer

This is an unofficial fan site. It is not affiliated with or endorsed by Mojang Studios or Microsoft. Game text and images belong to their respective owners. The site's fonts (Noto Serif, Geist, Geist Mono) are licensed under the SIL Open Font License 1.1.
