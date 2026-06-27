# Design — Game-wide Audio (SFX + Music + Mixer)

**Date:** 2026-06-27
**Status:** Approved for planning
**Scope:** Add sound across the whole game: a global SFX layer, a zone-based background-music system, a four-channel volume mixer with a settings surface, and routing of the existing TTS and evolution audio through the mixer.

## 1. Goals & non-goals

**Goals**
- A single, cohesive audio architecture mirroring the shipped `evolutionSound` pattern (provider seam, jsdom-silent fallback, lazy shared `AudioContext`).
- SFX on the core gameplay and economy moments that have none today.
- Zone-based background music (overworld / drill / boss / title), plus reserved seams for multiplayer and win/lose stingers.
- A four-channel mixer (Master / SFX / Music / Voice), each with a level slider and mute, plus a global "mute all", surfaced in a Settings sheet.
- Audio is an independent accessibility axis: it gates on the mixer only, **decoupled from `prefers-reduced-motion`** for the new layer.

**Non-goals**
- Sourcing/bundling final recorded assets is deferred. Phase 1 ships synth-only with zero assets; Phase 2 introduces music tracks. Recorded SFX clips are a later, seam-compatible upgrade.
- Multiplayer itself. Its music zone is a placeholder seam only.
- Per-context distinct win/lose tracks. Phase 2 ships shared `win`/`lose` stingers reused by boss and multiplayer.

## 2. Sound production strategy — Hybrid

All SFX are produced with synthesized Web Audio now, behind the same swappable provider seam as `evolutionSound`. Each named one-shot first checks for an optionally-registered recorded sample buffer and falls back to synth when none is registered. This means:
- Phase 1 ships with **zero audio assets** and zero bundle weight.
- Recorded "hero" clips (e.g. hatch, evolve, boss win) can be dropped in later by registering a buffer — no call-site or architecture change.

Background music is the exception: melodic loops sound poor as synth, so music is **always a recorded asset** (`HTMLAudioElement`), introduced in Phase 2.

## 3. Architecture

```
src/effects/sfx.ts        # NEW. Synth one-shots behind a provider seam (mirrors evolutionSound)
src/effects/music.ts      # NEW. Background-music loops + stingers (HTMLAudioElement), provider seam
src/audio/mixer.ts        # NEW. Pure gain math — no DOM, no audio
src/hooks/useAudio.ts     # NEW. Store-bound facade: play(name), setZone(zone), playStinger(kind)
src/config/audio.ts       # EXISTING. Voice/TTS seam — extended to apply the voice gate
src/effects/evolutionSound.ts  # EXISTING. Routed through SFX gain so mute-all silences it
```

### 3.1 `mixer.ts` (pure)
The testable core. No DOM or audio APIs — just math over the store's audio slice.

```ts
export type ChannelName = 'sfx' | 'music' | 'voice';
export type Channel = { level: number; muted: boolean };   // level in 0..1
export type AudioSettings = {
  master: Channel;
  sfx: Channel;
  music: Channel;
  voice: Channel;
  allMuted: boolean;
};

// Effective 0..1 gain for a channel given the full settings.
export function effectiveGain(channel: ChannelName, s: AudioSettings): number {
  if (s.allMuted) return 0;
  if (s.master.muted) return 0;
  const ch = s[channel];
  if (ch.muted) return 0;
  return s.master.level * ch.level;
}
```

Mute precedence: `allMuted` > `master.muted` > `channel.muted` > level product.

### 3.2 `sfx.ts` (synth one-shots, hybrid)
Mirrors `evolutionSound` structure exactly.

```ts
export type SfxName =
  | 'tap' | 'nav'
  | 'drop' | 'correct' | 'wrong'
  | 'coin' | 'purchase' | 'pull' | 'reveal' | 'feed'
  | 'coo';

export interface Sfx {
  play(name: SfxName, gain: number): void;  // gain is the pre-computed effective SFX gain (0..1)
  stop(): void;
}

export function getSfx(): Sfx;                       // provider() ?? createWebAudioSfx()
export function setSfxProvider(fn: (() => Sfx) | null): void;  // recorded clips or test spy
export function registerSample(name: SfxName, buffer: AudioBuffer): void;  // hybrid upgrade hook
```

- Silent no-op `Sfx` when there is no `AudioContext` (jsdom/unsupported), exactly like `evolutionSound`'s `silent`.
- Lazy shared `AudioContext`, `resume()` on use, `stop()` closes it.
- `play(name, gain)` early-returns when `gain <= 0`. When a sample is registered for `name`, plays the buffer at `gain`; otherwise plays the synth recipe at `gain`.
- Each synth recipe is a small oscillator/noise routine (see §5 for the per-event character).

