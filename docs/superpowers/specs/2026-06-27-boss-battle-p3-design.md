# Boss Battle P3 — Design Spec (multi-phase + spot-the-error)

**Date:** 2026-06-27
**Status:** Approved design (pre-implementation). Implementation plan to follow via `writing-plans`.
**Builds on:** P1 (merged PR #28), P2 (merged PR #29), and the master design spec
`2026-06-27-boss-battle-design.md` §6 (phases / sprite-growth sizing rule), §8 (spot-the-error
spell), §10 (juice incl. `enrage`), §12 (build phasing).

---

## 1. Scope

P3 = the **Climax** phase. It layers, on top of P2's timer-paced boss battle:

1. **Multi-phase bosses** — crossing a boss-HP threshold ramps the charge timer + boss hits,
   grows the boss sprite, and plays an **enrage** beat.
2. **Spot-the-error spell** — fired **on phase-cross**: the boss casts a wrong sentence; the kid
   taps the wrong word to break the spell and counter-attack. Reuses the existing `GrammarTrap`
   near-miss data.
3. **Recorded audio** generated via ElevenLabs, dropped into the existing `registerSample` seams.
4. **Polish + balance pass.**

Everything P1/P2 ships stays. Drill difficulty does **not** climb with phases — only pressure does.

**Out of scope (deferred):** streak super-bolt, weak-word guaranteed crit, word-bank volley,
multiplayer team-of-3, comeback-aid/hint system, per-tier `chargeMs` override.

---

## 2. Content / bosses (decided)

Three checkpoint bosses form a difficulty ladder, one per unit:

| Checkpoint | Tier | Phases | Note |
|------------|------|--------|------|
| `u1-checkpoint` — Ember Rival | `tier-1` | 1 | unchanged from P1 (`fire`) |
| `u2-checkpoint` | `tier-2` | 1 | **add** `boss` block (currently no boss) |
| `u3-…-checkpoint` (new unit) | `tier-3` | 2 | **the multi-phase showcase** |

- `u2-checkpoint` gets a `boss`: tier-2, an element with a clear counter (e.g. `water`), a name,
  and a `rivalSprite`. It keeps its existing `itemIds`.
- A **new unit `u3`** is added to the seed: a couple of practice lessons reusing existing pool
  item ids (mirrors how `u2-checkpoint` reuses `mx-l1-*`) + a checkpoint lesson carrying a
  **tier-3** boss. tier-3 has `phases: 2`, so this boss exercises one phase-cross at 50% HP.
- **No edits to `BOSS_TIERS`** — phase counts come from the existing tier rows
  (tier-1/2 = 1 phase, tier-3 = 2 phases). Resolves the P1/P2 carry-over "`u2-checkpoint` has no
  boss" open item.

---

## 3. Mechanics (decided)

### Phase thresholds
A boss with `phases = N` has `N − 1` HP-fraction thresholds, evenly spaced:
- 1 phase → `[]` (no cross; identical to P2 behaviour).
- 2 phases → `[0.5]`.
- 3 phases → `[0.66, 0.33]` (i.e. `2/3`, `1/3`).

`phaseIndex` starts at 0. When a player hit drops boss HP **to or below** the next threshold
fraction (`bossHp / bossHpMax <= threshold`), `phaseIndex` increments and a **phase-cross**
fires. A single hit can cross at most one threshold per resolution step (pure-math guarantee;
big crits that skip a band still advance exactly one phase per hit — acceptable for the small
phase counts in scope).

Phase-cross is checked in **one place only**: after `applyPlayerHit` in `onCorrect` (the sole
path that lowers boss HP). Boss attacks never lower boss HP, so no cross check is needed there.

### Per-phase ramp
On each phase-cross:
- **Charge timer shortens:** effective `chargeMs = baseChargeMs × chargeMult^phaseIndex`
  (`chargeMult < 1`, e.g. 0.8).
- **Boss hits harder:** boss atk is multiplied by `atkMult^phaseIndex` (`atkMult > 1`, e.g. 1.25)
  when computing boss damage (both counter and charged hits).
- **Sprite grows** (see §5 sizing rule).
- **Enrage beat** plays (flash/shake/color shift + `enrage` stinger).
- **Spot-the-error spell** is cast (see §4).

Ramp factors live in **one config block**, not per-boss.

### Spot-the-error spell (on phase-cross)
On a phase-cross the battle enters a `spell` sub-mode instead of immediately returning to
`answering`:
- A wrong sentence is built from the **current/next** drill item that has `traps` (a `GrammarTrap`
  injected at its slot → a tempting near-miss sentence). Builder is pure + deterministic.
- The kid taps the **wrong word** (the trap slot) to **break the spell** → a bonus counter-hit on
  the boss (`spellBreakMult × base player hit`).
- **Wrong tap or timeout** → the spell resolves as the boss landing a (ramped) hit on the pet
  (`applyBossHit`), no counter.
- **Graceful fallback:** if no eligible item with `traps` is available, the spell is skipped — the
  phase-cross still enrages + ramps + grows, it just doesn't open a spell. (Keeps the feature
  robust against content gaps.)

