# Spec — Pet Rename + Element System

**Date:** 2026-06-25
**Status:** approved (brainstorm)
**Base:** post-B-2 (gacha + collection). Assumes `PetInstance { id, species, hatched, xp, happiness, bars, stats, rarity }`, persist **version 6**, the `Collection` screen, `config/petDisplay.ts`, and `StatRadar`. Branch/merge decision deferred (designed ahead).

## Goal

Two cohesive pet-identity features:
1. **Rename** — players give pets custom names (default = species name), editable in the gacha reveal and in Collection.
2. **Elements** — the 4 species are elements with a strong/weak type wheel. Define the chart + a pure `typeMultiplier` now and surface matchups in Collection. **Combat use is deferred to B-3 battle** (which imports `typeMultiplier`).

## Decisions (pinned in brainstorm)

1. **Type wheel:** `Water > Fire > Air > Leaf > Water` (each strong vs the next; weak vs the one that beats it). Every pet is strong vs 1 element, weak vs 1, neutral vs 1.
2. **Multipliers:** strong **1.5×**, weak **0.75×**, neutral **1.0×**.
3. **Name:** new persisted `name: string` on `PetInstance`, default `''`. Display = `name.trim() || PET_NAME[species]`. Cap **14 chars**, trimmed. Blank reverts to species name.
4. **Naming entry points:** both — a skippable "Name your pet" field in the gacha reveal, and a ✎ inline edit in Collection.
5. **No profanity filter now** — names are single-player/local. Deferred to the future Firebase/multiplayer phase (names become visible to others → add moderation then).
6. **Persist bump 6→7** — additive backfill `name: ''` on every pet.
7. Element needs **no new field** (`species` is the element).

## Element domain — `src/domain/elements.ts` (pure)

```ts
import type { Species } from '../data/types';

/** Each element is strong vs the species it maps to (Water>Fire>Air>Leaf>Water). */
export const STRONG_VS: Record<Species, Species> = {
  water: 'fire',
  fire: 'air',
  air: 'leaf',
  leaf: 'water',
};

export const TYPE_STRONG = 1.5;
export const TYPE_WEAK = 0.75;
export const TYPE_NEUTRAL = 1.0;

/** Damage multiplier for `attacker` hitting `defender`. */
export function typeMultiplier(attacker: Species, defender: Species): number;

/** The element this species beats. */
export function strongAgainst(species: Species): Species; // = STRONG_VS[species]

/** The element that beats this species (i.e. this species is weak to it). */
export function weakAgainst(species: Species): Species;   // the s where STRONG_VS[s] === species
```
- `typeMultiplier(a, d)`: `TYPE_STRONG` if `STRONG_VS[a] === d`; `TYPE_WEAK` if `STRONG_VS[d] === a`; else `TYPE_NEUTRAL`. (The wheel is a 4-cycle, so a and d are never both strong vs each other.)
- `weakAgainst`: find the key `s` with `STRONG_VS[s] === species` (exactly one in a 4-cycle).
- Constants live here (fixed game rules), not `gameConfig`. B-3 battle imports `typeMultiplier`.

## Name domain + store

- `src/domain/petName.ts`: pure `sanitizePetName(raw: string): string` — `raw.trim().slice(0, 14)`. (Empty stays empty → display falls back to species name.) Cap constant `MAX_PET_NAME = 14` exported.
- `src/state/gameStore.ts`: action **`renamePet(id: string, name: string)`** — maps the pet with matching id to `{ ...p, name: sanitizePetName(name) }`; no-op on unknown id. Does **not** require the pet to be active (Collection can rename any pet).

## Persist migrate 6→7

Mirror the existing additive backfill pattern in `gameStore.ts`:
- Bump `version: 6` → `7`; update the migrate comment.
- After the existing rarity backfill, backfill `name` on any pet lacking it: `name: typeof p.name === 'string' ? p.name : ''`. Guard with `Array.isArray(base.pets)` (same as the rarity step).
- The v<5 legacy branch's constructed pet also gets `name: ''` (via `makePet` — see below).
- Test against the real `persist.getOptions().migrate`: v6→v7 backfills `name: ''`; v7 passthrough keeps a custom name.

