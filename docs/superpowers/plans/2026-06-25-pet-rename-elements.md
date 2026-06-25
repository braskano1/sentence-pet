# Pet Rename + Elements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add custom pet names (default = species name, editable in the gacha reveal and Collection) and an element type wheel (Water>Fire>Air>Leaf>Water) with a pure `typeMultiplier`, surfaced as strong/weak matchups in Collection. Battle damage application is deferred to B-3.

**Architecture:** Two pure domains — `elements.ts` (type wheel + multiplier) and `petName.ts` (sanitize) — feed a `renamePet` store action and display helpers in `config/petDisplay.ts`. `PetInstance` gains a persisted `name` (persist 6→7, additive backfill). UI touches: Collection (element line + ✎ rename), Gacha reveal (name field). No battle code.

**Tech Stack:** Vite + React 19 + TS + Tailwind v4 + Zustand(persist v7) + Vitest.

---

## Conventions (read first — proven over B-1/B-2)

- **Typecheck = `npx tsc -b`** (root tsconfig has `"files": []`, so `tsc --noEmit` is a NO-OP). `npm run build` runs `tsc -b`.
- **Tests:** `npm test -- --run` (full) or a single path. Deterministic RNG via `seq([...])` where needed.
- **The Bash tool resets cwd between calls** — prefix EVERY command with `cd "D:\ai_projects\AI_design_thinking\sentence-pet" &&`.
- Verify `git branch --show-current` before committing (detached-HEAD trap after agents run `git show`). Branch TBD by the controller — confirm before Task 1.
- Windows LF→CRLF git warnings cosmetic — ignore.
- jsdom can't test framer-motion/@dnd-kit; component tests are render-only (mount, static text, click, assert store/DOM). Anchor new label regexes (e.g. `/^strong/i`).
- React 19: no global JSX namespace.

## Current state this builds on (verify before starting)

- `PetInstance { id; species; hatched; xp; happiness; bars; stats; rarity }` — `src/data/types.ts`. Persist **version 6**.
- `makePet({ id, species, stats, rarity, hatched? })` — `src/domain/pets.ts`.
- `gameStore.ts` migrate is version-branching; ends with a rarity backfill over `base.pets` then `delete base.pet`.
- `config/petDisplay.ts` exports `PET_NAME`, `STAGE_LEVEL`, `BATTLE_STAT_LABELS`, `RARITY_BADGE`, `RARITY_RING`, `RARITY_HEX`, `petLevel`, `petStageSprite`.
- `Collection.tsx` detail title = `{PET_NAME[active.species]}`; roster chips show `{PET_NAME[p.species]}`.
- `Gacha.tsx` reveal shows `{PET_NAME[pulled.species]}!`; has local `revealed` + store `lastPull`.

## File structure

- `src/domain/elements.ts` (+test) — **create**: type wheel + `typeMultiplier`/`strongAgainst`/`weakAgainst`.
- `src/domain/petName.ts` (+test) — **create**: `sanitizePetName` + `MAX_PET_NAME`.
- `src/data/types.ts` — **modify**: `name: string` on `PetInstance`.
- `src/domain/pets.ts` (+test) — **modify**: `makePet` sets `name` (default `''`).
- `src/state/gameStore.ts` (+test) — **modify**: `renamePet` action; migrate 6→7 name backfill.
- `src/config/petDisplay.ts` — **modify**: `petDisplayName`, `ELEMENT_EMOJI`.
- `src/components/Collection.tsx` (+test) — **modify**: element line, emoji badges, ✎ rename.
- `src/components/Gacha.tsx` (+test) — **modify**: name field in the reveal.
- `src/components/PetRoom.tsx` — **modify**: use `petDisplayName` where pet name shows.
- `GAME_DESIGN.md` (repo root + H: copy) — **modify**: note names + element wheel.

---

# PART 1 — ELEMENTS

## Task 1: `elements.ts` type wheel + `typeMultiplier` (pure, TDD)

