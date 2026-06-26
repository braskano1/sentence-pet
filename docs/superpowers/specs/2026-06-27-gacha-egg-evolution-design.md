# Design — Play the evolution cinematic when a bought (gacha) egg hatches

**Date:** 2026-06-27
**Status:** Approved (brainstorming)
**Area:** gacha reveal — reuse the existing evolution cinematic as the "mystery egg → species baby" reveal.

## Problem

Buying a Mystery Egg (`pullEgg`) creates a new pet already `hatched: true` (`domain/gacha.ts:24`) and immediately shows a stats + name card (`Gacha.tsx:57-95`). There is no hatch moment. We want the just-shipped evolution cinematic (egg silhouette → strobe → flash → reveal of the species baby) to play as the dramatic reveal when a bought egg "hatches", then return to the existing name card.

## Goals

- After a pull, play the evolution cinematic (`egg → baby`, showing the **pulled** pet's species) as a full-screen takeover inside the Gacha screen.
- When it finishes, fall through to the **existing** gacha reveal/name card (today's flow).
- Reuse the existing cinematic visuals/audio — do not fork them.

## Non-goals / locked decisions (from brainstorming)

- **Do not** change the active pet (`activePetId` untouched).
- **Cosmetic only:** the gacha pet stays `hatched: true`; no `hatched`/collection/persistence changes.
- **No screen routing** for the gacha case — the cinematic plays as an in-Gacha overlay so the Gacha screen's local `revealed`/name-card state survives.
- No change to gacha odds, pricing, coins, or the pulled pet's stats/rarity.
- No change to the existing routed evolution triggers (hatch, L16, L36).

## Design

### 1. Extract a reusable `EvolutionCinematic` component

Move the entire cinematic out of `EvolutionScreen` into a presentational component.

- **File:** `src/components/EvolutionCinematic.tsx`
- **Props:** `{ from: PetStage; to: PetStage; species: Species; onDone: () => void }`.
- **Owns:** `useEvolutionSequence`, the synthesized audio cues (`getEvolutionSound`, `soundAllowed`, per-phase `cuedPhase` dedup, mute-stops-audio), confetti + haptics on reveal, skip-on-tap (which also stops audio), the 🔊 sound toggle, the silhouette/strobe/flash visuals, the reveal banner, and the Continue button.
- **Reads from store:** `soundEnabled`, `toggleSound` (global setting). Uses `useReducedMotion()` internally.
- **Sprite:** `spriteSrc(species, showNew ? to : from, 'happy')` — identical resolution to today (`from: 'egg'` yields the generic egg sprite).
- **`onDone`:** called by the Continue button (and is the single "sequence finished" exit). Continue calls `sound.current.stop()` then `onDone()`. The existing unmount cleanup (`return () => sound.current.stop()`) still stops audio if the parent unmounts the component.
- Keeps `data-testid="evolution-stage"` on the sprite and the existing banner copy `Evolved to {STAGE_NAME[to]}!`. (The egg→baby banner reads "Evolved to Baby!"; acceptable as a cosmetic reveal. A gacha-specific reveal label is a possible later copy tweak, explicitly out of scope here.)

This is a straight extraction: the body is today's `EvolutionScreen` JSX/effects with `pet.species` → the `species` prop and `finish()` → `sound.current.stop(); onDone()`.

### 2. `EvolutionScreen` becomes a thin store wrapper

- **File:** `src/components/EvolutionScreen.tsx` (rewritten, smaller).
- Reads `lastStageChange` + `selectActivePet` + `clearStageChange` + `setScreen`.
- Null-change guard unchanged: `useEffect(() => { if (!change) setScreen('petRoom'); }, ...)` and `if (!change) return null;`.
- Renders:
  ```tsx
  <EvolutionCinematic
    from={change.from}
    to={change.to}
    species={pet.species}
    onDone={() => { clearStageChange(); setScreen('petRoom'); }}
  />
  ```
- No behavior change for the hatch / L16 / L36 flows.

### 3. Gacha wiring (`src/components/Gacha.tsx`)

- Add local state: `const [hatching, setHatching] = useState(false);`
- `onPull` becomes: `pullEgg(); setRevealed(true); setHatching(true);` — remove the `fireConfetti()` call here (the cinematic fires confetti on reveal). Drop the now-unused `fireConfetti` import.
- Early-return the cinematic while hatching (full-screen takeover), before the normal layout:
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
- After `onDone`, `hatching` is false and `revealed` is true, so the existing reveal/name card renders unchanged (`pulled = revealed ? lastPull : null`).
- `lastPull` is set synchronously by `pullEgg` inside the same `set`, so `lastPull.species` is available on the next render while `hatching`.

## Component boundaries

- `EvolutionCinematic` — owns *presentation + audio + sequence*; props-driven; no store screen/clear logic. Reused by both callers.
- `EvolutionScreen` — owns the *store→cinematic* binding for routed evolutions (hatch/L16/L36).
- `Gacha` — owns the *pull→cinematic→name-card* local flow; no store screen/`lastStageChange` involvement.

## Testing

- **`EvolutionCinematic.test.tsx`** (new; moved from EvolutionScreen tests — mock `canvas-confetti` + `evolutionSound`):
  - With `from='baby' to='young' species='leaf'`: tap to skip → banner shows "Young" and Continue calls `onDone` once.
  - Skip calls `sound.stop`.
  - Reveal cue fires when `soundEnabled` true, not when false (and not under reduced motion).
  - The 🔊 toggle flips `soundEnabled`.
- **`EvolutionScreen.test.tsx`** (slimmed): null `lastStageChange` → redirects to `petRoom`; with a change set → renders the cinematic (`evolution-stage` present) and tapping skip→Continue clears `lastStageChange` and routes to `petRoom`.
- **`Gacha.test.tsx`** (updated): after clicking **Pull**, the cinematic overlay shows (`evolution-stage` present, the name input is NOT yet) ; after completing it (skip → Continue) the existing reveal card + **Name your pet** input appears. Mock `canvas-confetti` + `evolutionSound`. Update any existing pull-then-assert-card test to advance through the cinematic first.

Full suite green: `npx vitest run`; `npx tsc -b` clean; `npm run build` green.

## Files touched

- **New:** `src/components/EvolutionCinematic.tsx` (+ `EvolutionCinematic.test.tsx`)
- **Edit:** `src/components/EvolutionScreen.tsx` (thin wrapper; move tests out), `src/components/Gacha.tsx` (hatching overlay), `src/components/EvolutionScreen.test.tsx` (slim), `src/components/Gacha.test.tsx` (advance through cinematic)
