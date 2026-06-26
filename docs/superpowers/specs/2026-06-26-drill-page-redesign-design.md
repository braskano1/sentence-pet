# Drill Page Redesign — "Living Drill" — Design Spec

**Date:** 2026-06-26
**Status:** approved (brainstorm + visual companion), pending implementation plan.
**Scope:** the in-round sentence-building screen (`DrillScreen`) and its shared parts. The egg-hatch tutorial inherits a subset. No other screens change.

## Context

The drill page is the core loop: a student reads a Thai meaning hint and builds the English sentence by placing word tiles into part-of-speech slots. Today the **only** interaction is drag-a-tile-into-a-slot; on a wrong answer the whole item resets and the tray reshuffles. The screen is plain (`bg-slate-100`), the pet is absent, and several mechanics already modeled in data/domain are never surfaced (POS structure, grammar trap tips, no audio, no progress/streak feedback).

A brainstorm + visual-companion session explored three directions (tap-to-build / sentence-stage / focus-rail) and converged on a **blend** ("Living Drill"): tap-to-build + POS colors, a live centre-stage pet + streak, and inline why-wrong tips. This spec captures the locked design.

## Locked decisions (from brainstorm)

| Fork | Decision |
|---|---|
| **Redesign goals** | All four: richer interaction, stronger learning, more game feel, clearer layout. |
| **Background** | Light room (high-contrast for slots), not a dark themed scene. |
| **Lives / retries** | **Unlimited retries, no hearts.** The streak is the only stake. |
| **Pet placement** | **Centre-stage** — big animated active pet up front, reacting live. |
| **Audio** | Split: tile tap = **English** word; hint 🔊 = **Thai** meaning; full **English** sentence on the reward after solving. New feature (no audio in data today). |
| **Meaning help** | **💡 Hint button** that fills the current slot's correct word and resets the streak (counts as a slip). No English-sentence "reveal" (that would spoil the answer). |
| **Wrong answer** | **Partial retry** — keep correct slots, bounce only wrong tile(s) back, show why. Replaces today's full-item reset. |
| **Egg hatch** | Inherits **tap-to-place + POS colors + per-word audio** (shared components). No streak, no centre-stage pet reaction, no why-tip — the tutorial stays simple. |

> Visual fidelity in the mockups is direction only; the production pass uses the real palette and the `impeccable` craft bar. Pet/word art stays emoji until the partner's art pipeline lands (clean art seam).

## Goal

A student lands on a bright, legible drill screen with their pet centre-stage. They build the sentence by **tapping** words (which fly into the glowing current slot) or dragging them, hearing each English word as they place it. POS color-coding makes sentence structure visible. A streak and a 5-item star track reward clean runs; the pet cheers correct answers and flinches on wrong ones. A wrong placement bounces only the wrong tile back with an inline, data-driven explanation, never wiping correct progress. A 💡 hint is available when stuck. Scoring (stars, coins, XP, food) is unchanged.

## The redesign

### A. Interaction

1. **Tap-to-place.** Tapping a tray tile places it into the **current slot** (leftmost empty). Tapping a placed word recalls it to the tray. Drag-and-drop is fully retained. Keyboard path retained.
2. **Current-slot affordance.** The leftmost empty slot is visually "current" (emerald glow); it advances automatically as slots fill.
3. **Partial retry.** When all slots are filled and the answer is wrong, only the **wrong** slots clear (their tiles return to the tray); correct/accepted slots stay placed. The student refills just the wrong slots; re-evaluation fires automatically when the sentence is full again. No reshuffle.

### B. Learning

4. **POS color-coding.** Slots and tiles are colored by part of speech (Pronoun = sky, Verb = emerald, Object = amber), via a central map with a neutral fallback for any future `PosLabel`.
5. **Audio (new).** A speech seam speaks: the tapped/placed English word, the Thai hint (🔊), and the full English sentence on the reward screen. Implemented over the Web Speech API, behind a swappable provider so recorded clips can replace it later. Silently no-ops where speech is unavailable.
6. **Why-wrong.** On a wrong slot, an inline tip shows: if the wrong tile is a registered `GrammarTrap`, its `tip`; otherwise a generic per-slot nudge (e.g. "The Verb isn't right yet").
7. **💡 Hint.** Fills the current slot with its correct answer word, marks the matching tray tile used, resets the streak, and counts as a slip (so stars reflect the assist). Available any time the sentence is incomplete.

### C. Game feel

8. **Centre-stage pet.** The active pet (reusing `PetSprite` + `SpeechBubble`) sits above the hint, reacting: idle while building, bounce on correct, flinch on wrong, with short contextual nudges.
9. **Streak + star track.** A streak counts consecutive **ideal** items in the round (an exact, slip-free placement). Any wrong submission, a flagged near-miss accept, or a 💡 hint resets it to 0. A 5-node track shows round progress with earned stars. Both are **cosmetic**: stars, coins, XP, and food are computed exactly as today.

## Architecture

### No data or persistence changes
- **`DrillItem` is unchanged.** The English sentence for audio is `item.answer.join(' ')`; the per-word audio is each answer/tray word. No new content fields, no `englishHint`, no schema/migration, no `PERSIST_VERSION` bump.
- **`finishRound` and the scoring chain (`scoring`, `xp`, `bars`, coins, food) are unchanged.** Streak, why-tip, and pet reaction are **local, transient `DrillScreen` state** — not in the store, not persisted.