**Files:**
- Create: `src/domain/elements.ts`
- Create: `src/domain/elements.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/elements.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { typeMultiplier, strongAgainst, weakAgainst, STRONG_VS, TYPE_STRONG, TYPE_WEAK, TYPE_NEUTRAL } from './elements';
import type { Species } from '../data/types';

const ALL: Species[] = ['leaf', 'fire', 'air', 'water'];

describe('STRONG_VS wheel', () => {
  it('is the cycle water>fire>air>leaf>water', () => {
    expect(STRONG_VS).toEqual({ water: 'fire', fire: 'air', air: 'leaf', leaf: 'water' });
  });
  it('is a 4-cycle: every species appears exactly once as a value', () => {
    const values = ALL.map((s) => STRONG_VS[s]).sort();
    expect(values).toEqual([...ALL].sort());
  });
});

describe('typeMultiplier', () => {
  it('strong matchups return 1.5', () => {
    expect(typeMultiplier('water', 'fire')).toBe(TYPE_STRONG);
    expect(typeMultiplier('fire', 'air')).toBe(TYPE_STRONG);
    expect(typeMultiplier('air', 'leaf')).toBe(TYPE_STRONG);
    expect(typeMultiplier('leaf', 'water')).toBe(TYPE_STRONG);
  });
  it('weak matchups (defender beats attacker) return 0.75', () => {
    expect(typeMultiplier('fire', 'water')).toBe(TYPE_WEAK);
    expect(typeMultiplier('air', 'fire')).toBe(TYPE_WEAK);
    expect(typeMultiplier('leaf', 'air')).toBe(TYPE_WEAK);
    expect(typeMultiplier('water', 'leaf')).toBe(TYPE_WEAK);
  });
  it('everything else (incl. same element) is neutral 1.0', () => {
    for (const a of ALL) {
      expect(typeMultiplier(a, a)).toBe(TYPE_NEUTRAL);
    }
    expect(typeMultiplier('water', 'air')).toBe(TYPE_NEUTRAL); // water beats fire, not air
    expect(typeMultiplier('fire', 'leaf')).toBe(TYPE_NEUTRAL);
  });
  it('covers all 16 pairs as exactly 4 strong / 4 weak / 8 neutral', () => {
    let strong = 0, weak = 0, neutral = 0;
    for (const a of ALL) for (const d of ALL) {
      const m = typeMultiplier(a, d);
      if (m === TYPE_STRONG) strong++;
      else if (m === TYPE_WEAK) weak++;
      else neutral++;
    }
    expect([strong, weak, neutral]).toEqual([4, 4, 8]);
  });
});

describe('strongAgainst / weakAgainst', () => {
  it('strongAgainst returns the beaten element', () => {
    expect(strongAgainst('water')).toBe('fire');
    expect(strongAgainst('leaf')).toBe('water');
  });
  it('weakAgainst returns the element that beats it', () => {
    expect(weakAgainst('fire')).toBe('water'); // water beats fire
    expect(weakAgainst('leaf')).toBe('air');   // air beats leaf
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/domain/elements.test.ts 2>&1 | tail -15`
Expected: FAIL — `./elements` not found.

- [ ] **Step 3: Implement**