### 3.3 `music.ts` (loops + stingers, recorded)
```ts
export type Zone = 'title' | 'overworld' | 'drill' | 'boss' | 'multiplayer';
export type StingerKind = 'win' | 'lose';

export interface Music {
  setZone(zone: Zone | null, gain: number): void;     // crossfade to the zone's loop; null stops
  setGain(gain: number): void;                         // live music-channel gain
  playStinger(kind: StingerKind, gain: number, onDone?: () => void): void;  // one-shot, no loop
  stop(): void;
}

export function getMusic(): Music;
export function setMusicProvider(fn: (() => Music) | null): void;
```

- Backed by `HTMLAudioElement` (`loop = true` for zone loops). Silent-guarded when `HTMLAudioElement`/audio is unavailable (jsdom) so tests never touch real audio.
- **Crossfade:** `setZone` to the *same* zone is a no-op (track keeps playing — this is what makes PetRoom↔Shop↔Journey navigation seamless). A *different* zone crossfades old→new over ~400ms via gain ramps.
- **Stingers** play once on the music channel (non-looping); on `ended` they invoke `onDone`, which the caller uses to resume the zone loop.
- **Autoplay policy:** the first track start is deferred until a user gesture. `useAudio` records that a gesture has occurred (any `play`/interaction) and only then permits music to start; until then `setZone` arms the desired zone and starts it on the first gesture.
- Track assets resolve from a static map (`src/assets/audio/*` or `public/audio/*`); `multiplayer` has no asset (placeholder) and `setZone('multiplayer')` is a guarded no-op until one is added.

### 3.4 `useAudio.ts` (store-bound facade)
The single seam components/actions call. Subscribes to the store's `audio` slice and computes effective gains via `mixer.effectiveGain`, then forwards to `sfx`/`music`.

```ts
function useAudio(): {
  play(name: SfxName): void;                 // applies effective SFX gain
  setZone(zone: Zone): void;                 // applies effective music gain + crossfade
  playStinger(kind: StingerKind): void;      // applies effective music gain
};
```

Voice routing: `src/config/audio.ts` / `useSpeech` set `SpeechSynthesisUtterance.volume` from the effective **voice** gain, and skip `speak` entirely when voice gain is 0.

## 4. Store & persistence

Replace the binary `soundEnabled` with the mixer slice.

**State**
- `audio: AudioSettings` (replaces `soundEnabled`). Defaults: each channel `{ level: 1, muted: false }`, `allMuted: false`.

**Actions**
- `setChannelLevel(ch: 'master' | ChannelName, v: number)` — clamp to 0..1.
- `toggleChannelMute(ch: 'master' | ChannelName)`.
- `toggleMuteAll()`.

**Persistence**
- Add `audio` to `PersistedState` (the `Pick`), `toPersisted` projection, and `partialize`.
- Bump `PERSIST_VERSION` from `10` to `11`.
- **v10→v11 migration:** backfill `audio` from the old field — `soundEnabled === false` ⇒ `allMuted: true` (else `false`); all channels default to full. Remove the `soundEnabled` field from the migrated state.
- Cloud-save: `audio` rides the existing persisted payload through `src/sync/mapping.ts`; extend mapping/reconcile tests for the new field.

**Back-compat:** full replacement (not keeping both fields). The in-cinematic 🔊 button in `EvolutionCinematic` repoints from `toggleSound` to `toggleMuteAll`.

## 5. Event → sound map

SFX channel unless noted. Each event has one chokepoint to wire (not per-call-site).

| Event | Channel | Chokepoint | Synth character (Phase 1) |
|---|---|---|---|
| Word tile drop | SFX | drop handler / `useRoundFeedback` | short soft click (triangle, ~40ms) |
| Drill **correct** | SFX | `useRoundFeedback.play('correct')` | rising 2-note chime (major 3rd) |
| Drill **wrong** | SFX | `useRoundFeedback.play('wrong')` | low descending buzz (sawtooth) |
| UI button press | SFX | `PressButton` | tiny tick, low gain, debounced |
| Screen nav | SFX | nav action / route change | soft filtered-noise whoosh |
| Gacha **pull** | SFX | Gacha pull action | anticipation riser |
| Gacha **reveal** | SFX | reveal (or reuse cinematic) | sparkle arpeggio |
| Shop **purchase** | SFX | shop buy action | coin cha-ching (2 pings) |
| Coins/stars land | SFX | reward / level-up | staggered coin blips |
| Feed pet | SFX | feed action | pitch-bent gulp blip |
| Egg idle coo | SFX (ambient) | egg screen interval | occasional soft coo |
| Word / Thai / sentence TTS | Voice | `useSpeech` (existing) | Web Speech, now gated by voice channel |
| Evolution strobe/flash/reveal | SFX | `evolutionSound` (existing) | existing synth, routed through SFX gain |

