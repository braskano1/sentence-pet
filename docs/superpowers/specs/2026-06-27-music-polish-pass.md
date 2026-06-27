# Design — Music polish pass (Phase 2 follow-up)

**Date:** 2026-06-27
**Status:** Approved for implementation
**Builds on:** `2026-06-27-game-audio-design.md` (Phase 2 music system, already shipped). This is a focused polish pass driven by playtest feedback.

## Motivation (playtest feedback)
1. The tap-to-start menu (signed-out `MainMenu`) has no music.
2. Music should stop during the evolution cinematic.
3. The level-cleared / reward screen should NOT start the overworld (petroom) loop; it should play a short "level cleared" sting instead.
4. The overworld (petroom) loop sounds bad — regenerate it.

## Decisions
- **Reward sound:** normal lessons play a new `cleared` jingle; boss checkpoints keep their existing `win`/`lose` stingers.
- **Overworld style:** light whimsical orchestral fantasy (strings, flute, pizzicato, cozy adventure).
- **Menu style:** dreamy / atmospheric (soft pads, shimmer, wonder) — matches the indigo "twilight hatch world" title art.
- **Menu start timing:** music starts on the first tap (the tap-to-start tap), then plays through menu → game. The first untouched title frame is silent — an unavoidable browser autoplay rule, accepted. No splash gate.

## Assets (ElevenLabs sound-generation → `public/audio/`)
| File | Action | Prompt direction | Loop | ~dur |
|---|---|---|---|---|
| `overworld.mp3` | regenerate | light whimsical orchestral fantasy, strings + flute + pizzicato, cozy adventure, gentle | yes | 20s |
| `title.mp3` | new | dreamy atmospheric, soft pads, shimmer/twinkles, wonder, slow, gentle | yes | 20s |
| `cleared.mp3` | new | short happy level-complete flourish, bright orchestral sparkle, not harsh | no | ~2.5s |

## Code changes
### `src/effects/music.ts`
- `TRACKS.title`: `'/audio/title.mp3'` (was `null`).
- `STINGERS`: add `cleared: '/audio/cleared.mp3'`.
- `StingerKind`: `'win' | 'lose' | 'cleared'`.

### `src/hooks/useAudio.ts`
- `setZone(zone: Zone | null)`. `null` → stop the loop (when unlocked, `music().setZone(null, 0)`); pre-gesture `null` arms nothing (`armedZone = null`, unlock skips null). `play`/`playStinger` unchanged; `'cleared'` flows through `playStinger` automatically.

### `src/App.tsx` — `zoneForScreen(key, isCheckpoint): Zone | null`
- `'evolution'` → `null` (stop music during the cinematic; overworld resumes after).
- `'reward'` → `null` (no overworld loop on level-cleared; the sting plays instead).
- `'egg'` → `'title'`; overworld screens (`pickDrill`/`petRoom`/`shop`/`gacha`/`collection`) → `'overworld'`; `'drill'` → `isCheckpoint ? 'boss' : 'drill'`. Unknown → `'overworld'`.
- The `CurrentScreen` mount effect calls `setZone(zone)` (now possibly `null`).

### Menu wiring (outside `App`)
- `src/components/menu/MainMenu.tsx`: mount effect → `useAudio().setZone('title')`. The first tap (tap-to-start) unlocks playback via the existing global gesture listener, so title music begins then and crossfades to `overworld` on game entry.
- `src/components/menu/IntroVideo.tsx`: mount effect → `useAudio().setZone(null)` so music doesn't clash with the intro video's own audio.

### `src/state/gameStore.ts` — `finishRound`
- `pendingStinger = wasBoss ? (stars >= 1 ? 'win' : 'lose') : 'cleared'` (non-boss was `null`). `RewardScreen` already consumes `pendingStinger` and plays it — no change there.

## Testing
- `zoneForScreen`: `evolution`→null, `reward`→null, plus existing branches.
- `music.ts`: `TRACKS.title` non-null, `STINGERS.cleared` present, `StingerKind` includes `'cleared'`.
- `useAudio.ts`: `setZone(null)` forwards a stop to the engine when unlocked; pre-gesture `null` arms nothing.
- `gameStore.finishRound`: non-boss lesson → `pendingStinger === 'cleared'`; boss unchanged.
- `MainMenu` mounts → `setZone('title')`; `IntroVideo` mounts → `setZone(null)` (via the `setMusicProvider` spy or a mocked `useAudio`, matching each file's existing convention).
- Maintain: full `vitest run` green, `tsc -b` clean, `npm run build` green.

## Out of scope
- title/multiplayer beyond the title track (multiplayer stays a null seam).
- Per-context distinct cleared/win/lose variants.
- Refining the win/lose/cleared star thresholds (existing `// TODO`).
