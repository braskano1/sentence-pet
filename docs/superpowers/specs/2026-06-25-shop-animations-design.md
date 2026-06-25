# Shop animations / interaction polish — design

**Date:** 2026-06-25
**Status:** approved, ready for plan
**Branch:** `shop-economy` (follow-up commit before the PR — same slice as the treats shop)

## Problem

The shipped `Shop.tsx` has zero animation: static `🪙 {coins}` text, plain buttons, no purchase feedback, no denial feedback. Buying feels dead. The project already has a reduced-motion-aware animation toolkit (`useCountUp`, framer-motion `motion`/`useAnimationControls`, `fireConfetti`/`buzz`, global `MotionConfig reducedMotion="user"`); the shop just doesn't use it.

## Goal

Make every shop interaction feel responsive, using existing patterns only. No store / persist / business-logic change — affordability stays in pure `canAfford`/`purchase`.

## Decisions (from brainstorming)

Five animated interactions:
- **A — Coin balance count-down:** displayed balance tweens on purchase via `useCountUp` (matches PetRoom).
- **B — Button tap squish:** `whileTap={{ scale: 0.95 }}` on tappable buttons.
- **C — Cards stagger-in:** treat cards fade/slide in on shop open, delayed by index.
- **D — Purchase juice:** on a successful buy — card scale-pop + a floating `+{happiness} 😊` label that drifts up and fades + `fireConfetti()` + `buzz()`.
- **E — Can't-afford denial:** tapping an unaffordable treat shakes the card + `buzzError()` (vibrate pattern), performs NO purchase and NO confetti.

Button model changes from 2 states to **3**:

| State | `disabled`? | Style | Tap result |
|---|---|---|---|
| Affordable (and not full) | no | amber (`bg-amber-500 text-white`) | buy: pop + `+N 😊` + confetti + `buzz()`; coins tick down |
| Can't afford (and not full) | **no** (tappable) | muted amber (`bg-amber-200 text-amber-800`) + "Not enough coins" | shake + `buzzError()`; no purchase, no confetti |
| Happiness full | **yes** | grey (`bg-slate-200 text-slate-400`) + "Already happy!" | — (disabled) |

Rationale: can't-afford must stay tappable so it can shake (disabled buttons don't fire `onClick`). Happiness-full is a global "come back later" state — greyed/disabled, not shaken per-treat. Muted-amber (not grey) signals "you can try" vs the grey "blocked".

This also gates confetti to successful purchases only, resolving the prior final-review note that `fireConfetti()` fired unconditionally in `onClick`.

## Components

### 1. `src/effects/celebrate.ts` — add `buzzError`
A distinct error haptic (short double-buzz), no-op where `navigator.vibrate` is unavailable. Mirrors existing `buzz`.

```ts
/** Distinct error haptic (double buzz); no-op on unsupported devices. */
export function buzzError(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([40, 30, 40]);
  }
}
```

### 2. `src/components/TreatCard.tsx` (new)
Extracted per-treat card. Owns its own `useAnimationControls` (for pop/shake) and floating-label state (so each card animates independently). One clear responsibility: render one treat in its correct state and play the right animation on tap.

Props:
```ts
interface TreatCardProps {
  item: ShopItem;
  coins: number;   // live store coins (for affordability)
  full: boolean;   // happiness at max
  index: number;   // for stagger delay
}
```

Behavior:
- `afford = canAfford(coins, item)` (pure import).
- `disabled = full` only.
- Render `motion.button`:
  - `initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}` (stagger-in, **C**).
  - `whileTap={!disabled ? { scale: 0.95 } : undefined}` (**B**).
  - `animate={controls}` for pop/shake (the controls drive a separate animation channel; combine with the enter animation by giving the outer element the enter props and using `controls` on the same `motion.button` — controls take over after mount).
  - className by state (amber / muted-amber / grey table above).