The spell is layered over the enrage beat; the charge timer is paused while the spell is open
(mirrors how the `charged` swipe window halts the tick).

---

## 4. Architecture (layers onto existing seams)

Mirrors P1/P2 boundaries: pure domain → store slice → presentational components.

### `src/domain/bossTiers.ts` — pure phase math (extend)
Deterministic, no React. TDD red→green.
- `phaseThresholds(phases: number): number[]` — `[]` / `[0.5]` / `[0.66, 0.33]` per §3. Generalised
  to evenly-spaced `(N-1)` fractions: `i/N` for `i = N-1 .. 1`.
- `phaseScale(phaseIndex: number, phases: number): number` — sprite scale within the reserved box;
  final phase = `1.0`, earlier phases smaller. Generalised:
  `MIN + (1 - MIN) × phaseIndex / (phases - 1)` (single-phase → `1.0`). With `MIN = spriteScaleMin`
  (0.7): 2 phases → `0.7 / 1.0`; 3 phases → `0.7 / 0.85 / 1.0`.

### `src/domain/battle.ts` — spell builder (new pure helper)
- `buildSpellChallenge(item, rng): { words: string[]; wrongIndex: number; tip: string } | null`
  — pick a `trap` from `item.traps` (rng-indexed), substitute its `word` at `trap.slot` into a copy
  of `item.answer`, return the rendered word row, the index the kid must tap, and the trap `tip`.
  Returns `null` when `item` has no usable trap. Pure, deterministic (rng injected).

### `src/state/battleStore.ts` — phase + spell (extend)
P1/P2 paths intact. New state + actions:
- State: `phaseIndex: number`, `spell: { words: string[]; wrongIndex: number; tip: string } | null`.
- `battlePhase` union extends to `'answering' | 'charged' | 'spell'`.
- `BattleEvent` union adds `{ kind: 'enrage'; phaseIndex: number }` and
  `{ kind: 'spellBreak'; dmg: number }`.
- `begin` / `reset` initialise `phaseIndex = 0`, `spell = null`.
- `onCorrect` (extend) — after `applyPlayerHit`, compute the boss's phase from
  `phaseThresholds(tier.phases)` vs `bossHp/bossHpMax`. If it increased: set `phaseIndex`, build a
  spell challenge from the next eligible item, set `battlePhase = 'spell'` (or stay `answering` if
  the builder returns `null`), and emit an `enrage` event. (When `outcome === 'win'` the cross is
  ignored — the fight is over.)
- Boss-damage computation (`onWrong` counter + `resolveSwipe` charged hit) multiplies boss atk by
  `atkMult^phaseIndex`.
- `tickCharge` uses the **ramped** `chargeMs` (`baseChargeMs × chargeMult^phaseIndex`) and stays
  paused unless `battlePhase === 'answering'` (so it is also paused in `spell`).
- `resolveSpell(wordIndex: number)` (new) — only valid in `'spell'`. `wordIndex === spell.wrongIndex`
  → bonus player hit (`spellBreakMult`), emit `spellBreak`, return to `answering`. Else → ramped
  `applyBossHit`, emit `bossHit`, return to `answering`. Clears `spell`, resets `charge`.

### `src/components/battle/` — presentational (new + edit)
- **`SpellOverlay.tsx` (new):** mirrors `DodgeSwipe`. Shows `spell.words` as a row of tappable word
  chips; tapping a chip calls `resolveSpell(index)`. A short timeout auto-resolves as a miss
  (`resolveSpell(-1)`). Surfaces `spell.tip` as a gentle scaffold. `useReducedMotion`-aware.
- **`BossZone.tsx` (edit):** reserve the **largest-phase bounding box** up front; render the boss
  sprite scaled by `phaseScale(phaseIndex, phases)`. Add **phase pips** (filled up to `phaseIndex`).
  On `enrage`: color shift + scale-up (snap under reduced-motion).
- **`BattleScreen.tsx` (edit):** render `<SpellOverlay>` when `battlePhase === 'spell'`; the rAF
  tick already gates on `answering`, so the timer pauses during the spell for free. Wire the
  `enrage` event to the flash/shake juice + `enrage` stinger.
- **`ChargeRing.tsx`:** unchanged — a smaller ramped `chargeMs` just makes it fill faster.

