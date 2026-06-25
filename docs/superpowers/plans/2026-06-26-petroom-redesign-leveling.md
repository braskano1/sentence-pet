# PetRoom Redesign + 50-Level Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 50-level progression with per-level random stat growth, redesign the PetRoom (HUD-on-art, Care|Power tabs, food tiles, labeled radar + rail, XP bar) and give the pet a speech bubble, keeping the cozy storybook brand.

**Architecture:** Pure domain modules (level curve, stage bands, stat growth, dialogue) drive deterministic logic with an injectable RNG; the Zustand store funnels every XP gain through one helper that allocates growth on level-up; React components are render-only and read derived display values from `config/petDisplay`. Persist bumps v7→v8 to add a `growth` field.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist) + Vitest + framer-motion + canvas-confetti.

**Conventions (from the repo):**
- Build dir / run all git + node here: `D:\ai_projects\AI_design_thinking\sentence-pet`. The Bash tool resets cwd between calls — prefix every command with `cd "D:\ai_projects\AI_design_thinking\sentence-pet" &&`.
- Typecheck = `npx tsc -b` (NOT `tsc --noEmit`). Tests = `npm test -- --run`.
- jsdom can't test framer-motion / @dnd-kit. Real logic in pure modules (injected RNG), unit-tested. Component tests render-only; never assert animated style values. `useCountUp` returns its target synchronously on mount.
- Mock `canvas-confetti` (`vi.mock('canvas-confetti', () => ({ default: vi.fn() }))`) in any test transitively importing `src/effects/celebrate.ts`.
- Anchor name regexes in component tests (`/^eggs$/i`) to dodge collisions.

**Phases (for session handoff per global workflow):**
- **Phase 1 — Domain & data (Tasks 1–8):** curve, stages, growth, store wiring, migration, dialogue. Pure/unit-tested core. Natural session boundary.
- **Phase 2 — UI (Tasks 9–14):** StatRadar extend, SpeechBubble, PetRoom redesign, Collection wiring.

---

## File Structure

**Domain / config / data:**
- `src/config/gameConfig.ts` — add `xp.maxLevel`, `xp.curve {base, growth}`; remove `xp.evolution` (xp-based stages gone).
- `src/domain/xp.ts` — rename `xpForLevel`→`xpPerCorrect`; add `STAGE_LEVEL` thresholds, `stageForLevel`, `xpToNext`, `totalXpForLevel`, `levelForXp`, `xpProgress`; rewrite `stageForXp` to compose.
- `src/domain/pets.ts` — add `allocateStatPoints`; `makePet` initializes `growth`.
- `src/data/types.ts` — `PetInstance.growth: BattleStats`.
- `src/config/petDisplay.ts` — `STAGE_NAME`; `petLevel` returns real level; add `displayStats`, `petPower`, `petSpecialty`.
- `src/domain/petDialogue.ts` (new) — `petDialogue(ctx, rng)`.

**Store:**
- `src/state/gameStore.ts` — `applyXp` helper (xp + growth allocation) used by `finishRound` + `addXpForTest`; transient `lastLevelUp`; persist v7→v8 migrate.

**UI:**
- `src/components/StatRadar.tsx` — optional `specialty` highlight prop.
- `src/components/SpeechBubble.tsx` (new) — named bubble.
- `src/components/PetRoom.tsx` — full redesign.
- `src/components/Collection.tsx` — wire level/displayStats/specialty.

---

## Phase 1 — Domain & Data

### Task 1: Config — level curve + earn-rate rename

**Files:**
- Modify: `src/config/gameConfig.ts`
- Modify: `src/domain/xp.ts` (rename only), `src/state/gameStore.ts` (call site), tests referencing `xpForLevel`.

- [ ] **Step 1: Update config**

In `src/config/gameConfig.ts` replace the `xp` block:

```ts
  xp: {
    perLevelMultiplier: 10, // xp earned per correct answer = perLevelMultiplier * drill level
    maxLevel: 50,
    curve: { base: 40, growth: 1.5 }, // xpToNext(level) = round(base * level^growth)
  },
```

(Removes `evolution`. Tuning knobs: `base`, `growth`.)

- [ ] **Step 2: Rename the earn-rate function**

In `src/domain/xp.ts` rename `xpForLevel` → `xpPerCorrect` (same body):

```ts
export function xpPerCorrect(level: number): number {
  return GAME_CONFIG.xp.perLevelMultiplier * level;
}
```

- [ ] **Step 3: Update the call site**

In `src/state/gameStore.ts`: change the import `xpForLevel` → `xpPerCorrect` and the line in `finishRound`:

```ts
const xpGain = correctCount * xpPerCorrect(level);
```

- [ ] **Step 4: Fix any test references**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run -t "xpForLevel"` — for any hit, rename to `xpPerCorrect` in that test file.

- [ ] **Step 5: Typecheck + commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test -- --run
git add -A && git commit -m "refactor(xp): rename xpForLevel->xpPerCorrect, add level-curve config"
```
Expected: tsc clean, tests green.

---

### Task 2: Level curve helpers in `domain/xp.ts`

**Files:**
- Modify: `src/domain/xp.ts`
- Test: `src/domain/xp.test.ts` (add cases; create if absent)

- [ ] **Step 1: Write failing tests**

