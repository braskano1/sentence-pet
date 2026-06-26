# Gacha Egg Evolution Cinematic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play the existing evolution cinematic (egg → species baby) as the reveal when a bought (gacha) egg hatches, then fall through to the existing name card.

**Architecture:** Extract the cinematic from `EvolutionScreen` into a reusable, props-driven `EvolutionCinematic` (`from/to/species/onDone`). `EvolutionScreen` becomes a thin store wrapper. `Gacha` renders the cinematic as a full-screen overlay on pull, then shows its existing reveal/name card.

**Tech Stack:** React 19 + TS, Tailwind v4, framer-motion 12, Zustand, Web Audio, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-27-gacha-egg-evolution-design.md`

**Conventions:** typecheck `npx tsc -b`; tests `npx vitest run <path>`; build `npm run build`. framer renders statically in jsdom; `matchMedia` polyfilled in `src/test/setup.ts` (so `useReducedMotion()` is false); `evolutionSound` returns a silent no-op when there's no `AudioContext` (jsdom). End commits with the `Co-Authored-By: Claude Opus 4.8` trailer. Branch `gacha-egg-evolution` (stacked on `dev-panel-everywhere`) — do NOT switch branches.

---

## Task 1: Extract `EvolutionCinematic`

**Files:**
- Create: `src/components/EvolutionCinematic.tsx`
- Test: `src/components/EvolutionCinematic.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/EvolutionCinematic.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const sound = vi.hoisted(() => ({ strobe: vi.fn(), flash: vi.fn(), reveal: vi.fn(), stop: vi.fn() }));
vi.mock('../effects/evolutionSound', async (orig) => {
  const actual = await orig<typeof import('../effects/evolutionSound')>();
  return { ...actual, getEvolutionSound: () => sound };
});

import { EvolutionCinematic } from './EvolutionCinematic';
import { useGameStore } from '../state/gameStore';

beforeEach(() => {
  useGameStore.getState().resetForTest();
  Object.values(sound).forEach((f) => f.mockClear());
});
afterEach(() => vi.restoreAllMocks());