- `onClick` (only reachable when not `disabled`, i.e. not full):
  - if `afford`: call `useGameStore.getState().buyTreat(item)`, then `controls.start({ scale: [1, 1.08, 1], transition: { duration: 0.3 } })`, trigger floating `+{item.happiness} 😊` label, `fireConfetti()`, `buzz()`.
  - else (can't afford): `controls.start({ x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.4 } })`, `buzzError()`. No purchase.
- Floating label: a state flag + `AnimatePresence`; the `motion.span` animates `{ y: [-0, -28], opacity: [1, 0] }` then `onAnimationComplete` clears the flag (so it can replay on the next buy). Positioned absolutely over the card; card is `relative`.

Note on combining enter-animation + controls on one element: use the controls instance for the mount-in too — call `controls.start({ opacity: 1, y: 0 })` in a mount `useEffect` with `initial={{ opacity: 0, y: 12 }}`, OR keep the declarative `animate` for enter and use a nested `motion.div` carrying `controls` for pop/shake. **Plan will use a nested inner `motion.div` for pop/shake** to keep the enter animation declarative and avoid fighting over the `animate` prop. (Implementer: outer `motion.button` = enter + whileTap; inner wrapper `motion.div animate={controls}` = pop/shake.)

### 3. `src/components/Shop.tsx` — refactor to use `TreatCard` + count-up
- `const coins = useGameStore((s) => s.pet.coins);` (raw, for passing down).
- `const shownCoins = useCountUp(coins);` → render `🪙 {shownCoins}` in the header (**A**).
- `const happiness = useGameStore((s) => s.pet.happiness); const full = happiness >= GAME_CONFIG.happiness.max;`
- Map `GAME_CONFIG.shop.treats.map((item, index) => <TreatCard key={item.id} item={item} coins={coins} full={full} index={index} />)`.
- Remove the inline buy/disable/confetti logic (moves into `TreatCard`). Keep the Back button (add `whileTap` squish via `motion.button`, **B**).
- `setScreen` stays for Back.

## Data flow

`Shop` reads live `coins`/`happiness` → passes `coins`+`full` to each `TreatCard` → card computes `afford` with pure `canAfford` → tap branches buy-vs-deny → `buyTreat` (unchanged) updates store → `coins` selector re-renders → `useCountUp` tweens the header balance down, card re-evaluates `afford` (may flip to muted) on next render.

## Edge cases / constraints

- **Reduced motion:** global `MotionConfig reducedMotion="user"` (in `App.tsx`) auto-skips transform animations (pop/shake/squish/stagger). Count-up still runs (it's RAF state, not a transform) — acceptable, it's gentle. Confetti still fires.
- **Happiness-full + can't-afford simultaneously:** `full` wins → disabled/grey "Already happy!" (no shake). Per the table.
- **Repeated buys:** floating label must reset between buys (clear-on-complete) so it replays.
- **Disabled buttons never fire onClick** — happiness-full path needs no onClick guard, but `buyTreat` remains a defensive no-op anyway.

## Testing (render-only, jsdom-safe)

jsdom can't run framer-motion animations — never assert animated style values. Mock `canvas-confetti`.

- `src/components/TreatCard.test.tsx` (new):
  - Affordable card (coins ≥ price, not full): mounts, shows name/price/`+happiness`; clicking it spends coins (`coins` drops by price in store).
  - Can't-afford card (coins < price): mounts, shows "Not enough coins", is NOT disabled; clicking it leaves coins unchanged (no-op) and does not throw.
  - Happiness-full card: shows "Already happy!", is `disabled`.
  - Mock confetti.
- `src/components/Shop.test.tsx` (update): still renders title, 3 treats, Back; Back → petRoom; buying with coins spends. Adjust any selector that assumed `disabled` on unaffordable buttons (they're now tappable-muted, not disabled).
- `src/effects/celebrate.ts`: `buzzError` is trivial; cover via a unit test only if the existing `buzz` has one (mirror it) — otherwise no dedicated test (matches existing coverage level).

## Out of scope

- No store / persist / `gameConfig` / domain changes.
- No new sounds (haptics only, reusing the vibrate pattern).
- Happiness-bar animation on purchase — happiness bar lives on PetRoom (`StatBars` already animates); not shown in Shop.

## Docs

No `GAME_DESIGN.md` change needed (pure UI polish; the "Shop (treats shipped)" note already covers the feature).
