# Phase 0: Art Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace emoji pets with real art for all four species, assign a random starter at hatch, and swap happy/sad expressions by happiness — taking the first persist bump (2→3).

**Architecture:** A build-time ImageMagick pass cuts the cream background off the delivered PNGs and emits small per-(species,stage,mood) webp files. A pure sprite registry maps those imports; pure domain functions pick the random species and the mood; the store persists `species` (migrate backfills `leaf`); `PetSprite`/`EggHatch` render `<img>` instead of emoji.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist v3) + Vitest + framer-motion. ImageMagick `magick` for asset prep.

**Spec:** `docs/superpowers/specs/2026-06-25-art-integration-design.md`

**Conventions (carry forward):**
- Typecheck with `npx tsc -b` (root `tsconfig` has `files: []` — `--noEmit` is a no-op).
- Tests colocated: `foo.ts` + `foo.test.ts`. Pure logic exhaustively unit-tested; components render-only (mount, static text, `src`/`alt`); **never assert animated style values**.
- Mock `canvas-confetti` in any test transitively importing `src/effects/celebrate.ts`.
- Run tests: `npm test -- --run`. Single file: `npm test -- --run src/path/file.test.ts`.
- Source art lives in `H:\My Drive\01 Current Projects\AI\AI_design_thinking\Pictures\` (Google-Drive docs dir, NOT the build dir).
- Windows LF→CRLF git warnings are cosmetic — ignore.

**Species ↔ source art (confirmed):** `leaf`=green earth bunny, `fire`=orange flame cat, `air`=white/blue owl, `water`=teal aquatic dragon. Generic pre-hatch egg = `Animal/pets_egg.png.png`. 4 elemental eggs + 4 adults = `Animal/` root. Babies = `Animal/baby/`. Youngs = `Animal/young/`. Mood sheets (4-pose strips) = `Animal/mood/`.

---

## Task 1: Asset prep — cutout + webp pipeline (visual QA gate)

Not TDD — this is a content task producing committed binary assets plus a reusable prep script. **A montage QA gate ends the task: the main thread must eyeball the output before any wiring tasks proceed.**

**Files:**
- Create: `scripts/prep-sprites.sh` (the reusable pipeline)
- Create: `src/assets/sprites/egg.webp`
- Create: `src/assets/sprites/<species>/<stage>-<mood>.webp` (4 species × {baby,young,adult} × {happy,sad} = 24)
- Create: `src/assets/sprites/eggs/<species>.webp` (4 elemental eggs — reserved for Phase B, generated now while we have the pipeline)

- [ ] **Step 1: Map source files to slots**

View each candidate image (use the Read tool on the PNGs, or build a montage with `magick montage`) and record, for every (species, stage), the source path and — for mood sheets — which quarter is the **happy** (smiling/open-eyed) pose and which is the **sad** (eyes-closed/sleepy) pose. Mood sheets are 4-pose horizontal strips (`-crop 4x1@`). Where a stage has no usable sheet, use the single-pose `baby/`/`young/` neutral image for BOTH moods. Write the mapping as a comment block at the top of `scripts/prep-sprites.sh`.

- [ ] **Step 2: Write the prep script**

Create `scripts/prep-sprites.sh`. Use bounded corner-floodfill transparency (NOT global `-transparent white` — that eats the white owl). Resize to ~512px tall, export webp q80.

```bash
#!/usr/bin/env bash
# Prep pet sprites: crop mood-sheet quarters, cut cream bg, resize, webp.
# Source: H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures
# Mapping (species/stage -> source[, quarter]):  <fill in from Step 1>
set -euo pipefail
SRC="H:/My Drive/01 Current Projects/AI/AI_design_thinking/Pictures"
OUT="src/assets/sprites"
mkdir -p "$OUT"/{leaf,fire,air,water,eggs}

# Cut near-white/cream bg via floodfill from all four corners, then trim + resize + webp.
# $1=input  $2=output  $3=fuzz%  ($4 optional pre-crop geometry for a single mood pose)
cutout() {
  local in="$1" out="$2" fuzz="${3:-12}" crop="${4:-}"
  local tmp; tmp="$(mktemp --suffix=.png)"
  if [ -n "$crop" ]; then magick "$in" -crop "$crop" +repage "$tmp"; else cp "$in" "$tmp"; fi
  magick "$tmp" -alpha set -bordercolor white -border 1 \
    -fuzz "${fuzz}%" \
    -fill none -draw "alpha 0,0 floodfill" \
    -draw "alpha %[fx:w-1],0 floodfill" \
    -draw "alpha 0,%[fx:h-1] floodfill" \
    -draw "alpha %[fx:w-1],%[fx:h-1] floodfill" \
    -shave 1x1 -trim +repage \
    -resize x512 \
    -define webp:lossless=false -quality 80 "$out"
  rm -f "$tmp"
}