### `src/config/gameConfig.ts` → `GAME_CONFIG.battle` (extend)
```
phaseRamp: {
  atkMult: 1.25,      // boss atk × this ^ phaseIndex per phase
  chargeMult: 0.8,    // chargeMs × this ^ phaseIndex (shorter window per phase)
  spellBreakMult: 1.5,// bonus multiplier on a spell-break counter hit
  spriteScaleMin: 0.7,// smallest phase's sprite scale within the reserved box
},
spellWindowMs: 4000,  // spot-the-error tap window before auto-miss
```

---

## 5. Phase sprite-growth sizing rule (master spec §6)

The boss zone **reserves a fixed bounding box equal to the largest (final) phase's footprint**,
computed up front from the tier's phase count. Earlier phases render the **same sprite scaled
down** (`phaseScale`) within that reserved box; the final phase fills it. Layout space is
allocated for the biggest size from the start, so growth happens **inside a stable footprint** and
never reflows the HP bars / pet strip / drill. `useReducedMotion` → **snap** to the new scale
instead of animating.

---

## 6. Juice (master spec §10)

| Moment | Animation | SFX |
|--------|-----------|-----|
| **Phase cross / enrage** | boss sprite scales up (within reserved box), enrage flash + shake, element color shift, phase pip fills | `enrage` stinger |
| **Spell cast** | spell overlay slides in, wrong-sentence chips presented | (enrage carries it) |
| **Spell break (correct tap)** | tapped chip pops, bonus bolt → boss flinch + HP drain | `crit`/`hit` |
| **Spell fail (wrong/timeout)** | pet flinch + red flash | `bossHit` |

Reduced-motion: snap scale, no shake, no slide — timing/outcomes unchanged.

### Recorded audio
Generate via the ElevenLabs sound-generation API (key in `.env.local`, same pipeline as the music
tracks), save to `public/audio/`, and register over the synth recipes via `registerSample`:
`enrage`, `hit`, `crit`, `dodge`, `bossHit`, `bossCharge`, `fizzle`. The synth recipes remain as a
fallback if a sample is missing. (Verify an `enrage` synth recipe exists; add it if not.)

---

## 7. Win / lose integration

Unchanged outcome path. Phase-cross only mutates `phaseIndex` + ramp; `applyPlayerHit` /
`applyBossHit` and the `snapshot.outcome` → `finishBoss` flow are untouched. A phase-cross that
also drops boss HP to 0 resolves as a **win** (the cross is ignored — no enrage on a dead boss).
Soft-retry's `begin` resets `phaseIndex = 0` and `spell = null` alongside the HP snapshot.

---

## 8. Testing

- **Domain (TDD, pure):** `phaseThresholds` for 1/2/3 phases; `phaseScale` endpoints + midpoints;
  `buildSpellChallenge` — injects the trap at the right slot, returns the correct `wrongIndex`,
  returns `null` with no traps. RNG injected.
- **Store:** a player hit crossing a threshold increments `phaseIndex`, emits `enrage`, enters
  `spell` (or stays `answering` when the builder returns `null`); ramped boss atk grows hits;
  ramped `chargeMs` shortens the fill; `resolveSpell(correct)` → `spellBreak` + boss HP drops;
  `resolveSpell(wrong)` → ramped `bossHit`; a kill-hit that also crosses resolves as `win` with no
  enrage; `begin`/`reset` clear phase + spell. RNG injected for determinism.
- **e2e:** extend `e2e/boss.spec.ts` (or a new `boss-p3` case) — drive `window.battleStore` on the
  tier-3 cp3 boss to a phase-cross; assert `enrage` fires, the spell overlay opens, and a correct
  tap resolves (`spellBreak`) returning to `answering`.

---

## 9. Tuning defaults (balance during build, not blockers)

- `phaseRamp.atkMult` 1.25 · `chargeMult` 0.8 · `spellBreakMult` 1.5 · `spriteScaleMin` 0.7 ·
  `spellWindowMs` 4000.
- Revisit per playtest: ramp aggressiveness vs the soft-retry safety net, spell window for the
  youngest kids, whether tier-3's single cross feels climactic enough or wants a 3-phase tier-5
  checkpoint later, and per-tier element matchups across the cp1→cp3 ladder.

---

## 10. Open items carried forward (not P3 blockers)

- Tile-clear in battle is still a no-op (`onClearSlot={() => {}}`) — wire only if playtest demands.
- First-clear egg added silently — surface in the polish pass if wanted (RewardScreen egg reveal).
- A 3-phase (tier-5) checkpoint is **not** seeded in P3 — tier-3's 2-phase boss is the showcase;
  add a tier-5 checkpoint later if the ladder wants a harder capstone.
