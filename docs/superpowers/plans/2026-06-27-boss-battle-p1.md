# Boss Battle — Phase 1 (Core, turn-based) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable, turn-based checkpoint boss battle — pick a pet, fight a rival-pet boss by building correct sentences, with the five `BattleStats` driving damage/defense/dodge/crit and elemental matchups; win clears the checkpoint and grants rewards.

**Architecture:** Pure combat math + element wheel live in `src/domain/battle.ts` (RNG injected, deterministically testable, mirroring the existing `domain/` convention). Boss tiers + per-checkpoint boss data are config + a `Lesson.boss` field. A transient `battleStore` slice holds live session state (boss HP, pet HP, phase, outcome) — not persisted, mirroring `currentLessonId`. New screens (`bossPrep` pet-select, `battle`) route from a checkpoint node; on win a new `finishBoss` action records the clear + rewards through the same seams as `finishRound` and reuses the existing `pendingStinger` win/lose path. P1 is **turn-based, no clock**; the charge timer + dodge-swipe (P2) and multi-phase ramp (P3) are out of scope.

**Tech Stack:** React 19 + TypeScript, Zustand (+persist), @dnd-kit, framer-motion 12, Tailwind v4, Vitest. Typecheck `npx tsc -b`; tests `npx vitest run`; build `npm run build`.

---

## Scope & boundaries

**In scope (P1):** dedicated battle screen + pet-select; HP pool (`hp×K`), `atk`, ratio `def`, `luk` crit, `spd` first-strike + dodge-roll on the boss's counter; 4-cycle elements; boss tiers + per-checkpoint rival-pet boss; **single active phase only** (multi-phase ramp is P3); soft retry; first-clear egg + bonus coins/XP, replay coin trickle; recommended-power display; elemental bolt + floating damage numbers; short skippable intro cinematic; win/lose wired to the reward flow.

**Out of scope:** real-time charge timer, active dodge-swipe (P2); multi-phase HP thresholds, sprite-growth per phase, enrage, spot-the-error (P3); recorded audio assets (seams stay inert no-ops).

**Spec:** `docs/superpowers/specs/2026-06-27-boss-battle-design.md`.

## ⚠️ Concurrency gotchas (carry into every commit)

