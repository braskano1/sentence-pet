# Boss Battle — Design Spec

**Date:** 2026-06-27
**Status:** Approved design (pre-implementation). Implementation plan to follow via `writing-plans`.
**Feature area:** Checkpoint boss battles for Sentence Pet (the `B-3` seam).

---

## 1. Summary

Turn a checkpoint lesson from a thematic-only "boss" into a real **boss battle**: a
combat layer wrapped around the existing Thai→English sentence-building drill. Correct
sentences attack the boss; mistakes and the boss's own attacks threaten your pet. Pets'
`BattleStats` (`hp/atk/def/spd/luk`) — rolled at gacha and grown on level-up but never
used in any mechanic today — finally drive outcomes. The educational core (building
correct sentences) remains the primary weapon.

The battle **starts turn-based** (calm, no clock) and **becomes timer-paced** in a later
phase, so a playable boss ships early and pressure is additive.

### North stars
- **Education first.** Building correct sentences is the attack. Combat never replaces the drill.
- **Kid-friendly.** Losing motivates a retry, never punishes. Soft, encouraging, non-scary.
- **Reuse what's shipped.** `isCheckpoint` entry, `BattleStats`, the `boss` music zone, the
  `win`/`lose`/`cleared` stingers (`pendingStinger` in `finishRound`), the `DrillItem`
  content pool, the SFX/music seams, and the `EvolutionCinematic` motion pattern.
- **PvP-forward.** The combat model takes an array of pets (length-1 today) so a 3-pet team
  drops in later for the reserved `multiplayer` zone.

---

## 2. Core loop

A boss battle is the **combat-over-drill hybrid**: the @dnd-kit build-the-sentence drill is
preserved, and each `DrillItem` maps to a combat exchange.

One **drill item** at a time:

1. The item appears; your pet faces the boss. (In the timed phase, the boss's **charge
   timer** begins filling.)
2. You build the sentence (drag POS tiles into slots) and submit:
   - **Correct** → an elemental bolt flies at the boss; damage applied; (timed phase) the
     boss's charge **interrupts/resets**; next item.
   - **Wrong (MISS)** → the bolt **fizzles**, no damage; the boss gets a counter-hit
     (turn-based) or the charge **lurches forward** (timed); you retry the same sentence.
   - **(Timed phase) Timer fills first** → the boss fires its charged attack → **dodge roll**
     (SPD) decides hit (DEF-reduced) or dodge (0 dmg); the item continues.
3. Boss HP → 0 = **win**. Your pet HP → 0 = **lose** → free soft retry.

### Tempo by phase
- **Turn-based (P1):** no clock. You answer at your own pace. The boss counter-hits on a
  wrong answer and/or on a cadence (e.g. every Nth item — tunable). SPD here = first strike
  + dodge% on the boss's counter.
- **Timer-paced (P2):** the real-time **charge timer** is added. The boss charges
  independent of your submits; beat the clock to interrupt, or eat the charged attack
  (dodge roll). This is the "timed pressure" layer.
- **Phases (P3):** crossing a boss HP threshold ramps the timer + hits and plays an enrage
  beat (see §6).

---

## 3. Stats → mechanics

All five `BattleStats` become meaningful. Displayed stat = `stats + growth` (see
`displayStats`), each on the existing ~40–100 scale.

| Stat | Mechanic |
|------|----------|
| `hp` | **HP pool** = `hp × K` (K ≈ 8, tunable). Decouples survivability from the atk scale so a fight is **not** a one-hit KO. e.g. hp 100 → 800 HP, hp 40 → 320 HP. |
| `atk` | **Damage** dealt per correct sentence (base hit). |
| `def` | **Mitigation** via ratio defense (see §4). Reduces incoming damage, never to zero. |
| `spd` | **Dodge chance** (capped, see §4) + **first strike** if you outspeed the boss at battle/phase start. |
| `luk` | **Crit chance** (×2 damage) + a **bonus-reward roll** on clear. |