Append to `src/domain/xp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { xpToNext, totalXpForLevel, levelForXp, xpProgress } from './xp';

describe('level curve', () => {
  it('xpToNext ramps and is Infinity at max', () => {
    expect(xpToNext(1)).toBe(40);          // round(40 * 1^1.5)
    expect(xpToNext(4)).toBe(320);         // round(40 * 4^1.5) = 320
    expect(xpToNext(50)).toBe(Infinity);   // no level beyond 50
  });
  it('totalXpForLevel(1) is 0 and accumulates', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(40);
    expect(totalXpForLevel(3)).toBe(40 + xpToNext(2));
  });
  it('levelForXp inverts the curve and caps at 50', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(39)).toBe(1);
    expect(levelForXp(40)).toBe(2);
    expect(levelForXp(10_000_000)).toBe(50);
  });
  it('xpProgress reports within-level position', () => {
    const p = xpProgress(40); // exactly level 2 start
    expect(p.level).toBe(2);
    expect(p.into).toBe(0);
    expect(p.span).toBe(xpToNext(2));
    expect(p.atMax).toBe(false);
    const max = xpProgress(10_000_000);
    expect(max.level).toBe(50);
    expect(max.atMax).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/xp.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement**

Add to `src/domain/xp.ts`:

```ts
const { maxLevel, curve } = GAME_CONFIG.xp;

/** XP needed to go from `level` to `level+1`. Infinity once at/over the cap. */
export function xpToNext(level: number): number {
  if (level >= maxLevel) return Infinity;
  return Math.round(curve.base * level ** curve.growth);
}

/** Total cumulative XP required to *be* `level` (level 1 = 0). */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

/** Current level (1..maxLevel) for a total XP amount. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < maxLevel && xp >= totalXpForLevel(level + 1)) level++;
  return level;
}

export interface XpProgress {
  level: number;   // 1..maxLevel
  into: number;    // xp earned into the current level
  span: number;    // xp the current level spans (Infinity at max)
  toNext: number;  // xp remaining to next level (0 at max)
  atMax: boolean;
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const atMax = level >= maxLevel;
  const into = xp - totalXpForLevel(level);
  const span = xpToNext(level);
  return { level, into, span, toNext: atMax ? 0 : span - into, atMax };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/xp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(xp): ramping level curve helpers (xpToNext/levelForXp/xpProgress)"
```

---

### Task 3: Stage bands by level

**Files:**
- Modify: `src/domain/xp.ts` (thresholds + `stageForLevel`, rewrite `stageForXp`)
- Test: `src/domain/xp.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/domain/xp.test.ts`:

```ts
import { stageForLevel, stageForXp, STAGE_LEVEL } from './xp';

describe('stage bands', () => {
  it('STAGE_LEVEL holds evolution thresholds', () => {
    expect(STAGE_LEVEL).toEqual({ baby: 1, young: 16, adult: 36 });
  });
  it('stageForLevel maps bands', () => {
    expect(stageForLevel(1)).toBe('baby');
    expect(stageForLevel(15)).toBe('baby');
    expect(stageForLevel(16)).toBe('young');
    expect(stageForLevel(35)).toBe('young');
    expect(stageForLevel(36)).toBe('adult');
    expect(stageForLevel(50)).toBe('adult');
  });
  it('stageForXp returns egg when not hatched, else composes', () => {
    expect(stageForXp(999999, false)).toBe('egg');
    expect(stageForXp(0, true)).toBe('baby');
    expect(stageForXp(totalXpForLevel(16), true)).toBe('young');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/xp.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/domain/xp.ts` replace the existing `stageForXp` and add thresholds. (Thresholds live here, not in `petDisplay`, to avoid a circular import — `petDisplay` already imports `xp`.)

```ts
/** First level of each non-egg stage. Add/retune a stage = one line here. */
export const STAGE_LEVEL = { baby: 1, young: 16, adult: 36 } as const;

export function stageForLevel(level: number): Exclude<PetStage, 'egg'> {
  if (level >= STAGE_LEVEL.adult) return 'adult';
  if (level >= STAGE_LEVEL.young) return 'young';
  return 'baby';
}

