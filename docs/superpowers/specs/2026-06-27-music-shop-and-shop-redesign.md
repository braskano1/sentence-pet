# Design — Buyable music tracks + Shop UX/UI redesign

**Date:** 2026-06-27
**Status:** Approved for implementation
**Builds on:** the Phase 2 music system + the music polish pass. Adds an economy of equippable overworld music tracks and reworks the Shop surface.

## Part 1 — Buyable music tracks (economy)

Mirrors the existing decor/background economy (`owned[]`, `activeBackground`, pure `buyDecor`, `DecorCard` Buy/Equip state machine).

### Tracks
The 8 audition demos resolve to: keep all except #3 (storybook, dropped). #1 (cute orchestral) becomes the **free default** overworld loop. The other 6 are **buyable @ 150 coins each**.

| id | name | file | source demo |
|---|---|---|---|
| (default, null) | Cozy Theme | `public/audio/overworld.mp3` | 1-cute-orchestral |
| `music:lofi` | Lo-Fi Lounge | `public/audio/tracks/lofi.mp3` | 2-lofi |
| `music:jazz` | Jazz Café | `public/audio/tracks/jazz.mp3` | 4-jazz |
| `music:arcade` | Arcade Pop | `public/audio/tracks/arcade.mp3` | 5-chiptune |
| `music:musicbox` | Music Box | `public/audio/tracks/musicbox.mp3` | 6-musicbox |
| `music:celtic` | Celtic Trail | `public/audio/tracks/celtic.mp3` | 7-celtic |
| `music:bossa` | Sunny Bossa | `public/audio/tracks/bossa.mp3` | 8-bossa |

The default is pre-owned and equippable (to revert); `activeTrack === null` means the default.

### Data (`src/domain/shop.ts`)
- `ShopItemKind`: add `'music'`.
- `MusicTrackItem extends ShopItemBase { kind: 'music'; src: string }`. Add to the `ShopItem` union.
- Catalog `GAME_CONFIG.shop.music: MusicTrackItem[]` — the 6 buyable tracks above.

### Purchase domain
Generalize the decor purchase into a pure `buyOwnable(state: {coins, owned}, item: {id, price}): { ok, coins, owned } | { ok:false, reason }` (already exactly what `buyDecor` does). `buyDecor` and a new `buyMusic` both delegate to it (keep `buyDecor`'s signature/tests green). Pure `overworldTrackUrl(activeTrack: string | null, catalog: MusicTrackItem[]): string` → the active track's `src`, else `/audio/overworld.mp3`.

### Store (`src/state/gameStore.ts`)
- Reuse `owned[]` for purchased track ids.
- New `activeTrack: string | null` (null = default), persisted (add to `PersistedState`, `selectPersisted`, migration default `null`); bump `PERSIST_VERSION` 11 → 12.
- Actions: `buyMusic(item)` (delegates to `buyOwnable`, plays `purchase` SFX at the call site like decor) and `equipTrack(id: string | null)`.

### Engine (`src/effects/music.ts`)
- Add `setTrack(zone: Zone, url: string)` to the `Music` interface + impl: store a per-instance URL override (`Partial<Record<Zone,string>>`); URL resolution becomes `override ?? TRACKS[zone]`. If `zone === currentZone` **and** the resolved url differs from the playing element's url, crossfade to the new url (live track swap); if url is unchanged, no-op (don't restart). The silent/jsdom guard and same-zone navigation no-op are preserved. The null/silent `Music` gets a no-op `setTrack`.

### Facade (`src/hooks/useAudio.ts`)
- `setZone('overworld')` first resolves the active track url from the store (`overworldTrackUrl(activeTrack, GAME_CONFIG.shop.music)`) and pushes `music().setTrack('overworld', url)` before the `setZone` call, so the right loop plays.
- A store subscription on `activeTrack` (alongside the gain subscription) calls `music().setTrack('overworld', url)` so equipping a new track while in the petroom live-swaps the loop.
- New facade method `previewTrack(src: string)`: plays a track as a one-shot preview through the **music** channel at the effective music gain (so the Settings Music slider/mute governs it). Reuses the stinger primitive or a dedicated preview element; pauses any in-flight preview when a new one starts or on unmount. (Engine: add a small `preview(url, gain)` / reuse `playStinger`-style one-shot that does not loop and does not disturb the zone loop. Simplest: a dedicated non-looping element managed by the engine, `previewTrack(url, gain)` + `stopPreview()`.)

