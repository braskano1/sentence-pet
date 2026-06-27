# Boss Battle P3 Implementation Plan (multi-phase + spot-the-error)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-phase bosses (HP-threshold ramp + enrage + sprite-growth), a spot-the-error spell on phase-cross, recorded ElevenLabs SFX, and a 3-checkpoint boss ladder.

**Architecture:** Pure phase/spell math in `src/domain` (TDD), state in `battleStore` (phaseIndex + ramp + spell sub-mode), presentational additions in `src/components/battle` (SpellOverlay, sprite-growth box, phase pips, enrage juice). Content seeded in `seed.ts`. Audio = synth recipes (always-on fallback) + an offline ElevenLabs gen script + a runtime sample loader.

**Tech Stack:** React + TypeScript, Zustand, @dnd-kit, framer-motion, Vitest, Playwright, Web Audio API, ElevenLabs sound-generation API (node script).

**Spec:** `docs/superpowers/specs/2026-06-27-boss-battle-p3-design.md`

**Conventions (read before starting):**
- **Stage explicit files only** — never `git add -A`/`git add .` (shared `.git`; leave `firebase.json` + `sentencepet.mp4` untouched).
- Branch `journey-redesign`, single checkout `D:\ai_projects\AI_design_thinking\sentence-pet`. No worktrees.
- Tests: `npm test` (vitest, scoped to `src/`), `npm run build`, `npm run e2e` (Playwright).
- Windows + PowerShell; dev/e2e run on the main thread with `dangerouslyDisableSandbox: true`.

---

## File Map

| File | Responsibility | Action |
|------|----------------|--------|
| `src/domain/bossTiers.ts` | pure phase math: thresholds, scale, phase-from-hp | Modify |
| `src/domain/bossTiers.test.ts` | tests for the above | Create/Modify |
| `src/domain/battle.ts` | pure `buildSpellChallenge` | Modify |
| `src/domain/battle.test.ts` | tests for the spell builder | Modify |
| `src/config/gameConfig.ts` | `phaseRamp` + `spellWindowMs` tuning | Modify |
| `src/state/battleStore.ts` | phaseIndex, ramp, spell sub-mode, `resolveSpell`, `begin(items)` | Modify |
| `src/state/battleStore.test.ts` | phase-cross + spell store tests | Modify |
| `src/components/battle/SpellOverlay.tsx` | tappable wrong-sentence overlay | Create |
| `src/components/battle/SpellOverlay.test.tsx` | overlay render/tap test | Create |
| `src/components/battle/BossZone.tsx` | reserved sprite box + phaseScale + pips + enrage tint | Modify |
| `src/components/battle/BattleScreen.tsx` | render SpellOverlay, enrage juice (phaseIndex watch), pass items + sfx | Modify |
| `src/effects/sfx.ts` | battle `SfxName`s + synth recipes | Modify |
| `src/effects/sfx.test.ts` | new recipes don't throw | Modify |
| `src/effects/loadBattleSfx.ts` | fetch+decode public/audio/sfx → registerSample | Create |
| `scripts/gen-sfx.mjs` | offline ElevenLabs SFX generation | Create |
| `src/content/seed.ts` | u2-checkpoint boss (tier-2) + new u3 unit (tier-3, 2-phase) | Modify |
| `src/content/validate.test.ts` | seed still validates | (verify) |
| `e2e/boss.spec.ts` | cp3 phase-cross + spell resolve | Modify |

---

## Task 1: Pure phase math (`bossTiers.ts`)

**Files:**
- Modify: `src/domain/bossTiers.ts`
- Test: `src/domain/bossTiers.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Append to (or create) `src/domain/bossTiers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { phaseThresholds, phaseScale, phaseFromHp } from './bossTiers';

describe('phaseThresholds', () => {
  it('1 phase has no thresholds', () => {
    expect(phaseThresholds(1)).toEqual([]);
  });
  it('2 phases cross at 50%', () => {
    expect(phaseThresholds(2)).toEqual([0.5]);
  });
  it('3 phases cross at 2/3 and 1/3, descending', () => {
    const t = phaseThresholds(3);
    expect(t).toHaveLength(2);
    expect(t[0]).toBeCloseTo(2 / 3, 5);
    expect(t[1]).toBeCloseTo(1 / 3, 5);
  });
});

describe('phaseFromHp', () => {
  const t2 = phaseThresholds(2); // [0.5]
  it('full hp is phase 0', () => expect(phaseFromHp(1, t2)).toBe(0));
  it('just above threshold is phase 0', () => expect(phaseFromHp(0.51, t2)).toBe(0));
  it('at threshold is phase 1', () => expect(phaseFromHp(0.5, t2)).toBe(1));
  it('below threshold is phase 1', () => expect(phaseFromHp(0.2, t2)).toBe(1));
  it('3-phase boss at 0.3 hp is phase 2', () =>
    expect(phaseFromHp(0.3, phaseThresholds(3))).toBe(2));
});