export function stageForXp(xp: number, hatched: boolean): PetStage {
  if (!hatched) return 'egg';
  return stageForLevel(levelForXp(xp));
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/xp.test.ts && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(xp): level-band evolution stages (STAGE_LEVEL/stageForLevel)"
```

---

### Task 4: `growth` field on PetInstance

**Files:**
- Modify: `src/data/types.ts`, `src/domain/pets.ts`
- Test: `src/domain/pets.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/domain/pets.test.ts`:

```ts
it('makePet initializes zeroed growth', () => {
  const p = makePet({ id: 'x', species: 'fire', stats: rollStats(() => 0), rarity: 'common' });
  expect(p.growth).toEqual({ hp: 0, atk: 0, def: 0, spd: 0, luk: 0 });
});
```

(Ensure `makePet` and `rollStats` are imported in that test file.)

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/pets.test.ts`
Expected: FAIL (`growth` undefined).

- [ ] **Step 3: Implement**

In `src/data/types.ts`, add to `PetInstance` (after `stats`):

```ts
  growth: BattleStats; // points allocated by level-ups (+1 random per level); display = stats + growth
```

In `src/domain/pets.ts` `makePet` return object add:

```ts
    growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
```

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/pets.test.ts && npx tsc -b`
Expected: PASS; tsc may flag other spots constructing pets without `growth` — fix each by adding the zeroed growth. Re-run until clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(pets): add growth field, init zeroed in makePet"
```

---

### Task 5: Display derivations (`displayStats`/`petPower`/`petSpecialty`/level/stage name)

**Files:**
- Modify: `src/config/petDisplay.ts`
- Test: `src/config/petDisplay.test.ts` (create if absent)

- [ ] **Step 1: Write failing tests**

Create/append `src/config/petDisplay.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { displayStats, petPower, petSpecialty, petLevel, STAGE_NAME } from './petDisplay';
import { makePet, rollStats } from '../domain/pets';

const base = makePet({ id: 't', species: 'water', stats: { hp: 50, atk: 60, def: 40, spd: 55, luk: 45 }, rarity: 'rare' });

describe('display derivations', () => {
  it('displayStats = stats + growth', () => {
    const p = { ...base, growth: { hp: 5, atk: 0, def: 0, spd: 0, luk: 0 } };
    expect(displayStats(p)).toEqual({ hp: 55, atk: 60, def: 40, spd: 55, luk: 45 });
  });
  it('petPower sums displayed stats', () => {
    expect(petPower(base)).toBe(50 + 60 + 40 + 55 + 45);
  });
  it('petSpecialty is the highest displayed stat, tie-broken by stat order', () => {
    expect(petSpecialty(base)).toBe('atk');
  });
  it('petLevel reflects xp', () => {
    expect(petLevel({ ...base, xp: 0 })).toBe(1);
    expect(petLevel({ ...base, xp: 40 })).toBe(2);
  });
  it('STAGE_NAME labels each stage', () => {
    expect(STAGE_NAME.young).toBe('Young');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/config/petDisplay.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/config/petDisplay.ts`:
- Change the import from `../domain/xp` to include `levelForXp`.
- Replace `petLevel` body and add the new exports:

```ts
import { levelForXp, stageForXp } from '../domain/xp';
import type { BattleStats, PetInstance, ... } from '../data/types'; // keep existing

export const STAGE_NAME: Record<PetStage, string> = {
  egg: 'Egg', baby: 'Baby', young: 'Young', adult: 'Adult',
};

/** Displayed battle stats = creation roll + level-up growth. */
export function displayStats(pet: PetInstance): BattleStats {
  const g = pet.growth;
  const s = pet.stats;
  return { hp: s.hp + g.hp, atk: s.atk + g.atk, def: s.def + g.def, spd: s.spd + g.spd, luk: s.luk + g.luk };
}

export function petPower(pet: PetInstance): number {
  const d = displayStats(pet);
  return d.hp + d.atk + d.def + d.spd + d.luk;
}

/** Highest displayed stat; ties broken by BATTLE_STAT_LABELS order. */
export function petSpecialty(pet: PetInstance): keyof BattleStats {
  const d = displayStats(pet);
  let best = BATTLE_STAT_LABELS[0][1];
  for (const [, key] of BATTLE_STAT_LABELS) if (d[key] > d[best]) best = key;
  return best;
}

export function petLevel(pet: PetInstance): number {
  return levelForXp(pet.xp);
}
```

(`PetStage` must be imported in the type list. Remove the now-unused `stageForXp` import only if nothing else here uses it — `petStageSprite` does, so keep it.)

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/config/petDisplay.test.ts && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(display): displayStats/petPower/petSpecialty + real petLevel + STAGE_NAME"
```

---

### Task 6: Stat-point allocation (pure)

**Files:**
- Modify: `src/domain/pets.ts`
- Test: `src/domain/pets.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/domain/pets.test.ts`:

```ts
import { allocateStatPoints } from './pets';

describe('allocateStatPoints', () => {
  const zero = { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 };
  it('adds exactly `count` points across the five stats', () => {
    let calls = 0;
    const rng = () => [0, 0.25, 0.45, 0.65, 0.85][calls++]; // -> hp, atk, def, spd, luk
    const g = allocateStatPoints(zero, 5, rng);
    expect(g).toEqual({ hp: 1, atk: 1, def: 1, spd: 1, luk: 1 });
  });
  it('is immutable and total grows by count', () => {
    const g = allocateStatPoints(zero, 3, () => 0); // always hp
    expect(g).toEqual({ hp: 3, atk: 0, def: 0, spd: 0, luk: 0 });
    expect(zero.hp).toBe(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/pets.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `src/domain/pets.ts`:

```ts
const STAT_KEYS = ['hp', 'atk', 'def', 'spd', 'luk'] as const;

/** Add `count` points to random stats (uniform over the five), returning a new growth object. */
export function allocateStatPoints(growth: BattleStats, count: number, rng: () => number): BattleStats {
  const next: BattleStats = { ...growth };
  for (let i = 0; i < count; i++) {
    const key = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
    next[key] += 1;
  }
  return next;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/pets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(pets): allocateStatPoints (random +1 per level, injectable rng)"
```

---

### Task 7: Store — apply XP with growth + level-up signal

**Files:**
- Modify: `src/state/gameStore.ts`
- Test: `src/state/gameStore.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/state/gameStore.test.ts` (adjust imports to match the file's existing helpers):

```ts
import { levelForXp, totalXpForLevel } from '../domain/xp';

it('addXpForTest levels the pet and allocates one growth point per level', () => {
  const { resetForTest, addXpForTest } = useGameStore.getState();
  resetForTest();
  // hatch so it is not an egg (level still derives from xp)
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
  const need = totalXpForLevel(3); // jump straight to level 3 -> +2 points
  addXpForTest(need);
  const p = useGameStore.getState().pets[0];
  expect(levelForXp(p.xp)).toBe(3);
  const totalGrowth = p.growth.hp + p.growth.atk + p.growth.def + p.growth.spd + p.growth.luk;
  expect(totalGrowth).toBe(2);
  expect(useGameStore.getState().lastLevelUp?.toLevel).toBe(3);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/state/gameStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/state/gameStore.ts`:
- Add imports: `import { levelForXp } from '../domain/xp';` and `allocateStatPoints` from `../domain/pets`.
- Add to `GameState`: `lastLevelUp: { toLevel: number; gained: (keyof BattleStats)[] } | null;` and include `lastLevelUp: null` in `freshState()`. Import `BattleStats` type.
- Add a module-level helper (after `updateActive`):

```ts
/** Apply an XP gain to one pet, allocating +1 growth per level crossed. */
function applyXp(pet: PetInstance, xpGain: number, rng: () => number): { pet: PetInstance; levelUp: { toLevel: number; gained: (keyof BattleStats)[] } | null } {
  const before = levelForXp(pet.xp);
  const xp = pet.xp + xpGain;
  const after = levelForXp(xp);
  if (after <= before) return { pet: { ...pet, xp }, levelUp: null };
  const gained: (keyof BattleStats)[] = [];
  let growth = pet.growth;
  for (let l = before; l < after; l++) {
    const next = allocateStatPoints(growth, 1, rng);
    // diff to learn which stat got the point (for the level-up message)
    (Object.keys(next) as (keyof BattleStats)[]).forEach((k) => { if (next[k] !== growth[k]) gained.push(k); });
    growth = next;
  }
  return { pet: { ...pet, xp, growth }, levelUp: { toLevel: after, gained } };
}
```

- In `finishRound`, replace the active-pet update so it threads `applyXp` and sets `lastLevelUp`:

```ts
finishRound: ({ drill, level, stars, correctCount }) =>
  set((s) => {
    const group = DRILL_FOOD[drill];
    const xpGain = correctCount * xpPerCorrect(level);
    const coinsGain = GAME_CONFIG.coins.base + GAME_CONFIG.coins.perStar * stars;
    let levelUp: GameState['lastLevelUp'] = null;
    const pets = updateActive(s, (p) => {
      const happiness =
        decayHappiness(p.happiness) +
        GAME_CONFIG.happiness.onClear +
        (stars === 3 ? GAME_CONFIG.happiness.onThreeStars : 0);
      const withXp = applyXp(p, xpGain, rng);
      levelUp = withXp.levelUp;
      return {
        ...withXp.pet,
        happiness: Math.min(GAME_CONFIG.happiness.max, happiness),
        bars: decayBars(p.bars),
      };
    });
    return {
      pets,
      coins: s.coins + coinsGain,
      inventory: { ...s.inventory, [group]: s.inventory[group] + correctCount },
      lastReward: { level, stars, food: correctCount, coins: coinsGain, group },
      lastLevelUp: levelUp,
      screen: 'reward',
    };
  }),
```

- Replace `addXpForTest`:

```ts
addXpForTest: (xp) =>
  set((s) => {
    let levelUp: GameState['lastLevelUp'] = null;
    const pets = updateActive(s, (p) => {
      const r = applyXp(p, xp, rng);
      levelUp = r.levelUp;
      return r.pet;
    });
    return { pets, lastLevelUp: levelUp };
  }),
```

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/state/gameStore.test.ts && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(store): applyXp allocates growth on level-up, exposes lastLevelUp"
```

---

### Task 8: Persist v7 → v8 (backfill `growth`)

**Files:**
- Modify: `src/state/gameStore.ts` (version + migrate)
- Test: `src/state/gameStore.test.ts` (migrate test)

- [ ] **Step 1: Write failing test**

Append to `src/state/gameStore.test.ts`:

```ts
it('migrate backfills zeroed growth on pets without it (v7->v8)', () => {
  const migrate = useGameStore.persist.getOptions().migrate!;
  const v7 = {
    pets: [{ id: 'a', species: 'leaf', hatched: true, xp: 100, happiness: 60,
      bars: { protein: 50, veggie: 50, vitamin: 50, treat: 50 },
      stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 }, rarity: 'common', name: '' }],
    activePetId: 'a', coins: 0, inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
  };
  const out = migrate(v7, 7) as { pets: { growth: unknown }[] };
  expect(out.pets[0].growth).toEqual({ hp: 0, atk: 0, def: 0, spd: 0, luk: 0 });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/state/gameStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/state/gameStore.ts` persist options: bump `version: 8`, extend the comment, and add a backfill block alongside the existing v6/v7 ones (before the final `delete`/`return`):

```ts
        // v7->v8: backfill growth on any pet that predates the field.
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            (p as PetInstance).growth
              ? p
              : { ...(p as PetInstance), growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 } },
          );
        }
```

Also, in the v<5 legacy branch, the `makePet(...)` result already includes `growth` (Task 4), so no change needed there.

- [ ] **Step 4: Run, verify pass + full suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run && npx tsc -b`
Expected: all green, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(persist): v7->v8 backfill growth"
```

---

### Task 9: Pet dialogue module (pure)

**Files:**
- Create: `src/domain/petDialogue.ts`
- Test: `src/domain/petDialogue.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/petDialogue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { petDialogue, type DialogueCtx } from './petDialogue';

const baseCtx: DialogueCtx = {
  name: 'Bubble', species: 'water', stage: 'young',
  lowestGroup: 'protein', lowestValue: 80, happiness: 80,
  justFed: false, leveledTo: null, gainedStat: null, nearEvolution: false,
};

describe('petDialogue', () => {
  it('prioritizes level-up', () => {
    const line = petDialogue({ ...baseCtx, leveledTo: 13, gainedStat: 'atk' }, () => 0);
    expect(line).toMatch(/13|ATK|grew/i);
  });
  it('mentions hunger when a bar is low', () => {
    const line = petDialogue({ ...baseCtx, lowestValue: 15 }, () => 0);
    expect(line.length).toBeGreaterThan(0);
    expect(line).toMatch(/hungry|feed|eat/i);
  });
  it('thanks after feeding', () => {
    expect(petDialogue({ ...baseCtx, justFed: true }, () => 0)).toMatch(/thank|yum|tasty/i);
  });
  it('always returns a non-empty string (idle fallback)', () => {
    expect(petDialogue(baseCtx, () => 0).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/petDialogue.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/domain/petDialogue.ts`:

```ts
import type { BattleStats, FoodGroup, PetStage, Species } from '../data/types';

export interface DialogueCtx {
  name: string;
  species: Species;
  stage: PetStage;
  lowestGroup: FoodGroup;
  lowestValue: number;
  happiness: number;
  justFed: boolean;
  leveledTo: number | null;
  gainedStat: keyof BattleStats | null;
  nearEvolution: boolean;
}

const HUNGRY_AT = 30;
const HAPPY_AT = 70;
const FOOD_WORD: Record<FoodGroup, string> = { protein: 'meat', veggie: 'veggies', vitamin: 'vitamins', treat: 'a treat' };
const STAT_WORD: Record<keyof BattleStats, string> = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD', luk: 'LUK' };

function pick(rng: () => number, lines: string[]): string {
  return lines[Math.floor(rng() * lines.length)] ?? lines[0];
}

/** One contextual line. Priority: level-up > fed > hunger > near-evolution > low-happiness > idle. */
export function petDialogue(ctx: DialogueCtx, rng: () => number): string {
  if (ctx.leveledTo !== null) {
    const stat = ctx.gainedStat ? ` +1 ${STAT_WORD[ctx.gainedStat]}!` : '';
    return pick(rng, [`I grew to Lv ${ctx.leveledTo}!${stat}`, `Level ${ctx.leveledTo}!${stat} 💪`]);
  }
  if (ctx.justFed) return pick(rng, ['Yum, thank you!', 'So tasty!', 'Mmm, more please?']);
  if (ctx.lowestValue <= HUNGRY_AT) {
    const food = FOOD_WORD[ctx.lowestGroup];
    return pick(rng, [`I'm hungry, feed me ${food}!`, `Can I eat some ${food}?`, `My tummy needs ${food}.`]);
  }
  if (ctx.nearEvolution) return pick(rng, ['I feel like I am changing...', 'Something is happening to me!']);
  if (ctx.happiness < HAPPY_AT) return pick(rng, ['Can we play?', 'I want to have fun!', 'Play a round with me?']);
  return pick(rng, [`Hi! I'm ${ctx.name}.`, 'What a nice day!', "Let's learn together!", 'I love it here!']);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/domain/petDialogue.test.ts && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(dialogue): contextual canned pet lines (pure, injectable rng)"
```

**END OF PHASE 1.** Write a handoff and start a fresh session for Phase 2 if context is heavy. Verify: `npm test -- --run` green, `npx tsc -b` clean.

---

## Phase 2 — UI

### Task 10: Extend `StatRadar` with a specialty highlight

**Files:**
- Modify: `src/components/StatRadar.tsx`
- Test: `src/components/StatRadar.test.tsx` (create if absent)

- [ ] **Step 1: Write failing render test**

Create/append `src/components/StatRadar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatRadar } from './StatRadar';

describe('StatRadar', () => {
  it('renders all five axis labels with values', () => {
    const { getByText } = render(
      <StatRadar stats={{ hp: 70, atk: 60, def: 50, spd: 40, luk: 30 }} color="#8b5cf6" specialty="hp" />,
    );
    expect(getByText(/HP 70/)).toBeTruthy();
    expect(getByText(/LUK 30/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/StatRadar.test.tsx`
Expected: FAIL (prop type / not rendering) or PASS if labels already render — if it passes, still add the prop in Step 3 for the highlight.

- [ ] **Step 3: Implement**

In `src/components/StatRadar.tsx` add an optional `specialty` prop and mark its vertex/label gold:

```tsx
export function StatRadar({ stats, color, size = 180, max = 100, specialty }: {
  stats: BattleStats;
  color: string;
  size?: number;
  max?: number;
  specialty?: keyof BattleStats;
}) {
```

In the data polygon section, after the `<motion.polygon>`, add gold vertex dots (specialty larger/gold):

```tsx
      {BATTLE_STAT_LABELS.map(([, key], i) => {
        const [dx, dy] = xy(i, Math.max(0.08, animated[key] / max));
        const isSpec = key === specialty;
        return <circle key={`d-${key}`} cx={dx} cy={dy} r={isSpec ? 3.5 : 2.4}
          fill={isSpec ? '#fde68a' : color} stroke={isSpec ? '#b45309' : 'none'} strokeWidth={isSpec ? 2 : 0} />;
      })}
```

And in the label `<text>`, tint the specialty:

```tsx
        fill={key === specialty ? '#b45309' : '#451a03'}
```

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/StatRadar.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(StatRadar): optional specialty gold highlight + vertex dots"
```

---

### Task 11: `SpeechBubble` component

**Files:**
- Create: `src/components/SpeechBubble.tsx`
- Test: `src/components/SpeechBubble.test.tsx`

- [ ] **Step 1: Write failing render test**

Create `src/components/SpeechBubble.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SpeechBubble } from './SpeechBubble';

describe('SpeechBubble', () => {
  it('shows the speaker name and line', () => {
    const { getByText } = render(<SpeechBubble name="Bubble" line="I'm hungry!" />);
    expect(getByText('Bubble')).toBeTruthy();
    expect(getByText("I'm hungry!")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/SpeechBubble.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/SpeechBubble.tsx`:

```tsx
import { motion } from 'framer-motion';

/** Named speech bubble shown above the pet; tail points down to it. */
export function SpeechBubble({ name, line }: { name: string; line: string }) {
  return (
    <motion.div
      key={line}
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative max-w-[72%] rounded-2xl border-2 border-amber-900/15 bg-[#fffaf0] px-3 py-2 text-sm font-semibold text-amber-950 shadow-lg"
    >
      <span className="block text-[8px] font-extrabold uppercase tracking-wide text-violet-500">{name}</span>
      {line}
      <span aria-hidden className="absolute -bottom-[9px] left-9 border-[9px] border-transparent border-t-[#fffaf0] border-b-0" />
    </motion.div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/SpeechBubble.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(ui): SpeechBubble component"
```

---

### Task 12: PetRoom — scene (HUD overlay + identity + XP bar + bubble)

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Test: `src/components/PetRoom.test.tsx`

- [ ] **Step 1: Write failing render tests**

In `src/components/PetRoom.test.tsx` (keep `vi.mock('canvas-confetti', ...)` at top if the suite imports celebrate transitively). Add:

```tsx
it('shows identity chip with level, the XP bar label, and My Pets button', () => {
  // arrange: ensure hatched, some xp
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true, xp: 40 })) }));
  render(<PetRoom />);
  expect(screen.getByText(/Lv 2/)).toBeTruthy();
  expect(screen.getByText(/XP →/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /my pets/i })).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/PetRoom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the scene**

Rewrite the scene region of `src/components/PetRoom.tsx`. Read these from the store/derivations: `petDisplayName`, `petLevel`, `STAGE_NAME`, `ELEMENT_EMOJI`, `RARITY_RING`, `xpProgress`, `displayStats`, `petPower`, `petSpecialty`, and `petDialogue`. Compute the bubble line from current state:

```tsx
import { xpProgress } from '../domain/xp';
import { petLevel, petDisplayName, STAGE_NAME, ELEMENT_EMOJI, RARITY_RING, displayStats, petPower, petSpecialty } from '../config/petDisplay';
import { petDialogue } from '../domain/petDialogue';
import { stageForXp } from '../domain/xp';
import { FOOD_GROUPS, FOOD_META } from '../data/food';
import { SpeechBubble } from './SpeechBubble';
// ... existing imports
```

Scene JSX (pet lower-center, HUD corners, XP + bubble):

```tsx
const xpp = xpProgress(activePet.xp);
const level = petLevel(activePet);
const stageName = STAGE_NAME[stage];
const lowest = FOOD_GROUPS.reduce((a, g) => (activePet.bars[g] < activePet.bars[a] ? g : a), FOOD_GROUPS[0]);
const line = petDialogue({
  name: petDisplayName(activePet), species: activePet.species, stage,
  lowestGroup: lowest, lowestValue: activePet.bars[lowest], happiness: activePet.happiness,
  justFed: false, leveledTo: lastLevelUp?.toLevel ?? null, gainedStat: lastLevelUp?.gained[0] ?? null,
  nearEvolution: false,
}, Math.random);
```

```tsx
<div className="relative flex flex-1 flex-col">
  {/* HUD corners */}
  <div className="absolute inset-x-2 top-2 z-20 flex items-start justify-between">
    <span className="flex items-center gap-1.5 rounded-full bg-white/85 py-0.5 pl-0.5 pr-2 shadow">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sm ring-2 ${RARITY_RING[activePet.rarity]}`}>{ELEMENT_EMOJI[activePet.species]}</span>
      <span className="text-[11px] font-extrabold leading-tight text-amber-950">{petDisplayName(activePet)} · Lv {level}
        <small className="block text-[8px] font-bold text-amber-900/70">{activePet.rarity.toUpperCase()} · {activePet.species.toUpperCase()} · {stageName.toUpperCase()}</small>
      </span>
    </span>
    <div className="flex flex-col items-end gap-1">
      <span className="rounded-full bg-amber-950/85 px-2.5 py-1 text-[11px] font-bold text-amber-50 tabular-nums">🪙 {coins}</span>
      <PressButton onClick={() => setScreen('collection')} aria-label="My pets" className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-extrabold text-amber-950 shadow">🐾 My Pets · {pets.length}</PressButton>
    </div>
  </div>

  {/* bubble + pet */}
  <div className="relative z-10 flex flex-1 flex-col items-center justify-end px-6 pb-2">
    <div className="mb-2"><SpeechBubble name={petDisplayName(activePet)} line={line} /></div>
    <div className="relative drop-shadow-[0_14px_26px_rgba(0,0,0,0.4)]">
      <PetSprite stage={stage} species={activePet.species} happiness={activePet.happiness} feedTrigger={feedTrigger} />
    </div>
  </div>

  {/* XP bar */}
  <div className="absolute inset-x-3 bottom-2 z-20">
    <div className="mb-0.5 flex justify-between text-[9px] font-extrabold text-white drop-shadow">
      <span>{xpp.atMax ? 'FULLY GROWN' : `XP → LV ${level + 1}`}</span>
      <span>{xpp.atMax ? 'MAX ✨' : `${xpp.into} / ${xpp.span}`}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-black/30">
      <div className={`h-full rounded-full ${xpp.atMax ? 'bg-gradient-to-r from-amber-500 to-amber-300' : 'bg-gradient-to-r from-green-400 to-green-500'}`}
        style={{ width: `${xpp.atMax ? 100 : Math.round((xpp.into / xpp.span) * 100)}%` }} />
    </div>
  </div>
</div>
```

Add `const lastLevelUp = useGameStore((s) => s.lastLevelUp);` to the selectors. Keep the room background `<img>` and glow from the existing file. Remove the old name/XP/coins panel header (now in HUD).

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/PetRoom.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(PetRoom): HUD-on-art scene with identity, XP bar, speech bubble"
```

---

### Task 13: PetRoom — Care | Power tabs + Care tab (happiness + food tiles)

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Test: `src/components/PetRoom.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/components/PetRoom.test.tsx`:

```tsx
it('Care tab shows happiness and a feed button per owned food; feeding calls the store', () => {
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })), inventory: { ...s.inventory, protein: 3 } }));
  render(<PetRoom />);
  expect(screen.getByText(/Happiness/i)).toBeTruthy();
  const feedProtein = screen.getByRole('button', { name: /feed protein/i });
  fireEvent.click(feedProtein);
  expect(useGameStore.getState().inventory.protein).toBe(0); // feed() zeroes it
});

it('switches to the Power tab', () => {
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
  render(<PetRoom />);
  fireEvent.click(screen.getByRole('tab', { name: /power/i }));
  expect(screen.getByText(/Power/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/PetRoom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement panel + tabs + Care**

Add local tab state and the panel below the scene in `src/components/PetRoom.tsx`:

```tsx
const [tab, setTab] = useState<'care' | 'power'>('care');
```

Panel JSX (replaces the old stat grid / battle row / feed row):

```tsx
<div className="relative z-10 rounded-t-[2rem] border-t-4 border-amber-900/30 px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
  style={{ background: 'linear-gradient(180deg,#fcecc9 0%,#f4dba9 60%,#ebcb91 100%)' }}>

  <div role="tablist" aria-label="Pet details" className="mb-3 flex gap-1 rounded-xl bg-amber-900/12 p-1">
    {(['care', 'power'] as const).map((t) => (
      <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
        className={`flex-1 rounded-lg py-1.5 text-sm font-extrabold ${tab === t ? 'bg-white text-amber-950 shadow' : 'text-amber-900/70'}`}>
        {t === 'care' ? 'Care' : 'Power ⬡'}
      </button>
    ))}
  </div>

  {tab === 'care' ? (
    <div role="tabpanel">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">😊</span>
        <div className="flex-1">
          <div className="flex justify-between text-[10px] font-extrabold text-amber-900/70"><span>Happiness</span><span className="tabular-nums">{activePet.happiness}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-amber-950/15"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${activePet.happiness}%` }} /></div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {FOOD_GROUPS.map((g) => {
          const owned = inventory[g];
          return (
            <div key={g} className="flex flex-col items-center gap-1">
              <span className="text-xl">{FOOD_META[g].emoji}</span>
              <span className="text-xs font-extrabold tabular-nums text-amber-950">{activePet.bars[g]}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-950/15"><div className={`h-full rounded-full ${FOOD_META[g].color}`} style={{ width: `${activePet.bars[g]}%` }} /></div>
              <PressButton aria-label={`Feed ${FOOD_META[g].label}`} disabled={owned === 0}
                onClick={() => { feed(g); setFeedTrigger((n) => n + 1); }}
                className={`relative w-full rounded-lg py-1 text-xs font-extrabold text-white ${owned === 0 ? 'bg-amber-900/15 text-amber-900/40' : 'border-b-2 border-black/25 bg-green-600'}`}>
                ＋<span className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1 text-[7px] text-white">{owned}</span>
              </PressButton>
            </div>
          );
        })}
      </div>
    </div>
  ) : (
    <PowerPanel pet={activePet} />  /* Task 14 */
  )}

  <div className="mt-4 flex gap-2">
    <PressButton onClick={() => setScreen('gacha')} aria-label="Eggs" className="min-h-12 flex-1 rounded-2xl border-b-4 border-violet-800 bg-violet-500 px-3 py-3 text-base font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2">Eggs 🥚</PressButton>
    <PressButton onClick={() => setScreen('shop')} className="min-h-12 flex-1 rounded-2xl border-b-4 border-amber-900/50 bg-amber-500 px-3 py-3 text-base font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2">Shop 🛒</PressButton>
    <PressButton onClick={() => setScreen('pickDrill')} className="min-h-12 flex-1 rounded-2xl border-b-4 border-emerald-800 bg-emerald-500 px-3 py-3 text-base font-extrabold text-white shadow active:translate-y-0.5 active:border-b-2">Play ▶</PressButton>
  </div>
</div>
```

For Task 13, temporarily stub `PowerPanel` so the file compiles:

```tsx
function PowerPanel({ pet }: { pet: PetInstance }) { return <div role="tabpanel">Power</div>; }
```

Remove the now-unused `StatChip`, `health`, `barColor`, `BATTLE_STAT_LABELS` imports if no longer referenced (Power tab in Task 14 will re-add what it needs).

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/PetRoom.test.tsx && npx tsc -b`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(PetRoom): Care|Power tabs + Care tab (happiness + food tiles)"
```

---

### Task 14: PetRoom — Power tab (radar + rail)

**Files:**
- Modify: `src/components/PetRoom.tsx`
- Test: `src/components/PetRoom.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `src/components/PetRoom.test.tsx`:

```tsx
it('Power tab shows level/power/specialty rail', () => {
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
  render(<PetRoom />);
  fireEvent.click(screen.getByRole('tab', { name: /power/i }));
  expect(screen.getByText(/Power/i)).toBeTruthy();
  expect(screen.getByText(/Specialty/i)).toBeTruthy();
  expect(screen.getByText(/\/ 50/)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/PetRoom.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `PowerPanel`**

Replace the stub with the real component (uses `StatRadar` + derivations + `RARITY_HEX`):

```tsx
import { RARITY_HEX, displayStats, petPower, petSpecialty, petLevel, BATTLE_STAT_LABELS } from '../config/petDisplay';
import { StatRadar } from './StatRadar';

function PowerPanel({ pet }: { pet: PetInstance }) {
  const stats = displayStats(pet);
  const spec = petSpecialty(pet);
  const specLabel = BATTLE_STAT_LABELS.find(([, k]) => k === spec)?.[0] ?? 'HP';
  return (
    <div role="tabpanel" className="flex items-center gap-2">
      <StatRadar stats={stats} color={RARITY_HEX[pet.rarity]} size={160} specialty={spec} />
      <div className="flex w-24 flex-none flex-col gap-1.5">
        <div className="rounded-xl bg-amber-900/10 px-2 py-1.5"><div className="text-[8px] font-extrabold uppercase text-amber-900/70">Level</div><div className="text-lg font-extrabold text-amber-950">{petLevel(pet)}<span className="text-[9px] text-amber-900/70"> / 50</span></div></div>
        <div className="rounded-xl bg-amber-900/10 px-2 py-1.5"><div className="text-[8px] font-extrabold uppercase text-amber-900/70">⚔ Power</div><div className="text-lg font-extrabold text-amber-950 tabular-nums">{petPower(pet)}</div></div>
        <div className="rounded-xl bg-amber-900/10 px-2 py-1.5"><div className="text-[8px] font-extrabold uppercase text-amber-900/70">★ Specialty</div><div className="text-base font-extrabold text-amber-700">{specLabel}</div></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass + typecheck + full suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run && npx tsc -b`
Expected: all green, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(PetRoom): Power tab radar + level/power/specialty rail"
```

---

### Task 15: Collection — wire real level + displayed stats + specialty

**Files:**
- Modify: `src/components/Collection.tsx`
- Test: `src/components/Collection.test.tsx`

- [ ] **Step 1: Inspect + write failing test**

Read `src/components/Collection.tsx` to find where it renders the radar and stat numbers (currently likely `pet.stats` + `petLevel`). Add to `src/components/Collection.test.tsx`:

```tsx
it('shows displayed stats including growth on the detail card', () => {
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true, growth: { hp: 7, atk: 0, def: 0, spd: 0, luk: 0 } })) }));
  render(<Collection />);
  // base hp + 7 should appear somewhere in the detail readout
  // (assert via the radar label or numeric row text; adjust matcher to the real markup)
  expect(screen.getByText(/HP/)).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify current behavior**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx vitest run src/components/Collection.test.tsx`
Expected: passes trivially or fails — use it to confirm the markup matcher.

- [ ] **Step 3: Implement**

In `src/components/Collection.tsx`: replace direct `pet.stats` reads with `displayStats(pet)`, pass `specialty={petSpecialty(pet)}` to `StatRadar`, show `petLevel(pet)` (1..50) and `STAGE_NAME[stageForXp(pet.xp, pet.hatched)]`, and `petPower(pet)` where a total is shown. Import these from `petDisplay`/`xp`.

- [ ] **Step 4: Run, verify pass + full suite + typecheck**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run && npx tsc -b && npm run build`
Expected: all green, tsc clean, build clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(Collection): use displayed stats + specialty + real level"
```

---

## Final verification (after Task 15)

- [ ] `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run` — all green.
- [ ] `npx tsc -b` — clean.
- [ ] `npm run build` — clean.
- [ ] Manual: `npm run dev -- --host`, hatch + play a drill, confirm: XP bar fills, leveling at 50-scale, stat grows on level-up (bubble line + confetti), Care tab feeds via tiles, Power tab radar/rail, Collection matches.
- [ ] Then `superpowers:finishing-a-development-branch` (and resolve the `phase-b2-gacha` merge per spec §10).

## Self-review notes (addressed)

- **Spec coverage:** curve (T1–2), stages (T3), growth field+alloc (T4,6), display derivations (T5), store apply+level-up (T7), persist v8 (T8), dialogue (T9), radar specialty (T10), bubble (T11), PetRoom HUD/XP/tabs/care/power (T12–14), Collection (T15). XP-curve tuning numbers deliberately deferred (spec §1/§9).
- **Naming:** `xpPerCorrect` (earn) vs `levelForXp` (inverse) disambiguated in T1. `displayStats`/`petPower`/`petSpecialty` used consistently T5/T10/T14/T15.
- **Circular import:** stage thresholds + `stageForLevel` placed in `domain/xp.ts`, not `petDisplay` (which imports `xp`).
- **Lastlevelup transient:** persisted but harmless; reset by `freshState`/`resetForTest`.