describe('EvolutionCinematic', () => {
  it('on skip shows the to-stage banner; Continue calls onDone and stops audio', () => {
    const onDone = vi.fn();
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={onDone} />);
    fireEvent.click(screen.getByTestId('evolution-stage')); // tap to skip
    expect(sound.stop).toHaveBeenCalled();
    expect(screen.getByText(/Young/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('plays the reveal cue when sound is on, not when off', () => {
    useGameStore.setState({ soundEnabled: true });
    const { unmount } = render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByTestId('evolution-stage'));
    expect(sound.reveal).toHaveBeenCalled();
    unmount();

    Object.values(sound).forEach((f) => f.mockClear());
    useGameStore.setState({ soundEnabled: false });
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByTestId('evolution-stage'));
    expect(sound.reveal).not.toHaveBeenCalled();
  });

  it('renders a sound toggle that flips soundEnabled', () => {
    useGameStore.setState({ soundEnabled: true });
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /mute sound/i }));
    expect(useGameStore.getState().soundEnabled).toBe(false);
  });

  it('stops in-flight audio when muted mid-sequence', () => {
    useGameStore.setState({ soundEnabled: true });
    render(<EvolutionCinematic from="baby" to="young" species="leaf" onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /mute sound/i }));
    expect(sound.stop).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/EvolutionCinematic.test.tsx`
Expected: FAIL — cannot resolve `./EvolutionCinematic`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/EvolutionCinematic.tsx
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../state/gameStore';
import { spriteSrc } from '../config/sprites';
import { STAGE_NAME } from '../domain/xp';
import type { PetStage, Species } from '../data/types';
import { useEvolutionSequence } from '../hooks/useEvolutionSequence';
import { getEvolutionSound, soundAllowed } from '../effects/evolutionSound';
import { fireConfetti, buzz } from '../effects/celebrate';
import { PressButton } from './PressButton';

/** The full evolution sequence (silhouette → strobe → flash → reveal) with audio,
 * skip, sound toggle, and confetti. Presentational + store-sound-setting only;
 * the caller decides what `onDone` does. */
export function EvolutionCinematic({
  from, to, species, onDone,
}: { from: PetStage; to: PetStage; species: Species; onDone: () => void }) {
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const reduced = !!useReducedMotion();
  const { phase, swap, skip } = useEvolutionSequence({ reduced });
  const sound = useRef(getEvolutionSound());
  const celebrated = useRef(false);

  const allow = soundAllowed(soundEnabled, reduced);
  const cuedPhase = useRef<string | null>(null);

  // Phase-aligned audio cues. Fire once per phase; stop in-flight audio if muted.
  useEffect(() => {
    const s = sound.current;
    if (!allow) { s.stop(); cuedPhase.current = null; return; }
    if (cuedPhase.current === phase) return;
    cuedPhase.current = phase;
    if (phase === 'strobe') s.strobe();
    else if (phase === 'flash') s.flash();
    else if (phase === 'reveal') s.reveal();
  }, [phase, allow]);

  // Confetti + haptic once on reveal.
  useEffect(() => {
    if (phase === 'reveal' && !celebrated.current) {
      celebrated.current = true;
      fireConfetti();
      buzz();
    }
  }, [phase]);

  // Stop audio on unmount.
  useEffect(() => {
    const s = sound.current;
    return () => s.stop();
  }, []);

  const revealed = phase === 'reveal' || phase === 'done';
  const showNew = revealed || (phase === 'strobe' && swap);
  const isSil = phase === 'silhouette' || phase === 'strobe';
  const src = spriteSrc(species, showNew ? to : from, 'happy');

  const finish = () => { sound.current.stop(); onDone(); };

  return (
    <div
      className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#1d2746_0%,#0a0f1f_70%)] p-6"
      onClick={revealed ? undefined : () => { skip(); sound.current.stop(); }}
    >
      <button
        type="button"
        aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
        onClick={(e) => { e.stopPropagation(); toggleSound(); }}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white"
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>

      {phase === 'announce' && (
        <p className="absolute top-20 text-lg font-semibold text-white/90">What? Your pet is evolving!</p>
      )}

      <motion.img
        data-testid="evolution-stage"
        src={src}
        alt={`pet-${species}-${showNew ? to : from}`}
        draggable={false}
        className={`h-[clamp(7rem,30vh,13rem)] w-auto object-contain ${isSil ? 'evo-silhouette' : ''}`}
        animate={revealed ? { scale: [0.2, 1.35, 0.9, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: revealed ? 0.76 : 0.2 }}
      />

      {phase === 'flash' && <div className="evo-flash pointer-events-none absolute inset-0 bg-white" />}

      {revealed && (
        <>
          <p className="absolute bottom-28 text-xl font-extrabold text-white">
            Evolved to <span className="text-emerald-300">{STAGE_NAME[to]}</span>! ✨
          </p>
          <PressButton
            onClick={finish}
            className="absolute bottom-10 min-h-12 rounded-xl bg-emerald-500 px-8 py-3 text-lg font-semibold text-white shadow"
          >
            Continue
          </PressButton>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/EvolutionCinematic.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean. (Note: `EvolutionScreen.tsx` still has its own copy of this logic at this point — that's fine, both compile; Task 2 removes the duplication.)

- [ ] **Step 6: Commit**

```bash
git add src/components/EvolutionCinematic.tsx src/components/EvolutionCinematic.test.tsx
git commit -m "feat(evolution): extract reusable EvolutionCinematic component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Slim `EvolutionScreen` to delegate

**Files:**
- Modify: `src/components/EvolutionScreen.tsx` (rewrite as a thin wrapper)
- Modify: `src/components/EvolutionScreen.test.tsx` (drop the audio/skip/toggle tests now owned by the cinematic; keep the store-wiring tests)

- [ ] **Step 1: Rewrite the test to the slim surface**

