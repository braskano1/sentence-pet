# Design — Pokémon-style evolution sequence

**Date:** 2026-06-26
**Status:** Approved (brainstorming)
**Area:** pet progression celebration — a cinematic full-screen evolution scene shared by the egg→baby hatch and the baby→young / young→adult stage-ups.

## Problem

The pet has four stages — `egg → baby (L1) → young (L16) → adult (L36)` (`src/domain/xp.ts`) — but crossing a stage threshold is invisible: `stage` is *derived* from XP (`stageForXp`), the sprite simply swaps on the next render, and nothing marks the moment. The egg→baby hatch ends with a small "correct" feedback and a cut to the pet room. We want a memorable, Pokémon-style transformation that plays when a pet advances a stage.

## Goals

- A dedicated full-screen **evolution scene** with the "Full Pokémon" beats: announce → white silhouette → accelerating strobe between old and new silhouette → flash burst → squash-bounce reveal with sparkles + confetti + haptics → "Evolved to {stage}!" banner → tap/Continue.
- Trigger it for **all three** stage-ups via one shared screen: egg→baby (from `hatch()`), baby→young and young→adult (from `finishRound()` when XP crosses L16 / L36).
- Skippable (tap anywhere jumps to the reveal) and reduced-motion–aware.

## Non-goals

- No music or sound effects (no audio-asset seam exists; the app uses Web Speech for words only). Celebration uses confetti + `buzz()` haptics, consistent with the existing reward/level-up celebration.
- No change to XP curve, stat allocation, scoring, food, or persistence semantics.
- No new sprite art — reuse the existing per-stage webp sprites. `stage` remains derived, not stored.
- The drill Submit work (separate branch `drill-submit-intro`) is unrelated and out of scope here.

## Decisions (locked in brainstorming)

- **Placement:** a dedicated `evolution` screen. Flow for drills: `drill → reward → evolution → petRoom`. For the first hatch: `egg drill → hatch → evolution → petRoom`.
- **Scope:** all three stage-ups share the one sequence (the egg hatch is upgraded to the same cinematic language).
- **Fidelity:** "Full Pokémon" (demo variant A) — silhouette strobe, flash, squash-bounce reveal, sparkles. Timings live in a constants block so they can be retuned without rewriting.

## Design

### Stage-change detection (data flow)

`stage` stays derived. We detect a *crossing* by comparing the derived stage before and after an XP gain.

- **New helper in `src/domain/xp.ts`:**
  - `export const STAGE_ORDER: PetStage[] = ['egg', 'baby', 'young', 'adult'];`
  - `export const STAGE_NAME: Record<PetStage, string> = { egg: 'Egg', baby: 'Baby', young: 'Young', adult: 'Adult' };`
  - `export function stageUp(from: PetStage, to: PetStage): boolean { return STAGE_ORDER.indexOf(to) > STAGE_ORDER.indexOf(from); }`
- **`StageChange` type:** `{ from: PetStage; to: PetStage }` (declared in `src/data/types.ts` next to the pet types).

### `applyXp` (gameStore) returns the stage change

`applyXp(pet, xpGain, rng)` (`src/state/gameStore.ts:116`) gains a third return field. XP only increases, so `after >= before`.

```ts
function applyXp(pet, xpGain, rng): { pet: PetInstance; levelUp: ...; stageChange: StageChange | null } {
  const beforeStage = stageForXp(pet.xp, pet.hatched);
  // ... existing level/growth logic unchanged ...
  const afterStage = stageForXp(xp, pet.hatched);
  const stageChange = stageUp(beforeStage, afterStage) ? { from: beforeStage, to: afterStage } : null;
  return { pet: ..., levelUp: ..., stageChange };
}
```

(Within `finishRound` the pet is always hatched, so `beforeStage`/`afterStage` are non-egg. A jump spanning two stages, e.g. baby→adult, is representable and the scene handles any `from→to` pair.)

### Transient `lastStageChange` state

Mirror `lastLevelUp` exactly:

- Add `lastStageChange: StageChange | null` to `GameState`, `freshState()` (`= null`), and a `clearStageChange: () => set({ lastStageChange: null })` action.
- **Not persisted:** `PersistedState` is a `Pick` of explicit fields (`gameStore.ts:82`); do not add `lastStageChange` to it.
- `finishRound` captures `withXp.stageChange` into a local and returns `lastStageChange: stageChange` alongside the existing `lastLevelUp`.

### Triggers route to the `evolution` screen

- **Screen enum** (`src/data/types.ts:24`): add `'evolution'` to the `Screen` union.
- **`finishRound`** still sets `screen: 'reward'` (unchanged) plus `lastStageChange`. The reward screen forwards to evolution:
  - **`RewardScreen.tsx`** Continue button: read `lastStageChange`; `onClick={() => setScreen(lastStageChange ? 'evolution' : 'petRoom')}`. RewardScreen does **not** clear `lastStageChange` (the evolution screen owns clearing).
- **`hatch()`** (`gameStore.ts:165`): set `lastStageChange: { from: 'egg', to: 'baby' }` and `screen: 'evolution'` instead of `screen: 'petRoom'`. After hatch, `hatched` is true, so App routes by `screen`.
- **`App.tsx` `screenKeyAndNode`**: add `case 'evolution': return { key: 'evolution', node: <EvolutionScreen /> };`.

### Shared sprite resolver

Extract the sprite lookup so the evolution scene and `PetSprite` agree:

