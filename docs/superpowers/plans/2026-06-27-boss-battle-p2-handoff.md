# Handoff — Boss Battle P1 complete → P2 (charge timer + active dodge)

**Date:** 2026-06-27
**Branch:** `feat-boss-battle-p1` (worktree `D:\ai_projects\AI_design_thinking\sentence-pet-boss`, off `main` `6060e39`).
**Status:** P1 turn-based boss battle is **code-complete, typechecked, full-suite green (635 passed), and production-build green.** 12 commits `353107e`..`0306052`.

## What P1 shipped
Checkpoint tap → BossPrep (pet-select + recommended power, never blocks) → skippable intro → BattleScreen: build correct sentences to fire elemental hits at a rival-pet boss. Five stats drive it: HP pool (`hp×8`), `atk`, ratio defense `atk×100/(100+def)`, `luk` crit (×2, cap 60%), `spd` first-strike + dodge. 4-cycle elements fire>air>leaf>water (×1.5/×0.75). Boss counters every 2nd item (turn-based). Win → reward + first-clear egg + bonus coins/XP, replay coin trickle. Lose → in-screen soft-retry overlay (full bars). Floating damage numbers; `boss` music zone.

## Architecture seams for P2
- **`src/domain/battle.ts`** — pure combat math, RNG injected. Stable; reuse as-is.
- **`src/domain/battleSession.ts`** — pure HP-snapshot reducer (`initBattle`/`applyPlayerHit`/`applyBossHit`, `BattleSnapshot`).
- **`src/state/battleStore.ts`** — live battle brain. `onWrong` **already rolls dodge and emits `dodge`/`bossHit`/`miss` events**; `onCorrect` emits `playerHit` (with `crit`). P2's active-dodge swipe + real-time charge timer layer ON TOP of this — the `BattleEvent` union is the seam for new SFX/VFX. `COUNTER_EVERY = 2` constant mirrors `GAME_CONFIG.battle.bossCounterEveryNItems`.
- **`BossTier`** (`src/domain/bossTiers.ts`) has reserved-but-unused `phases` and `projectileVfxLevel` fields — P3 (multi-phase ramp) and richer VFX wire these.
- **`src/components/battle/BattleScreen.tsx`** — turn-based loop. P2 adds: a charge/timer component, swipe-to-dodge gesture during the boss's counter window. The win `useEffect` hands off via `finishBoss(true)` then resets the battle slice.

## Known gaps / decisions for next session
1. **`u2-checkpoint` is `isCheckpoint: true` with NO `boss`** (`src/content/seed.ts`). It currently runs as a normal mixed drill that plays the win/lose stinger via `finishRound`'s `wasBoss` path. Decide: seed a boss on it, or leave checkpoints with two runtime meanings. Only `u1-checkpoint` is a real boss right now.
2. **Tile-clear in battle is a no-op** (`onClearSlot={() => {}}` in BattleScreen) — intentional P1 lean. If play-testing shows kids need undo, wire `DrillScreen`'s `handleClear`.
3. **Manual play-test NOT yet run** (Task 11 step 4). Automated checks are green; a human/dev-server pass through checkpoint→fight→win→reward and intentional-loss→retry is still recommended before merge. Dev was on http://localhost:5176/.
4. First-clear egg is added to the collection silently (via `lastPull`); RewardScreen shows stars/coins/Continue but not the egg. Fine for P1; surface it in P2 polish if desired.

## On merge
`git worktree remove` the boss worktree once `feat-boss-battle-p1` lands on `main`. See memory `sentence-pet-boss-battle-worktree`.
