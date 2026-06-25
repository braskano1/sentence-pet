# Spec — PetRoom UI redesign + 50-level progression

**Date:** 2026-06-26
**Status:** approved design, pre-plan
**Supersedes:** the 3-stage XP model (baby/young/adult by XP thresholds) for level/stage purposes.

## Goal

The PetRoom ("storybook" screen) now carries a lot of info (happiness, 4 nutrition bars, 5 battle stats, XP, coins, rarity, element, name). Redesign it for that density, add a real XP bar, introduce a 50-level progression with per-level stat growth, and give the pet a voice (speech bubble). Keep the cozy storybook brand.

## 1. Progression model (replaces 3-stage XP thresholds)

- **Max level 50.** A pet's level is derived from total `xp` via a per-level XP curve.
- **XP curve: ramping cost-per-level.** Cost to reach the next level increases as level rises, so early levels come fast and later levels are a grind. Formula in `GAME_CONFIG.xp`, tunable:
  - `xpToNext(level) = round(BASE * level ^ GROWTH)` with e.g. `BASE = 40`, `GROWTH = 1.5` (level 1→2 ≈ 40 xp, 49→50 ≈ 13,720 xp). Cumulative thresholds derived by summing `xpToNext` over 1..n.
  - `levelForXp(xp)` returns 1..50; cap at 50 (no `xpToNext` beyond 50).
  - BASE/GROWTH are the tuning knobs; pick final values during/after implementation by playtest.
- **Stage bands (evolution):**
  - Lv 1–15 → Stage 1 (`baby`)
  - Lv 16–35 → Stage 2 (`young`)
  - Lv 36–50 → Stage 3 (`adult`)
  - `egg` stage stays for an un-hatched pet (`hatched === false`), independent of level.
  - Sprite still swaps at stage boundaries (existing `petStageSprite`).
- **Stat growth: +1 random battle stat per level-up.**
  - The creation roll stays in `stats` (base, immutable identity).
  - New persisted field `growth: BattleStats` (starts all-zero) accumulates allocated points.
  - **Displayed stat = base + growth** everywhere (radar, numbers, Power total, specialty, Collection).
  - On each level gained, pick one of the 5 stats with **equal probability** (purely random) using the **injectable RNG** (same pattern as gacha) and increment its `growth`. If an XP gain crosses multiple levels at once, allocate one point per level crossed.
  - **Level-up feedback:** confetti (`fireConfetti`) + haptic (`buzz`) + a transient "+1 SPD!" toast/line (also surfaced via the speech bubble, see §5). Reduced-motion safe.
- **Specialty** = the single highest displayed battle stat (ties broken by `BATTLE_STAT_LABELS` order). Shown as a gold vertex on the radar and in the Power rail.
- **Total Power** = sum of the 5 displayed battle stats.

## 2. Pure helpers + display module

New/updated pure functions in `src/domain/xp.ts` (unit-tested, no React):
- `levelForXp(xp): number` — 1..50.
- `xpProgress(xp): { level, into, span, toNext, atMax }` — XP into current level, span of current level, remaining to next, `atMax` at level 50.
- `stageForLevel(level): PetStage` — band mapping, reads evolution thresholds from `STAGE_LEVEL` (below).
- Keep `stageForXp` working (compose `stageForLevel(levelForXp(xp))`) so existing callers don't break; `hatched === false` ⇒ `egg`.

`src/config/petDisplay.ts`:
- **Repurpose `STAGE_LEVEL`** from "stage → shown level number" to the **evolution thresholds**: the first level of each stage — `{ baby: 1, young: 16, adult: 36 }` (egg handled separately via `hatched`). `stageForLevel` picks the highest threshold `<= level`. Adding/retuning a stage is a one-line change here.
- `petLevel(pet)` returns the real 1..50 level (was the stage number).
- Add `STAGE_NAME: Record<PetStage,string>` ("Baby/Young/Adult") for the chip subtitle.
- Add `displayStats(pet): BattleStats` = base + growth, `petPower(pet): number`, `petSpecialty(pet): keyof BattleStats`.

## 3. PetRoom layout (the redesign)

Mobile-first column (AppShell `max-w-md`). Two zones: **scene** (art + pet) on top, **panel** below.

### Scene (art)
- **Pet** sits lower-center with headroom above for the speech bubble; lifted off busy art by the existing radial glow + drop shadow. Pet is the largest element (emotional core).
- **HUD overlays** float on the art with purposeful translucency (legibility over room art):
  - Top-left: **identity chip** — sprite in a **rarity-colored ring** + **element glyph**, `petDisplayName · Lv {1..50}`, subtitle `EPIC · WATER · YOUNG` (rarity · element · stage).
  - Top-right (stacked): **coins** chip; **🐾 My Pets · N** button → Collection.
  - Bottom: **XP bar** — full width, slim. Green fill, label `XP → LV {n+1}` + `{into}/{span}`. At level 50: gold fill + `MAX ✨`.
- **Speech bubble** (§5): named-style bubble above the pet, tail pointing down to it. Does not overlap the HUD.