describe('phaseScale', () => {
  it('single phase is full scale', () => expect(phaseScale(0, 1)).toBe(1));
  it('final phase fills the box', () => {
    expect(phaseScale(1, 2)).toBe(1);
    expect(phaseScale(2, 3)).toBe(1);
  });
  it('earlier phases are smaller, bounded by spriteScaleMin (0.7)', () => {
    expect(phaseScale(0, 2)).toBeCloseTo(0.7, 5);
    expect(phaseScale(0, 3)).toBeCloseTo(0.7, 5);
    expect(phaseScale(1, 3)).toBeCloseTo(0.85, 5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/domain/bossTiers.test.ts`
Expected: FAIL — `phaseThresholds`/`phaseScale`/`phaseFromHp` not exported.

- [ ] **Step 3: Implement**

Append to `src/domain/bossTiers.ts` (after `recommendedPower`):

```ts
import { GAME_CONFIG } from '../config/gameConfig';

/** Evenly-spaced HP-fraction thresholds for an N-phase boss, descending.
 *  1 → [] · 2 → [0.5] · 3 → [2/3, 1/3]. */
export function phaseThresholds(phases: number): number[] {
  const out: number[] = [];
  for (let i = phases - 1; i >= 1; i--) out.push(i / phases);
  return out;
}

/** Current phase index from the boss HP ratio: how many thresholds it has passed
 *  (ratio at or below the threshold counts as crossed). */
export function phaseFromHp(hpRatio: number, thresholds: number[]): number {
  return thresholds.filter((t) => hpRatio <= t).length;
}

/** Sprite scale within the reserved (largest-phase) box. Final phase = 1.0;
 *  earlier phases interpolate up from spriteScaleMin. Single-phase → 1.0. */
export function phaseScale(phaseIndex: number, phases: number): number {
  if (phases <= 1) return 1;
  const min = GAME_CONFIG.battle.phaseRamp.spriteScaleMin;
  return min + (1 - min) * (phaseIndex / (phases - 1));
}
```

> Note: `GAME_CONFIG.battle.phaseRamp` is added in Task 3. If running tasks out of order, do Task 3 first or the import resolves but the field is undefined. Subagent-driven execution runs tasks in order.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/domain/bossTiers.test.ts`
Expected: PASS (after Task 3 adds `phaseRamp`).

- [ ] **Step 5: Commit**

```bash
git add src/domain/bossTiers.ts src/domain/bossTiers.test.ts
git commit -m "feat(boss): P3 pure phase math — thresholds, phaseFromHp, phaseScale"
```

---

## Task 2: Spot-the-error spell builder (`battle.ts`)

**Files:**
- Modify: `src/domain/battle.ts`
- Test: `src/domain/battle.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/domain/battle.test.ts`:

```ts
import { buildSpellChallenge } from './battle';
import type { DrillItem } from '../data/types';

const trapItem: DrillItem = {
  id: 'gr-x', drill: 'grammar', level: 1, thaiHint: 'เขากิน',
  slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
};
const noTrapItem: DrillItem = {
  id: 'p-x', drill: 'pattern', level: 1, thaiHint: 'x',
  slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'],
};

describe('buildSpellChallenge', () => {
  it('injects the trap word at its slot and marks that index wrong', () => {
    const c = buildSpellChallenge(trapItem, () => 0);
    expect(c).not.toBeNull();
    expect(c!.words).toEqual(['he', 'eat']); // slot 1 replaced by the trap word
    expect(c!.wrongIndex).toBe(1);
    expect(c!.tip).toBe('เขา → he eats 👍');
  });
  it('returns null when the item has no traps', () => {
    expect(buildSpellChallenge(noTrapItem, () => 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/domain/battle.test.ts`
Expected: FAIL — `buildSpellChallenge` not exported.

- [ ] **Step 3: Implement**

Append to `src/domain/battle.ts`:

```ts
import type { DrillItem } from '../data/types';

export interface SpellChallenge {
  words: string[];     // the boss's wrong sentence, as tappable word chips
  wrongIndex: number;  // the index the kid must tap to break the spell
  tip: string;         // gentle Thai-scaffolded nudge
}

/** Build a spot-the-error challenge: take a trap-bearing item, substitute the
 *  trap word at its slot into the answer, and mark that slot as the wrong word.
 *  Pure + deterministic (rng injected). Returns null if the item has no traps. */
export function buildSpellChallenge(item: DrillItem, rng: () => number): SpellChallenge | null {
  const traps = item.traps ?? [];
  if (traps.length === 0) return null;
  const trap = traps[Math.floor(rng() * traps.length) % traps.length];
  const words = item.answer.slice();
  words[trap.slot] = trap.word;
  return { words, wrongIndex: trap.slot, tip: trap.tip };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/domain/battle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/battle.ts src/domain/battle.test.ts
git commit -m "feat(boss): P3 pure spot-the-error spell builder"
```

---

## Task 3: Config — phase ramp + spell window (`gameConfig.ts`)

**Files:**
- Modify: `src/config/gameConfig.ts:70-74` (inside `battle`)

- [ ] **Step 1: Add the config block**

In `src/config/gameConfig.ts`, inside `battle: { ... }`, after the `timer: {...}` block (line ~74), add:

```ts
    phaseRamp: {                 // P3 multi-phase ramp
      atkMult: 1.25,             // boss atk × this ^ phaseIndex per phase
      chargeMult: 0.8,           // chargeMs × this ^ phaseIndex (faster per phase)
      spellBreakMult: 1.5,       // bonus multiplier on a spell-break counter hit
      spriteScaleMin: 0.7,       // smallest phase's sprite scale within the reserved box
    },
    spellWindowMs: 4000,         // spot-the-error tap window before auto-miss
```

- [ ] **Step 2: Verify it typechecks + existing tests pass**

Run: `npm test -- src/domain/bossTiers.test.ts`
Expected: PASS (Task 1's `phaseScale` now resolves `spriteScaleMin`).

- [ ] **Step 3: Commit**

```bash
git add src/config/gameConfig.ts
git commit -m "feat(boss): P3 phaseRamp + spellWindowMs config"
```

---

## Task 4: Store — phaseIndex, ramp, phase-cross (`battleStore.ts`)

**Files:**
- Modify: `src/state/battleStore.ts`
- Test: `src/state/battleStore.test.ts`

This task adds `phaseIndex`/`bossPhases` state, ramps boss atk + chargeMs by phase, and crosses phases inside `onCorrect`. Spell entry + `resolveSpell` come in Task 5.

- [ ] **Step 1: Write the failing tests**

Append to `src/state/battleStore.test.ts`:

```ts
import { GAME_CONFIG } from '../config/gameConfig';

describe('multi-phase ramp', () => {
  beforeEach(() => useBattleStore.getState().reset());

  // tier-3 has phases: 2 (threshold at 50%). Use a fire boss so water pet has advantage.
  const PHASE_BOSS: CheckpointBoss = {
    tierId: 'tier-3', element: 'fire', name: 'Phase Rival',
    rivalSprite: { species: 'fire', stage: 'young' },
  };

  it('begins at phase 0 with the tier phase count', () => {
    useBattleStore.getState().begin(PET, PHASE_BOSS);
    const s = useBattleStore.getState();
    expect(s.phaseIndex).toBe(0);
    expect(s.bossPhases).toBe(2);
  });

  it('crossing 50% boss HP increments phaseIndex', () => {
    // Big-atk pet, no crit, vs tier-3 (hpPool 950). Hit until below half.
    const bigPet: PetInstance = { ...PET, stats: { ...PET.stats, atk: 100 } };
    useBattleStore.getState().begin(bigPet, PHASE_BOSS, () => 0.99);
    const max = useBattleStore.getState().snapshot!.bossHpMax;
    let guard = 0;
    while (useBattleStore.getState().snapshot!.bossHp / max > 0.5 && guard++ < 100) {
      useBattleStore.getState().onCorrect();
      // re-arm to answering if a spell opened (spell tested separately)
      if (useBattleStore.getState().battlePhase === 'spell') {
        useBattleStore.setState({ battlePhase: 'answering', spell: null });
      }
    }
    expect(useBattleStore.getState().phaseIndex).toBe(1);
  });

  it('ramped chargeMs makes the ring fill faster after a phase cross', () => {
    useBattleStore.getState().begin(PET, PHASE_BOSS, () => 0.99);
    // Force phase 1 directly.
    useBattleStore.setState({ phaseIndex: 1 });
    const ramped = GAME_CONFIG.battle.timer.chargeMs * GAME_CONFIG.battle.phaseRamp.chargeMult;
    useBattleStore.getState().tickCharge(ramped); // one ramped window worth of ms
    expect(useBattleStore.getState().battlePhase).toBe('charged'); // crossed in a single shorter window
  });

  it('a kill-hit that also crosses resolves as win, no phase bump', () => {
    const onePunch: PetInstance = { ...PET, stats: { ...PET.stats, atk: 100 } };
    useBattleStore.getState().begin(onePunch, { ...PHASE_BOSS, tierId: 'tier-1' }, () => 0.99);
    // tier-1 (hpPool 400, 1 phase): drain to 0.
    let guard = 0;
    while (useBattleStore.getState().snapshot!.outcome == null && guard++ < 100) {
      useBattleStore.getState().onCorrect();
    }
    const s = useBattleStore.getState();
    expect(s.snapshot!.outcome).toBe('win');
    expect(s.phaseIndex).toBe(0); // tier-1 is single-phase, never crosses
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/state/battleStore.test.ts`
Expected: FAIL — `phaseIndex`/`bossPhases` undefined.

- [ ] **Step 3: Implement state + ramp + cross**

In `src/state/battleStore.ts`:

(a) Extend imports (line ~10):

```ts
import {
  computeHit, rollCrit, rollDodge, chargeFraction, lurchedFraction,
} from '../domain/battle';
import { findTier, phaseThresholds, phaseFromHp } from '../domain/bossTiers';
```

(b) In `interface BattleState`, add fields (after `battlePhase`):

```ts
  phaseIndex: number;
  bossPhases: number;
```

(c) Add a ramp constant near `TIMER` (line ~42):

```ts
const RAMP = GAME_CONFIG.battle.phaseRamp;
```

(d) In the store object's initial state (after `battlePhase: 'answering',`), add:

```ts
  phaseIndex: 0,
  bossPhases: 1,
```

(e) In `begin`, after `const tier = findTier(...)` guard, set the new fields in the `set({...})`:

```ts
      charge: 0,
      battlePhase: 'answering',
      phaseIndex: 0,
      bossPhases: tier.phases,
```

(f) Rewrite `onCorrect` to cross phases after the player hit:

```ts
  onCorrect: () =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss) return s;
      if (s.battlePhase !== 'answering') return s; // charged/spell must resolve first
      const ds = displayStats(s.pet);
      const crit = rollCrit(ds.luk, s.rng);
      const dmg = computeHit({
        atkStat: ds.atk,
        defStat: s.bossStats!.def,
        attackerSpecies: s.pet.species,
        defenderSpecies: s.boss.element,
        crit,
      });
      const snapshot = applyPlayerHit(s.snapshot, dmg);
      const base = {
        snapshot,
        itemsAnswered: s.itemsAnswered + 1,
        lastEvent: { kind: 'playerHit' as const, dmg, crit },
        charge: 0,
        battlePhase: 'answering' as const,
      };
      // Phase cross only on a still-live boss.
      if (snapshot.outcome) return base;
      const ratio = snapshot.bossHp / snapshot.bossHpMax;
      const newPhase = phaseFromHp(ratio, phaseThresholds(s.bossPhases));
      if (newPhase <= s.phaseIndex) return base;
      // Crossed → bump phase. Spell entry is layered on in Task 5.
      return { ...base, phaseIndex: newPhase };
    }),
```

(g) In `onWrong`, ramp the boss counter atk. Replace the `computeHit({ atkStat: s.bossStats!.atk, ... })` call with:

```ts
      const dmg = computeHit({
        atkStat: s.bossStats!.atk * Math.pow(RAMP.atkMult, s.phaseIndex),
        defStat: ds.def,
        attackerSpecies: s.boss.element,
        defenderSpecies: s.pet.species,
        crit: false,
      });
```

(h) In `tickCharge`, ramp the window. Replace the body's `elapsed`/`charge` lines with:

```ts
      const chargeMs = TIMER.chargeMs * Math.pow(RAMP.chargeMult, s.phaseIndex);
      const elapsed = s.charge * chargeMs + dtMs;
      const charge = chargeFraction(elapsed, chargeMs);
```

(i) In `resolveSwipe`, ramp the charged-hit atk the same way as (g):

```ts
      const dmg = computeHit({
        atkStat: s.bossStats!.atk * Math.pow(RAMP.atkMult, s.phaseIndex),
        defStat: ds.def,
        attackerSpecies: s.boss.element,
        defenderSpecies: s.pet.species,
        crit: false,
      });
```

(j) In `reset`, add the new fields to the reset object:

```ts
    phaseIndex: 0,
    bossPhases: 1,
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/state/battleStore.test.ts`
Expected: PASS (the `spell`/`bossPhases` references in the new test resolve; `spell` field is set as `null` via setState in the test even before Task 5 — it is `undefined` in state until Task 5, but `setState({..., spell: null})` is harmless. If TS complains about `spell` in setState, do Task 5 first then return — but ordering keeps it fine because Task 5 adds the field.)

> If TS errors on `spell` not existing yet, temporarily drop the `spell: null` from the test's re-arm line; Task 5 restores it.

- [ ] **Step 5: Commit**

```bash
git add src/state/battleStore.ts src/state/battleStore.test.ts
git commit -m "feat(boss): P3 store phaseIndex + per-phase atk/charge ramp + phase cross"
```

---

## Task 5: Store — spell sub-mode + `resolveSpell` (`battleStore.ts`)

**Files:**
- Modify: `src/state/battleStore.ts`
- Test: `src/state/battleStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/state/battleStore.test.ts`:

```ts
import type { DrillItem } from '../data/types';

const SPELL_ITEM: DrillItem = {
  id: 'gr-spell', drill: 'grammar', level: 1, thaiHint: 'เขากิน',
  slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
};

describe('spot-the-error spell', () => {
  beforeEach(() => useBattleStore.getState().reset());

  const PHASE_BOSS: CheckpointBoss = {
    tierId: 'tier-3', element: 'fire', name: 'Phase Rival',
    rivalSprite: { species: 'fire', stage: 'young' },
  };

  function driveToCross() {
    const bigPet: PetInstance = { ...PET, stats: { ...PET.stats, atk: 100 } };
    useBattleStore.getState().begin(bigPet, PHASE_BOSS, () => 0, [SPELL_ITEM]);
    const max = useBattleStore.getState().snapshot!.bossHpMax;
    let guard = 0;
    while (useBattleStore.getState().phaseIndex === 0 && guard++ < 100) {
      // stop driving once a spell opens
      if (useBattleStore.getState().battlePhase === 'spell') break;
      useBattleStore.getState().onCorrect();
      void max;
    }
  }

  it('a phase cross opens the spell sub-mode with a built challenge', () => {
    driveToCross();
    const s = useBattleStore.getState();
    expect(s.phaseIndex).toBe(1);
    expect(s.battlePhase).toBe('spell');
    expect(s.spell).not.toBeNull();
    expect(s.spell!.wrongIndex).toBe(1);
  });

  it('tapping the wrong word breaks the spell → bonus boss damage, back to answering', () => {
    driveToCross();
    const before = useBattleStore.getState().snapshot!.bossHp;
    useBattleStore.getState().resolveSpell(1); // correct = the trap slot
    const s = useBattleStore.getState();
    expect(s.snapshot!.bossHp).toBeLessThan(before);
    expect(s.lastEvent?.kind).toBe('spellBreak');
    expect(s.battlePhase).toBe('answering');
    expect(s.spell).toBeNull();
  });

  it('a wrong tap lets the boss hit the pet', () => {
    driveToCross();
    const before = useBattleStore.getState().snapshot!.petHp;
    useBattleStore.getState().resolveSpell(0); // wrong word
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBeLessThan(before);
    expect(s.lastEvent?.kind).toBe('bossHit');
    expect(s.battlePhase).toBe('answering');
  });

  it('with no trap-bearing items the cross enrages but skips the spell', () => {
    const bigPet: PetInstance = { ...PET, stats: { ...PET.stats, atk: 100 } };
    useBattleStore.getState().begin(bigPet, PHASE_BOSS, () => 0.99, []); // no spell items
    let guard = 0;
    while (useBattleStore.getState().phaseIndex === 0 && guard++ < 100) {
      useBattleStore.getState().onCorrect();
    }
    const s = useBattleStore.getState();
    expect(s.phaseIndex).toBe(1);
    expect(s.battlePhase).toBe('answering'); // no spell opened
    expect(s.spell).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/state/battleStore.test.ts`
Expected: FAIL — `begin` takes no `items` arg, `spell`/`resolveSpell` undefined, `'spellBreak'` not in event union.

- [ ] **Step 3: Implement**

In `src/state/battleStore.ts`:

(a) Extend imports:

```ts
import { findTier, phaseThresholds, phaseFromHp } from '../domain/bossTiers';
import {
  computeHit, rollCrit, rollDodge, chargeFraction, lurchedFraction,
  buildSpellChallenge, type SpellChallenge,
} from '../domain/battle';
import type { DrillItem } from '../data/types';
```

(b) Extend `BattleEvent`:

```ts
  | { kind: 'bossCharge' }
  | { kind: 'chargedHit'; dmg: number }
  | { kind: 'spellBreak'; dmg: number };
```

(c) Extend `battlePhase` union + add fields in `interface BattleState`:

```ts
  battlePhase: 'answering' | 'charged' | 'spell';
  phaseIndex: number;
  bossPhases: number;
  spellItems: DrillItem[];
  spell: SpellChallenge | null;
```

(d) Update the `begin` signature + spell-item capture:

```ts
  begin: (pet: PetInstance, boss: CheckpointBoss, rng?: () => number, items?: DrillItem[]) => void;
```

and in the action body change the signature + set `spellItems`/`spell`:

```ts
  begin: (pet, boss, rng = Math.random, items = []) => {
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
      charge: 0,
      battlePhase: 'answering',
      phaseIndex: 0,
      bossPhases: tier.phases,
      spellItems: items.filter((i) => (i.traps?.length ?? 0) > 0),
      spell: null,
    });
  },
```

(e) Initial state object: add `spellItems: [], spell: null,` alongside `phaseIndex`/`bossPhases`.

(f) In `onCorrect`, replace the cross branch (`if (newPhase <= s.phaseIndex) return base;` … return) with spell entry:

```ts
      if (newPhase <= s.phaseIndex) return base;
      // Crossed a threshold → enter the next phase. Try to open a spot-the-error spell.
      const pool = s.spellItems;
      const challenge =
        pool.length > 0
          ? buildSpellChallenge(pool[Math.floor(s.rng() * pool.length) % pool.length], s.rng)
          : null;
      return {
        ...base,
        phaseIndex: newPhase,
        battlePhase: challenge ? ('spell' as const) : ('answering' as const),
        spell: challenge,
      };
```

(g) Add the `resolveSpell` action (after `resolveSwipe`):

```ts
  resolveSpell: (wordIndex) =>
    set((s) => {
      if (!s.snapshot || !s.pet || !s.boss || s.battlePhase !== 'spell' || !s.spell) return s;
      const ds = displayStats(s.pet);
      if (wordIndex === s.spell.wrongIndex) {
        // Spell broken → bonus counter hit on the boss.
        const base = computeHit({
          atkStat: ds.atk,
          defStat: s.bossStats!.def,
          attackerSpecies: s.pet.species,
          defenderSpecies: s.boss.element,
          crit: false,
        });
        const dmg = Math.round(base * RAMP.spellBreakMult);
        return {
          snapshot: applyPlayerHit(s.snapshot, dmg),
          charge: 0,
          battlePhase: 'answering' as const,
          spell: null,
          lastEvent: { kind: 'spellBreak' as const, dmg },
        };
      }
      // Wrong tap / timeout (wordIndex -1) → boss lands a ramped hit.
      const dmg = computeHit({
        atkStat: s.bossStats!.atk * Math.pow(RAMP.atkMult, s.phaseIndex),
        defStat: ds.def,
        attackerSpecies: s.boss.element,
        defenderSpecies: s.pet.species,
        crit: false,
      });
      return {
        snapshot: applyBossHit(s.snapshot, dmg),
        charge: 0,
        battlePhase: 'answering' as const,
        spell: null,
        lastEvent: { kind: 'bossHit' as const, dmg },
      };
    }),
```

(h) Add `resolveSpell` to the interface:

```ts
  resolveSpell: (wordIndex: number) => void;
```

(i) In `reset`, add `spellItems: [], spell: null,`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/state/battleStore.test.ts`
Expected: PASS (all P1/P2/P3 store tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/battleStore.ts src/state/battleStore.test.ts
git commit -m "feat(boss): P3 store spell sub-mode + resolveSpell + begin(items)"
```

---

## Task 6: SpellOverlay component

**Files:**
- Create: `src/components/battle/SpellOverlay.tsx`
- Test: `src/components/battle/SpellOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/battle/SpellOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpellOverlay } from './SpellOverlay';

const challenge = { words: ['he', 'eat'], wrongIndex: 1, tip: 'เขา → he eats 👍' };

describe('SpellOverlay', () => {
  it('renders the wrong sentence as tappable chips and reports the tapped index', () => {
    const onResolve = vi.fn();
    render(<SpellOverlay challenge={challenge} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: 'eat' }));
    expect(onResolve).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/components/battle/SpellOverlay.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/battle/SpellOverlay.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '../../config/gameConfig';
import type { SpellChallenge } from '../../domain/battle';

/** Spot-the-error overlay: the boss casts a wrong sentence. Tap the wrong word
 *  to break the spell. Auto-resolves as a miss (-1) when the window expires. */
export function SpellOverlay({
  challenge,
  onResolve,
}: {
  challenge: SpellChallenge;
  onResolve: (wordIndex: number) => void;
}) {
  const windowMs = GAME_CONFIG.battle.spellWindowMs;
  const done = useRef(false);

  const resolve = (i: number) => {
    if (done.current) return;
    done.current = true;
    onResolve(i);
  };

  useEffect(() => {
    const t = setTimeout(() => resolve(-1), windowMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowMs]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-violet-950/70 backdrop-blur-sm p-6 text-center">
      <p className="text-3xl font-black text-white drop-shadow">🔮 Spell! 🔮</p>
      <p className="mt-1 text-white/80">Tap the wrong word to break it!</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {challenge.words.map((w, i) => (
          <button
            key={i}
            type="button"
            onClick={() => resolve(i)}
            className="min-h-12 rounded-xl bg-white/90 px-4 py-2 text-lg font-bold text-slate-800 active:scale-95"
          >
            {w}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-violet-200">{challenge.tip}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/components/battle/SpellOverlay.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/battle/SpellOverlay.tsx src/components/battle/SpellOverlay.test.tsx
git commit -m "feat(boss): P3 SpellOverlay tap-the-wrong-word component"
```

---

## Task 7: BossZone — reserved sprite box, phaseScale, pips, enrage tint

**Files:**
- Modify: `src/components/battle/BossZone.tsx`

- [ ] **Step 1: Implement (presentational; no unit test — covered by e2e + manual)**

Replace the body of `src/components/battle/BossZone.tsx` with:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import type { CheckpointBoss } from '../../content/model';
import { bossSpriteSrc, bossElementEmoji } from '../../config/bossSprite';
import { HpBar } from './HpBar';
import { ChargeRing } from './ChargeRing';
import { useBattleStore } from '../../state/battleStore';
import { phaseScale } from '../../domain/bossTiers';

const BOX_H = 128; // reserved bounding box (px) = the largest phase's footprint

export function BossZone({ boss, hp, hpMax }: { boss: CheckpointBoss; hp: number; hpMax: number }) {
  const charge = useBattleStore((s) => s.charge);
  const phaseIndex = useBattleStore((s) => s.phaseIndex);
  const bossPhases = useBattleStore((s) => s.bossPhases);
  const reduce = useReducedMotion();
  const scale = phaseScale(phaseIndex, bossPhases);
  const enraged = phaseIndex > 0;

  return (
    <div className="relative rounded-b-3xl bg-gradient-to-b from-fuchsia-950 to-indigo-950 px-4 pb-3 pt-4">
      <div className="flex items-center justify-between text-xs text-fuchsia-100">
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-bold">
          {bossElementEmoji(boss)} {boss.element}
        </span>
        <div className="flex items-center gap-2">
          {/* Phase pips: filled up to the current phase */}
          {bossPhases > 1 && (
            <span className="flex gap-1" aria-label={`phase ${phaseIndex + 1} of ${bossPhases}`}>
              {Array.from({ length: bossPhases }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${i <= phaseIndex ? 'bg-rose-400' : 'bg-white/30'}`}
                />
              ))}
            </span>
          )}
          <span className="font-semibold">{boss.name}</span>
          <ChargeRing fraction={charge} />
        </div>
      </div>

      {/* Reserved box = largest phase; the sprite scales WITHIN it so layout never shifts. */}
      <div className="mx-auto my-2 flex items-end justify-center" style={{ height: BOX_H }}>
        <motion.img
          src={bossSpriteSrc(boss)}
          alt={boss.name}
          draggable={false}
          className={`h-32 w-auto object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)] ${
            enraged ? 'saturate-150 hue-rotate-[330deg]' : ''
          }`}
          style={{ transformOrigin: 'bottom center' }}
          animate={{ scale }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 14 }}
        />
      </div>

      <HpBar value={hp} max={hpMax} tone="boss" />
      <div className="mt-1 text-right text-[10px] text-fuchsia-200">
        {hp} / {hpMax}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + existing tests**

Run: `npm run build`
Expected: typechecks (framer-motion already a dep — used in `BossIntro`/`EvolutionCinematic`).

- [ ] **Step 3: Commit**

```bash
git add src/components/battle/BossZone.tsx
git commit -m "feat(boss): P3 BossZone reserved sprite box, phaseScale growth, pips, enrage tint"
```

---

## Task 8: BattleScreen — render SpellOverlay, enrage juice, pass items

**Files:**
- Modify: `src/components/battle/BattleScreen.tsx`

- [ ] **Step 1: Implement**

In `src/components/battle/BattleScreen.tsx`:

(a) Add imports:

```ts
import { useEffect, useRef, useState } from 'react';
import { SpellOverlay } from './SpellOverlay';
import { getSfx } from '../../effects/sfx';
```

(b) Add store selectors (after `resolveSwipe`):

```ts
  const phaseIndex = useBattleStore((s) => s.phaseIndex);
  const spell = useBattleStore((s) => s.spell);
  const resolveSpell = useBattleStore((s) => s.resolveSpell);
```

(c) Pass the lesson items to `begin`. There are TWO `begin(...)` call sites: the loss-overlay "Try again" button calls `begin(pet, boss)`. Find that and change to:

```ts
                  begin(pet, boss, undefined, items);
```

Also: the **initial** battle `begin` happens in `BossPrepScreen` (pre-battle), not here — wire its items there too (see Step (f)).

(d) Add an enrage-juice effect that fires when `phaseIndex` increases (skip the initial 0):

```ts
  const prevPhase = useRef(0);
  const [enrageKey, setEnrageKey] = useState(0);
  useEffect(() => {
    if (phaseIndex > prevPhase.current) {
      prevPhase.current = phaseIndex;
      setEnrageKey((k) => k + 1);
      getSfx().play('enrage', 0.5);
    }
  }, [phaseIndex]);
```

(e) Render the spell overlay + an enrage flash. Near the bottom `DodgeSwipe` render, add:

```tsx
      {battlePhase === 'spell' && spell && (
        <SpellOverlay challenge={spell} onResolve={resolveSpell} />
      )}

      {enrageKey > 0 && (
        <div
          key={enrageKey}
          className="pointer-events-none fixed inset-0 z-30 animate-[pulse_0.4s_ease-out] bg-rose-600/30"
        />
      )}
```

(f) **BossPrepScreen wiring.** Open `src/components/battle/BossPrepScreen.tsx`, find its `begin(pet, boss)` call (the "Fight" handler), and pass the checkpoint lesson's items. The screen already resolves the lesson/boss; add the items lookup with `itemsForLesson` and pass them:

```ts
import { findLesson, itemsForLesson } from '../../content/model';
// ...
const items = lessonId ? itemsForLesson(bundle, findLesson(bundle, lessonId)!.lesson) : [];
// in the Fight handler:
begin(pet, boss, undefined, items);
```

> If `BossPrepScreen` already imports `findLesson`/`itemsForLesson` or already has an `items` array, reuse it. The exact handler name/shape is in that file; the only change is adding the 4th `begin` argument.

- [ ] **Step 2: Verify build + tests**

Run: `npm run build && npm test`
Expected: typechecks; all unit tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/battle/BattleScreen.tsx src/components/battle/BossPrepScreen.tsx
git commit -m "feat(boss): P3 render SpellOverlay + enrage flash, pass spell items to begin"
```

---

## Task 9: SFX — battle recipes (`sfx.ts`)

**Files:**
- Modify: `src/effects/sfx.ts`
- Test: `src/effects/sfx.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/effects/sfx.test.ts`:

```ts
import { getSfx } from './sfx';

describe('battle sfx recipes', () => {
  it('plays every battle one-shot without throwing (silent in jsdom)', () => {
    const sfx = getSfx();
    for (const name of ['hit', 'crit', 'dodge', 'bossCharge', 'bossHit', 'enrage', 'fizzle'] as const) {
      expect(() => sfx.play(name, 0.5)).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/effects/sfx.test.ts`
Expected: FAIL — these names are not in `SfxName` (TS error / runtime undefined recipe).

- [ ] **Step 3: Implement**

In `src/effects/sfx.ts`:

(a) Extend the `SfxName` union:

```ts
export type SfxName =
  | 'tap' | 'nav'
  | 'drop' | 'correct' | 'wrong'
  | 'coin' | 'purchase' | 'pull' | 'reveal' | 'feed'
  | 'coo'
  | 'hit' | 'crit' | 'dodge' | 'bossCharge' | 'bossHit' | 'enrage' | 'fizzle';
```

(b) Add recipes to the `recipes` record (after `coo:`):

```ts
    hit:        (c, v) => { ping(440, 'square', c.currentTime, 0.1, 0.14 * v, 220); noise(0.08, 0.06 * v, 1200, 400); },
    crit:       (c, v) => { ping(660, 'square', c.currentTime, 0.14, 0.18 * v, 990); ping(990, 'square', c.currentTime + 0.06, 0.12, 0.16 * v); },
    dodge:      (_c, v) => noise(0.22, 0.08 * v, 300, 3000),
    bossCharge: (c, v) => ping(160, 'sawtooth', c.currentTime, 0.6, 0.1 * v, 520),
    bossHit:    (c, v) => { ping(140, 'sawtooth', c.currentTime, 0.22, 0.16 * v, 70); noise(0.12, 0.08 * v, 800, 200); },
    enrage:     (c, v) => { ping(110, 'sawtooth', c.currentTime, 0.5, 0.18 * v, 440); ping(220, 'square', c.currentTime + 0.08, 0.4, 0.12 * v, 660); },
    fizzle:     (c, v) => { ping(300, 'sawtooth', c.currentTime, 0.3, 0.1 * v, 120); noise(0.18, 0.05 * v, 2000, 300); },
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/effects/sfx.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/effects/sfx.ts src/effects/sfx.test.ts
git commit -m "feat(boss): P3 battle SFX recipes (hit/crit/dodge/bossCharge/bossHit/enrage/fizzle)"
```

---

## Task 10: Wire battle events → SFX (`BattleScreen.tsx`)

**Files:**
- Modify: `src/components/battle/BattleScreen.tsx`

- [ ] **Step 1: Implement event-driven sound**

`lastEvent` is a one-shot. Play a sound whenever it changes. Add an effect (near the enrage effect):

```ts
  useEffect(() => {
    if (!lastEvent) return;
    const map: Record<string, [import('../../effects/sfx').SfxName, number]> = {
      playerHit: ['hit', 0.5],
      bossHit: ['bossHit', 0.5],
      chargedHit: ['bossHit', 0.5],
      dodge: ['dodge', 0.5],
      miss: ['fizzle', 0.5],
      bossCharge: ['bossCharge', 0.4],
      spellBreak: ['crit', 0.5],
    };
    const entry = map[lastEvent.kind];
    if (entry) getSfx().play(entry[0], entry[1]);
    // crit upgrade: a critical player hit gets the brighter 'crit' sound
    if (lastEvent.kind === 'playerHit' && lastEvent.crit) getSfx().play('crit', 0.5);
  }, [lastEvent]);
```

> `lastEvent` is already selected in the component (`const lastEvent = useBattleStore((s) => s.lastEvent);`). Zustand returns the same object reference until it changes, so this effect fires once per event.

- [ ] **Step 2: Verify build + tests**

Run: `npm run build && npm test`
Expected: PASS (jsdom SFX is silent; no throw).

- [ ] **Step 3: Commit**

```bash
git add src/components/battle/BattleScreen.tsx
git commit -m "feat(boss): P3 play SFX on battle events"
```

---

## Task 11: Recorded audio — ElevenLabs gen script + sample loader

**Files:**
- Create: `scripts/gen-sfx.mjs`
- Create: `src/effects/loadBattleSfx.ts`
- Modify: `src/components/battle/BattleScreen.tsx` (load samples once on mount)

The synth recipes (Task 9) are the always-working fallback. This task adds recorded upgrades via `registerSample`. The clips are generated offline (network + API key) and committed as assets; the loader fetches + decodes them at battle start.

- [ ] **Step 1: Write the generation script**

Create `scripts/gen-sfx.mjs`:

```js
// Offline SFX generation via the ElevenLabs sound-generation API.
// Usage: node scripts/gen-sfx.mjs   (reads ELEVENLABS_API_KEY from .env.local)
// Writes mp3 clips to public/audio/sfx/. Re-run to regenerate.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = readFileSync(resolve('.env.local'), 'utf8');
const key = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('ELEVENLABS_API_KEY missing from .env.local');

const OUT = resolve('public/audio/sfx');
mkdirSync(OUT, { recursive: true });

// name → text prompt + duration (s) for the sound-generation model.
const CLIPS = {
  hit:        ['a short bright magical bolt impact, video game hit', 0.6],
  crit:       ['a powerful sparkly critical magic hit, game crit', 0.8],
  dodge:      ['a quick whoosh dash dodge swipe, game', 0.5],
  bossCharge: ['a rising ominous energy charge-up hum, game boss', 1.2],
  bossHit:    ['a heavy dull monster strike thud, game boss attack', 0.7],
  enrage:     ['an angry monster roar power-up surge, game boss enrage', 1.2],
  fizzle:     ['a failed spell fizzle sputter, game miss', 0.7],
};

for (const [name, [text, durationSeconds]] of Object.entries(CLIPS)) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: durationSeconds, prompt_influence: 0.6 }),
  });
  if (!res.ok) { console.error(`✗ ${name}: ${res.status} ${await res.text()}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(resolve(OUT, `${name}.mp3`), buf);
  console.log(`✓ ${name}.mp3 (${buf.length} bytes)`);
}
```

- [ ] **Step 2: Write the runtime sample loader**

Create `src/effects/loadBattleSfx.ts`:

```ts
import { registerSample, type SfxName } from './sfx';

const BATTLE_SFX: SfxName[] = ['hit', 'crit', 'dodge', 'bossCharge', 'bossHit', 'enrage', 'fizzle'];

let loaded = false;

/** Fetch + decode the recorded battle clips and register them over the synth
 *  recipes. Idempotent, best-effort: a missing clip silently keeps the synth
 *  fallback. Call once when a battle begins. */
export async function loadBattleSfx(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const Ctor =
    (globalThis as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext })
      .AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: new () => AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  await Promise.all(
    BATTLE_SFX.map(async (name) => {
      try {
        const res = await fetch(`/audio/sfx/${name}.mp3`);
        if (!res.ok) return;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        registerSample(name, buf);
      } catch {
        /* keep synth fallback */
      }
    }),
  );
}
```

- [ ] **Step 3: Call the loader on battle mount**

In `src/components/battle/BattleScreen.tsx`, add an import and a mount effect:

```ts
import { loadBattleSfx } from '../../effects/loadBattleSfx';
// ...
  useEffect(() => { void loadBattleSfx(); }, []);
```

- [ ] **Step 4: Generate the clips (manual, networked)**

Run (main thread, `dangerouslyDisableSandbox: true`):

```bash
node scripts/gen-sfx.mjs
```

Expected: `✓ <name>.mp3` lines; files appear in `public/audio/sfx/`.
If the API is unavailable/rate-limited, the synth fallback still ships — note it and continue.

- [ ] **Step 5: Verify build + tests**

Run: `npm run build && npm test`
Expected: PASS (jsdom has no AudioContext → loader no-ops; no throw).

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-sfx.mjs src/effects/loadBattleSfx.ts src/components/battle/BattleScreen.tsx
# stage the generated clips explicitly IF they were produced:
git add public/audio/sfx/hit.mp3 public/audio/sfx/crit.mp3 public/audio/sfx/dodge.mp3 public/audio/sfx/bossCharge.mp3 public/audio/sfx/bossHit.mp3 public/audio/sfx/enrage.mp3 public/audio/sfx/fizzle.mp3
git commit -m "feat(boss): P3 ElevenLabs SFX gen script + runtime sample loader"
```

> If clips were NOT generated, omit the `public/audio/sfx/*.mp3` line and commit only the code.

---

## Task 12: Content — u2 boss (tier-2) + new u3 unit (tier-3, 2-phase)

**Files:**
- Modify: `src/content/seed.ts`
- Verify: `src/content/validate.test.ts`

cp1 = `u1-checkpoint` (tier-1) is unchanged. This task adds cp2 (`u2-checkpoint`, tier-2) and cp3 (new unit `u3`, tier-3 = 2 phases). The cp3 checkpoint **must include trap-bearing grammar items** so the spell can build.

- [ ] **Step 1: Add the u2-checkpoint boss**

In `src/content/seed.ts`, find the `u2-checkpoint` lesson (~line 308):

```ts
{ id: "u2-checkpoint", drill: "mixed", level: 1, isCheckpoint: true, itemIds: ["mx-l1-1", "mx-l1-2", "mx-l1-3", "mx-l1-4", "mx-l1-5"] }
```

Replace with (add a `boss`, and swap two items for grammar items so cp2 also carries traps for future-proofing — keeping 5 items):

```ts
{
  id: "u2-checkpoint", drill: "mixed", level: 1, isCheckpoint: true,
  itemIds: ["mx-l1-1", "mx-l1-2", "gr-l1-1", "gr-l1-2", "mx-l1-5"],
  boss: {
    tierId: 'tier-2',
    element: 'water',
    name: 'Tidal Rival',
    rivalSprite: { species: 'water', stage: 'young' },
  },
}
```

- [ ] **Step 2: Add the new u3 unit**

In `src/content/seed.ts`, find the end of the `units` array (after the unit that contains `u2-checkpoint`, ~line 310-311) and add a third unit. Match the existing unit shape (`id`, `title`, `emoji`, `order`, `lessons`) — check u1/u2's exact fields and mirror them. Insert before the closing `]` of `units`:

```ts
,
{
  id: "u3-challenge",
  title: "Challenge",
  emoji: "🔥",
  order: 3,
  lessons: [
    { id: "u3-grammar", drill: "grammar", level: 1, itemIds: ["gr-l1-1", "gr-l1-2", "gr-l1-3", "gr-l1-4", "gr-l1-5"] },
    {
      id: "u3-checkpoint", drill: "mixed", level: 1, isCheckpoint: true,
      itemIds: ["gr-l1-1", "gr-l1-2", "gr-l1-3", "mx-l1-1", "mx-l1-2"],
      boss: {
        tierId: 'tier-3',
        element: 'leaf',
        name: 'Thornlord',
        rivalSprite: { species: 'leaf', stage: 'adult' },
      },
    },
  ],
}
```

> Verify `emoji`/`order` are the real `Unit` fields (model.ts `Unit` requires them). If u1/u2 use different keys, mirror those. `stage: 'adult'` must be a valid `Exclude<PetStage,'egg'>` — confirm against `src/data/types.ts` (`PetStage`); if `'adult'` isn't a stage, use `'young'`.

- [ ] **Step 3: Verify content validates**

Run: `npm test -- src/content/validate.test.ts`
Expected: PASS — each unit has exactly one checkpoint (last), all itemIds exist, ids unique.

If `validate.test.ts` snapshots the bundle or asserts a unit count, update its expectations to include u3.

- [ ] **Step 4: Verify the seed export + full suite**

Run: `npm test && npm run build`
Expected: PASS.

> If `scripts/export-seed.ts` / `seed-content.mjs` produce a derived seed JSON that other tests read, re-run the export per its header comment and stage the regenerated file explicitly.

- [ ] **Step 5: Commit**

```bash
git add src/content/seed.ts
# add any test files you had to update:
# git add src/content/validate.test.ts
git commit -m "feat(boss): P3 seed cp2 (tier-2) + u3 unit with cp3 multi-phase boss (tier-3)"
```

---

## Task 13: e2e — phase-cross + spell resolve on cp3

**Files:**
- Modify: `e2e/boss.spec.ts`

- [ ] **Step 1: Add the test**

Extend the `StoreState` type in `e2e/boss.spec.ts` to include the P3 fields:

```ts
  // P3 battle-store fields
  phaseIndex: number;
  bossPhases: number;
  spell: { words: string[]; wrongIndex: number; tip: string } | null;
  resolveSpell: (wordIndex: number) => void;
  onCorrect: () => void;
```

Then append a new test inside `test.describe('boss battle', ...)`:

```ts
  test('D: tier-3 boss crosses a phase and opens the spot-the-error spell', async ({ page }) => {
    await waitForStore(page);

    const CP3 = 'u3-checkpoint';
    await page.evaluate((id) => {
      (window as unknown as { store: { getState: () => StoreState } }).store.getState().startBoss(id);
    }, CP3);

    const hasBattleStore = await page.evaluate(() =>
      typeof (window as unknown as { battleStore?: { getState: () => unknown } }).battleStore?.getState === 'function',
    ).catch(() => false);
    test.skip(!hasBattleStore, 'battleStore not exposed on window in this build');

    await page.waitForFunction(
      () => typeof (window as unknown as { contentStore?: { getState: () => unknown } }).contentStore?.getState === 'function',
      null, { timeout: 10_000 },
    );

    // Begin a real battle on cp3 with its trap-bearing items so the spell can build.
    await page.evaluate((id) => {
      const gs = (window as unknown as { store: { getState: () => StoreState } }).store.getState();
      const pet = (gs.pets as Array<{ hatched: boolean }>).find((p) => p.hatched) ?? gs.pets[0];
      const cs = (window as unknown as { contentStore: { getState: () => { bundle: { pool: Record<string, unknown>; units: Array<{ lessons: Array<{ id: string; boss?: unknown; itemIds: string[] }> }> } } } }).contentStore.getState();
      let boss: unknown, items: unknown[] = [];
      for (const unit of cs.bundle.units) {
        const lesson = unit.lessons.find((l) => l.id === id);
        if (lesson?.boss) { boss = lesson.boss; items = lesson.itemIds.map((i) => cs.bundle.pool[i]); break; }
      }
      if (!boss) throw new Error(`No boss for ${id}`);
      const bs = (window as unknown as { battleStore: { getState: () => StoreState } }).battleStore.getState();
      // Deterministic rng (0) → no crit, deterministic spell pick.
      bs.begin(pet, boss, () => 0, items);
    }, CP3);

    // Hammer correct answers until the phase crosses (50% for tier-3).
    const crossed = await page.evaluate(() => {
      const ref = (window as unknown as { battleStore: { getState: () => StoreState } }).battleStore;
      for (let i = 0; i < 200; i++) {
        const s = ref.getState();
        if (s.phaseIndex >= 1) break;
        if (s.battlePhase === 'spell') break;
        s.onCorrect();
      }
      const s = ref.getState();
      return { phaseIndex: s.phaseIndex, battlePhase: s.battlePhase, hasSpell: s.spell !== null };
    });
    expect(crossed.phaseIndex).toBeGreaterThanOrEqual(1);
    expect(crossed.battlePhase).toBe('spell');
    expect(crossed.hasSpell).toBe(true);

    // Tap the wrong word → spell breaks, back to answering.
    const after = await page.evaluate(() => {
      const ref = (window as unknown as { battleStore: { getState: () => StoreState } }).battleStore;
      const wrongIndex = ref.getState().spell!.wrongIndex;
      ref.getState().resolveSpell(wrongIndex);
      const s = ref.getState();
      return { battlePhase: s.battlePhase, spell: s.spell };
    });
    expect(after.battlePhase).toBe('answering');
    expect(after.spell).toBeNull();
  });
```

- [ ] **Step 2: Run e2e**

Run: `npm run e2e -- -g "spot-the-error"`
Expected: PASS (or graceful skip if battleStore isn't exposed in the built env).

> If cp3's win triggers before a cross because the pet one-shots the boss, lower the test pet's effective atk by selecting `gs.pets[0]` regardless of hatched, or assert `phaseIndex>=1 OR outcome==='win'`. Prefer driving with the real first pet — tier-3's 950 HP pool needs several hits.

- [ ] **Step 3: Commit**

```bash
git add e2e/boss.spec.ts
git commit -m "test(boss): P3 e2e — tier-3 phase cross opens + resolves the spell"
```

---

## Task 14: Polish + balance pass

**Files:**
- Modify: `src/config/gameConfig.ts` (tuning only), any P3 file needing a fix found in play.

- [ ] **Step 1: Manual play-test (dev server)**

Run (main thread, `dangerouslyDisableSandbox: true`):

```bash
npm run dev
```

Open http://localhost:5173/ → `dev` button → `🧪 test acct` → play **cp1 → cp2 → cp3**. Verify per checkpoint:
- cp1 (tier-1): unchanged single-phase fight still wins/loses correctly.
- cp2 (tier-2): single-phase, water boss, no spell.
- cp3 (tier-3): at ~50% boss HP the **enrage flash + sprite grows + pip fills + `enrage` sound**, then the **spell overlay** opens; tapping the wrong word breaks it (boss takes bonus damage), a wrong tap/timeout hits the pet; the charge ring is **faster** in phase 2; boss hits are **harder**.
- Layout never shifts when the sprite grows (reserved box holds).
- Loss → "Try again" resets `phaseIndex` to 0 (boss small again, pips empty).
- Recorded SFX play if generated; otherwise synth.

- [ ] **Step 2: Tune**

Adjust `GAME_CONFIG.battle.phaseRamp` (`atkMult`, `chargeMult`, `spellBreakMult`, `spriteScaleMin`) and `spellWindowMs` so the climax feels harder-but-fair against the soft-retry safety net. Re-run `npm test` after any change (some store tests assert ramped behaviour qualitatively, not exact numbers, so they should hold).

- [ ] **Step 3: Full green gate**

Run: `npm test && npm run build && npm run e2e`
Expected: all green (e2e boss A/B/C/D).

- [ ] **Step 4: Commit any polish**

```bash
git add src/config/gameConfig.ts   # + any fixed files, explicitly
git commit -m "polish(boss): P3 balance pass — phase ramp + spell window tuning"
```

---

## Final whole-feature review (do not skip)

After all tasks, run a holistic review of the P3 diff (the P2 final review caught a real desync the per-task reviews missed). Check:
- `onCorrect` is the **only** phase-cross site; boss attacks never bump `phaseIndex`.
- `submit()` during `battlePhase === 'spell'` is ignored (it already guards on `=== 'answering'`).
- The rAF tick is paused in both `charged` and `spell` (it gates on `answering`).
- `begin`/`reset` clear `phaseIndex`, `bossPhases` (re-set on begin), `spellItems`, `spell`.
- A kill-hit that also crosses resolves as `win` with no enrage/spell.
- No `git add -A`; `firebase.json` + `sentencepet.mp4` still unstaged.

Then use **superpowers:finishing-a-development-branch** to push + open the PR (mirroring P1 #28 / P2 #29).

---

## Self-review notes (author)

- **Spec coverage:** §2 content ladder → Task 12; §3 thresholds/ramp/spell → Tasks 1,2,4,5; §4 architecture → Tasks 4–8; §5 sizing rule → Task 7; §6 juice + audio → Tasks 7,8,9,10,11; §7 win/lose → Task 4 (kill-hit test); §8 testing → every task + Task 13.
- **Deviation (documented):** enrage juice is driven by a `phaseIndex`-change `useEffect` in BattleScreen, not a one-shot `enrage` `BattleEvent` — so the crossing hit's `playerHit` damage number still renders (a single `lastEvent` can't carry both). `spellBreak` remains a real `BattleEvent`. Spec §4's "emit an `enrage` event" is satisfied behaviourally.
- **Type consistency:** `phaseThresholds`/`phaseFromHp`/`phaseScale` (Task 1) ↔ used in store (Task 4/5) + BossZone (Task 7). `buildSpellChallenge`/`SpellChallenge` (Task 2) ↔ store (Task 5) + SpellOverlay (Task 6). `begin(pet, boss, rng?, items?)` consistent across store, tests, BattleScreen, BossPrepScreen, e2e. `SfxName` battle additions (Task 9) ↔ loader (Task 11) + event map (Task 10).
- **Verify-against-real-code TODOs flagged inline:** `Unit` field names (`emoji`/`order`), `PetStage` `'adult'` validity, BossPrepScreen `begin` call site, whether `validate.test.ts`/seed-export need updates.