## `makePet` + display helpers

- `makePet` (`src/domain/pets.ts`): add `name` to the returned object, defaulting to `''` (optional arg `name?: string`, default `''` — gacha/starter don't pass it; rename happens after creation). Update the `makePet` tests to assert `name === ''` by default.
- `config/petDisplay.ts`:
  - `petDisplayName(pet: PetInstance): string` = `pet.name.trim() || PET_NAME[pet.species]`.
  - `ELEMENT_EMOJI: Record<Species, string>` = `{ leaf:'🍃', fire:'🔥', air:'💨', water:'💧' }`.
- Replace `PET_NAME[species]`/`PET_NAME[p.species]` with `petDisplayName(pet)` in **PetRoom**, **Gacha** reveal, **Collection** (detail + roster). Where a custom name is set, show the species name as a small subtitle/tag so the species stays legible (e.g. Collection detail: big custom name + small "Fire" tag).

## UI

### Gacha reveal (`Gacha.tsx`)
- In the revealed state, add a **"Name your pet"** text input (`maxLength=14`) + a **Save/Name** button, plus the existing path that leaves the default. Skipping (blank) keeps the species name. On save, call `renamePet(pulled.id, value)`. The reveal already has `lastPull` (the pulled pet id).
- Keep render-only test discipline: test that typing + Save calls through to the store (`pets` reflects the new name); never assert animation.

### Collection (`Collection.tsx`)
- Detail panel: show `petDisplayName(active)` as the title with a ✎ button; tapping toggles an inline text field (`maxLength=14`) + Save → `renamePet(active.id, value)`. Species name shown as a small tag beside/under the title.
- Add an **element line**: `Strong vs {ELEMENT_EMOJI[strongAgainst(species)]} {PET_NAME[strongAgainst]} · Weak vs {ELEMENT_EMOJI[weakAgainst(species)]} {PET_NAME[weakAgainst]}`.
- Roster chips + detail: small element-emoji badge per pet.

## Testing

- **Pure (deterministic):**
  - `elements.test.ts`: all 16 attacker×defender pairs of `typeMultiplier` (4 strong = 1.5, 4 weak = 0.75, 8 neutral = 1.0); `strongAgainst`/`weakAgainst` for each species; sanity that the wheel is a 4-cycle (each species appears exactly once as a `STRONG_VS` value).
  - `petName.test.ts`: `sanitizePetName` trims, caps at 14, passes empty through.
  - `petDisplay` (or inline): `petDisplayName` returns custom when set, species name when blank/whitespace.
- **Store:** `renamePet` sets/trims a name, reverts on blank, no-ops on unknown id; works on a non-active pet.
- **Migrate:** v6→v7 backfills `name: ''`; v7 with a custom name passes through; existing v<6 tests still green.
- **Component (render-only, jsdom):**
  - Collection: ✎ reveals the field; typing + Save updates the store; element line renders the right strong/weak species.
  - Gacha: name field present in the reveal; Save sets the pulled pet's name.
  - Anchor any new label regexes (naming-collision trap).

## Out of scope

- **Battle damage** using `typeMultiplier` — B-3.
- **Name moderation / profanity** — Firebase/multiplayer phase.
- Renaming the *species* set or adding elements beyond the 4.

## Docs to sync on landing

`GAME_DESIGN.md` §7/§12 (both repo-root and H: copies) — add a note: custom pet names; the element type wheel (Water>Fire>Air>Leaf>Water, 1.5/0.75) with combat deferred to B-3.

## Suggested implementation split (for writing-plans)

Two parts, each independently green:
- **Part 1 — Elements:** `elements.ts` + tests; Collection element line + emoji badges; docs.
- **Part 2 — Rename:** `name` field + `makePet` + `sanitizePetName` + `renamePet` + migrate 6→7; `petDisplayName`; Gacha reveal field; Collection ✎; tests.