- **`src/config/sprites.ts`:** `export function spriteSrc(species: Species, stage: PetStage, mood: PetMood): string { return stage === 'egg' ? EGG_SPRITE : SPRITES[species][stage][mood]; }`
- `PetSprite.tsx:47` switches to `spriteSrc(species, stage, mood)`.
- The evolution scene uses the **happy** mood for both old and new sprites (it is a happy moment), via `spriteSrc(species, from, 'happy')` and `spriteSrc(species, to, 'happy')`. For `from === 'egg'` this yields `EGG_SPRITE`.

### `useEvolutionSequence` hook (the timeline)

A phase state machine, isolated from rendering so it is unit-testable.

- **Phases:** `'announce' | 'silhouette' | 'strobe' | 'flash' | 'reveal' | 'done'`.
- **`TIMINGS` constant block** (ms): `announce: 900, silhouette: 350, strobe: 1900, strobeStart: 260, strobeMin: 70, strobeStep: 22, flash: 650, reveal: 760`. These reproduce demo A.
- **API:** `useEvolutionSequence({ reduced }: { reduced: boolean }) → { phase, swap, skip }` where `swap` is the boolean the strobe toggles (which silhouette is showing) and `skip()` jumps straight to `reveal`.
- Drives phase transitions with `setTimeout`; the strobe shrinks its interval from `strobeStart` toward `strobeMin` by `strobeStep` until `strobe` elapses, then advances to `flash`.
- **Reduced motion (`reduced === true`):** collapse to `announce → reveal` (skip `silhouette/strobe/flash`); the scene cross-fades old→new with one soft glow instead of strobing/flashing.
- Cleans up all timers on unmount and on `skip()`.

### `EvolutionScreen.tsx`

- Reads `lastStageChange`, active pet (`selectActivePet` → species, happiness), `clearStageChange`, `setScreen`. Uses `useReducedMotion()` from framer-motion to pick the hook's `reduced` flag.
- **Guard:** if `lastStageChange` is null (e.g. reload while `screen === 'evolution'` since the field is transient), run an effect that calls `setScreen('petRoom')` and render nothing.
- Renders the scene by `phase`: dim radial backdrop; the pet `<img>` (old/new src by `swap` during strobe; new on reveal) with the silhouette filter class during `silhouette`/`strobe`; a white flash overlay during `flash`; on `reveal`, the squash-bounce on the new sprite plus sparkle elements, and fire `fireConfetti()` + `buzz()` once.
- **Skip:** tapping the screen calls `skip()`.
- **Continue:** on `phase === 'done'` (or after reveal) show a Continue control and an "Evolved to {STAGE_NAME[to]}!" banner; pressing it (or tapping after reveal) calls `clearStageChange()` then `setScreen('petRoom')`.
- The silhouette filter (`brightness(0) invert(1)` + glow), flash, and sparkle styles are added as small utility classes in `src/index.css` next to the existing `flash-correct`/`pop-check` keyframes.

## Component boundaries

- `xp.ts` — owns stage order/names and `stageUp`; pure functions.
- `applyXp`/`finishRound`/`hatch` — own *detection* and stashing `lastStageChange`; no animation knowledge.
- `useEvolutionSequence` — owns *timing/phase*; no store or DOM knowledge beyond timers.
- `EvolutionScreen` — owns *rendering + effects*; reads store, drives the hook, resolves sprites.
- `spriteSrc` — single source of truth for sprite lookup, shared with `PetSprite`.

## Testing

Component/unit tests (jsdom; framer-motion renders statically; use fake timers for the hook):

- **`xp.ts`:** `stageUp` true for baby→young, young→adult, egg→baby; false for equal stages and (defensively) downgrades. `STAGE_NAME` covers all stages.
- **`applyXp` / `finishRound`:** crossing into L16 yields `stageChange {baby, young}`; into L36 yields `{young, adult}`; a level gain that stays within a stage yields `null`; a gain spanning two stages yields `{from, to}` spanning correctly; `finishRound` puts it on `lastStageChange` and still sets `screen: 'reward'`.
- **`hatch()`:** sets `lastStageChange { egg, baby }` and `screen: 'evolution'`.
- **`RewardScreen`:** Continue routes to `'evolution'` when `lastStageChange` is set, to `'petRoom'` when null.
- **`App`:** `screen === 'evolution'` renders `EvolutionScreen`.
- **`useEvolutionSequence`:** with fake timers, advances `announce → silhouette → strobe → flash → reveal → done`; `skip()` jumps to `reveal`; `reduced` path goes `announce → reveal` with no strobe/flash.
- **`EvolutionScreen`:** with `lastStageChange` set, renders the new stage-name banner and a Continue control that calls `clearStageChange` + `setScreen('petRoom')`; with `lastStageChange` null, redirects to `petRoom`. (Assert behavior/markup, not pixel animation.)

Full suite green: `npx vitest run`; `npx tsc -b` clean; `npm run build` green.

## Files touched

- **New:** `src/components/EvolutionScreen.tsx` (+ test), `src/hooks/useEvolutionSequence.ts` (+ test)
- **Edit:** `src/domain/xp.ts` (stage order/names/`stageUp`), `src/data/types.ts` (`StageChange`, `Screen` += `'evolution'`), `src/state/gameStore.ts` (`applyXp` return, `lastStageChange` + `clearStageChange`, `finishRound`, `hatch`), `src/components/RewardScreen.tsx` (Continue routing), `src/components/PetSprite.tsx` (use `spriteSrc`), `src/config/sprites.ts` (`spriteSrc`), `src/App.tsx` (route), `src/index.css` (silhouette/flash/sparkle styles)
- **Tests:** new hook + screen tests; extend `xp`, `gameStore`/`finishRound`, `RewardScreen`, `App` tests.
- Throwaway `evolution-demo.html` at repo root is a brainstorming artifact — delete before the work merges.