**Music** (Phase 2, see §3.3 zones):

| Zone / stinger | Trigger | Notes |
|---|---|---|
| Title loop | MainMenu mount | optional; may alias overworld, cuttable |
| Overworld loop | PetRoom / Shop / Journey / Collection mount | shared; no restart across these screens |
| Drill loop | enter normal lesson | |
| Boss loop | enter lesson where `isCheckpoint === true` | `LessonNode.isCheckpoint` exists today |
| Multiplayer loop | future PvP only | **placeholder** seam — no trigger, no asset |
| `win` / `lose` stinger | boss outcome (wired); multiplayer outcome (placeholder) | shared across both contexts; one-shot, then resume zone loop |

Anti-annoyance: UI `tap`/`nav` default to low gain; `tap` is debounced so rapid presses don't stack.

## 6. Settings surface

A new Settings bottom sheet (mobile-first, `max-w-md`), opened from a gear icon in the header.

- A **Mute all** toggle at the top.
- Four channel rows — **Master, SFX, Music, Voice** — each a level slider (0–100%) plus a mute toggle.
- Live preview: adjusting SFX plays a sample `tap`; Master/Music/Voice apply immediately.
- Accessible: slider + toggle have labels; focus-visible rings; operable by keyboard (per the project's a11y norms).

Polish/a11y of this surface to be handled with the `impeccable` skill during implementation.

## 7. Accessibility — reduced motion

The new audio layer gates on the mixer **only**, decoupled from `prefers-reduced-motion`: motion sensitivity and audio preference are independent axes. The existing `evolutionSound.soundAllowed(soundEnabled, reduced)` motion gate on the cinematic is left as-is for its motion-heavy context; new audio uses a sound-only gate (effective gain > 0). (A later cleanup could unify these, out of scope here.)

## 8. Testing strategy

jsdom has no `AudioContext` and no real audio for `HTMLAudioElement`, so both effect modules fall back to silent and tests assert *wiring*, not sound.

- **`mixer.ts`** — pure unit tests: gain product, clamping, and full mute precedence (`allMuted` > `master.muted` > channel mute > level).
- **`sfx.ts` / `music.ts`** — silent-fallback path returns a no-op; wiring verified by `vi.mock` with a `vi.hoisted` spy provider (the `EvolutionCinematic.test.tsx` pattern). Crossfade/same-zone-no-op logic tested against the spy.
- **Store** — mixer actions (`setChannelLevel` clamp, `toggleChannelMute`, `toggleMuteAll`) and the **v10→v11 migration** (`soundEnabled: false` ⇒ `allMuted: true`; field removed).
- **Components** — Settings sheet renders rows, slider/mute/mute-all dispatch the right actions; chokepoints (`PressButton`, `useRoundFeedback`, gacha/shop/feed/reward) call `play(name)` with the mocked provider; `EvolutionCinematic` 🔊 calls `toggleMuteAll`.
- **Sync** — extend `mapping`/`reconcile` tests to round-trip the `audio` field.
- Baseline to maintain: `npx vitest run` green, `npx tsc -b` clean, `npm run build` green.

## 9. Phasing

**Phase 1 — SFX + mixer (no assets, ships independently)**
1. `mixer.ts` (+ tests).
2. Store: `audio` slice, actions, persisted fields, `PERSIST_VERSION = 11` + v10→v11 migration (+ tests); sync mapping/reconcile updates.
3. `sfx.ts` synth one-shots + provider seam (+ silent-fallback test).
4. `useAudio.ts` facade.
5. Wire chokepoints: `PressButton`, `useRoundFeedback`, gacha/shop/feed/reward, egg coo; route `evolutionSound` and TTS through gains.
6. Settings bottom sheet + header gear; repoint cinematic 🔊 to `toggleMuteAll`.

**Phase 2 — Music system**
1. `music.ts` loops + stingers (HTMLAudioElement, crossfade, autoplay-gesture defer) + provider seam (+ tests).
2. Zone resolver (screen mounts declare zone; `isCheckpoint` ⇒ boss) and `useAudio.setZone` / `playStinger` wiring.
3. Source 3–4 CC0/licensed loops (overworld, drill, boss, optional title) + `win`/`lose` stingers into the asset map; music slider goes live.
4. Reserve `multiplayer` zone seam (no asset/trigger).

## 10. Open items / future
- Recorded "hero" SFX clips via `registerSample` (post-Phase 2 polish).
- Distinct per-context win/lose tracks (currently shared).
- Multiplayer music + its win/lose wiring (when multiplayer ships).
- Optional unification of `evolutionSound`'s reduced-motion gate with the sound-only gate.