## Part 2 — Shop UX/UI redesign (impeccable)

Approved live mock: `public/shop-redesign.html`. Implement that design in React.

### Shell (`src/components/Shop.tsx`)
Replace the single `flex h-full flex-col p-6` column (which lets Back drift off-screen on overflow) with a **3-zone grid**: `grid h-full grid-rows-[auto_1fr_auto]`.
- **Sticky header** (row auto): "Shop" title + a coins pill (🪙 + `tabular-nums`), then the tab bar as a segmented control inside `bg-amber-100/70 p-1` (Treats / Decor / Music), active tab `bg-white shadow-sm`. Keep the existing `role=tablist` + arrow-key roving-tabindex a11y.
- **Scroll zone** (row `1fr`, `overflow-y-auto`): the active tab panel. `min-h-0` so it actually scrolls.
- **Sticky footer** (row auto): the Back button, full-width, pinned. Always visible.

### Treats tab — "Portion cards" (style 1)
Per-treat horizontal card: a food emoji in a tinted circle that grows by tier (Snack `h-12`/`text-3xl` → Treat `h-14`/`text-4xl` → Feast `h-16`/`text-5xl`), tier ring color (lime/amber/orange), name + portion descriptor, a happiness meter bar (current happiness fill) with `+N 😊` gain label, and a coin Buy button. Preserve the existing buy behaviour (confetti, buzz, float `+N`, shake-on-can't-afford, disabled when happiness full). Add per-treat fields to the config or a presentational map (emoji, portion, tier color) — keep `TreatItem` domain type clean; UI-only metadata can live in a component-level map keyed by id.

### Decor tab
Keep the 2-col grid + real room webp sprites; restyle the card to match the new system (white card, `ring-amber-100`, active → `ring-emerald-300` + ACTIVE badge). No behavioural change.

### Music tab — `MusicCard` (layout B)
New `src/components/MusicCard.tsx`: playlist row — gradient genre tile (emoji), ▶ preview button (calls `previewTrack`), name + genre, and the Buy🪙150 / Equip / Equipped action (same state machine as `DecorCard`, driven by `isOwned(owned, id)` + `activeTrack === id`). Equipped row gets `ring-emerald-300`. The default "Cozy Theme" card shows as owned/equippable. Per-track presentational metadata (emoji, gradient, genre label) lives in a map keyed by id.

### Accessibility / craft
- Contrast: body text `slate-600/700` on white/amber-50 (≥4.5:1). Price/muted text not lighter than `slate-500`.
- Buttons: verb + object accessible names (`Buy Lo-Fi Lounge`, `Equip Jazz Café`, `Preview Arcade Pop`).
- Motion: existing stagger-in; preview/equip transitions subtle; honor `prefers-reduced-motion`.
- Keyboard: tab roving-tabindex retained; ▶ and action buttons focusable with visible focus rings.

## Testing
- Domain: `buyOwnable` (already-owned / insufficient / ok), `buyMusic` delegate, `overworldTrackUrl` (default + equipped).
- Store: `buyMusic` adds to `owned` + spends coins; `equipTrack` sets/clears `activeTrack`; persistence round-trip incl. `activeTrack`; v11→v12 migration default `null`.
- Engine: `setTrack` override + live crossfade when current + same-url no-op + silent no-op; `previewTrack`/`stopPreview` no-throw + don't disturb the zone loop.
- Facade: `setZone('overworld')` pushes the active track url; `activeTrack` change live-swaps; `previewTrack` plays at effective music gain (0 when muted).
- Components: `MusicCard` Buy/Equip/Equipped + preview; Treats portion cards render tiers + buy behaviour intact; Shop 3-tab + sticky shell; Decor unchanged behaviour.
- Maintain: full `vitest run` green, `tsc -b` clean, `npm run build` green.

## Cleanup
- Move demos to final locations (table above); delete `public/demo/`, `public/overworld-demo.html`, `public/shop-music-mockup.html`, `public/shop-redesign.html` after implementation.

## Out of scope
- Theming drill/boss/title per purchase (only overworld is swappable now; `setTrack` is general enough for later).
- Track bundles/sales, gifting, per-track rarity.