Replace the entire contents of `src/components/EvolutionScreen.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const sound = vi.hoisted(() => ({ strobe: vi.fn(), flash: vi.fn(), reveal: vi.fn(), stop: vi.fn() }));
vi.mock('../effects/evolutionSound', async (orig) => {
  const actual = await orig<typeof import('../effects/evolutionSound')>();
  return { ...actual, getEvolutionSound: () => sound };
});

import { EvolutionScreen } from './EvolutionScreen';
import { useGameStore } from '../state/gameStore';

beforeEach(() => {
  useGameStore.getState().resetForTest();
  useGameStore.setState((s) => ({ pets: s.pets.map((p) => ({ ...p, hatched: true })) }));
  Object.values(sound).forEach((f) => f.mockClear());
});
afterEach(() => vi.restoreAllMocks());

describe('EvolutionScreen', () => {
  it('redirects to petRoom when there is no stage change', () => {
    useGameStore.setState({ lastStageChange: null, screen: 'evolution' });
    render(<EvolutionScreen />);
    expect(useGameStore.getState().screen).toBe('petRoom');
  });

  it('renders the cinematic; Continue clears the change and routes to petRoom', () => {
    useGameStore.setState({ lastStageChange: { from: 'baby', to: 'young' }, screen: 'evolution' });
    render(<EvolutionScreen />);
    fireEvent.click(screen.getByTestId('evolution-stage'));   // tap to skip
    expect(screen.getByText(/Young/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(useGameStore.getState().lastStageChange).toBeNull();
    expect(useGameStore.getState().screen).toBe('petRoom');
  });
});
```

- [ ] **Step 2: Run test to verify it still passes against the CURRENT (full) EvolutionScreen**

Run: `npx vitest run src/components/EvolutionScreen.test.tsx`
Expected: PASS (2 tests) — the current full component already satisfies these, so we're refactoring under green.

- [ ] **Step 3: Rewrite `EvolutionScreen.tsx` as a thin wrapper**

Replace the entire contents of `src/components/EvolutionScreen.tsx` with:

```tsx
import { useEffect } from 'react';
import { useGameStore, selectActivePet } from '../state/gameStore';
import { EvolutionCinematic } from './EvolutionCinematic';

/** Routed evolution screen (hatch / L16 / L36). Binds the transient
 * lastStageChange + active pet to the shared cinematic. */
export function EvolutionScreen() {
  const change = useGameStore((s) => s.lastStageChange);
  const pet = useGameStore(selectActivePet);
  const clearStageChange = useGameStore((s) => s.clearStageChange);
  const setScreen = useGameStore((s) => s.setScreen);

  // No stage change to show (e.g. reload while on this screen) -> leave.
  useEffect(() => {
    if (!change) setScreen('petRoom');
  }, [change, setScreen]);

  if (!change) return null;

  return (
    <EvolutionCinematic
      from={change.from}
      to={change.to}
      species={pet.species}
      onDone={() => {
        clearStageChange();
        setScreen('petRoom');
      }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it still passes**

Run: `npx vitest run src/components/EvolutionScreen.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean (the duplicated logic and unused imports are now gone from `EvolutionScreen.tsx`).

- [ ] **Step 6: Commit**

```bash
git add src/components/EvolutionScreen.tsx src/components/EvolutionScreen.test.tsx
git commit -m "refactor(evolution): EvolutionScreen delegates to EvolutionCinematic

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Play the cinematic on a gacha pull

**Files:**
- Modify: `src/components/Gacha.tsx` (hatching overlay)
- Modify: `src/components/Gacha.test.tsx` (advance through the cinematic before asserting the card)

- [ ] **Step 1: Update the Gacha tests**

In `src/components/Gacha.test.tsx`:

a) Add a helper just inside `describe('Gacha screen', ...)`, after the `beforeEach`:

```tsx
  // After a pull, the hatch cinematic plays first; advance through it to the card.
  function advanceCinematic() {
    fireEvent.click(screen.getByTestId('evolution-stage'));            // skip -> reveal
    fireEvent.click(screen.getByRole('button', { name: /continue/i })); // onDone -> name card
  }
