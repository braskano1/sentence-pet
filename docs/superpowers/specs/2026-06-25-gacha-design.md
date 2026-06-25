# Spec — Phase B-2: Gacha

**Date:** 2026-06-25
**Status:** approved (brainstorm)
**Builds on:** Phase B-1 multi-pet foundation (PR #8). Reuses the `pets[]` + `activePetId` + account-wallet contract and the `BattleStats`/`PetInstance`/`makePet`/`rollStats` shapes. Does **not** invent a parallel pet store.

## Goal

Replace "buy a chosen species" with a **gacha egg pull**: spend coins on a single egg → roll a random rarity, then a random species + rarity-tiered stats → append a new `PetInstance` to `pets[]`. Duplicates allowed (pinned in B-1). This is the payoff for B-1's instance model.

## Decisions (pinned in brainstorm)

1. **Rarity:** 4 tiers, weighted roll, each maps to a stat band. Rarity is **persisted** on `PetInstance` → persist bump **5→6**.
2. **Price:** single egg, **60 coins**. Single pull only (no multi-pull / pity / 10x — YAGNI).
3. **Placement:** dedicated `'gacha'` screen, reached from PetRoom. Full-screen reveal.
4. **After pull:** new pet **joins the collection only** — `activePetId` is unchanged. New pet is created `hatched: true` (the reveal is its hatch ceremony).
5. **Species:** uniform random across the 4 (leaf/fire/air/water).
6. **Collection cap:** unlimited.
7. **Migrate 5→6:** derive each pre-existing pet's `rarity` from its existing stats (option b), not a flat default.

## Rarity model

| Rarity | Weight | Stat band (each of HP/ATK/DEF/SPD/LUK) |
|---|---|---|
| `common` | 65% | 40–60 |
| `rare` | 25% | 55–75 |
| `epic` | 8% | 72–88 |
| `legendary` | 2% | 85–90 |

- All five stats roll independently **within** the rolled rarity's band, so rarity strongly correlates with battle power (legible to a kid).
- Weights and bands live in `gameConfig` (a new `gacha` section), next to `shop`. Tunable without touching domain.
- Bands intentionally overlap (e.g. Common 40–60, Rare 55–75) — rarity is the headline, exact stats vary within band.

## Data model changes

`src/data/types.ts`:
```ts
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface PetInstance {
  // ...existing fields...
  rarity: Rarity; // rolled once at creation, immutable thereafter
}
```

`makePet` (`src/domain/pets.ts`) gains a **required** `rarity` arg. Both callers (gacha pull, starter `freshPet`) pass it explicitly — starter passes `'common'`.

## Domain — `rollRarity` + `rollStatsForRarity`

`src/domain/pets.ts` (pure, injected RNG, deterministic tests):
- `rollRarity(rng: () => number, weights): Rarity` — weighted pick. Weights passed in from `gameConfig` (or read inside; keep RNG injected).
- `rollStatsForRarity(rarity, rng, bands): BattleStats` — each stat rolls flat within the rarity's `[min,max]` band.
- Keep the existing `rollStats(rng)` working (it may delegate to `rollStatsForRarity('common', ...)` or stay as a flat helper — plan decides; the starter pet path must not regress).

## Domain — `pullEgg` (mirrors `buyDecor`)

`src/domain/gacha.ts` (pure, no mutation):
```ts
export type PullEggResult =
  | { ok: true; coins: number; pet: PetInstance }
  | { ok: false; reason: 'insufficient-coins' };

export function pullEgg(
  state: { coins: number },
  args: { price: number; id: string; rng: () => number },
): PullEggResult;
```
- Rejects `insufficient-coins` when `state.coins < price` (no mutation on reject).
- On success: `rollRarity` → uniform `species` → `rollStatsForRarity` → `makePet({ id, species, stats, rarity, hatched: true })`; returns `{ ok, coins: state.coins - price, pet }`.
- `id` and `rng` are injected by the store so the domain stays deterministic. The pet id must be unique across pulls (store generates it — counter or rng-based; plan decides).

## Store action — `pullEgg()`

`src/state/gameStore.ts`:
- New action `pullEgg()` calls the domain `pullEgg` with `{ coins }`, the configured price, a fresh unique id, and the store `rng`.
- On `ok`: `set({ pets: [...s.pets, res.pet], coins: res.coins, screen: 'gacha' })` — append, deduct, **leave `activePetId` unchanged**, route to (stay on) the reveal. The screen component holds the just-pulled pet for the reveal (return it / track `lastPull`).
- On reject: no-op (UI disables Pull when `coins < price`; defensive parity with `buyTreat`/`buyDecor`).
- Reveal needs the pulled pet — add `lastPull: PetInstance | null` to state (set on success, cleared on leaving the gacha screen) so the reveal renders deterministically. The store has no `partialize`, so `lastPull` persists with the rest — harmless (it is a pet already in `pets[]`); no special handling needed. `freshState`/`resetForTest` set it `null`.
- **Do NOT reuse** DevPanel's dev-only `addPet` — gacha is a real validated action + pure domain + tests.

## Persist migrate 5→6

Mirror the existing version-branching additive pattern in `gameStore.ts`:
- The v<5 branch (legacy single `pet` → `pets[]`) stays untouched.
- New additive step: for any pet lacking `rarity`, derive it from its stats — `rarityForStats(stats)` pure helper (e.g. band the pet's **minimum** stat falls into, clamped to the nearest tier). Keeps old pets internally consistent with the new tier bands.
- Newly-created saves (v6) pass through. Test against the real `persist.getOptions().migrate`: v4→v6, v5→v6, v6 passthrough.
- Bump `version: 5` → `6`; update the migrate comment.

## UI — Gacha screen + reveal

- Add `'gacha'` to the `Screen` union (`types.ts`).
- **PetRoom:** add an **Eggs** button beside Shop/Play → `setScreen('gacha')`.
- **`src/components/Gacha.tsx`:**
  - Idle: `EGG_SPRITE`, coin balance (`useCountUp`), `Pull · 60🪙` `PressButton` (disabled when `coins < 60`), Back → PetRoom.
  - On pull: reveal sequence — egg shake → crack → species sprite (`SPRITES`/`ELEMENTAL_EGGS`) + **rarity badge** + stat readout (reuse `BATTLE_STAT_LABELS` from PetRoom) + confetti (`fireConfetti`, intensity scaled by rarity). Then "Back to room" → PetRoom.
- Confetti import means tests transitively importing `celebrate.ts` must `vi.mock('canvas-confetti')`.

## Testing

- **Pure/unit (deterministic, injected RNG):** `rollRarity` (weight boundaries hit each tier), `rollStatsForRarity` (every stat within band for each rarity), `pullEgg` (insufficient-coins reject + no mutation; success shape, coins deducted, pet hatched + has rarity), `rarityForStats`, migrate (v4→v6 / v5→v6 / v6 passthrough, rarity backfilled).
- **Store:** `pullEgg()` appends to `pets[]`, deducts coins, leaves `activePetId` unchanged, sets `lastPull`; no-op when too poor.
- **Component (render-only, jsdom):** Gacha mounts; Pull disabled when poor / enabled when affordable; static reveal text after a forced pull. **Never assert animated style values.** Anchor any new label regexes (naming-collision trap — e.g. `/^eggs$/i`).

## Bundled-in (deferred follow-ups, natural here)

- **a11y pass** (project `accessibility` skill): the Shop tab buttons want `role=tab`/`aria-selected`/`role=tablist`; add explicit `aria-label`s to the new Eggs/Pull/Back buttons and the rarity badge. Do the Shop tab roles in the same pass since we're touching shop-adjacent UI.
- **Shop scroll-chain** fix (AppShell `min-h-[100dvh]` → `h-[100dvh]` or `max-h`+`overflow-hidden`) — only if gacha screen hits the same overflow; verify across screens.

## Out of scope (later phases)

- Multi-pull / pity / 10x / duplicate-merge. No.
- Battle (B-3) — but `rarity` + `stats` on every pet feed it.
- Firebase/multiplayer. No.

## Docs to sync on landing

`GAME_DESIGN.md` §7 (repo root **and** the H: drive copy) — add a "Gacha (Phase B-2, shipped)" note with the price (60) and the rarity table.