### Module changes

```
src/
  components/
    DrillScreen.tsx        // MODIFY: orchestrates tap/streak/why/pet-reaction; thinner via sub-components
    SentenceSlots.tsx      // MODIFY: POS colors, current-slot glow, tap-to-clear (already taps)
    WordTray.tsx           // MODIFY: POS-colored tiles, onTapPlace, per-word audio on tap
    EggHatch.tsx           // MODIFY: adopt tap-to-place + POS colors + per-word audio (no streak/pet/why)
    drill/                 // NEW folder for the new sub-components
      DrillHeader.tsx      // NEW: streak chip + 5-node star track + score chip
      DrillPet.tsx         // NEW: centre-stage active pet + speech bubble; reaction prop ('idle'|'correct'|'wrong')
      WhyTip.tsx           // NEW: inline why-wrong banner
      HintButton.tsx       // NEW: 💡 fill-current-slot assist
  domain/
    placement.ts           // MODIFY: add tapPlace (tile -> current slot) + currentSlotIndex helper
    grade.ts               // MODIFY (or add helper): per-slot result ('ok'|'wrong') for partial retry + tip selection
    round.ts               // MODIFY: 'retry' action carries wrongSlots:number[] and tip:string|null
  config/
    posColors.ts           // NEW: PosLabel -> { slot classes, tile classes }, neutral fallback
    audio.ts               // NEW: SpeechProvider interface + Web Speech default + no-op fallback
  hooks/
    useSpeech.ts           // NEW (or co-located): thin hook over the audio provider
```

### Key flows

- **Tap place:** `WordTray` tile `onTap` → `DrillScreen` computes current slot via `currentSlotIndex(placed)` → `tapPlace(...)` → set state → speak word → if all filled, `evaluate()`.
- **Evaluate:** unchanged `resolveRound(...)`, but the `retry` action now returns `wrongSlots` + `tip`. `applyAction('retry')` clears **only** `wrongSlots` (returns their tiles), sets `whyTip`, resets streak, `mistakes++`, sets pet reaction `wrong`. (No `loadItem`.)
- **Advance/finish:** unchanged except streak increment on a clean item and pet reaction `correct`.
- **Hint:** `HintButton` → fill `currentSlotIndex` with `item.answer[i]`, mark tile used, streak→0, `mistakes++`.
- **Audio:** `useSpeech()` exposes `speakWord/speakThai/speakSentence`; reward screen speaks the sentence once on mount.

## Testing strategy

- **`placement.ts`** — `tapPlace` (fills current slot, ignores when full/used), `currentSlotIndex`.
- **`grade.ts` / `round.ts`** — per-slot results; `retry` action carries the correct `wrongSlots` + tip; clean/flagged/finish paths and star math stay green (existing tests must pass unchanged).
- **`posColors.ts`** — known labels map; unknown label → fallback.
- **`audio.ts`** — provider no-ops when `speechSynthesis` is absent; calls utterance with the right `lang` when present (mock `window.speechSynthesis`).
- **Component render tests** (mock `framer-motion` per the App.test pattern, mock the audio provider): `DrillScreen` tap places into current slot; wrong → only wrong slot clears + WhyTip shows; hint fills current slot + resets streak; `DrillHeader` renders streak/track/score; `EggHatch` still hatches on a correct tap-built sentence.
- **Green bar:** `npx tsc -b`, `npm run build`, full `vitest`. Existing `DrillScreen`/`SentenceSlots`/`WordTray`/`EggHatch` tests updated only where the contract genuinely changed; selectors/testids preserved where possible.
- **Visual + interaction QA:** headed-Chrome pass against the emulator (tap, drag, wrong→partial-retry, hint, audio buttons present, pet reactions, reduced-motion).

## Non-goals (this slice)

- ❌ Recorded audio assets / a TTS service — Web Speech seam only.
- ❌ Real pet/word art — emoji until the partner's pipeline; keep the art seam.
- ❌ Content authoring changes (no English gloss field; audio derives from `answer`).
- ❌ Changing scoring, XP, coins, food, journey unlock, or persistence.
- ❌ Streak/combo *bonuses* that affect rewards (streak is cosmetic this slice).
- ❌ Redesigning other screens (PetRoom, JourneyMap, Shop, Gacha, Collection, Reward beyond adding sentence audio).
- ❌ Battle/friends (slice 4).

## Success criteria

- A student can complete a round by **tapping** words (and still by dragging); tapping a placed word recalls it.
- Slots and tiles are POS-colored; the current slot is clearly indicated.
- Tapping a word speaks the English word; 🔊 speaks the Thai hint; the reward screen speaks the English sentence. All degrade silently without a voice.
- A wrong answer clears **only** the wrong slot(s) and shows an inline why-tip (trap tip when present, generic otherwise); correct words stay put.
- 💡 Hint fills the current slot and resets the streak.
- The active pet is centre-stage and reacts to correct/wrong; a streak + 5-item star track show progress; **stars/coins/XP/food are identical to today**.
- Egg hatch supports tap-to-place + POS colors + per-word audio.
- `npx tsc -b`, `npm run build`, full `vitest` green; no persistence/version change.