```

b) In the test `'pulling reveals the new pet with its rarity, and grows the collection'`, insert `advanceCinematic();` immediately after the Pull click and before the rarity-text assertion (the `pets` length assertion can stay where it is — the pet is added synchronously on pull):

```tsx
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    expect(useGameStore.getState().pets).toHaveLength(2);
    advanceCinematic();
    const rarity = useGameStore.getState().lastPull?.rarity ?? '';
    expect(screen.getByText(new RegExp(`^${rarity}$`, 'i'))).toBeTruthy();
```

c) In the test `'names the pulled pet from the reveal field'`, insert `advanceCinematic();` immediately after the Pull click and before querying the name field:

```tsx
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    advanceCinematic();
    const field = screen.getByRole('textbox', { name: /name your pet/i });
```

d) Add a new test asserting the cinematic gates the card:

```tsx
  it('plays the hatch cinematic on pull, then shows the name card', () => {
    useGameStore.getState().addCoinsForTest(100);
    render(<Gacha />);
    fireEvent.click(screen.getByRole('button', { name: /pull/i }));
    // cinematic overlay first — name card not shown yet
    expect(screen.getByTestId('evolution-stage')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /name your pet/i })).toBeNull();
    advanceCinematic();
    expect(screen.getByRole('textbox', { name: /name your pet/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Gacha.test.tsx`
Expected: FAIL — there's no cinematic yet, so `evolution-stage` isn't found (the new test and the two `advanceCinematic()` calls fail).

- [ ] **Step 3: Wire the cinematic into `Gacha.tsx`**

In `src/components/Gacha.tsx`:

a) Add the import (next to the other component imports):

```tsx
import { EvolutionCinematic } from './EvolutionCinematic';
```

b) Remove the now-unused `fireConfetti` import (line 8: `import { fireConfetti } from '../effects/celebrate';`) — the cinematic fires confetti itself.

c) Add hatching state next to the other `useState`s:

```tsx
  const [hatching, setHatching] = useState(false);
```

d) Change `onPull` to start the cinematic instead of firing confetti:

```tsx
  const onPull = () => {
    pullEgg();
    setRevealed(true);
    setHatching(true);
  };
```

e) Early-return the cinematic overlay while hatching, before the main `return (`:

```tsx
  if (hatching && lastPull) {
    return (
      <EvolutionCinematic
        from="egg"
        to="baby"
        species={lastPull.species}
        onDone={() => setHatching(false)}
      />
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/Gacha.test.tsx`
Expected: PASS (all gacha tests, including the new cinematic test).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean (no unused `fireConfetti`).

- [ ] **Step 6: Commit**

```bash
git add src/components/Gacha.tsx src/components/Gacha.test.tsx
git commit -m "feat(gacha): play the hatch cinematic on egg pull, then the name card

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all green (prior baseline + new `EvolutionCinematic` tests; `EvolutionScreen`/`Gacha` tests updated; previously-skipped tests still skipped).

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc -b`
Expected: clean.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke check (headed Chrome / dev server, optional)**

Reach the Gacha screen with enough coins, tap **Pull** → the cinematic plays (egg → the pulled species' baby) → tap to skip / Continue → the existing stats + name card appears. The active pet in the pet room is unchanged.

---

## Self-review notes

- **Spec coverage:** `EvolutionCinematic` extraction (Task 1) → spec §1; `EvolutionScreen` thin wrapper (Task 2) → §2; Gacha overlay (Task 3) → §3; tests across Tasks 1–3 → spec "Testing"; full verify (Task 4) → spec "Files touched".
- **No active-pet / screen / hatched changes** in the gacha path: `onPull` only adds local `hatching` state; `pullEgg` is unchanged.
- **Type/name consistency:** `EvolutionCinematic({ from: PetStage, to: PetStage, species: Species, onDone })`, `data-testid="evolution-stage"`, `evo-silhouette`/`evo-flash` classes, `spriteSrc`, `STAGE_NAME` are used identically across tasks.
- **Banner copy** for egg→baby reads "Evolved to Baby!" — accepted as cosmetic per the spec; not changed here.