# To extract pose N (0-based) of a 4-pose strip, pass crop geometry "25%x100%+<N*25>%+0".
# Example happy=pose1, sad=pose3 of an adult leaf sheet:
#   cutout "$SRC/Animal/mood/<leaf-adult-sheet>.png" "$OUT/leaf/adult-happy.webp" 12 "25%x100%+25%+0"
#   cutout "$SRC/Animal/mood/<leaf-adult-sheet>.png" "$OUT/leaf/adult-sad.webp"   12 "25%x100%+75%+0"
# Owl (air): start fuzz at 6% and raise only if cream remains, so the white body survives.

# <fill in all 25 cutout calls + 4 elemental eggs from the Step 1 mapping>
cutout "$SRC/Animal/pets_egg.png.png" "$OUT/egg.webp" 12

echo "done -> $OUT"
```

- [ ] **Step 3: Run the pipeline**

Run: `cd D:/ai_projects/AI_design_thinking/sentence-pet && bash scripts/prep-sprites.sh`
Expected: `done -> src/assets/sprites`, and `find src/assets/sprites -name '*.webp' | wc -l` returns **29** (egg + 24 pets + 4 elemental eggs).

- [ ] **Step 4: Verify size budget**

Run: `find src/assets/sprites -name '*.webp' -printf '%s %p\n' | sort -n | tail -5`
Expected: every file **< 60000** bytes. If any exceeds, lower webp quality (e.g. `-quality 70`) or resize smaller (`-resize x448`) and rerun.

- [ ] **Step 5: Build a QA montage and STOP for visual review**

Run: `magick montage src/assets/sprites/*/*.webp src/assets/sprites/egg.webp -tile 6x -geometry 180x180+4+4 -background gray80 src/assets/sprites/_qa-montage.png`
Then the main thread Reads `src/assets/sprites/_qa-montage.png` and checks: no white halos, the **owl is not eaten**, crops are centered, happy vs sad are distinguishable. **Do not proceed to Task 2 until this passes.** If a sprite fails, tune its fuzz/crop in `scripts/prep-sprites.sh` and rerun. Delete the montage after QA: `rm src/assets/sprites/_qa-montage.png`.

- [ ] **Step 6: Commit**

```bash
cd D:/ai_projects/AI_design_thinking/sentence-pet
git add scripts/prep-sprites.sh src/assets/sprites
git commit -m "feat: prep pet sprite assets (cutout webp, 4 species x 3 stages x 2 moods)"
```

---

## Task 2: Species + mood pure logic

**Files:**
- Modify: `src/data/types.ts` (add `Species`, `PetMood`)
- Modify: `src/config/gameConfig.ts` (add `mood.happyThreshold`)
- Create: `src/domain/species.ts`
- Test: `src/domain/species.test.ts`

- [ ] **Step 1: Add types**

In `src/data/types.ts` add:

```ts
export type Species = 'leaf' | 'fire' | 'air' | 'water';

export type PetMood = 'happy' | 'sad';
```

- [ ] **Step 2: Add mood config**

In `src/config/gameConfig.ts`, inside the `GAME_CONFIG` object (after `happiness`), add:

```ts
  mood: { happyThreshold: 0.5 }, // happiness >= max * threshold => happy
```

- [ ] **Step 3: Write the failing test**

Create `src/domain/species.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SPECIES, pickSpecies, moodFor } from './species';

describe('pickSpecies', () => {
  it('returns each species across the rng range', () => {
    expect(pickSpecies(() => 0)).toBe('leaf');
    expect(pickSpecies(() => 0.26)).toBe('fire');
    expect(pickSpecies(() => 0.5)).toBe('air');
    expect(pickSpecies(() => 0.99)).toBe('water');
  });

  it('only ever returns a known species', () => {
    for (let i = 0; i < 100; i++) {
      expect(SPECIES).toContain(pickSpecies(() => i / 100));
    }
  });
});

describe('moodFor', () => {
  it('is happy at or above half of max', () => {
    expect(moodFor(50, 100)).toBe('happy');
    expect(moodFor(100, 100)).toBe('happy');
  });
  it('is sad below half of max', () => {
    expect(moodFor(49, 100)).toBe('sad');
    expect(moodFor(0, 100)).toBe('sad');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- --run src/domain/species.test.ts`
Expected: FAIL — cannot resolve `./species`.

- [ ] **Step 5: Implement**

Create `src/domain/species.ts`:

```ts
import { GAME_CONFIG } from '../config/gameConfig';
import type { PetMood, Species } from '../data/types';

export const SPECIES: readonly Species[] = ['leaf', 'fire', 'air', 'water'] as const;

/** Uniform 1-of-4. `rng` injectable for deterministic tests. */
export function pickSpecies(rng: () => number = Math.random): Species {
  return SPECIES[Math.floor(rng() * SPECIES.length)];
}