### Panel (cozy warm gradient, carved top)
- **Segmented tabs: `Care | Power`** (one block visible at a time — keeps the pet big). Default tab = **Care**. Roving-tabindex + arrow-key nav + proper `role=tablist/tab/tabpanel` (reuse the Shop-tabs a11y pattern).
- **Care tab:**
  - **Happiness** headline: 😊 + label + value + bar (read-only; raised by play/treats, not fed).
  - **4 food tiles** (🥩 protein / 🥦 veggie / 🍊 vitamin / 🍬 treat), 4-across grid. Each tile: food emoji, current bar value, slim fullness bar, and a full-width **＋ feed button** with a count badge = `inventory[group]`. When `inventory[group] === 0` the button is **dimmed/disabled** (＋0 = "earn by playing"). Tapping feeds that group (existing `feed(g)` + feed animation trigger).
  - The old standalone feed-button row and the derived ❤️ health chip are **removed** (heart dropped — it duplicated the nutrition bars and clashed with battle HP).
- **Power tab:**
  - **Radar** (reuse/extend `StatRadar`): concentric rings + spokes for scale, **rarity-tinted fill** (`RARITY_HEX`), subtle glow, vertex dots, **gold specialty vertex**, each spoke labeled with stat name + displayed value. Draws/morphs via existing `useCountUp` animation.
  - **Rail** beside it: cards for **Level n/50**, **⚔ Power {total}**, **★ Specialty {stat}**.
- **Action row** (always visible, below the tab panel): one pill vocabulary — **Eggs 🥚 / Shop 🛒 / Play ▶**.

### Impeccable notes (applied)
- No nested cards: battle stats rendered as radar + labels, not boxes-in-the-panel.
- Contrast: labels `#7c5a2e`, values `#3d1d04` on the amber panel (≥4.5:1); nutrition fill colors darkened for legibility.
- One consistent button shape across feed + actions; feed differs by color + food emoji only.
- Motion 150–250ms, reduced-motion fallbacks; level-up + bubble respect `prefers-reduced-motion`.

## 4. Collection screen

Apply the same display source of truth: real `Lv 1..50`, stage name, **displayed stats = base + growth**, specialty marker, rarity-tinted radar. Reuse `displayStats`/`petPower`/`petSpecialty`. No layout overhaul required beyond wiring the new level/stat values and specialty.

## 5. Pet dialogue (speech bubble)

- **Named bubble** above the pet (`{name}:` eyebrow + line, tail offset toward the pet). Cozy cream bubble, soft shadow, reduced-motion-safe fade/pop in.
- **Content = contextual canned lines** (no AI; offline; kid-safe). New pure module `src/domain/petDialogue.ts`:
  - `petDialogue(ctx, rng): string` where `ctx` summarizes state (lowest nutrition group + value, happiness, justFed?, justLeveled? + which stat, nearEvolution?, idle).
  - Priority order: level-up line ("I grew! +1 ATK 💪") > just-fed thanks > hunger (lowest bar) > near-evolution > low-happiness > idle rotation.
  - Lines flavored by species/stage; chosen via **injectable RNG** for deterministic tests.
- Bubble component is render-only in tests (assert the chosen line text from the pure module; never assert animation).

## 6. Data + persistence

- `PetInstance` gains `growth: BattleStats`.
- **Persist bump v7 → v8.** Migrate: for every existing pet set `growth = {hp:0,atk:0,def:0,spd:0,luk:0}` (base = current `stats`, no retro points). Older legacy branches keep building via `makePet` then default `growth`.
- Test migrate against the real `persist.getOptions().migrate`.
- `makePet` initializes `growth` to zero.

## 7. Store

- The XP-gain action (e.g. `addXp`) detects level increases and, per level gained, rolls one random stat via the injected RNG and increments `growth`, then triggers level-up feedback (confetti/buzz/bubble line). Keep the RNG injectable for tests.
- No change to the feed action beyond it already moving nutrition bars.

## 8. Testing (house rules)

- Pure modules unit-tested with injected RNG: `levelForXp`, `xpProgress`, `stageForLevel`, stat-growth allocation, `petDialogue`, `petPower`/`petSpecialty`/`displayStats`.
- Component tests render-only: tabs switch, food tiles render + ＋ disabled at 0, feed click calls store, bubble shows the line. Never assert animated style values; `useCountUp` returns target synchronously.
- Mock `canvas-confetti` in any test transitively importing `effects/celebrate`.
- Migration test against real persist migrate (v7 → v8).

## 9. Out of scope (deferred)

- Actual battle (B-3) — this only grows/displays stats.
- AI-generated dialogue; full 13-pose mood system.
- Exact XP curve tuning values (structure now, numbers later).

## 10. Branch note

Build dir `D:\ai_projects\AI_design_thinking\sentence-pet`, currently on `phase-b2-gacha` (unmerged, ~30 commits). Recommend merging `phase-b2-gacha` to `main` first, then branching fresh for this redesign, to keep PRs sane. Decide at plan time.
