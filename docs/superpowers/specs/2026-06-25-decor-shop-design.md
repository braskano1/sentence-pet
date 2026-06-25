# Decor Shop — Design (Phase A)

**Date:** 2026-06-25
**Status:** Approved, ready for plan
**Slice:** Phase A of the shop-categories roadmap (A decor → B pet-unlocks → C L3–L5 content).
**Predecessor:** Phase 0 art integration (PR #6, merge `eaa5659`).

## Goal

Sell **room backgrounds** the kid buys with coins and applies behind the pet in `PetRoom`. This is the **first persisted owned-items set**. Build the ownership infra cleanly because Phase B (pet-unlocks) reuses the exact same `owned` set + per-category active pattern.

## Scope

In:
- 7 room backgrounds as buyable decor, tiered pricing.
- Generic `owned: string[]` ownership + `activeBackground` selector. Persist bump 3→4 + migrate.
- Pure `buyDecor` reducer + ownership helpers, exhaustively unit-tested.
- `ShopItem` refactored to a discriminated union (`treat` | `decor`).
- Shop tabbed UI (`Treats | Decor`) + `DecorCard`.
- `PetRoom` renders the active room behind pet/stats with a radial scrim for legibility.
- Asset prep script (resize + webp, no bg removal) + sprite config.

Out (YAGNI): decor preview/zoom, sorting/filtering, sell-back, per-room music, animated rooms.

## Catalog

`GAME_CONFIG.shop.decor`, ids namespaced `decor:<slug>`. **Ids are always read from this catalog — never hand-typed string literals elsewhere.** Names are simple English (pre-A1 Thai M.4 learners; reinforces known vocab + the elemental theme of the 4 species).

| id | name | source png (`Pictures/room/`) | tier (coins) |
|---|---|---|---|
| `decor:beach` | Beach | `ChatGPT Image Jun 24, 2026, 10_14_23 PM.png` | 50 |
| `decor:forest-path` | Forest Path | `ChatGPT Image Jun 24, 2026, 10_14_20 PM.png` | 50 |
| `decor:night-room` | Night Room | `ChatGPT Image Jun 24, 2026, 10_14_17 PM.png` | 50 |
| `decor:forest-room` | Forest Room | `ChatGPT Image Jun 24, 2026, 10_13_51 PM.png` | 100 |
| `decor:sky-room` | Sky Room | `ChatGPT Image Jun 24, 2026, 10_14_00 PM.png` | 100 |
| `decor:fire-room` | Fire Room | `ChatGPT Image Jun 24, 2026, 10_13_47 PM.png` | 150 |
| `decor:water-room` | Water Room | `ChatGPT Image Jun 24, 2026, 10_13_55 PM.png` | 150 |

3 @ 50 / 2 @ 100 / 2 @ 150. Cheapest reachable in a few drills (~10–25 coins/round); elemental rooms (busiest art) are the goal. The three @50 are open, bright-centered scenes (good legibility, calm); the four elemental rooms map thematically to the fire/leaf/water/air species.

## Persist contract (the important one — Phase B reuses this)

Decision locked: **generic owned set, option A.** Pay the small id-namespacing-convention cost once; later categories are nearly free.

New persisted fields on the root state:

```ts
owned: string[]                 // e.g. ['decor:fire-room'] — id-namespaced, any category
activeBackground: string | null // a decor id, or null = free default (current bg-emerald-50)
```

- `owned` is the single ownership primitive for all categories forever. Phase B adds `pet:<species>` ids to the **same** array + an `activePet` field — no new owned set, no second migrate for ownership.
- The one risk of a generic string set (id typos failing silently) is killed by **deriving every id from the catalog config** — UI/store never construct decor ids by hand.

**Persist bump 3 → 4.** Migrate backfills `owned: []`, `activeBackground: null`. Mirror the existing v2→v3 species backfill pattern in `gameStore.ts` (~line 150):

```ts
return {
  selectedDrill: 'pattern',
  ...st,
  inventory: { ...freshInventory(), ...(st.inventory ?? {}) },
  pet: { ...freshPet(), ...(st.pet ?? {}), species: st.pet?.species ?? 'leaf' },
  owned: st.owned ?? [],
  activeBackground: st.activeBackground ?? null,
} as GameState;
```

Add a migrate test against the real `persist.getOptions().migrate` (assert a v3-shaped object backfills both new fields; assert an already-v4 object is preserved).

The store's inline initial state (in `create()`) and `resetForTest` both initialise `owned: []`, `activeBackground: null`. (There is no `freshState` helper today; if the initial-state literal + `resetForTest` start to drift, the plan may extract one — optional, not required.)

## Domain — `src/domain/decor.ts` (pure, exhaustively unit-tested)

Mirror `src/domain/shop.ts` (`purchase`) conventions: validate then return new values, no mutation.

```ts
export type BuyDecorResult =
  | { ok: true; coins: number; owned: string[] }
  | { ok: false; reason: 'already-owned' | 'insufficient-coins' };

export function isOwned(owned: string[], id: string): boolean;

export function buyDecor(
  state: { coins: number; owned: string[] },
  item: DecorItem,
): BuyDecorResult;
```

Ordering (mirrors `purchase`'s happiness-full-first guard): reject **`already-owned` first**, then **`insufficient-coins`**. On success: `coins - item.price`, `owned` = `[...owned, item.id]` (no dup possible — already-owned guarded).

Tests cover: not-owned + affordable → ok with new coins/owned; not-owned + too poor → `insufficient-coins`; already-owned (regardless of coins) → `already-owned`; `isOwned` true/false; no input mutation.

Equip is not a reducer — it is just the store setting `activeBackground` (no validation needed beyond owning it; UI only offers Equip on owned cards, store action may assert-own defensively).

## ShopItem type — discriminated union

`src/domain/shop.ts`:

```ts
interface ShopItemBase { id: string; name: string; price: number; }
export interface TreatItem extends ShopItemBase { kind: 'treat'; happiness: number; }
export interface DecorItem extends ShopItemBase { kind: 'decor'; sprite: string; } // sprite = imported webp url
export type ShopItem = TreatItem | DecorItem;
```

`purchase` narrows to `TreatItem` (or keeps its current `{coins,happiness}` state signature + reads `item.happiness` after a `kind === 'treat'` check). Existing treat catalog + `buyTreat` unchanged in behaviour. `canAfford` stays generic (uses `price` only).

## Store actions

```ts
buyDecor: (item: DecorItem) => void;       // runs domain buyDecor; on ok sets pet.coins + owned; no-op on !ok (UI disables)
equipBackground: (id: string | null) => void; // sets activeBackground (null clears to default)
```

`coins` currently lives on `pet`. `owned`/`activeBackground` live at **root** state (not on `pet`) — they are player inventory, not creature attributes, and Phase B `activePet`/pet ids belong at root too. `buyDecor` reads `pet.coins` + root `owned`, writes both.

## UI

### Shop — tabs
- Local tab state `'treats' | 'decor'`, default `'treats'`. Tab switcher row `[ Treats | Decor ]` at top. Scales to Phase B by adding a `Pets` tab.
- Treats tab: existing `TreatCard` list unchanged.
- Decor tab: grid of `DecorCard`, one per `GAME_CONFIG.shop.decor` item.

### `DecorCard.tsx` (new, render-only tested)
Thumbnail (imported webp) + name + price. State machine per card:
- **not owned, affordable** → `Buy` (price shown). Click → `buyDecor(item)`.
- **not owned, too poor** → `Buy` disabled (greyed), price shown.
- **owned, not active** → `Equip`. Click → `equipBackground(item.id)`.
- **owned, active** → `Equipped` (disabled/marked).

Derive states from `coins`, `isOwned(owned, item.id)`, `activeBackground === item.id`. Reuse `PressButton`. Add explicit `aria-label`s (folds toward the deferred a11y pass).

### PetRoom — render active background
- `activeBackground === null` → current `bg-emerald-50` (free default, unchanged).
- set → render the room webp full-bleed behind everything (`absolute inset-0`, `object-cover`), then a **radial scrim** (soft radial gradient, lighter/darker toward centre) behind the pet + stats so the transparent-cutout pet and `StatBars` stay legible over busy art. Room stays sharp at the edges. Map id→webp via the sprite config.

## Assets

- `scripts/prep-decor.sh` (ImageMagick `magick`, mirror `scripts/prep-sprites.sh`): for each of the 7 source PNGs → resize to **1280px wide** (backgrounds, wider than sprites) + convert to webp. **No background removal** — keep the full frame. Target `<~200kb` each; tune quality to stay within budget.
- Output to `src/assets/sprites/` (or a `decor/` subdir) as hashed webp imports.
- `src/config/decorSprites.ts` (mirror `src/config/sprites.ts`): map decor id → imported webp. Catalog `sprite` fields reference these.
- **Main thread runs the script + a montage QA gate** before wiring (visual/asset task, per established workflow). Watch total bundle budget — these are separate hashed assets, not in the JS bundle.

## Testing conventions (carry forward from Phase 0)

- Real logic in pure modules (`decor.ts`), unit-tested exhaustively. jsdom can't drive @dnd-kit/framer-motion — component tests render-only (mount, static text, click plain/`PressButton` buttons, assert store/DOM). Never assert animated style values.
- Migrate test against real `persist.getOptions().migrate`.
- `DecorCard`/Shop-tab tests: render, assert states, click Buy/Equip, assert store mutation. `motion`/`PressButton` render native elements → `getByRole` works.

## Docs to update on landing

`GAME_DESIGN.md` §7 — add a "Decor shop (shipped)" note. Keep both copies in sync (repo root + `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md`). Price the decor tier in §7/§12.

## Definition of done

- 7 decor items buyable + equippable; active room renders behind a legible pet.
- Persist v4 + migrate backfills both fields; migrate test green.
- `npm test -- --run` green, `npm run build` clean, `npx tsc -b` clean.
- Branch off `main` → PR → merge-commit (preserve TDD history).