/** Happy when happiness reaches the configured fraction of max, else sad. */
export function moodFor(happiness: number, max: number): PetMood {
  return happiness >= max * GAME_CONFIG.mood.happyThreshold ? 'happy' : 'sad';
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- --run src/domain/species.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/config/gameConfig.ts src/domain/species.ts src/domain/species.test.ts
git commit -m "feat: species + mood pure logic (pickSpecies, moodFor)"
```

---

## Task 3: Sprite registry

**Files:**
- Create: `src/config/sprites.ts`
- Test: `src/config/sprites.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/config/sprites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SPRITES, EGG_SPRITE, ELEMENTAL_EGGS } from './sprites';
import { SPECIES } from '../domain/species';

const STAGES = ['baby', 'young', 'adult'] as const;
const MOODS = ['happy', 'sad'] as const;

describe('sprite registry', () => {
  it('has a generic egg sprite', () => {
    expect(EGG_SPRITE).toBeTruthy();
  });

  it('resolves a url for every species x stage x mood', () => {
    for (const sp of SPECIES) {
      for (const stage of STAGES) {
        for (const mood of MOODS) {
          expect(SPRITES[sp][stage][mood], `${sp}/${stage}/${mood}`).toBeTruthy();
        }
      }
    }
  });

  it('has an elemental egg per species (reserved for Phase B)', () => {
    for (const sp of SPECIES) expect(ELEMENTAL_EGGS[sp], sp).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/config/sprites.test.ts`
Expected: FAIL — cannot resolve `./sprites`.

- [ ] **Step 3: Implement the registry**

Create `src/config/sprites.ts`. Vite resolves `.webp` imports to hashed URL strings (works in vitest too). One import per asset:

```ts
import type { PetMood, PetStage, Species } from '../data/types';

import egg from '../assets/sprites/egg.webp';

import leafBabyHappy from '../assets/sprites/leaf/baby-happy.webp';
import leafBabySad from '../assets/sprites/leaf/baby-sad.webp';
import leafYoungHappy from '../assets/sprites/leaf/young-happy.webp';
import leafYoungSad from '../assets/sprites/leaf/young-sad.webp';
import leafAdultHappy from '../assets/sprites/leaf/adult-happy.webp';
import leafAdultSad from '../assets/sprites/leaf/adult-sad.webp';

import fireBabyHappy from '../assets/sprites/fire/baby-happy.webp';
import fireBabySad from '../assets/sprites/fire/baby-sad.webp';
import fireYoungHappy from '../assets/sprites/fire/young-happy.webp';
import fireYoungSad from '../assets/sprites/fire/young-sad.webp';
import fireAdultHappy from '../assets/sprites/fire/adult-happy.webp';
import fireAdultSad from '../assets/sprites/fire/adult-sad.webp';

import airBabyHappy from '../assets/sprites/air/baby-happy.webp';
import airBabySad from '../assets/sprites/air/baby-sad.webp';
import airYoungHappy from '../assets/sprites/air/young-happy.webp';
import airYoungSad from '../assets/sprites/air/young-sad.webp';
import airAdultHappy from '../assets/sprites/air/adult-happy.webp';
import airAdultSad from '../assets/sprites/air/adult-sad.webp';

import waterBabyHappy from '../assets/sprites/water/baby-happy.webp';
import waterBabySad from '../assets/sprites/water/baby-sad.webp';
import waterYoungHappy from '../assets/sprites/water/young-happy.webp';
import waterYoungSad from '../assets/sprites/water/young-sad.webp';
import waterAdultHappy from '../assets/sprites/water/adult-happy.webp';
import waterAdultSad from '../assets/sprites/water/adult-sad.webp';

import eggLeaf from '../assets/sprites/eggs/leaf.webp';
import eggFire from '../assets/sprites/eggs/fire.webp';
import eggAir from '../assets/sprites/eggs/air.webp';
import eggWater from '../assets/sprites/eggs/water.webp';

/** Stages that have a per-species sprite (egg is generic, see EGG_SPRITE). */
type SpriteStage = Exclude<PetStage, 'egg'>;

export const EGG_SPRITE: string = egg;

export const SPRITES: Record<Species, Record<SpriteStage, Record<PetMood, string>>> = {
  leaf: {
    baby: { happy: leafBabyHappy, sad: leafBabySad },
    young: { happy: leafYoungHappy, sad: leafYoungSad },
    adult: { happy: leafAdultHappy, sad: leafAdultSad },
  },
  fire: {
    baby: { happy: fireBabyHappy, sad: fireBabySad },
    young: { happy: fireYoungHappy, sad: fireYoungSad },
    adult: { happy: fireAdultHappy, sad: fireAdultSad },
  },
  air: {
    baby: { happy: airBabyHappy, sad: airBabySad },
    young: { happy: airYoungHappy, sad: airYoungSad },
    adult: { happy: airAdultHappy, sad: airAdultSad },
  },
  water: {
    baby: { happy: waterBabyHappy, sad: waterBabySad },
    young: { happy: waterYoungHappy, sad: waterYoungSad },
    adult: { happy: waterAdultHappy, sad: waterAdultSad },
  },
};

/** Reserved for Phase B (species shop icons). Unused by Phase 0 components. */
export const ELEMENTAL_EGGS: Record<Species, string> = {
  leaf: eggLeaf,
  fire: eggFire,
  air: eggAir,
  water: eggWater,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/config/sprites.test.ts`
Expected: PASS. (If an import fails to resolve, the asset filename does not match Task 1 output — fix the filename in Task 1's script and rerun it, do not hand-rename.)

- [ ] **Step 5: Commit**

```bash
git add src/config/sprites.ts src/config/sprites.test.ts
git commit -m "feat: sprite registry (species x stage x mood + elemental eggs)"
```

---

## Task 4: Store — persist species, random hatch, migrate v3

**Files:**
- Modify: `src/state/gameStore.ts`
- Test: `src/state/gameStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/state/gameStore.test.ts`:

```ts
import { pickSpecies } from '../domain/species';
// ...existing imports

describe('species', () => {
  it('freshPet defaults to leaf before hatch', () => {
    useGameStore.getState().resetForTest();
    expect(useGameStore.getState().pet.species).toBe('leaf');
  });

  it('hatch assigns a valid species', () => {
    useGameStore.getState().resetForTest();
    useGameStore.getState().hatch();
    expect(['leaf', 'fire', 'air', 'water']).toContain(useGameStore.getState().pet.species);
  });
});

describe('migrate v2 -> v3', () => {
  it('backfills species=leaf and keeps inventory backfill', () => {
    const persist = (useGameStore as unknown as {
      persist: { getOptions: () => { migrate: (s: unknown, v: number) => unknown } };
    }).persist;
    const migrated = persist.getOptions().migrate(
      { pet: { hatched: true, xp: 0, coins: 5, happiness: 60, bars: { protein: 1 } }, inventory: { protein: 2 } },
      2,
    ) as { pet: { species: string }; inventory: Record<string, number> };
    expect(migrated.pet.species).toBe('leaf');
    expect(migrated.inventory.veggie).toBe(0);
  });
});
```

Note: match the existing migrate-test access pattern already in this file if one exists; otherwise the `persist.getOptions().migrate` accessor above is correct for zustand persist.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: FAIL — `pet.species` undefined / migrate does not set species.

- [ ] **Step 3: Implement**

In `src/state/gameStore.ts`:

a) Add import:
```ts
import { pickSpecies } from '../domain/species';
import type { DrillType, FoodGroup, NutritionBars, PetStage, Screen, Species } from '../data/types';
```

b) Add `species` to the `Pet` interface:
```ts
interface Pet {
  hatched: boolean;
  species: Species;
  xp: number;
  coins: number;
  happiness: number;
  bars: NutritionBars;
}
```

c) In `freshPet()` add `species: 'leaf',` (placeholder until hatch).

d) Update `hatch()`:
```ts
      hatch: () =>
        set((st) => ({ pet: { ...st.pet, hatched: true, species: pickSpecies() }, screen: 'petRoom' })),
```

e) Bump version and extend migrate:
```ts
      name: 'sentence-pet',
      version: 3,
      // v1->v2 backfilled inventory groups; v2->v3 adds pet.species (backfill 'leaf').
      migrate: (persisted: unknown) => {
        const st = persisted as
          | { inventory?: Partial<Record<FoodGroup, number>>; pet?: Partial<Pet> }
          | null;
        if (!st) return st as unknown as GameState;
        return {
          selectedDrill: 'pattern',
          ...st,
          inventory: { ...freshInventory(), ...(st.inventory ?? {}) },
          pet: { ...freshPet(), ...(st.pet ?? {}), species: st.pet?.species ?? 'leaf' },
        } as GameState;
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/state/gameStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/gameStore.ts src/state/gameStore.test.ts
git commit -m "feat: persist pet.species, random hatch, migrate v2->v3 (leaf backfill)"
```

---

## Task 5: PetSprite renders art

**Files:**
- Modify: `src/components/PetSprite.tsx`
- Test: `src/components/PetSprite.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/PetSprite.test.tsx`:

```ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PetSprite } from './PetSprite';

describe('PetSprite', () => {
  it('renders a happy sprite img with species/stage/mood alt', () => {
    render(<PetSprite stage="baby" species="leaf" happiness={80} />);
    const img = screen.getByRole('img', { name: 'pet-leaf-baby-happy' });
    expect(img).toHaveAttribute('src');
    expect(img.getAttribute('src')).toBeTruthy();
  });

  it('renders sad below the happiness threshold', () => {
    render(<PetSprite stage="adult" species="fire" happiness={10} />);
    expect(screen.getByRole('img', { name: 'pet-fire-adult-sad' })).toBeTruthy();
  });

  it('renders the generic egg at the egg stage', () => {
    render(<PetSprite stage="egg" species="leaf" happiness={60} />);
    expect(screen.getByRole('img', { name: 'pet-egg' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/PetSprite.test.tsx`
Expected: FAIL — current `PetSprite` requires no `species`/`happiness` and renders emoji text, no `img` role.

- [ ] **Step 3: Implement**

Replace `src/components/PetSprite.tsx`:

```tsx
// src/components/PetSprite.tsx
import { useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import type { PetStage, Species } from '../data/types';
import { SPRITES, EGG_SPRITE } from '../config/sprites';
import { moodFor } from '../domain/species';
import { GAME_CONFIG } from '../config/gameConfig';

/**
 * Pet artwork with: a gentle infinite idle bob, a one-shot bounce when `feedTrigger`
 * increments, and a scale pop when `stage` changes (evolution). Sprite is chosen by
 * (species, stage) and swaps happy/sad by happiness.
 */
export function PetSprite({
  stage,
  species,
  happiness,
  feedTrigger = 0,
}: {
  stage: PetStage;
  species: Species;
  happiness: number;
  feedTrigger?: number;
}) {
  const controls = useAnimationControls();
  const prevStage = useRef(stage);
  const prevFeed = useRef(feedTrigger);

  // feed bounce
  useEffect(() => {
    if (prevFeed.current !== feedTrigger) {
      prevFeed.current = feedTrigger;
      controls.start({ scale: [1, 1.3, 0.95, 1], transition: { duration: 0.5 } });
    }
  }, [feedTrigger, controls]);

  // evolution pop
  useEffect(() => {
    if (prevStage.current !== stage) {
      prevStage.current = stage;
      controls.start({ scale: [1, 1.6, 1], rotate: [0, -8, 8, 0], transition: { duration: 0.7 } });
    }
  }, [stage, controls]);

  const mood = moodFor(happiness, GAME_CONFIG.happiness.max);
  const isEgg = stage === 'egg';
  const src = isEgg ? EGG_SPRITE : SPRITES[species][stage][mood];
  const alt = isEgg ? 'pet-egg' : `pet-${species}-${stage}-${mood}`;

  return (
    <motion.div
      className="select-none"
      animate={controls}
      initial={false}
    >
      <motion.img
        src={src}
        alt={alt}
        draggable={false}
        className="h-[clamp(6rem,26vh,12rem)] w-auto object-contain"
        animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/PetSprite.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PetSprite.tsx src/components/PetSprite.test.tsx
git commit -m "feat: PetSprite renders art img with happy/sad swap"
```

---

## Task 6: Wire PetRoom + EggHatch to the new sprites

**Files:**
- Modify: `src/components/PetRoom.tsx:26`
- Modify: `src/components/EggHatch.tsx` (the egg emoji block, lines ~92-98 + imports)
- Test: `src/components/PetRoom.test.tsx`, `src/components/EggHatch.test.tsx`

- [ ] **Step 1: Update PetRoom to pass species + happiness**

In `src/components/PetRoom.tsx`, replace line 26:

```tsx
        <PetSprite stage={stage} species={pet.species} happiness={pet.happiness} feedTrigger={feedTrigger} />
```

- [ ] **Step 2: Replace the egg emoji in EggHatch**

In `src/components/EggHatch.tsx`, add to imports:

```ts
import { EGG_SPRITE } from '../config/sprites';
```

Replace the emoji `motion.div` (the block rendering `🥚`, ~lines 92-98) with:

```tsx
          <motion.img
            src={EGG_SPRITE}
            alt="egg"
            draggable={false}
            className="h-[clamp(3rem,14vh,5rem)] w-auto object-contain"
            animate={{ y: [0, -6, 0], scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          />
```

- [ ] **Step 3: Update component tests**

In `src/components/EggHatch.test.tsx`, add an assertion that the egg image renders (place inside an existing render-based test, or add one):

```ts
expect(screen.getByRole('img', { name: 'egg' })).toBeTruthy();
```

In `src/components/PetRoom.test.tsx`, ensure the existing render test still mounts and add:

```ts
// pet img present (hatch first if the test harness starts pre-hatch)
expect(screen.getByRole('img', { name: /^pet-/ })).toBeTruthy();
```

If `PetRoom.test.tsx` renders before hatch and `stage()` returns `egg`, the alt will be `pet-egg` — `/^pet-/` still matches. Confirm the test's store setup; if it asserts a species sprite specifically, call `useGameStore.getState().hatch()` (or set `pet.species`) in that test's setup first.

- [ ] **Step 4: Run the affected tests**

Run: `npm test -- --run src/components/PetRoom.test.tsx src/components/EggHatch.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PetRoom.tsx src/components/EggHatch.tsx src/components/PetRoom.test.tsx src/components/EggHatch.test.tsx
git commit -m "feat: wire PetRoom + EggHatch to art sprites"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test -- --run`
Expected: all pass (≥142 prior + new tests). Investigate any failure before proceeding.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean, no errors. (Watch for: any remaining `PetSprite` call sites missing `species`/`happiness`; `Species` import unused warnings.)

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: clean build. Note the bundle/asset sizes — webps should appear as separate hashed assets, JS bundle near the prior ~127 kb gz.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `npm run dev -- --host`, open the LAN URL on a phone. Clear localStorage (or it migrates), build the hatch sentence, confirm a real creature appears, feed it, watch happy/sad swap as happiness changes.

- [ ] **Step 5: Update GAME_DESIGN docs**

Add a short "Art integrated (Phase 0): 4 species, random starter, happy/sad" note to **both** `GAME_DESIGN.md` copies (repo root + `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md`). Commit the repo copy:

```bash
git add GAME_DESIGN.md
git commit -m "docs: note Phase 0 art integration in GAME_DESIGN"
```

- [ ] **Step 6: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill: push `art-integration`, open a PR, merge with a merge-commit (`gh pr merge N --merge --delete-branch`) to preserve TDD history — matching the PR #2–#5 pattern.

---

## Self-review notes (author)

- **Spec coverage:** types (T2), registry incl. reserved elemental eggs (T3), asset pipeline + cutout + owl special-case + QA gate (T1), pickSpecies/moodFor (T2), store species+hatch+migrate v3 (T4), PetSprite img + happy/sad + egg stage (T5), EggHatch + PetRoom wiring (T6), tests throughout, verification + docs (T7). All spec sections mapped.
- **Type consistency:** `Species`/`PetMood` defined T2, used T3/T4/T5; `SPRITES`/`EGG_SPRITE`/`ELEMENTAL_EGGS` defined T3, consumed T5; `pickSpecies`/`moodFor` defined T2, consumed T4/T5. `SpriteStage = Exclude<PetStage,'egg'>` keeps the egg stage out of the registry while `PetSprite` special-cases it.
- **Asset dependency:** T3 imports fail unless T1 produced the exact filenames — called out in T3 Step 4.
- **Risk:** owl cutout (T1 Step 2 + QA gate Step 5). Framed-card fallback noted in spec if a sprite can't be cleanly cut.
