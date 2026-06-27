# Boss Battle P2 — Design Spec (charge timer + active dodge)

**Date:** 2026-06-27
**Status:** Approved design (pre-implementation). Implementation plan to follow via `writing-plans`.
**Builds on:** P1 (shipped, merged PR #28) and the master design spec `2026-06-27-boss-battle-design.md` §12 (build phasing).

---

## 1. Scope

P2 = the **Pressure** phase. It layers a real-time **charge timer** and an **active dodge**
swipe on top of P1's turn-based boss battle, converting the tempo from "answer at your own
pace" to "beat the clock." Everything P1 ships stays.

**Out of scope (P3):** multi-phase HP ramp, enrage juice, sprite-growth, spot-the-error spell,
recorded audio assets.

---

## 2. Mechanics (decided)

### Per-item charge race
Each drill item, the boss's **charge ring** fills `0 → 100%` over `chargeMs` (~8s default).

- **Correct submit before full** → ring **interrupts**, an elemental bolt hits the boss
  (existing `onCorrect` path), next item with a fresh ring.
- **Ring fills first** → boss fires a **charged attack** → opens the **swipe-to-dodge** window.
- **Wrong answer** → ring **lurches** forward by `wrongLurchFrac` (~0.3) **and** the P1
  every-2nd-wrong counter still fires (see below). Retry the same item; ring keeps its
  (lurched) position.

### Two boss-attack sources (decided: keep both)
1. **Wrong-answer counter (P1, unchanged):** every `COUNTER_EVERY`-th wrong answer = an
   **immediate** counter hit. Dodge is the **instant SPD% roll** only — **no swipe window**.
2. **Charged ring attack (P2, new):** when the ring reaches 100%, the boss fires a telegraphed
   charged attack. This one opens the **active-dodge swipe window**.

Only the **charged** attack is swipe-dodgeable. The counter stays punchy/instant.

### Active dodge (swipe-to-dodge)
On a charged attack: a directional **"SWIPE!"** prompt appears for `swipeWindowMs` (~1.2s).

- **Swipe the pet aside in time** → guaranteed dodge, 0 dmg (skill beats the roll).
- **Too slow / no swipe** → fall back to the **SPD% roll** (`rollDodge`); success = 0 dmg,
  fail = DEF-reduced hit lands (`applyBossHit`).

Pure reflex — **no reading**, no direction-matching. Kid-simple.

### Strict timer (decided: max pressure)
The ring **never pauses** and runs a **fixed duration regardless of motion preferences**.
`prefers-reduced-motion` changes **rendering only** — the ring shows as a **static fill**
(no spin/sweep animation), same duration. (A spinning ring under reduced-motion would be an
accessibility violation; the timing is unchanged, only the animation is suppressed.)

This is intentionally more punishing than the master spec's "never punishes" lean. The
existing **soft retry** (free, full HP) and the **large HP pool** (absorbs dodge variance)
keep it survivable for an under-leveled kid.

---

## 3. Architecture (layers onto existing seams)

Mirrors the P1 component boundaries (pure domain → store slice → presentational components).

### `src/domain/battle.ts` — pure helpers (new)
Deterministic, no React, RNG/clock injected (elapsed passed in). TDD red→green.
- `chargeFraction(elapsedMs, chargeMs): number` — clamp `elapsed/chargeMs` to `[0, 1]`.
- `lurchedFraction(frac, lurch): number` — `min(1, frac + lurch)`.
- `swipeDodges(swipedAtMs, windowMs): boolean` — swipe landed within the window.

### `src/state/battleStore.ts` — charge state machine (extend)
New slice fields + actions, P1 paths intact:
- State: `charge: number` (0–1), `battlePhase: 'answering' | 'charged' | 'dodging'`.
- `tickCharge(dtMs)` — advance `charge`; when it crosses 1 in `answering`, transition to
  `charged` and emit a `bossCharge` event.
- `fireCharge()` — resolve the charged attack: open the swipe window (`dodging`); the UI calls
  `resolveSwipe`.
- `resolveSwipe(success: boolean)` — `success` → dodge (0 dmg, `dodge` event); else roll SPD
  dodge, on fail apply `applyBossHit` and emit a `chargedHit` event. Return to `answering`,
  reset `charge` for the next item.
- `onWrong` (extend) — add the ring lurch (`lurchedFraction`) alongside the existing counter
  logic. `COUNTER_EVERY` path unchanged.
- `reset` / `begin` — initialize `charge = 0`, `battlePhase = 'answering'`.
- `BattleEvent` union — add `{ kind: 'bossCharge' }` and `{ kind: 'chargedHit'; dmg: number }`.

### `src/components/battle/` — presentational (new + edit)
- **`ChargeRing.tsx` (new):** the boss timer ring; fills, color-shifts toward red near full;
  reduced-motion → static fill. Rendered inside `BossZone` (spec §9).
- **`DodgeSwipe.tsx` (new):** the swipe overlay — directional "SWIPE!" prompt + swipe gesture
  detection; calls `resolveSwipe(true)` on a valid swipe, auto-`resolveSwipe(false)` on
  window expiry.
- **`BattleScreen.tsx` (edit):** drive the real-time tick via a `useEffect` (rAF or interval)
  calling `tickCharge(dt)` while `battlePhase === 'answering'`; render `<DodgeSwipe>` when
  `battlePhase === 'charged'`. Drill input stays live throughout (clock pressures, never
  blocks input). Soft-retry already calls `begin`, which resets charge state.
- **`BossZone.tsx` (edit):** host the `ChargeRing`.

### `src/config/gameConfig.ts` → `GAME_CONFIG.battle` (extend)
One-file tuning, no per-boss values:
```
timer: {
  chargeMs: 8000,
  swipeWindowMs: 1200,
  wrongLurchFrac: 0.3,
}
```

---

## 4. UI / UX

- The **charge ring** lives in the boss zone (master spec §9: "charge-timer ring" on the
  boss). Fills over the item; color shifts toward red approaching full.
- **`bossCharge` SFX** rises with the fill (new recipe per master spec §10).
- The **`DodgeSwipe`** overlay shows a directional "SWIPE!" prompt on the charged attack;
  success = "Dodge!" pop + whoosh (`dodge`, existing juice), fail = `bossHit`/`chargedHit`
  flinch + red flash (existing juice).
- Three distinct negative beats preserved (Miss / Hit / Dodge), now plus the charged-attack
  telegraph.

---

## 5. Win / lose integration

Unchanged outcome path. Both the counter hit and the charged hit apply through the existing
`applyBossHit` → `snapshot`. Win/lose still resolve via `snapshot.outcome` →
`finishBoss(true)` / loss overlay. The soft-retry resets the charge state alongside the HP
snapshot.

---

## 6. Testing

- **Domain (TDD):** `chargeFraction` clamps; `lurchedFraction` caps at 1; `swipeDodges`
  window boundary. Pure, deterministic.
- **Store:** `tickCharge` crossing 1 → `charged` + `bossCharge` event; `resolveSwipe(true)` →
  dodge no damage; `resolveSwipe(false)` → SPD roll then `chargedHit`/dodge; `onWrong` lurch;
  `reset`/`begin` clear charge. RNG injected for determinism.
- **e2e:** extend `e2e/boss.spec.ts` — drive `window.store` to force the ring full, assert the
  charged attack fires and both dodge outcomes (swipe success / SPD fallback) resolve.

---

## 7. Tuning defaults (balance during build, not blockers)

- `chargeMs` 8000 · `swipeWindowMs` 1200 · `wrongLurchFrac` 0.3 · `COUNTER_EVERY` 2 (P1).
- Revisit per playtest: charge duration vs item difficulty, swipe window for youngest kids,
  lurch size, and whether the strict timer needs a per-tier `chargeMs` override later.

---

## 8. Open items carried from the P1 handoff (not P2 blockers)

- `u2-checkpoint` has `isCheckpoint: true` but no `boss` — still runs as a normal drill.
  Decide in P3 content work, not here.
- Tile-clear in battle is a no-op (`onClearSlot={() => {}}`) — wire only if playtest demands.
- First-clear egg added silently — surface in polish if wanted.
