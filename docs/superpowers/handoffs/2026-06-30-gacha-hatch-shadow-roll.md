# Handoff — Gacha hatch: roll a RANDOM baby silhouette (stop spoiling the pet)

**Date:** 2026-06-30
**Repo:** `sentence-pet` — `D:/ai_projects/AI_design_thinking/sentence-pet`. On `main` (`8a08c35`, in sync with origin). **Start this work on a NEW branch off `main`** (e.g. `gacha-hatch-shadow`).

## The bug

When a gacha egg hatches, the pre-reveal **silhouette/shadow is the shadow of the exact pet that will hatch** — it spoils the result. Desired: while the egg is "rolling", show a **random** shadow, and the shadow must only ever be a **baby-stage** silhouette. The real pet is revealed at the end as today.

## Root cause (verified)

`src/components/EvolutionCinematic.tsx` is a SHARED reveal animation (silhouette → strobe → flash → reveal). Its sprite source is always the **actual** pet:

```
// EvolutionCinematic.tsx:57-60
const revealed = phase === 'reveal' || phase === 'done';
const showNew = revealed || (phase === 'strobe' && swap);
const isSil   = phase === 'silhouette' || phase === 'strobe';
const src     = spriteSrc(species, showNew ? to : from, 'happy', def);  // ← species = the real pet
```

During `silhouette`/`strobe` (`isSil`), the `.evo-silhouette` CSS filter (`src/index.css`, `.evo-silhouette` = `brightness(0) invert(1) …`) darkens `src` — but `src` is built from the **real** `species` (and `def`, the real pet's custom art), so the shadow's outline gives the pet away.

## CRITICAL scoping nuance — do NOT break evolution

`EvolutionCinematic` has THREE callers:
- `src/components/Gacha.tsx:42` — `from="egg" to="baby" species={lastPull.species} def={pulledDef}` (HATCH — should be a mystery)
- `src/components/RewardHatchScreen.tsx:29` — `from="egg" to="baby" species={pet.species} def={…}` (HATCH — should be a mystery)
- `src/components/EvolutionScreen.tsx` — real evolution (you ALREADY know which pet is evolving; showing its real silhouette is correct/expected — like Pokémon "What? … is evolving!"). **Leave this path unchanged.**

So the fix must be **opt-in per caller**, not a global change. Add a prop to `EvolutionCinematic` (e.g. `mysterySilhouette?: boolean` or `randomBabyRoll?: boolean`); only the two HATCH callers pass it. Evolution keeps current behavior.

## Suggested fix shape

In `EvolutionCinematic`, when the new mystery prop is set:
- For the silhouette/strobe phases, build `src` from a **random baby-stage** sprite instead of the real pet: `spriteSrc(randomSpecies, 'baby', 'happy')` — **omit `def`** (passing the real pet's `def` would leak its custom art into the shadow).
- Random pool = the four elements: `SPECIES` from `src/domain/species.ts` (`['leaf','fire','air','water']`). A random baby element silhouette is enough mystery; no need to enumerate every PetDef.
- At `flash`/`reveal`, switch back to the REAL pet (`spriteSrc(species, to, 'happy', def)`) as today.
- "Rolling" feel: the title says *rolling* — prefer the random species to **change each strobe tick** (re-roll on each `swap` toggle) so it reads like a slot machine, rather than one fixed random held the whole time. Confirm with the user (see Open decisions).

Sprite/stage refs: `spriteSrc(species, stage, mood, def?)` in `src/config/sprites.ts`; `PetStage = 'egg' | 'baby' | 'young' | 'adult'` in `src/data/types.ts`. The dex's uncaught silhouette uses `filter: brightness(0)` (`src/components/DexGrid.tsx`) — same darkening idea, but the cinematic already has `.evo-silhouette`; reuse it.

Determinism for tests: `Math.random()` is fine in app code, but make the random species **injectable** (an optional `rng?: () => number` prop, or reuse `pickSpecies(rng)` from `src/domain/species.ts`) so a test can assert the rolled silhouette is (a) baby stage and (b) NOT necessarily the real species. `pickSpecies()` already exists and takes an injectable `rng`.

## Open decisions (resolve first)
1. **Roll style:** cycle a new random baby silhouette on every strobe tick (slot-machine "rolling"), or pick ONE random baby silhouette and hold it until the flash? (Recommend cycling — matches "rolling".)
2. **Avoid accidental match?** Should the random roll be allowed to land on the real pet's own species mid-roll (harmless, it's random) or explicitly exclude it? (Recommend allow; excluding is a tiny extra.)
3. **Prop name / surface:** `mysterySilhouette` on `EvolutionCinematic`, vs a dedicated `HatchCinematic` wrapper. (Recommend the prop — smallest, keeps one animation engine.)

## Files
- `src/components/EvolutionCinematic.tsx` — the fix (sprite-source selection + new prop). Lines 16-18 (props), 57-60 (src).
- `src/components/Gacha.tsx`, `src/components/RewardHatchScreen.tsx` — pass the new prop.
- `src/components/EvolutionScreen.tsx` — DO NOT touch (evolution path).
- `src/hooks/useEvolutionSequence.ts` — phase/`swap` state machine + `TIMINGS` (read-only context; `swap` is the per-tick toggle to hook the re-roll onto).
- `src/config/sprites.ts` (`spriteSrc`), `src/domain/species.ts` (`SPECIES`, `pickSpecies(rng)`), `src/index.css` (`.evo-silhouette`).
- Tests (APPEND, never clobber): `src/components/EvolutionCinematic.test.tsx`, `src/components/Gacha.test.tsx`, `src/components/RewardHatchScreen.test.tsx`. None test silhouette identity today — add one asserting that with the mystery prop, the rendered silhouette `src` during strobe is a BABY sprite and can differ from the real pet's, and that WITHOUT the prop (evolution) the real species is used (regression guard).

## Acceptance
- Gacha + reward hatch: during the roll the shadow is a random baby-stage silhouette that does not reveal the pet; the correct pet still reveals at the end.
- Evolution (`EvolutionScreen`) animation is unchanged.
- Full unit suite + `npx tsc -b` + `npx vite build` green. New tests cover the mystery-roll behavior and the evolution regression guard.

## Hazards
- Use the **Bash** tool with explicit `cd /d/ai_projects/AI_design_thinking/sentence-pet &&` (PowerShell-tool cwd resolves wrong + resets each call).
- Bash `@'...'@` is NOT a heredoc — `git commit -F- <<'EOF'`. `git merge` does NOT take `-F-` stdin (use a temp file `-F /tmp/x`).
- `npx tsc -b`, not `--noEmit`. Stage explicit files, never `git add -A`. APPEND to existing `*.test.*`.
- Promote with a `--no-ff` merge to `main` + push when green (matches the recent lines).

## Suggested skills
- `superpowers:brainstorming` — only to lock Open-decision #1/#2 with the user (quick; it's a small UX choice). Skip if the user just answers inline.
- `prototype` or `/run` + the e2e harness — to actually SEE the roll (the existing `e2e/templates-smoke.spec.ts` shows the hermetic-auth + screenshot pattern; `e2e/support/hermetic-auth.ts` stubs anon auth and walks the menu into the game where gacha lives).
- `superpowers:test-driven-development` — write the silhouette-identity test first (inject `rng`).
- `superpowers:requesting-code-review` — final review; verify evolution path untouched.