- Working tree + `.git/HEAD` are **shared with a concurrent session**. Before every commit run `git rev-parse --abbrev-ref HEAD`; the boss work needs its **own branch** (`feat-boss-battle-p1`) created off `main` — do not commit onto `journey-redesign`. Coordinate branch creation with the user (shared tree means a checkout moves the other session too).
- **Stage explicit files only** — never `git add -A`/`.`. Leave `firebase.json` unstaged (concurrent session's).
- The Journey redesign (`src/components/journey/`, `PanViewport`) may be mid-flight. The only shared file this plan touches is `src/App.tsx` (routing) and `src/content/model.ts` (`Lesson.boss` field) — re-read both before editing and keep changes additive.

## File structure

**Create:**
- `src/domain/battle.ts` — pure combat math: HP pool, ratio defense, crit/element multipliers, dodge roll, first strike, element wheel.
- `src/domain/battle.test.ts` — unit tests for the above.
- `src/domain/bossTiers.ts` — `BossTier` type + `BOSS_TIERS` ladder + `recommendedPower`.
- `src/domain/bossTiers.test.ts`.
- `src/domain/battleSession.ts` — pure session reducer: `initBattle`, `applyPlayerHit`, `applyBossHit`, outcome resolution.
- `src/domain/battleSession.test.ts`.
- `src/state/battleStore.ts` — transient Zustand slice driving a live battle (no persist).
- `src/state/battleStore.test.ts`.
- `src/components/battle/BossPrepScreen.tsx` — pet-select + recommended power + "Fight!".
- `src/components/battle/BattleScreen.tsx` — the battle (boss zone + pet HP + sentence input).
- `src/components/battle/BossIntro.tsx` — short skippable intro cinematic.
- `src/components/battle/BossZone.tsx` — boss sprite + HP bar + element badge.
- `src/components/battle/HpBar.tsx` — animated HP bar (reuses `useCountUp`).
- `src/components/battle/DamageNumber.tsx` — floating damage number.
- `src/config/bossSprite.ts` — resolve a rival-pet boss sprite (scaled/tinted) + element emoji helper.

**Modify:**
- `src/config/gameConfig.ts` — add `battle` tuning block + boss reward config.
- `src/content/model.ts` — add optional `boss?: CheckpointBoss` to `Lesson`; add `CheckpointBoss` type.
- `src/content/seed.ts` — attach a `boss` to the first unit's checkpoint lesson (demo content).
- `src/data/types.ts` — add `'bossPrep' | 'battle'` to `Screen`.
- `src/state/gameStore.ts` — add `currentBossLessonId`, `startBoss`, `finishBoss`; mark the new fields transient (partialize/migrate untouched-version-wise).
- `src/App.tsx` — route `bossPrep`/`battle` in `screenKeyAndNode`; map them to the `boss` music zone in `zoneForScreen`.
- `src/components/journey/TrailNode.tsx` (or wherever a checkpoint node's onClick lives) — checkpoint taps call `startBoss` instead of `startLesson`. **Re-read first** (concurrent redesign).

---

## Task 1: Combat tuning config

**Files:**
- Modify: `src/config/gameConfig.ts`

- [ ] **Step 1: Add the `battle` block to `GAME_CONFIG`**

Insert a `battle` key inside the `GAME_CONFIG` object literal (after `gacha`):

```typescript
  battle: {
    hpMultiplier: 8,        // maxHP = hp stat × this (K) — decouples survivability from atk scale
    defConstant: 100,       // C in ratio defense atk×C/(C+def)
    combatScalar: 1.4,      // keeps per-hit numbers juicy vs the HP pool
    critMult: 2,            // crit = ×2 damage
    critPerLuk: 0.004,      // critChance = clamp(luk × this, 0, critCap)
    critCap: 0.6,
    dodgeBase: 0.05,        // base dodge before the spd delta
    dodgePerSpd: 0.005,     // dodge += (playerSpd − bossSpd) × this
    dodgeCap: 0.55,         // hard cap so high spd never trivializes the fight
    element: { advantage: 1.5, disadvantage: 0.75, neutral: 1 },
    bossCounterEveryNItems: 2, // turn-based (P1): boss also counter-attacks every Nth item
    reward: {
      firstClearCoins: 50,  // bonus coins on first clear (on top of the base flow)
      firstClearXp: 80,     // bonus XP applied to the fighting pet on first clear
      replayCoins: 8,       // small coin trickle on a repeat clear
    },
  },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS (config is `as const`; no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/config/gameConfig.ts
git commit -m "feat(boss): add battle combat-tuning config"
```

---

## Task 2: Element wheel + combat math (pure domain)

**Files:**
- Create: `src/domain/battle.ts`
- Test: `src/domain/battle.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/battle.test.ts
import { describe, it, expect } from 'vitest';
import {
  ELEMENT_BEATS, elementMultiplier, maxHpFromStat, mitigatedBase,
  critChance, computeHit, dodgeChance, rollDodge, firstStrike,
} from './battle';

describe('elements', () => {
  it('forms the 4-cycle fire>air>leaf>water>fire', () => {
    expect(ELEMENT_BEATS).toEqual({ fire: 'air', air: 'leaf', leaf: 'water', water: 'fire' });
  });
  it('advantage = 1.5, disadvantage = 0.75, neutral = 1', () => {
    expect(elementMultiplier('fire', 'air')).toBe(1.5);   // fire beats air
    expect(elementMultiplier('air', 'fire')).toBe(0.75);  // air loses to fire
    expect(elementMultiplier('fire', 'leaf')).toBe(1);    // neutral
    expect(elementMultiplier('fire', 'fire')).toBe(1);    // mirror = neutral
  });
});

describe('hp pool & defense', () => {
  it('hp pool = stat × hpMultiplier (8)', () => {
    expect(maxHpFromStat(100)).toBe(800);
    expect(maxHpFromStat(40)).toBe(320);
  });
  it('ratio defense never reaches zero and halves at def=C', () => {
    expect(mitigatedBase(100, 0)).toBe(100);
    expect(mitigatedBase(100, 100)).toBeCloseTo(50);
    expect(mitigatedBase(100, 50)).toBeCloseTo(66.6667, 3);
  });
});

describe('computeHit', () => {
  const base = { atkStat: 100, defStat: 0, attackerSpecies: 'fire', defenderSpecies: 'leaf' } as const;
  it('applies the combat scalar and rounds, min 1', () => {
    // 100 × C/(C+0)=100 × scalar 1.4 × crit1 × element1 = 140
    expect(computeHit({ ...base, crit: false })).toBe(140);
  });
  it('doubles on crit', () => {
    expect(computeHit({ ...base, crit: true })).toBe(280);
  });
  it('applies element advantage', () => {
    expect(computeHit({ ...base, defenderSpecies: 'air', crit: false })).toBe(210); // ×1.5
  });
  it('floors at 1', () => {
    expect(computeHit({ atkStat: 0, defStat: 90, attackerSpecies: 'fire', defenderSpecies: 'water', crit: false }))
      .toBeGreaterThanOrEqual(1);
  });
});

describe('crit & dodge & first strike', () => {
  it('critChance scales with luk and caps', () => {
    expect(critChance(0)).toBe(0);
    expect(critChance(100)).toBeCloseTo(0.4);   // 100 × 0.004
    expect(critChance(1000)).toBe(0.6);          // capped
  });
  it('dodgeChance uses the spd delta, clamped to [0, cap]', () => {
    expect(dodgeChance(50, 50)).toBeCloseTo(0.05);              // base only
    expect(dodgeChance(150, 50)).toBe(0.55);                    // 0.05 + 100×0.005 = 0.55 (cap)
    expect(dodgeChance(0, 100)).toBe(0);                        // clamped at 0
  });
  it('rollDodge is true when the rng draw is below the chance', () => {
    expect(rollDodge(150, 50, () => 0.1)).toBe(true);
    expect(rollDodge(150, 50, () => 0.9)).toBe(false);
  });
  it('firstStrike when the player outspeeds', () => {
    expect(firstStrike(60, 50)).toBe(true);
    expect(firstStrike(50, 60)).toBe(false);
    expect(firstStrike(50, 50)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/battle.test.ts`
Expected: FAIL — `battle.ts` does not exist.

- [ ] **Step 3: Implement `src/domain/battle.ts`**

```typescript
import { GAME_CONFIG } from '../config/gameConfig';
import type { Species } from '../data/types';

const B = GAME_CONFIG.battle;

/** 4-cycle element wheel: each element BEATS the value it maps to. */
export const ELEMENT_BEATS: Record<Species, Species> = {
  fire: 'air',
  air: 'leaf',
  leaf: 'water',
  water: 'fire',
};

/** Damage multiplier for attacker's element vs defender's element. */
export function elementMultiplier(attacker: Species, defender: Species): number {
  if (ELEMENT_BEATS[attacker] === defender) return B.element.advantage;
  if (ELEMENT_BEATS[defender] === attacker) return B.element.disadvantage;
  return B.element.neutral;
}

/** Derived HP pool from the hp stat (decoupled from the atk scale). */
export function maxHpFromStat(hpStat: number): number {
  return hpStat * B.hpMultiplier;
}

/** Ratio defense: atk × C/(C+def). Never 0, never negative, diminishing returns. */
export function mitigatedBase(atk: number, def: number): number {
  return atk * (B.defConstant / (B.defConstant + def));
}

/** Crit chance from the luk stat, capped. */
export function critChance(lukStat: number): number {
  return Math.min(B.critCap, Math.max(0, lukStat * B.critPerLuk));
}

export interface HitParams {
  atkStat: number;
  defStat: number;
  attackerSpecies: Species;
  defenderSpecies: Species;
  crit: boolean;
}

/** Final integer damage for one hit (min 1). */
export function computeHit(p: HitParams): number {
  const base = mitigatedBase(p.atkStat, p.defStat);
  const crit = p.crit ? B.critMult : 1;
  const elem = elementMultiplier(p.attackerSpecies, p.defenderSpecies);
  return Math.max(1, Math.round(base * B.combatScalar * crit * elem));
}

/** Dodge probability from the spd delta, clamped to [0, cap]. */
export function dodgeChance(playerSpd: number, bossSpd: number): number {
  const raw = B.dodgeBase + (playerSpd - bossSpd) * B.dodgePerSpd;
  return Math.min(B.dodgeCap, Math.max(0, raw));
}

export function rollDodge(playerSpd: number, bossSpd: number, rng: () => number): boolean {
  return rng() < dodgeChance(playerSpd, bossSpd);
}

export function rollCrit(lukStat: number, rng: () => number): boolean {
  return rng() < critChance(lukStat);
}

export function firstStrike(playerSpd: number, bossSpd: number): boolean {
  return playerSpd > bossSpd;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/battle.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck & commit**

```bash
npx tsc -b
git add src/domain/battle.ts src/domain/battle.test.ts
git commit -m "feat(boss): element wheel + ratio-defense combat math"
```

---

## Task 3: Boss tiers + recommended power

**Files:**
- Create: `src/domain/bossTiers.ts`
- Test: `src/domain/bossTiers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/bossTiers.test.ts
import { describe, it, expect } from 'vitest';
import { BOSS_TIERS, findTier, recommendedPower } from './bossTiers';

describe('boss tiers', () => {
  it('ships a 5-rung ladder, ordered weakest → strongest by hpPool', () => {
    expect(BOSS_TIERS).toHaveLength(5);
    const hps = BOSS_TIERS.map((t) => t.hpPool);
    expect([...hps].sort((a, b) => a - b)).toEqual(hps);
  });
  it('every tier has a unique id', () => {
    expect(new Set(BOSS_TIERS.map((t) => t.id)).size).toBe(5);
  });
  it('findTier resolves by id, undefined when unknown', () => {
    expect(findTier(BOSS_TIERS[0].id)?.id).toBe(BOSS_TIERS[0].id);
    expect(findTier('nope')).toBeUndefined();
  });
  it('recommendedPower sums the tier combat stats', () => {
    const t = BOSS_TIERS[0];
    expect(recommendedPower(t)).toBe(t.hpStatEquivalent + t.atk + t.def + t.spd);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/bossTiers.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/domain/bossTiers.ts`**

```typescript
/** A reusable boss template the admin picks from. `phases` is reserved for P3
 *  (P1 treats every boss as single-phase). `hpStatEquivalent` is the hp-stat the
 *  recommended-power comparison uses (so it is comparable to a pet's petPower). */
export interface BossTier {
  id: string;
  label: string;
  hpPool: number;            // boss max HP (already a pool, not a 40–100 stat)
  hpStatEquivalent: number;  // hp-stat equivalent for recommended-power comparison
  atk: number;
  def: number;
  spd: number;
  phases: number;            // reserved (P3); P1 ignores >1
  rewardTier: number;        // scales reward sizing (P1 uses it as a coin/xp factor)
  projectileVfxLevel: number;// reserved (P1 renders a single bolt style)
}

export const BOSS_TIERS: readonly BossTier[] = [
  { id: 'tier-1', label: 'Sprout',  hpPool: 400,  hpStatEquivalent: 50,  atk: 45, def: 40, spd: 45, phases: 1, rewardTier: 1, projectileVfxLevel: 1 },
  { id: 'tier-2', label: 'Scout',   hpPool: 650,  hpStatEquivalent: 60,  atk: 55, def: 50, spd: 55, phases: 1, rewardTier: 2, projectileVfxLevel: 2 },
  { id: 'tier-3', label: 'Veteran', hpPool: 950,  hpStatEquivalent: 70,  atk: 65, def: 60, spd: 62, phases: 2, rewardTier: 3, projectileVfxLevel: 3 },
  { id: 'tier-4', label: 'Elite',   hpPool: 1300, hpStatEquivalent: 80,  atk: 75, def: 70, spd: 70, phases: 2, rewardTier: 4, projectileVfxLevel: 4 },
  { id: 'tier-5', label: 'Legend',  hpPool: 1700, hpStatEquivalent: 88,  atk: 85, def: 80, spd: 78, phases: 3, rewardTier: 5, projectileVfxLevel: 5 },
] as const;

export function findTier(id: string): BossTier | undefined {
  return BOSS_TIERS.find((t) => t.id === id);
}

/** Recommended pet power to face this tier — comparable to petPower(pet). */
export function recommendedPower(tier: BossTier): number {
  return tier.hpStatEquivalent + tier.atk + tier.def + tier.spd;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/bossTiers.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck & commit**

```bash
npx tsc -b
git add src/domain/bossTiers.ts src/domain/bossTiers.test.ts
git commit -m "feat(boss): boss tier ladder + recommended power"
```

---

## Task 4: `CheckpointBoss` on the lesson model + seed content

**Files:**
- Modify: `src/content/model.ts`
- Modify: `src/content/seed.ts`

- [ ] **Step 1: Add the `CheckpointBoss` type and `Lesson.boss` field**

In `src/content/model.ts`, add after the imports and extend `Lesson`:

```typescript
import type { DrillItem, DrillType, Species, PetStage } from '../data/types';

/** Per-checkpoint boss: a rival pet (reused sprite) parameterised by tier + element. */
export interface CheckpointBoss {
  tierId: string;            // references a BossTier (src/domain/bossTiers.ts)
  element: Species;          // boss element for the matchup wheel
  name: string;              // display name
  rivalSprite: { species: Species; stage: Exclude<PetStage, 'egg'> }; // pet art reused as the boss
}
```

Then add `boss?: CheckpointBoss;` to the `Lesson` interface (keep `isCheckpoint`):

```typescript
export interface Lesson {
  id: string;
  drill: DrillType;
  level: number;
  itemIds: string[];
  isCheckpoint?: boolean;
  boss?: CheckpointBoss;   // present on a checkpoint to enable a boss battle
  title?: string;
}
```

- [ ] **Step 2: Attach a boss to the first checkpoint in the seed**

Open `src/content/seed.ts`, find the first unit's checkpoint lesson (the one with `isCheckpoint: true`). Add a `boss` to it. Example shape (match the real lesson's existing fields; only add `boss`):

```typescript
      boss: {
        tierId: 'tier-1',
        element: 'fire',
        name: 'Ember Rival',
        rivalSprite: { species: 'fire', stage: 'young' },
      },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS. If the seed has a content-shape test, run `npx vitest run src/content` and confirm PASS.

- [ ] **Step 4: Commit**

```bash
git add src/content/model.ts src/content/seed.ts
git commit -m "feat(boss): CheckpointBoss model + seed the first checkpoint"
```

---

## Task 5: Battle session reducer (pure)

**Files:**
- Create: `src/domain/battleSession.ts`
- Test: `src/domain/battleSession.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/battleSession.test.ts
import { describe, it, expect } from 'vitest';
import { initBattle, applyPlayerHit, applyBossHit, type BattleSnapshot } from './battleSession';

const snap = (over: Partial<BattleSnapshot> = {}): BattleSnapshot => ({
  bossHp: 400, bossHpMax: 400, petHp: 800, petHpMax: 800, outcome: null, ...over,
});

describe('initBattle', () => {
  it('starts both bars full with no outcome', () => {
    const s = initBattle({ bossHpPool: 400, petHpStat: 100 });
    expect(s).toEqual({ bossHp: 400, bossHpMax: 400, petHp: 800, petHpMax: 800, outcome: null });
  });
});

describe('applyPlayerHit', () => {
  it('reduces boss hp, clamps at 0, sets win when boss falls', () => {
    expect(applyPlayerHit(snap(), 120).bossHp).toBe(280);
    const dead = applyPlayerHit(snap({ bossHp: 100 }), 250);
    expect(dead.bossHp).toBe(0);
    expect(dead.outcome).toBe('win');
  });
  it('is a no-op once the battle is resolved', () => {
    const won = snap({ bossHp: 0, outcome: 'win' });
    expect(applyPlayerHit(won, 50)).toBe(won);
  });
});

describe('applyBossHit', () => {
  it('reduces pet hp, clamps at 0, sets lose when pet faints', () => {
    expect(applyBossHit(snap(), 200).petHp).toBe(600);
    const dead = applyBossHit(snap({ petHp: 80 }), 90);
    expect(dead.petHp).toBe(0);
    expect(dead.outcome).toBe('lose');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/battleSession.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/domain/battleSession.ts`**

```typescript
import { maxHpFromStat } from './battle';

export type BattleOutcome = 'win' | 'lose' | null;

export interface BattleSnapshot {
  bossHp: number;
  bossHpMax: number;
  petHp: number;
  petHpMax: number;
  outcome: BattleOutcome;
}

export function initBattle(args: { bossHpPool: number; petHpStat: number }): BattleSnapshot {
  const petHpMax = maxHpFromStat(args.petHpStat);
  return {
    bossHp: args.bossHpPool,
    bossHpMax: args.bossHpPool,
    petHp: petHpMax,
    petHpMax,
    outcome: null,
  };
}

export function applyPlayerHit(s: BattleSnapshot, dmg: number): BattleSnapshot {
  if (s.outcome) return s;
  const bossHp = Math.max(0, s.bossHp - dmg);
  return { ...s, bossHp, outcome: bossHp === 0 ? 'win' : null };
}

export function applyBossHit(s: BattleSnapshot, dmg: number): BattleSnapshot {
  if (s.outcome) return s;
  const petHp = Math.max(0, s.petHp - dmg);
  return { ...s, petHp, outcome: petHp === 0 ? 'lose' : null };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/battleSession.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck & commit**

```bash
npx tsc -b
git add src/domain/battleSession.ts src/domain/battleSession.test.ts
git commit -m "feat(boss): pure battle-session reducer"
```

---

## Task 6: Screen union + game-store boss entry & outcome

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/state/gameStore.ts`
- Test: `src/state/gameStore.test.ts` (append; create if absent)

- [ ] **Step 1: Extend the `Screen` union**

In `src/data/types.ts`, add the two screens:

```typescript
export type Screen = 'egg' | 'petRoom' | 'pickDrill' | 'drill' | 'reward' | 'shop' | 'gacha' | 'collection' | 'evolution' | 'bossPrep' | 'battle';
```

- [ ] **Step 2: Write the failing store test**

Append to `src/state/gameStore.test.ts` (mirror the existing test setup — `useGameStore.getState().resetForTest()` in `beforeEach`):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';

describe('boss flow', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('startBoss records the lesson id and routes to bossPrep', () => {
    useGameStore.getState().startBoss('u1-checkpoint');
    expect(useGameStore.getState().currentBossLessonId).toBe('u1-checkpoint');
    expect(useGameStore.getState().screen).toBe('bossPrep');
  });

  it('finishBoss win marks the checkpoint cleared and grants the first-clear egg', () => {
    const before = useGameStore.getState().pets.length;
    useGameStore.getState().startBoss('u1-checkpoint');
    useGameStore.getState().finishBoss(true);
    const s = useGameStore.getState();
    expect(s.journey.lessonStars['u1-checkpoint']).toBeGreaterThanOrEqual(1);
    expect(s.pets.length).toBe(before + 1);   // guaranteed egg on first clear
    expect(s.pendingStinger).toBe('win');
    expect(s.screen).toBe('reward');
    expect(s.currentBossLessonId).toBeNull();
  });

  it('a replay win grants no extra egg, only the coin trickle', () => {
    useGameStore.getState().startBoss('u1-checkpoint');
    useGameStore.getState().finishBoss(true);          // first clear
    const afterFirst = useGameStore.getState().pets.length;
    const coinsAfterFirst = useGameStore.getState().coins;
    useGameStore.getState().startBoss('u1-checkpoint');
    useGameStore.getState().finishBoss(true);          // replay
    const s = useGameStore.getState();
    expect(s.pets.length).toBe(afterFirst);            // no second egg
    expect(s.coins).toBe(coinsAfterFirst + 8);         // replayCoins
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: FAIL — `startBoss`/`finishBoss`/`currentBossLessonId` undefined.

- [ ] **Step 4: Implement the store changes**

In `src/state/gameStore.ts`:

(a) Add to the `GameState` interface (near `currentLessonId`):

```typescript
  currentBossLessonId: string | null;
  startBoss: (lessonId: string) => void;
  finishBoss: (won: boolean) => void;
```

(b) Add to `freshState()` (near `currentLessonId`):

```typescript
    currentBossLessonId: null as string | null,
```

(c) Mark it transient in `partialize` (extend the destructure that already drops `currentLessonId`):

```typescript
      partialize: (s) => {
        const { lastLevelUp, lastStageChange, currentLessonId, currentBossLessonId, pendingStinger, ...rest } = s;
        void lastLevelUp; void lastStageChange; void currentLessonId; void currentBossLessonId; void pendingStinger;
        return rest as Omit<GameState, 'lastLevelUp' | 'lastStageChange' | 'currentLessonId' | 'currentBossLessonId' | 'pendingStinger'>;
      },
```

(d) Implement the actions (add near `startLesson`). Reuse `findLesson`, `selectActivePet`, `applyXp`, `GAME_CONFIG.battle.reward`, and the existing gacha domain for the egg:

```typescript
      startBoss: (lessonId) => {
        const found = findLesson(useContentStore.getState().bundle, lessonId);
        if (!found?.lesson.boss) return; // not a boss checkpoint — defensive no-op
        set({ currentBossLessonId: lessonId, screen: 'bossPrep' });
      },

      finishBoss: (won) =>
        set((s) => {
          const lessonId = s.currentBossLessonId;
          if (!lessonId) return s;
          if (!won) {
            // Lose is handled in-battle (soft retry); finishBoss is only called on win in P1.
            return { ...s, currentBossLessonId: null, pendingStinger: 'lose', screen: 'reward' };
          }
          const firstClear = !(lessonId in s.journey.lessonStars);
          const r = GAME_CONFIG.battle.reward;
          const coinsGain = firstClear ? r.firstClearCoins : r.replayCoins;
          // First clear → bonus XP to the active pet + a guaranteed egg.
          let pets = s.pets;
          let lastPull = s.lastPull;
          let lastLevelUp: GameState['lastLevelUp'] = null;
          let lastStageChange: StageChange | null = null;
          if (firstClear) {
            pets = updateActive(s, (p) => {
              const withXp = applyXp(p, r.firstClearXp, rng);
              lastLevelUp = withXp.levelUp;
              lastStageChange = withXp.stageChange;
              return withXp.pet;
            });
            const egg = makePet({
              id: crypto.randomUUID(),
              species: (['leaf', 'fire', 'air', 'water'] as const)[Math.floor(rng() * 4)],
              stats: rollStats(rng),
              rarity: 'common',
            });
            pets = [...pets, egg];
            lastPull = egg;
          }
          return {
            pets,
            coins: s.coins + coinsGain,
            lastPull,
            lastLevelUp,
            lastStageChange,
            journey: { lessonStars: { ...s.journey.lessonStars, [lessonId]: Math.max(s.journey.lessonStars[lessonId] ?? 0, 3) } },
            currentBossLessonId: null,
            pendingStinger: 'win',
            screen: 'reward',
          };
        }),
```

> Note: `makePet`, `rollStats`, `StageChange`, `GAME_CONFIG` are already imported in `gameStore.ts`. The egg here uses a flat `common` roll (the boss reward is a freebie, not a paid gacha pull). If a richer reward roll is wanted later, swap to `pullEggDomain` minus the price — out of scope for P1.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/state/gameStore.test.ts`
Expected: PASS. Then `npx vitest run` to confirm no regression in other store tests.

- [ ] **Step 6: Typecheck & commit**

```bash
npx tsc -b
git add src/data/types.ts src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat(boss): startBoss/finishBoss store actions + bossPrep/battle screens"
```

---

## Task 7: Live battle store slice

**Files:**
- Create: `src/state/battleStore.ts`
- Test: `src/state/battleStore.test.ts`

This transient store drives one live battle: it owns the `BattleSnapshot`, the chosen pet, the resolved boss, and the per-item attack/counter logic. It calls pure `domain/battle.ts` for numbers (RNG injected for tests). It does **not** persist.

- [ ] **Step 1: Write the failing test**

```typescript
// src/state/battleStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useBattleStore } from './battleStore';
import { makePet } from '../domain/pets';
import type { CheckpointBoss } from '../content/model';
import { BOSS_TIERS } from '../domain/bossTiers';

const boss: CheckpointBoss = {
  tierId: 'tier-1', element: 'fire', name: 'Ember Rival',
  rivalSprite: { species: 'fire', stage: 'young' },
};
const pet = makePet({
  id: 'p1', species: 'water',
  stats: { hp: 100, atk: 100, def: 50, spd: 60, luk: 0 },
  rarity: 'common',
});

describe('battleStore', () => {
  beforeEach(() => useBattleStore.getState().reset());

  it('begin sets up full bars from pet + tier', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99);
    const s = useBattleStore.getState();
    expect(s.snapshot?.bossHpMax).toBe(BOSS_TIERS[0].hpPool);
    expect(s.snapshot?.petHpMax).toBe(800); // hp 100 × 8
    expect(s.lastEvent).toBeNull();
  });

  it('a correct answer damages the boss (water beats fire = ×1.5)', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99); // 0.99 → no crit
    useBattleStore.getState().onCorrect();
    const s = useBattleStore.getState();
    // 100 atk × C/(C+40 def)=100×100/140=71.43 × 1.4 scalar × 1.5 element ≈ 150
    expect(s.snapshot!.bossHp).toBeLessThan(BOSS_TIERS[0].hpPool);
    expect(s.lastEvent?.kind).toBe('playerHit');
  });

  it('a wrong answer on the counter-cadence item makes the boss attack', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99); // 0.99 → boss hit lands (no dodge)
    useBattleStore.getState().onWrong();
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBeLessThan(800);
    expect(['bossHit', 'dodge']).toContain(s.lastEvent?.kind);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/state/battleStore.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/state/battleStore.ts`**

```typescript
import { create } from 'zustand';
import type { PetInstance } from '../data/types';
import type { CheckpointBoss } from '../content/model';
import { findTier } from '../domain/bossTiers';
import { displayStats } from '../config/petDisplay';
import {
  initBattle, applyPlayerHit, applyBossHit, type BattleSnapshot,
} from '../domain/battleSession';
import { computeHit, rollCrit, rollDodge } from '../domain/battle';

/** A one-shot event the UI animates (bolt, crit, dodge, etc.). */
export type BattleEvent =
  | { kind: 'playerHit'; dmg: number; crit: boolean }
  | { kind: 'bossHit'; dmg: number }
  | { kind: 'dodge' }
  | { kind: 'miss' };

interface BattleState {
  snapshot: BattleSnapshot | null;
  pet: PetInstance | null;
  boss: CheckpointBoss | null;
  bossStats: { atk: number; def: number; spd: number } | null;
  itemsAnswered: number;
  lastEvent: BattleEvent | null;
  rng: () => number;
  begin: (pet: PetInstance, boss: CheckpointBoss, rng?: () => number) => void;
  onCorrect: () => void;
  onWrong: () => void;
  reset: () => void;
}

const COUNTER_EVERY = 2; // P1 turn-based cadence (mirrors GAME_CONFIG.battle.bossCounterEveryNItems)

export const useBattleStore = create<BattleState>((set, get) => ({
  snapshot: null,
  pet: null,
  boss: null,
  bossStats: null,
  itemsAnswered: 0,
  lastEvent: null,
  rng: Math.random,

  begin: (pet, boss, rng = Math.random) => {
    const tier = findTier(boss.tierId);
    if (!tier) return;
    const ds = displayStats(pet);
    set({
      pet,
      boss,
      bossStats: { atk: tier.atk, def: tier.def, spd: tier.spd },
      snapshot: initBattle({ bossHpPool: tier.hpPool, petHpStat: ds.hp }),
      itemsAnswered: 0,
      lastEvent: null,
      rng,
    });
  },

  onCorrect: () =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss) return s;
      const ds = displayStats(s.pet);
      const crit = rollCrit(ds.luk, s.rng);
      const dmg = computeHit({
        atkStat: ds.atk,
        defStat: s.bossStats!.def,
        attackerSpecies: s.pet.species,
        defenderSpecies: s.boss.element,
        crit,
      });
      return {
        snapshot: applyPlayerHit(s.snapshot, dmg),
        itemsAnswered: s.itemsAnswered + 1,
        lastEvent: { kind: 'playerHit', dmg, crit },
      };
    }),

  onWrong: () =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss) return s;
      const items = s.itemsAnswered + 1;
      // Turn-based (P1): a wrong answer on the cadence beat → boss counter-attacks.
      if (items % COUNTER_EVERY !== 0) {
        return { itemsAnswered: items, lastEvent: { kind: 'miss' } };
      }
      const ds = displayStats(s.pet);
      if (rollDodge(ds.spd, s.bossStats!.spd, s.rng)) {
        return { itemsAnswered: items, lastEvent: { kind: 'dodge' } };
      }
      const dmg = computeHit({
        atkStat: s.bossStats!.atk,
        defStat: ds.def,
        attackerSpecies: s.boss.element,
        defenderSpecies: s.pet.species,
        crit: false,
      });
      return {
        snapshot: applyBossHit(s.snapshot, dmg),
        itemsAnswered: items,
        lastEvent: { kind: 'bossHit', dmg },
      };
    }),

  reset: () => set({ snapshot: null, pet: null, boss: null, bossStats: null, itemsAnswered: 0, lastEvent: null, rng: Math.random }),
}));
```

> Note the test's `onWrong` case: with `itemsAnswered` starting at 0, the first wrong answer makes `items = 1`, which is **not** on the every-2 cadence — so it would be a `miss`. Adjust the test to call `onWrong()` twice, or seed `itemsAnswered`. **Fix the test in Step 1** to assert the boss attacks on the *second* wrong answer:
>
> ```typescript
>     useBattleStore.getState().onWrong(); // item 1 → miss
>     useBattleStore.getState().onWrong(); // item 2 → boss attacks
> ```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/state/battleStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck & commit**

```bash
npx tsc -b
git add src/state/battleStore.ts src/state/battleStore.test.ts
git commit -m "feat(boss): live battle store slice (turn-based)"
```

---

## Task 8: Boss sprite + HP bar + damage number presentational components

**Files:**
- Create: `src/config/bossSprite.ts`
- Create: `src/components/battle/HpBar.tsx`
- Create: `src/components/battle/DamageNumber.tsx`
- Create: `src/components/battle/BossZone.tsx`

- [ ] **Step 1: `bossSprite.ts` — resolve a rival-pet boss sprite**

```typescript
import type { CheckpointBoss } from '../content/model';
import { spriteSrc } from './sprites';
import { ELEMENT_EMOJI } from './petDisplay';

/** A boss reuses a pet sprite (angry mood) scaled up by the UI. */
export function bossSpriteSrc(boss: CheckpointBoss): string {
  return spriteSrc(boss.rivalSprite.species, boss.rivalSprite.stage, 'sad'); // 'sad' = angry-ish face
}

export function bossElementEmoji(boss: CheckpointBoss): string {
  return ELEMENT_EMOJI[boss.element];
}
```

- [ ] **Step 2: `HpBar.tsx` — animated bar**

```tsx
import { useCountUp } from '../../effects/useCountUp';

export function HpBar({ value, max, tone }: { value: number; max: number; tone: 'boss' | 'pet' }) {
  const shown = useCountUp(value);
  const pct = max > 0 ? Math.max(0, Math.min(100, (shown / max) * 100)) : 0;
  const fill = tone === 'boss' ? 'from-rose-500 to-orange-400' : 'from-emerald-400 to-teal-300';
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800/60">
      <div className={`h-full rounded-full bg-gradient-to-r ${fill} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}
```

> Verify the `useCountUp` signature in `src/effects/useCountUp.ts` (it animates a number toward `value`). If its API differs (e.g. returns an object), adapt this call; do not change `useCountUp`.

- [ ] **Step 3: `DamageNumber.tsx` — floating number**

```tsx
import { motion } from 'framer-motion';

export function DamageNumber({ id, dmg, crit }: { id: number; dmg: number; crit: boolean }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 1, y: 0, scale: crit ? 1.4 : 1 }}
      animate={{ opacity: 0, y: -48 }}
      transition={{ duration: 0.8 }}
      className={`pointer-events-none absolute font-extrabold ${crit ? 'text-amber-300 text-3xl' : 'text-white text-xl'}`}
    >
      {crit ? `${dmg}!` : dmg}
    </motion.div>
  );
}
```

- [ ] **Step 4: `BossZone.tsx` — sprite + HP + element badge**

```tsx
import type { CheckpointBoss } from '../../content/model';
import { bossSpriteSrc, bossElementEmoji } from '../../config/bossSprite';
import { HpBar } from './HpBar';

export function BossZone({ boss, hp, hpMax }: { boss: CheckpointBoss; hp: number; hpMax: number }) {
  return (
    <div className="relative rounded-b-3xl bg-gradient-to-b from-fuchsia-950 to-indigo-950 px-4 pb-3 pt-4">
      <div className="flex items-center justify-between text-xs text-fuchsia-100">
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-bold">{bossElementEmoji(boss)} {boss.element}</span>
        <span className="font-semibold">{boss.name}</span>
      </div>
      <img src={bossSpriteSrc(boss)} alt={boss.name} draggable={false}
           className="mx-auto my-2 h-28 w-auto object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]" />
      <HpBar value={hp} max={hpMax} tone="boss" />
      <div className="mt-1 text-right text-[10px] text-fuchsia-200">{hp} / {hpMax}</div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck & commit**

```bash
npx tsc -b
git add src/config/bossSprite.ts src/components/battle/HpBar.tsx src/components/battle/DamageNumber.tsx src/components/battle/BossZone.tsx
git commit -m "feat(boss): boss-zone, hp-bar, damage-number components"
```

---

## Task 9: Boss prep (pet-select + recommended power)

**Files:**
- Create: `src/components/battle/BossPrepScreen.tsx`

- [ ] **Step 1: Implement the screen**

Picks one pet from `pets` (hatched only), shows the recommended power vs the selected pet's `petPower`, and a "Fight!" button that begins the battle and routes to `battle`.

```tsx
import { useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { useBattleStore } from '../../state/battleStore';
import { useContentStore } from '../../content/store';
import { findLesson } from '../../content/model';
import { findTier, recommendedPower } from '../../domain/bossTiers';
import { petPower, petDisplayName, ELEMENT_EMOJI, petStageSprite } from '../../config/petDisplay';
import { PressButton } from '../PressButton';

export function BossPrepScreen() {
  const lessonId = useGameStore((s) => s.currentBossLessonId);
  const pets = useGameStore((s) => s.pets);
  const setScreen = useGameStore((s) => s.setScreen);
  const bundle = useContentStore((s) => s.bundle);
  const begin = useBattleStore((s) => s.begin);

  const boss = lessonId ? findLesson(bundle, lessonId)?.lesson.boss : undefined;
  const tier = boss ? findTier(boss.tierId) : undefined;
  const hatched = useMemo(() => pets.filter((p) => p.hatched), [pets]);
  const [picked, setPicked] = useState(hatched[0]?.id ?? '');
  const pet = hatched.find((p) => p.id === picked) ?? hatched[0];

  if (!boss || !tier || !pet) return null; // defensive — routed only for real boss lessons

  const rec = recommendedPower(tier);
  const power = petPower(pet);
  const under = power < rec;

  return (
    <div className="flex h-full flex-col gap-4 bg-gradient-to-b from-indigo-100 to-fuchsia-50 p-4">
      <h2 className="text-center text-xl font-extrabold text-slate-800">{ELEMENT_EMOJI[boss.element]} {boss.name}</h2>
      <p className="text-center text-sm text-slate-600">
        Recommended power <b>{rec}</b> · your pet <b className={under ? 'text-rose-600' : 'text-emerald-600'}>{power}</b>
        {under && <span className="block text-rose-600">This one's tough — but you can still try! 💪</span>}
      </p>

      <div className="grid grid-cols-3 gap-2 overflow-y-auto">
        {hatched.map((p) => (
          <button key={p.id} type="button" onClick={() => setPicked(p.id)}
            className={`flex flex-col items-center rounded-xl border-2 p-2 ${p.id === picked ? 'border-indigo-500 bg-white' : 'border-transparent bg-white/60'}`}>
            <img src={petStageSprite(p)} alt={petDisplayName(p)} className="h-12 w-auto" draggable={false} />
            <span className="text-xs font-bold">{ELEMENT_EMOJI[p.species]} {petDisplayName(p)}</span>
            <span className="text-[10px] text-slate-500">PWR {petPower(p)}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto flex gap-2">
        <PressButton onClick={() => setScreen('pickDrill')}
          className="min-h-12 flex-1 rounded-xl bg-slate-200 font-bold text-slate-700">Back</PressButton>
        <PressButton onClick={() => { begin(pet, boss); setScreen('battle'); }}
          className="min-h-12 flex-[2] rounded-xl bg-indigo-600 font-extrabold text-white">Fight! ⚔️</PressButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck & commit**

```bash
npx tsc -b
git add src/components/battle/BossPrepScreen.tsx
git commit -m "feat(boss): pet-select prep screen with recommended power"
```

---

## Task 10: Battle screen (sentence input drives the fight)

**Files:**
- Create: `src/components/battle/BattleScreen.tsx`
- Create: `src/components/battle/BossIntro.tsx`

The battle reuses the existing presentational drill pieces (`SentenceSlots`, `WordTray`, `DndContext`) and the placement domain (`placeTile`, `tapPlace`, `parseDndId`, `currentSlotIndex`) — mirroring `DrillScreen.tsx` — but on submit it checks correctness and drives `battleStore` instead of `finishRound`. Items loop until a HP bar empties. On `win`/`lose` it reacts: win → `finishBoss(true)`; lose → soft retry overlay.

- [ ] **Step 1: `BossIntro.tsx` — short skippable cinematic**

```tsx
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CheckpointBoss } from '../../content/model';
import { bossSpriteSrc, bossElementEmoji } from '../../config/bossSprite';

export function BossIntro({ boss, onDone }: { boss: CheckpointBoss; onDone: () => void }) {
  const reduced = !!useReducedMotion();
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    const ms = reduced ? 200 : 1500;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [reduced, onDone]);
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#3a1d3d,#0a0f1f)] p-6"
         onClick={() => { if (!skip) { setSkip(true); onDone(); } }}>
      <motion.img src={bossSpriteSrc(boss)} alt={boss.name} draggable={false}
        initial={{ x: 120, opacity: 0, scale: 0.8 }} animate={{ x: 0, opacity: 1, scale: 1 }}
        transition={{ duration: reduced ? 0 : 0.6 }} className="h-36 w-auto object-contain" />
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.5 }}
        className="mt-4 text-2xl font-extrabold text-white">{bossElementEmoji(boss)} {boss.name}</motion.p>
      <p className="mt-2 text-xs text-white/60">tap to skip</p>
    </div>
  );
}
```

- [ ] **Step 2: `BattleScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useGameStore, selectActivePet } from '../../state/gameStore';
import { useBattleStore } from '../../state/battleStore';
import { useContentStore } from '../../content/store';
import { findLesson, itemsForLesson, trayWords } from '../../content/model';
import { shuffle } from '../../domain/check';
import { parseDndId, placeTile, tapPlace, currentSlotIndex } from '../../domain/placement';
import { SentenceSlots } from '../SentenceSlots';
import { WordTray } from '../WordTray';
import { PressButton } from '../PressButton';
import { BossZone } from './BossZone';
import { HpBar } from './HpBar';
import { DamageNumber } from './DamageNumber';
import { BossIntro } from './BossIntro';
import { petStageSprite, petDisplayName } from '../../config/petDisplay';

export function BattleScreen() {
  const lessonId = useGameStore((s) => s.currentBossLessonId);
  const finishBoss = useGameStore((s) => s.finishBoss);
  const setScreen = useGameStore((s) => s.setScreen);
  const bundle = useContentStore((s) => s.bundle);
  const lesson = lessonId ? findLesson(bundle, lessonId)?.lesson : undefined;
  const items = lesson ? itemsForLesson(bundle, lesson) : [];

  const { snapshot, boss, pet, onCorrect, onWrong, lastEvent, begin } = useBattleStore();

  const [intro, setIntro] = useState(true);
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<(string | null)[]>(() => (items[0]?.slots.map(() => null) ?? []));
  const [tiles, setTiles] = useState<string[]>(() => (items[0] ? shuffle(trayWords(items[0])) : []));
  const [used, setUsed] = useState<boolean[]>(() => (items[0] ? trayWords(items[0]).map(() => false) : []));
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [dmgKey, setDmgKey] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Defensive: if entered without a live battle (e.g. refresh), bounce to the map.
  useEffect(() => { if (!snapshot || !boss || !pet) setScreen('pickDrill'); }, [snapshot, boss, pet, setScreen]);

  // Resolve win/lose.
  useEffect(() => {
    if (snapshot?.outcome === 'win') finishBoss(true);
  }, [snapshot?.outcome, finishBoss]);

  if (!snapshot || !boss || !pet || items.length === 0) return null;
  if (intro) return <BossIntro boss={boss} onDone={() => setIntro(false)} />;

  const item = items[index];

  function loadItem(i: number) {
    const words = trayWords(items[i]);
    setPlaced(items[i].slots.map(() => null));
    setTiles(shuffle(words));
    setUsed(words.map(() => false));
  }
  function nextItem() { const i = (index + 1) % items.length; setIndex(i); loadItem(i); }

  function commit(next: { placed: (string | null)[]; used: boolean[] }) {
    if (next.placed === placed) return;
    setPlaced(next.placed); setUsed(next.used);
  }
  function onTapPlace(ti: number) { commit(tapPlace({ placed, used }, tiles, ti)); }
  function onDragStart(e: DragStartEvent) { const id = parseDndId(String(e.active.id)); if (id?.kind === 'tile') setActiveWord(tiles[id.index]); }
  function onDragEnd(e: DragEndEvent) {
    setActiveWord(null);
    if (!e.over) return;
    const from = parseDndId(String(e.active.id));
    const to = parseDndId(String(e.over.id));
    if (from?.kind !== 'tile' || to?.kind !== 'slot') return;
    commit(placeTile({ placed, used }, tiles, from.index, to.index));
  }

  function submit() {
    const correct = placed.length === item.answer.length && placed.every((w, i) => w === item.answer[i]);
    if (correct) { onCorrect(); setDmgKey((k) => k + 1); }
    else onWrong();
    // Only advance the item if the battle is still going; the win/lose effect handles the rest.
    if (useBattleStore.getState().snapshot?.outcome == null) nextItem();
  }

  const lost = snapshot.outcome === 'lose';
  const ready = placed.every((p) => p !== null) && placed.length > 0;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex h-full flex-col bg-gradient-to-b from-slate-900 to-slate-800">
        <BossZone boss={boss} hp={snapshot.bossHp} hpMax={snapshot.bossHpMax} />

        {/* floating damage number on a player hit */}
        <div className="relative h-0">
          {lastEvent?.kind === 'playerHit' && (
            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              <DamageNumber id={dmgKey} dmg={lastEvent.dmg} crit={lastEvent.crit} />
            </div>
          )}
          {lastEvent?.kind === 'dodge' && <div className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-sky-300">Dodge!</div>}
        </div>

        {/* pet strip */}
        <div className="flex items-center gap-2 bg-slate-950/40 px-4 py-2">
          <img src={petStageSprite(pet)} alt={petDisplayName(pet)} className="h-10 w-auto" draggable={false} />
          <div className="flex-1">
            <div className="text-[10px] text-emerald-200">{petDisplayName(pet)} · {snapshot.petHp}/{snapshot.petHpMax}</div>
            <HpBar value={snapshot.petHp} max={snapshot.petHpMax} tone="pet" />
          </div>
        </div>

        {/* drill input */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="rounded-xl bg-white/90 p-3 text-center text-lg font-extrabold text-slate-800">{item.thaiHint}</div>
          <div className="flex flex-1 items-center justify-center">
            <SentenceSlots slots={item.slots} placed={placed} onClearSlot={() => {}} />
          </div>
          {ready && <PressButton onClick={submit} className="min-h-12 rounded-xl bg-indigo-600 font-extrabold text-white">Attack! ⚡</PressButton>}
          <WordTray tiles={tiles} used={used} onTapPlace={onTapPlace} />
        </div>

        {lost && (
          <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/70 p-6 text-center">
            <p className="text-2xl font-extrabold text-white">So close! 💪</p>
            <p className="mt-1 text-white/80">Your pet is tired. Try again?</p>
            <div className="mt-5 flex gap-2">
              <PressButton onClick={() => setScreen('pickDrill')} className="min-h-12 rounded-xl bg-slate-200 px-5 font-bold text-slate-700">Leave</PressButton>
              <PressButton onClick={() => { begin(pet, boss); setIntro(false); setIndex(0); loadItem(0); }}
                className="min-h-12 rounded-xl bg-indigo-600 px-6 font-extrabold text-white">Try again</PressButton>
            </div>
          </div>
        )}
      </div>
      <DragOverlay>{activeWord ? <div className="min-h-12 rounded-xl bg-indigo-600 px-5 py-3 text-lg font-semibold text-white">{activeWord}</div> : null}</DragOverlay>
    </DndContext>
  );
}
```

> Implementation notes for the worker:
> - Correctness here is a direct `placed === answer` compare (simpler than `resolveRound`, which also handles partial-credit stars — not needed in battle). If the lesson's items include grammar traps, the same compare still works (trap tiles are wrong words → not equal).
> - The win effect calls `finishBoss(true)` which navigates to `reward`; no extra cleanup needed since `battleStore` is transient (reset on the next `begin`).
> - Clearing a placed tile is simplified to a no-op (`onClearSlot={() => {}}`) to keep P1 lean; if play-testing shows kids need to undo, wire the same `handleClear` logic as `DrillScreen.tsx`. Flag this to the user during review.

- [ ] **Step 3: Typecheck & commit**

```bash
npx tsc -b
git add src/components/battle/BattleScreen.tsx src/components/battle/BossIntro.tsx
git commit -m "feat(boss): battle screen + intro cinematic"
```

---

## Task 11: Routing — checkpoint enters the boss; screens render; music zone

**Files:**
- Modify: `src/App.tsx`
- Modify: the checkpoint node click handler in `src/components/journey/` (re-read first)

- [ ] **Step 1: Render the new screens in `screenKeyAndNode`**

In `src/App.tsx`, import the two screens and add cases:

```tsx
import { BossPrepScreen } from './components/battle/BossPrepScreen';
import { BattleScreen } from './components/battle/BattleScreen';
```

Inside the `switch (screen)`:

```tsx
    case 'bossPrep': return { key: 'bossPrep', node: <BossPrepScreen /> };
    case 'battle': return { key: 'battle', node: <BattleScreen /> };
```

- [ ] **Step 2: Map the new screens to the `boss` music zone**

In `zoneForScreen`, add:

```tsx
    case 'bossPrep':
    case 'battle':
      return 'boss';
```

- [ ] **Step 3: Route checkpoint taps to `startBoss`**

Re-read the journey node component (e.g. `src/components/journey/TrailNode.tsx` and its parent that calls `startLesson`). Where a node is tapped, branch on whether the lesson is a boss checkpoint:

```tsx
// where the node currently does: startLesson(lesson.id)
if (lesson.isCheckpoint && lesson.boss) startBoss(lesson.id);
else startLesson(lesson.id);
```

Pull `startBoss` from the store: `const startBoss = useGameStore((s) => s.startBoss);`. Keep the change additive and minimal to avoid colliding with the concurrent journey redesign.

- [ ] **Step 4: Manual verification**

Run: `npm run dev` (MAIN thread, `dangerouslyDisableSandbox: true`, PowerShell). Open the dev URL.
- Clear the first unit's non-checkpoint lessons so the checkpoint unlocks (or use a test save).
- Tap the checkpoint → **BossPrep** appears with recommended power.
- Pick a pet → **Fight!** → short intro → **BattleScreen** with boss + both HP bars.
- Build correct sentences → boss HP drains, damage numbers float; wrong answers eventually drain pet HP.
- Win → reward screen + a new egg in the collection; the checkpoint shows cleared and the next unit unlocks.
- Lose (intentionally tank it) → "Try again?" overlay; retry restores full bars.

Expected: all of the above; no console errors.

- [ ] **Step 5: Typecheck & commit**

```bash
npx tsc -b
git add src/App.tsx src/components/journey/TrailNode.tsx
git commit -m "feat(boss): route checkpoints into the boss battle + boss music zone"
```

---

## Task 12: Full suite + build + final commit

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: PASS (new battle/boss tests + no regressions).

- [ ] **Step 2: Typecheck + production build**

Run: `npx tsc -b && npm run build`
Expected: both succeed.

- [ ] **Step 3: Final commit (if any lint/build tweaks were needed)**

```bash
git add <explicit changed files>
git commit -m "chore(boss): P1 build green"
```

- [ ] **Step 4: Handoff note**

Write a short handoff for P2 (charge timer + active-dodge swipe) noting: `battleStore.onWrong` already rolls dodge and emits `dodge`/`bossHit` events (P2 adds the skill-swipe layer + real-time timer); `BattleEvent` is the seam for new SFX; `projectileVfxLevel`/`phases` on `BossTier` are reserved and unused in P1.

---

## Self-review (completed by planner)

**Spec coverage:** core loop (Tasks 7,10) · turn-based tempo (Task 7 cadence) · stat mapping hp/atk/def/spd/luk (Tasks 2,7) · ratio defense (Task 2) · 4-cycle elements (Task 2) · pet-select one pet (Task 9) · rival-pet boss tiers (Tasks 3,4,8) · soft retry (Task 10) · first-clear egg + bonus, replay trickle (Task 6) · recommended power never-block (Task 9) · elemental bolt + floating numbers (Tasks 8,10) · short cinematic intro (Task 10) · dedicated battle screen (Task 10) · win/lose via reward + `pendingStinger` (Task 6) · `boss` music zone (Task 11). **Out of scope (P2/P3):** charge timer, active-dodge swipe, multi-phase ramp, sprite growth, enrage, spot-the-error — explicitly deferred.

**Placeholder scan:** none — every code step has concrete content; the one test-fixture caveat (Task 7 cadence) is called out with the exact fix.

**Type consistency:** `BattleSnapshot` (Task 5) used identically in Tasks 7/10; `CheckpointBoss` (Task 4) consumed in Tasks 7/8/9/10; `BossTier`/`findTier`/`recommendedPower` (Task 3) used in Tasks 7/9; `computeHit`/`rollCrit`/`rollDodge`/`maxHpFromStat` (Task 2) used in Tasks 5/7; store actions `startBoss`/`finishBoss`/`currentBossLessonId` (Task 6) consumed in Tasks 9/10/11.

**Open items to confirm during execution (flagged, non-blocking):** `useCountUp` exact signature (Task 8); the journey checkpoint click handler's real location (Task 11); simplified tile-clear in battle (Task 10).
