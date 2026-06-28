# Design — Generational Pet Dex P3a: per-`PetDef` sprite override (URL-paste)

**Date:** 2026-06-28
**Repo:** `sentence-pet` — checkout at `D:/ai_projects/AI_design_thinking/sentence-pet` (NOT the H:\ Google-Drive copy, which holds design docs only).
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`).
**Epic spec:** `docs/superpowers/specs/2026-06-28-generational-pet-dex-design.md` (P3 = "Per-`PetDef` sprite upload").
**Handoff this derives from:** `docs/superpowers/plans/2026-06-28-generational-pet-dex-p3-sprite-upload-handoff.md`.
**Status:** designed, not implemented.

## Goal

Let an admin attach custom art to an individual `PetDef` that **overrides** the element-based built-in sprite. Today every creature of element `leaf` shares the 4-element art; this lets each authored creature carry its own sprite. Unblocks a real generational dex of visually distinct creatures (P2 shipped the structure; this is the art axis).

## Phase split

This is **P3a** — the resolver + UI + data, end-to-end, with **no Firebase Storage**. The admin supplies a sprite by **pasting a hosted image URL**.

- **P3a (this spec):** `PetDef` sprite field + validation + resolver override + `PetSprite` wiring + a URL-paste control in `PetForm` + tests. Fully shippable and testable: admin pastes a link → the game renders the custom art, and falls back to element art when cleared or the URL 404s.
- **P3b (separate, future handoff — OUT OF SCOPE here):** real Firebase Storage upload — `src/firebase/storage.ts` (`getStorage` + emulator connect), a Storage emulator block in `firebase.json`, `storage.rules` (admin-claim write), CORS config, and a file-picker replacing the paste field. The 6-slot `variants` authoring UI may also land in P3b.

Rationale: the hard, risky infra (Storage emulator + rules + CORS) is isolated into its own slice; the fun, verifiable part (per-creature art rendering in-game) ships and proves the idea first. Chosen over a single big-bang P3.

## Decisions (locked)

1. **Granularity (MVP):** one sprite per creature, used for **all** stages and moods. The egg is never overridable.
2. **Data shape is future-proofed for the 6-slot set**, but P3a surfaces only the single slot. No data migration when the 6-slot UI lands later.
3. **Mechanism:** paste a hosted `http(s)` URL now; real Storage upload deferred to P3b.
4. **Fallback chain (per stage×mood):** `variants[stage][mood] → default → element art`. Never blank.
5. **Egg:** always the generic egg sprite; `variants.egg` is **rejected** by validation (strict).

## Data shape

New optional field on `PetDef` (`src/data/types.ts`):

```ts
sprite?: {
  default?: string;                                                       // P3a UI writes here
  variants?: Partial<Record<PetStage, Partial<Record<PetMood, string>>>>; // reserved for P3b 6-slot
};
```

- **Optional** → `BUILTIN_PET_DEFS` (`src/domain/petDef.ts`) is untouched; builtins keep element art.
- **No `backfillPetDefs` change** (`src/content/petDefMigrate.ts`) — absent field is valid; no defaults wanted.
- **No `PERSIST_VERSION` bump.** `sprite` lives on `PetDef` (Firestore **content** `content/petDefs`, its own hydrate/backfill path), NOT the persisted game store (`PersistedState`, `PERSIST_VERSION = 16` at `src/state/gameStore.ts:109`). `PetInstance` gains no field — it already carries `defId` since P1.

## Validation

In `validatePetDefs` (`src/content/validate.ts`), same `{ ok, errors[] }` shape the admin surfaces in its `aria-live` error `<ul>`:

- If `sprite` present, every string in `default` and `variants[stage][mood]` must be a **non-empty, parseable `http(s)` URL** (use `new URL()` + protocol check). Bad/empty string → error.
- **`variants.egg` present → error** (strict; egg is never overridable).
- `sprite` absent, or present with no strings → valid (means "no override").

## Resolver + rendering

**Resolver** (`spriteSrc`, `src/config/sprites.ts:67`) gains an optional `def`:

```ts
function spriteSrc(species: Species, stage: PetStage, mood: PetMood, def?: PetDef): string {
  if (stage === 'egg') return EGG_SPRITE;                  // egg never overridable
  return def?.sprite?.variants?.[stage]?.[mood]
      ?? def?.sprite?.default
      ?? SPRITES[species][stage][mood];                    // element-art fallback
}
```

Existing 3-arg callers keep working (`def` undefined → pure element art).

**`PetSprite`** (`src/components/PetSprite.tsx`) gains an optional `defId?: string`:

- `const def = defId ? resolvePetDef(defId) : undefined;` (`resolvePetDef`, `src/domain/petDef.ts:57`, never null; undefined `defId` → undefined `def` → current element-art behavior).
- Render `spriteSrc(species, stage, mood, def)`.
- **Runtime image fallback:** an uploaded URL can 404 or be slow (static imports never do). `<img onError>` swaps to element art (`spriteSrc(species, stage, mood)` with no `def`). Track the errored `src` (ref/state keyed by `src`) so it does not loop or refetch every render. Never blank.

**Why `defId`, not `species`:** once multiple defs share an element (the point of the dex), `species` alone cannot select a def. The override must reach the resolver via `defId`.

**Consumers** thread `defId` where a `PetInstance` exists (PetRoom, Gacha result, EvolutionCinematic, reward/boss screens). Species-only previews omit `defId` → element art. One optional, default-safe prop.

## Upload UI (`PetForm`)

A **Sprites `<fieldset>`** in `src/components/admin/PetsTab.tsx` `PetForm`, mirroring the existing fieldsets (implicit `<label>`-wrap, accessible names, `aria-live` errors, immutable patch via `onPatch`):

- One **URL text input** → writes `sprite.default` via `onPatch` (`{ sprite: { ...draft.sprite, default: value } }`). Empty input clears the override (drop `sprite`/unset `default` so "cleared" = no override).
- **Thumbnail preview** of the current `default` (alt e.g. `${name} custom sprite preview`); `onError` hides/placeholders it — never a broken `<img>`.
- **Clear** button removes `default`.
- The existing PetForm validate gate blocks Save on a bad URL via the existing error `<ul>`.
- **Accessible** (apply `accessibility` skill at build): named input, named button, error announced via existing `aria-live`, keyboard-operable.

**Save path unchanged:** `default` rides in the draft → `savePetDefs` → `setActivePetDefs` + `writePetDefsCache` (registry swap **after** save), exactly like every other `PetDef` field.

## Testing

Mirror `PetsTab.test.tsx` mock conventions (`savePetDefs`/`useAuth` mocked):

- **Resolver:** variant → default → element fallback; egg ignores any override.
- **Validate:** bad URL → error; `variants.egg` → error; absent/empty → valid.
- **PetForm:** typing a URL writes `sprite.default` into the draft; Save persists; Clear removes it; bad URL blocks Save.
- **PetSprite:** `onError` falls back to element art.

## Out of scope

- **All Firebase Storage** (`getStorage`, `src/firebase/storage.ts`, `firebase.json` Storage block, `storage.rules`, emulator CORS) → P3b.
- The **6-slot `variants` authoring UI** → P3b (the data shape already holds it; no migration needed).
- Gacha pool over the dex; dex tracking (seen/caught); obtainability; course/boss `rewardPetDefId`; evolution execution. (Epic P4+.)

## Landmines / heads-ups

- **`firebase.json` is dirty-by-design** (intentional unstaged `host: 0.0.0.0` diff). P3a does **not** touch it (no Storage). **Stage explicit files only — never `git add -A`** (concurrent sessions).
- **`src/content/seed.ts` is generated** (`npm run seed:export`); do not hand-edit.
- **Never-blank invariant:** every (stage, mood) the game can render must resolve to something — guaranteed by the resolver's element-art tail and `PetSprite`'s `onError` fallback.

## Verify gates

`npm test`, `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`), `npm run build`. Manual smoke against the emulator: `/#admin` → dev sign-in → Pets tab → open a def → paste a sprite URL → save → reload persists → the game renders the pasted art (and falls back to element art when cleared or on a 404).

## Suggested skills (implementation)

- `superpowers:writing-plans` → `superpowers:subagent-driven-development` — per-task, two-stage review (spec then quality) + final whole-feature review (the P2a/P2b cadence).
- `accessibility` — the URL-paste control (accessible name, error/loading via `aria-live`, keyboard-operable, thumbnail alt).