`def` (mitigation: soak the hit) and `spd` (avoidance: don't get hit) are deliberately
distinct defensive axes.

---

## 4. Combat math

### Damage (ratio defense)
Subtractive defense (`atk − def`) is rejected — it yields 0/negative damage when `def ≥ atk`.
Instead, **ratio (multiplicative) defense**:

```
baseDmg = atk × C / (C + def)        // C ≈ 100, tunable
```

- `def = 0` → full `atk`; `def = 50` → `atk × 0.67`; `def = 100` → `atk × 0.5`.
- Never 0, never negative, never an instant kill. High `def` has diminishing returns
  (can't become invincible).

Applied **both directions** with the same formula:
- player → boss: `playerAtk × C/(C + bossDef)`
- boss → player: `bossAtk × C/(C + playerDef)`

### Final hit
```
finalDmg = round( baseDmg × COMBAT_SCALAR × critMult × elementMult )
```
- `COMBAT_SCALAR` (tunable) keeps per-hit numbers juicy against the HP pool.
- `critMult` = 2 on a crit (rolled from `luk`), else 1.
- `elementMult` from the element wheel (see §5).
- A guaranteed minimum of `≥ 1` as a float-safety floor.

### Dodge
```
dodgeChance = clamp( DODGE_BASE + (playerSpd − bossSpd) × DODGE_K, 0, DODGE_CAP )
```
- `DODGE_CAP ≈ 0.55` so high SPD never trivializes the fight.
- On each incoming boss attack, roll dodge → success = 0 dmg + "Dodge!" juice; fail =
  DEF-reduced hit lands.
- **Active dodge (P2 modifier):** on an incoming attack, the player may swipe the correct
  translation in time to dodge by skill; this is layered **on top of** the SPD% roll (skill
  can save you even when the roll fails).

### First strike
If `playerSpd > bossSpd` at battle/phase start, the player lands one free opening hit.

All constants (`K`, `C`, `COMBAT_SCALAR`, `DODGE_*`, cadence, timer durations) live in **one
global combat config**, not per-boss.

---

## 5. Elements

Pet **species is the element** (`leaf | fire | air | water`) — no new pet field. The boss
carries its own element.

### 4-cycle wheel
```
fire → air → leaf → water → fire     (each BEATS the next, loses to the previous)
```
Thematic: fire consumes air · wind (air) strips leaf · leaf/roots drink water · water douses
fire. Every element beats exactly one, loses to one, and is neutral vs one — so **any** boss
element has a counter the kid can bring.

### Magnitude (`elementMult`)
- Advantage ×1.5 · Disadvantage ×0.75 · Neutral ×1.0
- Applied in both directions (your element vs boss element).

### Pet selection
A pre-battle screen lets the kid **pick one pet** from owned/hatched. This makes element +
stats + level strategic and gives the collection/gacha purpose. The combat model accepts an
**array of pets** (length 1 today; **team of 3 reserved** for multiplayer — see §10).

---

## 6. Bosses (data-driven)

Bosses are **rival pets**: they reuse existing pet sprites (a species + stage), scaled up and
tinted by element with an angry mood — **zero new art**, and a rival-pet shape that doubles
as the PvP-forward model.

### Boss tiers (preset ladder)
A hand-tuned ladder of ~5 named tiers the admin picks from a dropdown:

```
BossTier = {
  id,                  // e.g. 'tier-1'
  label,               // 'Sprout' | 'Scout' | 'Veteran' | 'Elite' | 'Legend'
  hpPool,              // boss max HP
  atk, def, spd,       // boss combat stats (ratio/dodge formulas in §4)
  phases,              // 1..3 (HP-threshold phases, see below)
  rewardTier,          // scales coins/XP payout (§7)
  projectileVfxLevel,  // 1..5 — escalates the bolt VFX (small → screen-filling)
}
```

### Per-checkpoint boss
Attached to the checkpoint `Lesson`:

```
boss = {
  tierId,              // references a BossTier
  element,             // leaf | fire | air | water
  name,                // display name
  rivalSprite,         // species + stage to reuse as the boss sprite (rival-pet art)
}
```

Admin flow on a checkpoint: pick a **tier** (stats come from it), an **element**, a **name**,
and the **rival sprite**. Combat tuning is global, not per-boss.

### Phases (P3)
The tier's `phases` count defines HP thresholds (e.g. 2 phases → 50%; 3 phases → 66%/33%).
Crossing a threshold:
- **Faster charge timer** (shorter answer window),
- **Bigger boss hits** (boss atk multiplier rises),
- **Boss sprite grows** — the **same sprite scales up** each phase (it does **not** evolve /
  change art). See the sizing rule below.
- **Enrage juice** (flash/shake, color shift, `enrage` stinger).

Drill **difficulty stays steady** across phases — pressure climbs, sentence difficulty does
not.

### Phase sprite-growth sizing rule
To avoid the largest phase overflowing into the HP bars / pet strip / drill, the boss zone
**reserves a fixed bounding box equal to the final (largest) phase's size**, computed first.
Earlier phases render the **same sprite scaled down** within that reserved box; the final
phase fills it. So layout space is allocated for the biggest size up front and never shifts —
growth happens *inside* a stable footprint. The per-phase scale is derived from the tier's
phase count (e.g. 3 phases → ~0.7 / ~0.85 / 1.0 of the reserved box), `useReducedMotion`-aware
(snap instead of animate when reduced).

---

## 7. Rewards & readiness

### Rewards (on top of unlocking the next unit)
- **First clear:** bonus coins + XP (scaled by `rewardTier` and stars/performance) **+ a
  guaranteed gacha egg** (or token). Ties boss → collection → element strategy.
- **Replays:** a smaller coin trickle (prevents farming, keeps replay value).

Feeds the existing economy; the `luk` bonus-reward roll can sweeten the first-clear payout.

### Readiness / anti-frustration
- Each tier has a **recommended power** (compare against `petPower(pet)`).
- The pre-battle screen shows **"recommended power vs your pet."** If under, a gentle nudge
  ("This one's tough!"), but the kid **can always try** — **never blocked**.
- Combined with the free soft retry and the large HP pool absorbing dodge variance, this
  keeps an under-leveled kid from hitting a hard wall. (No comeback-aid / hint system in
  scope for now.)

### Lose handling
Lose = **free soft retry**: encouraging message ("So close! Try again!"), boss restored to
full HP, instant retry, no energy/coin cost. The pet **faints gently** (sits sad — no death
imagery).

---

## 8. Mechanics & modifiers

**Primary attack mechanic:** **build-the-sentence** (the existing drag-POS-tiles drill).
Reuses the `DrillItem` content pool 1:1 and stays consistent with the rest of the game.

**Modifiers in scope:**
- **Active dodge (P2):** swipe the correct translation in time to dodge an incoming attack by
  skill, layered on the SPD% roll (see §4).
- **Spot-the-error spell (P3):** the boss occasionally "casts" a wrong sentence; the kid taps
  the wrong word to break the spell and counter-attack. Reuses the existing **grammar-trap**
  tip/near-miss system.

**Out of scope** (considered, deferred): streak super-bolt, weak-word guaranteed crit,
word-bank volley, multiple-choice tap, jumble-reorder, listening rounds, mixed-by-phase
formats, parry/complete defense. (Random `luk` crit still exists — only the *weak-word*
guaranteed crit is cut.)

---

## 9. UI / UX surface

**Dedicated battle screen** (mobile-first `max-w-md`), not a HUD overlay. Top-to-bottom:

1. **Boss zone:** boss sprite (rival pet, scaled/tinted), boss HP bar, element badge, phase
   pips, and (timed phase) the charge-timer ring.
2. **Pet strip:** your pet sprite + your HP bar + element.
3. **Drill area:** the existing build-the-sentence UI (Thai hint, POS slots, word tray),
   anchored at the bottom — the attack input.

### New screen / entry
- A `boss` battle screen and a **pre-battle pet-select** screen.
- Entered from a checkpoint node (via `startLesson` / `App.tsx screenKeyAndNode`). The
  journey `Screen` union + screen-key routing extend to cover them. **Coordinate with the
  concurrent Journey redesign** (`src/components/journey/`, `PanViewport`) before touching
  shared files.

### Cinematic
- **Short, skippable boss intro** (~1.5s) mirroring `EvolutionCinematic`: boss slides in,
  name card + element, roar, then the battle. `useReducedMotion` respected.

### Component boundaries (each one purpose, testable in isolation)
- **Pure combat domain** (`src/domain/battle*.ts`): damage/dodge/element/crit math, HP-pool
  derivation, phase thresholds, win/lose resolution. No React, deterministic (RNG injected,
  matching the existing `domain` convention).
- **Boss data** (`src/content/` + config): `BossTier` ladder, per-checkpoint `boss`,
  combat-tuning config.
- **Battle store slice / state machine:** current item, HP values, phase, charge state,
  turn/timer mode, outcome.
- **Presentational battle components:** boss zone, pet strip, HP bars (`useCountUp` drain),
  bolt/dmg-number/dodge effects, intro cinematic — driven by store state.
- Reuse the existing drill component for the sentence input rather than forking it.

---

## 10. Juice (animation / interaction / effects / sound)

Built against existing seams: SFX synth (`getSfx().play(name, gain)`, extensible recipes +
`registerSample` for recorded upgrades), music (`boss` zone loop + `win`/`lose`/`cleared`
stingers, already wired in `finishRound`), `fireConfetti`/`buzz`/`buzzError`, `useCountUp`,
framer-motion + `useReducedMotion`. New SFX recipes to add: `hit`, `crit`, `dodge`,
`bossCharge`, `bossHit`, `enrage`, `fizzle`.

| Moment | Animation | SFX / haptic |
|--------|-----------|--------------|
| **Intro** | Boss slides in, name card + element badge, roar | `boss` music zone + roar |
| **Correct → attack** | Elemental bolt (themed by **pet element**, VFX quality scales with boss tier's `projectileVfxLevel`) flies → boss flinch + HP drain (`useCountUp`) | `hit`; big hits screen-shake |
| **Crit (luk)** | Bigger bolt, white pop, stronger shake | `crit` + `buzz` |
| **Element ×1.5** | "Super!" spark | bright `hit` |
| **Miss (wrong answer)** | Bolt **sputters & fizzles**, pet winces/recoils, boss smirks, (timed) charge lurches forward; grammar-trap tip may surface | `fizzle`/`wrong` (existing descending sawtooth) + `buzzError` |
| **Boss charge (P2)** | Charge-timer ring fills on the boss | rising `bossCharge` |
| **Dodge (spd / active)** | Pet dashes aside, "Dodge!" pop, 0 dmg | whoosh `dodge` |
| **Hit lands** | Pet flinch, red flash, your HP drain | `bossHit` + `buzzError` |
| **Phase cross (P3)** | Boss **sprite scales up** (within the reserved final-size box), enrage flash/shake, color shift | `enrage` stinger |
| **Win** | Boss dissolves, confetti, → reward + egg reveal (reuse gacha reveal) | `win` stinger |
| **Lose** | Pet sits sad (no death), "Try again?" | `lose` stinger |

**Damage numbers:** floating RPG-style numbers on each hit; crit bigger/colored.

Three distinct negative beats, each visually different: **Miss** (you whiff — fizzle),
**Hit** (boss lands — flinch + red), **Dodge** (boss whiffs — dash + whoosh).

---

## 11. Integration with existing systems

- **Entry:** checkpoint lesson (`Lesson.isCheckpoint`) opens the boss instead of a normal
  `finishRound` flow. Gating unchanged: clearing the checkpoint unlocks the next unit
  (`journeyProgress.ts`, `lessonCleared`).
- **Outcome → existing seam:** the `pendingStinger` win/lose already resolves in
  `finishRound` (`wasBoss ? (stars≥1 ? 'win' : 'lose') : 'cleared'`). The battle defines the
  real win/lose (boss HP vs pet HP) and feeds that outcome through (resolving the existing
  `// TODO refine win/lose threshold`). On win, the checkpoint is recorded cleared; on a
  soft retry, no clear is recorded.
- **Stat growth:** the `applyXp` level-up growth already feeds `displayStats`, which feeds
  the HP pool and combat formulas — no change to how stats grow.
- **Persistence:** boss content lives in the content bundle; transient battle state is not
  persisted (mirrors `currentLessonId`/`pendingStinger`). First-clear vs replay is derivable
  from the existing `journey.lessonStars` map.

---

## 12. Build phasing

Each phase ships a playable boss.

- **P1 — Core (playable, turn-based):** dedicated battle screen + pre-battle pet-select; HP
  pool + `atk` + ratio `def`; elements (4-cycle); boss tiers + per-checkpoint rival-pet boss;
  single-phase boss; soft retry; rewards (first-clear egg + bonus, replay trickle);
  recommended-power display; elemental bolt + floating damage numbers; short cinematic intro;
  win/lose wired to `finishRound`. **Turn-based, no clock.** `luk` crit + `spd` first strike
  + `spd` dodge-roll on the boss's counter.
- **P2 — Pressure:** real-time **charge timer**; **active dodge** (skill swipe over the SPD
  roll); timer juice + `bossCharge`/`dodge` SFX. Converts the tempo to timer-paced.
- **P3 — Climax:** **multi-phase bosses** + enrage ramp/juice; **spot-the-error spell**
  modifier; recorded audio assets dropped into the seams; polish + balance pass.

---

## 13. Open tuning questions (for implementation, not blockers)

These are numbers to balance during the build, not design decisions:
- Exact `K` (HP multiplier), `C` (defense constant), `COMBAT_SCALAR`, crit/element
  multipliers, dodge constants + cap.
- Boss counter-attack cadence (turn-based) and charge-timer durations (timed).
- Per-tier stat values and recommended-power thresholds.
- Phase HP thresholds and per-phase ramp multipliers.
- First-clear reward sizes per `rewardTier`.
