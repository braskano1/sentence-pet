# Design — Generational Pet Dex P4d: def-chain evolution (runtime `defId` transform)

**Date:** 2026-06-29
**Repo:** `sentence-pet` — checkout `D:/ai_projects/AI_design_thinking/sentence-pet`
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`; whole line promotes via PR #33).
**Predecessors:** P4a (dex tracking), P4b (gacha-over-dex), P4c (reward pets). Handoff: `docs/superpowers/plans/2026-06-28-generational-pet-dex-p4d-evolution-handoff.md`.

## Problem

Today a pet **grows visually** (art stage egg→baby→young→adult, driven by level) but its **identity** (`defId`) never changes — a Leaflet stays the Leaflet def at a later art stage. P4d makes a pet **become a different authored `PetDef`** when it evolves, so the dex chain reflects a real species transform and the evolved def's sprite/name apply.

## Two axes (do NOT conflate)

- **Art stage** (Axis 1, already works): `egg | baby | young | adult`, computed from level via `STAGE_LEVEL = { baby: 1, young: 16, adult: 36 }`. NOT a stored field — derived from `pet.xp` + `pet.hatched`.
- **Def-chain hop** (Axis 2, NEW): advance `pet.defId` along `evolvesToId` to a different `PetDef`.

P4d maps Axis 1 onto Axis 2: a stage-change event is what fires a def-chain hop.

## Decisions (locked in brainstorm)

### D1 — Trigger: piggyback on stage-change
A def-chain hop fires at the same moment the art stage bumps, **except hatch**:
- `egg → baby` (hatch): **no hop** — the stage-1 def IS the baby.
- `baby → young` (L16): **hop 1** (if active def has `evolvesToId`).
- `young → adult` (L36): **hop 2** (if active def has `evolvesToId`).

Guard: hop only when `stageChange && stageChange.from !== 'egg'`. Reads the stage-change event, not hardcoded level numbers — editing `STAGE_LEVEL` values does NOT touch P4d. Max 2 post-hatch hops → max 3-def chain. A def with no `evolvesToId` = plain art bump (today's behavior), no-op.

### D2 — Stats: multiply effective total, carry growth, gentle spike
A pet has two stored fields: `stats` (base roll, set at creation) + `growth` (+1 random/level). Effective = `stats + growth` (`petDisplay.ts:58`).

On a hop, multiply the **effective total** per stat by a random per-stat factor, fold the result back into the base field (keeps `growth` intact, never downgrades since factor ≥ 1):

```
factor   = 1 + roll(range)            // independent per stat (hp/atk/def/spd/luk)
newBase  = round( (stats + growth) * factor ) - growth
// displayed = newBase + growth = round( (stats+growth) * factor )
```

Per-stat factor range, chosen by **which hop fired** (NOT by authored `evolutionStage`):
- `stageChange.to === 'young'` → hop 1 → roll **+3%..+10%**
- `stageChange.to === 'adult'` → hop 2 → roll **+5%..+10%**

Compounded over both hops: ~ **+8% to +21%** total. Both ranges strictly positive — every evolution feels like a spike.

**Consequence (accepted):** the evolved def's `statBands` are NOT used for evolved pets — stats grow from the pet's current value. `statBands` still apply to pets that START as that def (gacha / reward). So two same-def pets can differ by origin: an *evolved* young-form = parent stats ×factor; a *freshly-obtained* one = `roll(def.statBands)`. This is intended — preserves each pet's individual variance instead of normalizing to a species baseline.

### D3 — Gacha gives stage-1 only
Random obtainable pool = chain **roots** only. A def is a root iff it has no `evolvesFromId` (reliable: `reconcileEvolution` always derives `evolvesFromId` on mid/final evos; single-stage defs are also roots).

Change `obtainablePool` to also require `!d.evolvesFromId`. This affects:
- **Random gacha** (`pullEgg`): roots only. ✓
- **Random boss-reward fallback** (`finishBoss`, no `rewardPetDefId`): roots only. ✓ consistent.
- **Authored `rewardPetDefId`** (`finishBoss`): UNCHANGED — bypasses the pool, so an author may deliberately grant any stage. Author intent preserved.

### D4 — Identity & art
On a hop the pet also gets `species = nextDef.element`. Required because `spriteSrc` only applies a def's art when `def.element === pet.species` (element-guard); without this the evolved art would not render. `name`, `xp`, `happiness`, `bars`, `id`, `rarity` all untouched.

### D5 — Dex record
At the hop site, `caughtDefIds = addCaught(caughtDefIds, evolvedDefId)` (mirror P4c grant). The chain overlay then lights up the evolved form.

### D6 — Persist
`defId`, `species`, `stats`, `growth` are all already persisted. **No new persisted field → no `PERSIST_VERSION` bump** (currently 17). Confirm during implementation; if any new persisted field is added, bump + migrate.

## Architecture

### New pure domain fn — `src/domain/evolution.ts`
```
evolvePetDef(pet: PetInstance, defs: readonly PetDef[], hop: EvoHop, rng: () => number): PetInstance
```
- `hop` carries which range to use (e.g. `'young' | 'adult'`, or pass `stageChange.to`).
- Resolve active def. If no `evolvesToId` → return `pet` unchanged (no-op).
- Resolve `nextDef = resolvePetDef(def.evolvesToId, defs)`.
- Return pet with: `defId = nextDef.id`, `species = nextDef.element`, `stats` = re-based per D2, everything else untouched.
- **Pure**: `defs` + `rng` passed in, no registry reach-in (P4b/P4c convention).
- Range table lives here as a constant (`HOP_RANGE = { young: [0.03, 0.10], adult: [0.05, 0.10] }`).

### Store hook — `src/state/gameStore.ts`
In `finishRound` and `finishBoss`, the same `set((s) => …)` block that builds `lastStageChange`:
- After `applyXp`, if `stageChange && stageChange.from !== 'egg'`, call `evolvePetDef` on the active pet using `getActivePetDefs()` snapshot + the same `rng`.
- The swap must land in-block **before** screen routes to `'evolution'`, so `EvolutionScreen` (reads `selectActivePet`) shows the evolved def.
- If the hop produced a different `defId`, union it into `caughtDefIds`.
- Compose cleanly with existing `lastLevelUp` / `lastStageChange` / `lastHatch` / `rewardHatch` routing (P4c added a `rewardHatch` hop before `evolution`).

### Gacha gate — `src/domain/petDef.ts`
`obtainablePool` filter becomes `d.enabled && d.gachaObtainable !== false && !d.evolvesFromId`. Floor fallback `[starterDef()]` unchanged (starter is a root).

## Edge cases / landmines

- **DexGrid visibility (VERIFY FIRST):** confirm DexGrid / dex silhouette logic (P4a) does NOT derive visibility from `obtainablePool`. If it does, the D3 root-filter would hide stage-2/3 from the dex — must decouple (dex shows all defs; gacha pool is a separate concept).
- **Cinematic "from" frame:** `EvolutionCinematic` renders from/to art using the active (post-swap) def, so the brief "from" frame shows the new def's lower stage. Acceptable. Optional polish (out of scope): pass the pre-swap def for the "from" frame.
- **Chain > 3 defs:** only 2 post-hatch hops exist, so a 4+ def chain can't fully express. Out of scope; optional `validatePetDefs` warning deferred.
- **Dangling `evolvesToId`:** `resolvePetDef` starter-fallback already guards; `validatePetDefs` already checks chain integrity. No new validation required.
- **`makePet` / swap must keep explicit `defId`** — never default from species (P4c trap).
- **Species mutation:** `species` is documented "immutable at creation" — evolution is the deliberate exception. Verify nothing else keys behavior on species-immutability (stats use `statBands`/rarity not species; dex keys on `defId`; sprite + name-fallback are the only species reads — both intended to change on evolve).

## Testing

- **Unit — `src/domain/evolution.test.ts` (new):** no-op when no `evolvesToId`; defId/species swap to nextDef; stats re-base math (effective = round(total×factor), growth preserved, never downgrades); per-hop range correctness with a seeded rng; dangling `evolvesToId` resolves via fallback.
- **Unit — `obtainablePool`:** roots only; mid/final evos excluded; floor fallback still returns starter.
- **Unit — gameStore:** `finishRound`/`finishBoss` advance `defId` on baby→young & young→adult, NOT on egg→baby (hatch); `caughtDefIds` unions the evolved def; authored `rewardPetDefId` still grants the exact def regardless of stage.
- **e2e — `e2e/p4d-evolution.spec.ts` (new):** hermetic inject-catalog + inject-bundle (template: `e2e/p4c-reward-pets.spec.ts`); author an evolution pair, drive to L16, assert the pet became the evolved def (sprite + dex chain lights next form). Cinematic auth-gate-skip like `boss.spec.ts` test B.
- **APPEND to existing test files** where a target already exists (subagent listings miss subdir tests — has clobbered tests before).

## Files touched

- `src/domain/evolution.ts` (new) + `src/domain/evolution.test.ts` (new)
- `src/domain/petDef.ts` (`obtainablePool` filter) + append to its test
- `src/state/gameStore.ts` (two hook sites) + append to `gameStore.test.ts`
- `e2e/p4d-evolution.spec.ts` (new)
- No authoring-UI change. No `PERSIST_VERSION` bump expected. Do NOT hand-edit `src/content/seed.ts` (regen via `npm run seed:export` only if seed changes — not expected here).

## Verify gate (every slice)

`npx vitest run`, `npx tsc -b` (NOT `--noEmit`), `npx vite build`. Windows worker-fork flake ("Worker exited unexpectedly") → re-run.

## Out of scope (deferred)

Firebase go-live / production (emulators only, by decision). Chain-length authoring warning. Cinematic "from"-frame polish. Course-level evolution preview in authoring UI.