Create `src/domain/elements.ts`:
```ts
import type { Species } from '../data/types';

/** Each element is strong vs the species it maps to: Water>Fire>Air>Leaf>Water. */
export const STRONG_VS: Record<Species, Species> = {
  water: 'fire',
  fire: 'air',
  air: 'leaf',
  leaf: 'water',
};

export const TYPE_STRONG = 1.5;
export const TYPE_WEAK = 0.75;
export const TYPE_NEUTRAL = 1.0;

/** Damage multiplier for `attacker` hitting `defender`. */
export function typeMultiplier(attacker: Species, defender: Species): number {
  if (STRONG_VS[attacker] === defender) return TYPE_STRONG;
  if (STRONG_VS[defender] === attacker) return TYPE_WEAK;
  return TYPE_NEUTRAL;
}

/** The element this species beats. */
export function strongAgainst(species: Species): Species {
  return STRONG_VS[species];
}

/** The element that beats this species (i.e. this species is weak to it). */
export function weakAgainst(species: Species): Species {
  const found = (Object.keys(STRONG_VS) as Species[]).find((s) => STRONG_VS[s] === species);
  return found ?? species; // unreachable in a complete 4-cycle; satisfies the type
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test -- --run src/domain/elements.test.ts 2>&1 | tail -10`
Expected: PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(elements): type wheel + typeMultiplier pure domain"
```

---

## Task 2: Collection element line + emoji badges (TDD)

**Files:**
- Modify: `src/config/petDisplay.ts`
- Modify: `src/components/Collection.tsx`
- Modify: `src/components/Collection.test.tsx`

- [ ] **Step 1: Add `ELEMENT_EMOJI` to petDisplay**

In `src/config/petDisplay.ts`, add (near the other exported consts):
```ts
/** Element glyph per species (UI flavor; species IS the element). */
export const ELEMENT_EMOJI: Record<Species, string> = { leaf: '🍃', fire: '🔥', air: '💨', water: '💧' };
```
(`Species` is already imported in this file.)

- [ ] **Step 2: Write the failing test**

In `src/components/Collection.test.tsx`, add:
```ts
  it('shows the element strong/weak line for the active pet', () => {
    useGameStore.getState().hatch(); // starter is leaf -> strong vs water, weak vs air
    render(<Collection />);
    const strong = screen.getByText(/strong vs/i);
    expect(strong.textContent).toMatch(/water/i);
    const weak = screen.getByText(/weak vs/i);
    expect(weak.textContent).toMatch(/air/i);
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/components/Collection.test.tsx 2>&1 | tail -15`
Expected: FAIL — no strong/weak text.

- [ ] **Step 4: Implement the element line + badges in Collection**

In `src/components/Collection.tsx`:
- Update the petDisplay import to add `ELEMENT_EMOJI`, and add an elements import:
```ts
import { BATTLE_STAT_LABELS, ELEMENT_EMOJI, PET_NAME, RARITY_BADGE, RARITY_HEX, RARITY_RING, petLevel, petStageSprite } from '../config/petDisplay';
import { strongAgainst, weakAgainst } from '../domain/elements';
```
- In the detail panel, immediately AFTER the name/rarity/Lv row (the `<div className="flex items-center gap-2">…Lv…</div>`) and BEFORE `<StatRadar …/>`, add:
```tsx
          <p className="text-xs font-semibold text-amber-900/70">
            <span>Strong vs {ELEMENT_EMOJI[strongAgainst(active.species)]} {PET_NAME[strongAgainst(active.species)]}</span>
            <span className="mx-1 text-amber-900/30">·</span>
            <span>Weak vs {ELEMENT_EMOJI[weakAgainst(active.species)]} {PET_NAME[weakAgainst(active.species)]}</span>
          </p>
```
- In the roster chip (inside the roster `.map`), add a small element badge under the name. After the `<span … >{PET_NAME[p.species]}</span>` line add:
```tsx
                <span className="text-[10px]" aria-hidden="true">{ELEMENT_EMOJI[p.species]}</span>
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test -- --run src/components/Collection.test.tsx 2>&1 | tail -10`
Expected: PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(elements): Collection strong/weak line + element badges"
```

---

# PART 2 — RENAME

## Task 3: `name` field + `makePet` default + persist migrate 6→7 (TDD)

Adding `name: string` to `PetInstance` is non-breaking because `makePet` will set a default `''` and every `PetInstance` is built through `makePet` (freshPet, migrate, gacha, DevPanel).

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/domain/pets.ts`
- Modify: `src/domain/pets.test.ts`
- Modify: `src/state/gameStore.ts`
- Modify: `src/state/gameStore.test.ts`

- [ ] **Step 1: Add the `name` field**

In `src/data/types.ts`, in `interface PetInstance`, after `rarity: Rarity;` add:
```ts
  name: string;        // custom name; '' falls back to the species name (see petDisplayName)
```

- [ ] **Step 2: makePet default + failing pets test**

In `src/domain/pets.test.ts`, update the first `makePet` test to assert the default name:
```ts
  it('creates a fresh unhatched pet with the given id/species/stats/rarity and an empty name', () => {
    const stats = rollStats(() => 0.5);
    const p = makePet({ id: 'x', species: 'fire', stats, rarity: 'rare' });
    expect(p).toMatchObject({ id: 'x', species: 'fire', hatched: false, xp: 0, stats, rarity: 'rare', name: '' });
    expect(p.happiness).toBe(GAME_CONFIG.happiness.start);
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b 2>&1 | tail -15`
Expected: TS error — `name` missing on the object `makePet` returns (and the test object).

- [ ] **Step 4: makePet sets name**

In `src/domain/pets.ts`, update `makePet`:
```ts
export function makePet(args: {
  id: string;
  species: Species;
  stats: BattleStats;
  rarity: Rarity;
  name?: string;
  hatched?: boolean;
}): PetInstance {
  return {
    id: args.id,
    species: args.species,
    hatched: args.hatched ?? false,
    xp: 0,
    happiness: GAME_CONFIG.happiness.start,
    bars: freshBars(),
    stats: args.stats,
    rarity: args.rarity,
    name: args.name ?? '',
  };
}
```

- [ ] **Step 5: Failing migrate test**

In `src/state/gameStore.test.ts`, add to the migrate describe block (use the existing `getMigrate` helper pattern; `STARTER_ID` already imported):
```ts
  it('backfills name="" on a v6 save (pets without a name)', () => {
    const v6 = {
      pets: [{ id: STARTER_ID, species: 'leaf', xp: 0, hatched: true, rarity: 'common',
               bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
               stats: { hp: 50, atk: 50, def: 50, spd: 50, luk: 50 } }],
      activePetId: STARTER_ID, coins: 0,
      inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: [], activeBackground: null,
    };
    const m = getMigrate()(v6, 6) as { pets: { name: string }[] };
    expect(m.pets[0].name).toBe('');
  });

  it('a v7 save keeps a custom name', () => {
    const v7 = {
      pets: [{ id: STARTER_ID, species: 'fire', xp: 0, hatched: true, rarity: 'epic', name: 'Blaze',
               bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
               stats: { hp: 80, atk: 80, def: 80, spd: 80, luk: 80 } }],
      activePetId: STARTER_ID, coins: 0,
      inventory: { protein: 0, veggie: 0, vitamin: 0, treat: 0 },
      owned: [], activeBackground: null,
    };
    const m = getMigrate()(v7, 7) as { pets: { name: string }[] };
    expect(m.pets[0].name).toBe('Blaze');
  });
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/state/gameStore.test.ts 2>&1 | tail -15`
Expected: FAIL — migrated pet has no `name`.

- [ ] **Step 7: Bump version + add name backfill**

In `src/state/gameStore.ts`:
- Bump `version: 6` → `version: 7`. Update the migrate comment to add `v6->v7 backfills pet.name (default '')`.
- Right AFTER the existing rarity backfill block (and before `delete (base as { pet?: unknown }).pet;`), add:
```ts
        // v6->v7: backfill name on any pet that predates the field.
        if (Array.isArray(base.pets)) {
          base.pets = base.pets.map((p) =>
            typeof (p as PetInstance).name === 'string' ? p : { ...p, name: '' },
          );
        }
```
(The v<5 legacy branch already builds its pet via `makePet`, which now sets `name: ''`, so that path needs no change.)

- [ ] **Step 8: Run typecheck + full suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test -- --run 2>&1 | tail -12`
Expected: tsc clean, ALL tests pass (existing v2/v4/v5/v6 migrate tests still green).

- [ ] **Step 9: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(rename): PetInstance.name field + makePet default + persist 6->7"
```

---

## Task 4: `sanitizePetName` + store `renamePet` (TDD)

**Files:**
- Create: `src/domain/petName.ts`
- Create: `src/domain/petName.test.ts`
- Modify: `src/state/gameStore.ts`
- Modify: `src/state/gameStore.test.ts`

- [ ] **Step 1: Failing sanitize test**

Create `src/domain/petName.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { sanitizePetName, MAX_PET_NAME } from './petName';

describe('sanitizePetName', () => {
  it('trims surrounding whitespace', () => expect(sanitizePetName('  Rex  ')).toBe('Rex'));
  it('caps length at MAX_PET_NAME', () => {
    expect(MAX_PET_NAME).toBe(14);
    expect(sanitizePetName('x'.repeat(20))).toHaveLength(14);
  });
  it('passes an empty / whitespace-only name through as empty', () => {
    expect(sanitizePetName('')).toBe('');
    expect(sanitizePetName('   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/domain/petName.test.ts 2>&1 | tail -12`
Expected: FAIL — `./petName` not found.

- [ ] **Step 3: Implement sanitize**

Create `src/domain/petName.ts`:
```ts
export const MAX_PET_NAME = 14;

/** Trim and cap a user-entered pet name. Empty/whitespace stays '' (falls back to species name). */
export function sanitizePetName(raw: string): string {
  return raw.trim().slice(0, MAX_PET_NAME);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/domain/petName.test.ts 2>&1 | tail -8`
Expected: PASS.

- [ ] **Step 5: Failing store test**

In `src/state/gameStore.test.ts`, add:
```ts
describe('renamePet action', () => {
  beforeEach(() => useGameStore.getState().resetForTest());

  it('sets a sanitized name on the matching pet', () => {
    const id = useGameStore.getState().pets[0].id;
    useGameStore.getState().renamePet(id, '  Rocky  ');
    expect(useGameStore.getState().pets[0].name).toBe('Rocky');
  });

  it('reverts to empty on a blank name', () => {
    const id = useGameStore.getState().pets[0].id;
    useGameStore.getState().renamePet(id, 'Rocky');
    useGameStore.getState().renamePet(id, '   ');
    expect(useGameStore.getState().pets[0].name).toBe('');
  });

  it('no-ops on an unknown id', () => {
    const before = useGameStore.getState().pets.map((p) => p.name);
    useGameStore.getState().renamePet('nope', 'X');
    expect(useGameStore.getState().pets.map((p) => p.name)).toEqual(before);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/state/gameStore.test.ts 2>&1 | tail -15`
Expected: FAIL — `renamePet` not on the store.

- [ ] **Step 7: Implement the action**

In `src/state/gameStore.ts`:
- Import: `import { sanitizePetName } from '../domain/petName';`
- Add to `GameState` actions: `renamePet: (id: string, name: string) => void;`
- Add the action (near `switchPet`):
```ts
      renamePet: (id, name) =>
        set((s) => ({ pets: s.pets.map((p) => (p.id === id ? { ...p, name: sanitizePetName(name) } : p)) })),
```

- [ ] **Step 8: Run typecheck + suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test -- --run src/state/gameStore.test.ts 2>&1 | tail -10`
Expected: tsc clean, PASS.

- [ ] **Step 9: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(rename): sanitizePetName + store renamePet action"
```

---

## Task 5: `petDisplayName` + swap display names across screens (TDD)

**Files:**
- Modify: `src/config/petDisplay.ts`
- Create: `src/config/petDisplay.test.ts`
- Modify: `src/components/PetRoom.tsx`
- Modify: `src/components/Collection.tsx`
- Modify: `src/components/Gacha.tsx`

- [ ] **Step 1: Failing helper test**

Create `src/config/petDisplay.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { petDisplayName } from './petDisplay';
import { makePet, rollStats } from '../domain/pets';

const base = () => makePet({ id: 'x', species: 'fire', stats: rollStats(() => 0.5), rarity: 'common' });

describe('petDisplayName', () => {
  it('returns the species name when name is blank', () => {
    expect(petDisplayName(base())).toBe('Ember'); // fire -> Ember
  });
  it('returns the custom name when set', () => {
    expect(petDisplayName({ ...base(), name: 'Blaze' })).toBe('Blaze');
  });
  it('falls back to species name for whitespace-only names', () => {
    expect(petDisplayName({ ...base(), name: '   ' })).toBe('Ember');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/config/petDisplay.test.ts 2>&1 | tail -12`
Expected: FAIL — `petDisplayName` not exported.

- [ ] **Step 3: Implement the helper**

In `src/config/petDisplay.ts`, add (`PetInstance` is already imported):
```ts
/** Display name: the custom name if set, otherwise the species name. */
export function petDisplayName(pet: PetInstance): string {
  return pet.name.trim() || PET_NAME[pet.species];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/config/petDisplay.test.ts 2>&1 | tail -8`
Expected: PASS.

- [ ] **Step 5: Use `petDisplayName` in PetRoom**

In `src/components/PetRoom.tsx`:
- Add `petDisplayName` to the petDisplay import.
- The name chip currently reads `{PET_NAME[activePet.species]} · Lv {STAGE_LEVEL[stage] || 1}`. Change the name part to `petDisplayName(activePet)`:
```tsx
              {petDisplayName(activePet)} · Lv {STAGE_LEVEL[stage] || 1}
```

- [ ] **Step 6: Use `petDisplayName` in Collection (title + roster) with species subtitle**

In `src/components/Collection.tsx`:
- Add `petDisplayName` to the petDisplay import.
- Detail title: change `<span className="text-lg font-extrabold text-amber-950">{PET_NAME[active.species]}</span>` to:
```tsx
            <span className="text-lg font-extrabold text-amber-950">{petDisplayName(active)}</span>
```
- Directly after that title span, add a small species subtitle shown only when a custom name is set:
```tsx
            {active.name.trim() && <span className="text-[10px] font-semibold text-amber-900/50">({PET_NAME[active.species]})</span>}
```
- Roster chip: change `{PET_NAME[p.species]}` to `{petDisplayName(p)}`.

- [ ] **Step 7: Use `petDisplayName` in Gacha reveal**

In `src/components/Gacha.tsx`:
- Add `petDisplayName` to the petDisplay import.
- The reveal heading currently `{PET_NAME[pulled.species]}!`. Leave the species `alt`/name where it identifies the species, but change the headline to `{petDisplayName(pulled)}!` (after a name-on-pull this reflects the chosen name; Task 6 adds the field).

- [ ] **Step 8: Run typecheck + full suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test -- --run 2>&1 | tail -12`
Expected: tsc clean, ALL tests pass. (Existing PetRoom/Collection/Gacha tests assert species names like "Sprout"/"Ember" with no custom name set, so `petDisplayName` returns the species name — they stay green.)

- [ ] **Step 9: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(rename): petDisplayName + use it across PetRoom/Collection/Gacha"
```

---

## Task 6: Gacha reveal "Name your pet" field (render-only TDD)

**Files:**
- Modify: `src/components/Gacha.tsx`
- Modify: `src/components/Gacha.test.tsx`

- [ ] **Step 1: Failing test**

In `src/components/Gacha.test.tsx`, add (the file already mocks canvas-confetti + has the store helpers):
```ts
  it('names the pulled pet from the reveal field', () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    const field = screen.getByRole('textbox', { name: /name your pet/i });
    fireEvent.change(field, { target: { value: 'Sparky' } });
    fireEvent.click(screen.getByRole('button', { name: /^name$/i }));
    const pulled = useGameStore.getState().lastPull!;
    expect(useGameStore.getState().pets.find((p) => p.id === pulled.id)!.name).toBe('Sparky');
  });
```
(The input gets `aria-label="Name your pet"` in Step 3, so `getByRole('textbox', { name: /name your pet/i })` resolves it.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/components/Gacha.test.tsx 2>&1 | tail -15`
Expected: FAIL — no textbox.

- [ ] **Step 3: Implement the name field in the reveal**

In `src/components/Gacha.tsx`:
- Add imports: `import { renamePet usage via store }` — actually pull the action: add `const renamePet = useGameStore((s) => s.renamePet);` alongside the other store hooks. Add `import { useState } from 'react'` already present. Add a local draft state: `const [nameDraft, setNameDraft] = useState('');`
- Import `MAX_PET_NAME`: `import { MAX_PET_NAME } from '../domain/petName';`
- Inside the reveal block (`pulled` truthy), after the rarity badge / stats, add:
```tsx
          <div className="mt-1 flex items-center gap-2">
            <input
              type="text"
              aria-label="Name your pet"
              placeholder="Name your pet"
              maxLength={MAX_PET_NAME}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <PressButton
              onClick={() => { if (pulled) renamePet(pulled.id, nameDraft); }}
              aria-label="Name"
              className="rounded-lg bg-violet-500 px-3 py-2 text-sm font-bold text-white"
            >
              Name
            </PressButton>
          </div>
```
(Skipping = simply leaving the field blank and pressing Back; the pet keeps its species name. The headline already uses `petDisplayName(pulled)` from Task 5, so after naming + a re-render it reflects the new name — acceptable; do not over-engineer live headline sync.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test -- --run src/components/Gacha.test.tsx 2>&1 | tail -10`
Expected: tsc clean, PASS.

- [ ] **Step 5: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(rename): name-your-pet field in the gacha reveal"
```

---

## Task 7: Collection ✎ inline rename (render-only TDD)

**Files:**
- Modify: `src/components/Collection.tsx`
- Modify: `src/components/Collection.test.tsx`

- [ ] **Step 1: Failing test**

In `src/components/Collection.test.tsx`, add:
```ts
  it('renames the active pet via the pencil + Save', () => {
    useGameStore.getState().hatch();
    render(<Collection />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /pet name/i }), { target: { value: 'Leafy' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(useGameStore.getState().pets[0].name).toBe('Leafy');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run src/components/Collection.test.tsx 2>&1 | tail -15`
Expected: FAIL — no rename control.

- [ ] **Step 3: Implement the ✎ editor**

In `src/components/Collection.tsx`:
- Add imports: `import { useState } from 'react';`, `import { MAX_PET_NAME } from '../domain/petName';`, and pull the action: `const renamePet = useGameStore((s) => s.renamePet);`
- Add local state: `const [editing, setEditing] = useState(false);` and `const [draft, setDraft] = useState('');`
- Replace the detail title span (now `{petDisplayName(active)}` + the species subtitle from Task 5) so the title row includes a pencil and an inline editor. Structure:
```tsx
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <input
                  type="text"
                  aria-label="Pet name"
                  maxLength={MAX_PET_NAME}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-amber-900/30 bg-amber-50 px-2 py-1 text-base"
                />
                <PressButton
                  onClick={() => { renamePet(active.id, draft); setEditing(false); }}
                  aria-label="Save"
                  className="rounded-lg bg-amber-600 px-2 py-1 text-sm font-bold text-white"
                >
                  Save
                </PressButton>
              </>
            ) : (
              <>
                <span className="text-lg font-extrabold text-amber-950">{petDisplayName(active)}</span>
                {active.name.trim() && <span className="text-[10px] font-semibold text-amber-900/50">({PET_NAME[active.species]})</span>}
                <PressButton
                  onClick={() => { setDraft(active.name); setEditing(true); }}
                  aria-label="Rename"
                  className="rounded-md bg-amber-900/15 px-2 py-0.5 text-sm"
                >
                  ✎
                </PressButton>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${RARITY_BADGE[active.rarity]}`}>{active.rarity}</span>
                <span className="text-xs font-semibold text-amber-900/60">Lv {petLevel(active)}</span>
              </>
            )}
          </div>
```
This replaces the existing name/rarity/Lv `<div className="flex items-center gap-2">…</div>` block. Keep the element line (Task 2) and `StatRadar` immediately below, unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm test -- --run src/components/Collection.test.tsx 2>&1 | tail -10`
Expected: tsc clean, PASS.

- [ ] **Step 5: Run the FULL suite**

Run: `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npm test -- --run 2>&1 | tail -8`
Expected: all green (the element-line test from Task 2 still passes — it queries `/strong vs/i` which is unaffected by the title restructure).

- [ ] **Step 6: Commit**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add -A && git commit -m "feat(rename): Collection inline pencil rename"
```

---

## Task 8: Docs sync (GAME_DESIGN, both copies)

**Files:**
- Modify: `GAME_DESIGN.md` (repo root)
- Modify: `H:\My Drive\01 Current Projects\AI\AI_design_thinking\GAME_DESIGN.md`

- [ ] **Step 1: Add the note (both copies, identical)**

Read §7 of both files. After the "Gacha (Phase B-2, shipped)." paragraph, insert this paragraph into BOTH:
```markdown
**Pet names + elements (shipped).** Pets can be given a **custom name** (default = the species name, ≤14 chars, editable in the gacha reveal and in the Collection ✎). The four species are an **element type wheel** — **Water > Fire > Air > Leaf > Water** (each strong vs one element, weak vs the one that beats it). Strong/weak matchups show on the Collection detail card; the pure `typeMultiplier` (strong ×1.5, weak ×0.75, neutral ×1.0) is defined now and **applied in battle in Phase B-3**.
```
Verify both files contain it.

- [ ] **Step 2: Commit (repo-tracked file only)**

```bash
cd "D:\ai_projects\AI_design_thinking\sentence-pet" && git add GAME_DESIGN.md && git commit -m "docs: pet names + element wheel note (combat in B-3)"
```

---

## Final verification (before PR)

- [ ] `cd "D:\ai_projects\AI_design_thinking\sentence-pet" && npx tsc -b && npm run build && npm test -- --run 2>&1 | tail -20` — tsc clean, build clean, all tests green.
- [ ] `npm run dev -- --host` smoke: pull an egg → type a name → Save → reveal headline shows it; PetRoom name chip shows it; Collection ✎ edits it; Collection shows the right "Strong vs / Weak vs" element line + emoji badges; hard-refresh confirms the v7 save reloads (name persists).
- [ ] `superpowers:finishing-a-development-branch` → PR.

## Self-review notes (addressed)

- **Spec coverage:** elements domain (T1), element display (T2), `name` field + persist 6→7 (T3), sanitize + `renamePet` (T4), `petDisplayName` + cross-screen swap (T5), gacha name field (T6), Collection ✎ (T7), docs (T8). All spec sections mapped. Profanity filter explicitly out of scope (spec) — no task, correct.
- **Type consistency:** `STRONG_VS`/`typeMultiplier`/`strongAgainst`/`weakAgainst` defined T1, consumed T2 unchanged. `name`/`makePet name?` T3 consumed by `petDisplayName` (T5), `renamePet` (T4), gacha field (T6), Collection ✎ (T7). `sanitizePetName`/`MAX_PET_NAME` T4 reused T6/T7. `petDisplayName` T5 reused T6/T7.
- **Build-green ordering:** T3 makes `name` non-breaking by defaulting in `makePet`; the migrate backfill covers persisted saves; the rarity-backfill pattern is mirrored exactly.
- **Test-name stability:** existing component tests assert species names (no custom name set) → `petDisplayName` returns species name → they stay green after T5.
