# Spec — Admin pet-def hydration fix (data-loss bug)

**Date:** 2026-06-28
**Repo:** `sentence-pet` — checkout `D:/ai_projects/AI_design_thinking/sentence-pet`.
**Branch:** `journey-redesign` (integration branch — commit here, do **NOT** merge to `main`).
**Discovered by:** the P3b sprite-upload Playwright smoke (`e2e/p3b-sprite-upload-smoke.spec.ts`). Upload + Save persisted correctly to Firestore, but a reload in the admin showed none of it — the admin Pets tab never loads the live catalog.

## Problem

The pet-def registry is the module variable `active` in `src/domain/petDef.ts`, defaulting to `BUILTIN_PET_DEFS` and only ever changed by `setActivePetDefs()`. `setActivePetDefs` is called in exactly two places:
- `src/main.tsx`, inside `if (!isAdmin) { … }` — the **player route only**.
- `src/content/load.ts` `hydratePetDefs()` — itself only invoked from that same player-only block.

So on the **admin route** (`/#admin`), `active` is never seeded from cache or hydrated from Firestore. `PetsTab` seeds its draft from `getActivePetDefs()` (= the 4 builtins) at mount. Consequences:

1. **Authored content is invisible.** Custom pets (P2b) and sprite overrides (P3a/P3b) saved to Firestore do not appear when the admin reopens the Pets tab. (Smoke diagnostic confirmed: the localStorage cache held the uploaded sprite while the editor showed none — proof the draft came from builtins, not the registry/cache.)
2. **Data-loss on Save.** Editing from that stale builtins draft and clicking the PetsTab Save calls `savePetDefs(reconciled)`, overwriting `content/petDefs` in Firestore with the builtins-derived set — **clobbering all previously authored pets.**

The course-authoring side avoids this only because `src/content/store.ts` self-seeds the zustand store from cache at module init (`cachedCourse() ?? SEED_COURSE`). Pet-defs have no equivalent self-seed.

This is pre-existing (since the P2b admin pet-authoring tab). Unit tests miss it because they mock `getActivePetDefs`/`setActivePetDefs`.

## Goal

The admin Pets tab must edit and save the **live** pet-def catalog, never the builtins-by-default. A Save must be impossible until the editor reflects live data, so a stale draft can never clobber the Firestore catalog.

## Locked decision (from brainstorm)

**Block until live load.** PetsTab fetches the live catalog on mount, shows a loading state, and gates the editor + Save until the fetch resolves (or definitively fails). Chosen over cache-then-refresh because the whole point is eliminating the clobber, and a fast Save on a stale/empty-cache machine must not be able to win the race.

## Design

### Part 1 — `src/main.tsx`: seed the registry from cache on both routes
Move the cache seed out of the player-only guard so the registry has a no-clobber baseline on every route:

```ts
const isAdmin = isAdminEntry(window.location.hash)

// Seed the pet-def registry from last-good cache on BOTH routes (instant, no-clobber baseline).
setActivePetDefs(cachedPetDefs() ?? [...BUILTIN_PET_DEFS])

if (!isAdmin) {
  void hydrateCourse('default')
  void hydratePetDefs() // player live-fetch; admin's live-fetch is owned by PetsTab (gates Save)
}
```

Player behavior is unchanged (it still seeds from cache then live-hydrates). Admin now at least starts from cache instead of builtins; the authoritative live fetch + Save-gate is Part 2.

### Part 2 — `src/components/admin/PetsTab.tsx`: block until live load
- Add `const [loaded, setLoaded] = useState(false);`.
- Add a mount effect that live-fetches, re-seeds, then unblocks:
  ```ts
  useEffect(() => {
    let cancelled = false;
    void hydratePetDefs().finally(() => {
      if (cancelled) return;
      setDraft([...getActivePetDefs()]);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);
  ```
  `hydratePetDefs()` performs the live fetch → `setActivePetDefs` + cache on success; on failure it swallows and keeps the current registry (cache/builtins). Either way `loaded` flips so the UI never hangs. `.finally` runs the re-seed for both outcomes.
- While `!loaded`: return a loading view, e.g. `return <p className="p-4 text-sm">loading pets…</p>;` — placed after the hooks so hook order is stable. This gates the entire editor (list, form, Save).
- The seed effect runs once on mount. PetsTab mounts fresh when the admin enters the Pets tab and there are no edits yet, so re-seeding the draft cannot discard in-progress edits.

**Import additions:** `useEffect` from `react`; `hydratePetDefs` from `../../content/load`; `getActivePetDefs` is already imported.

### Why this is clobber-safe
Save lives inside the `loaded` view, so it is unreachable until `hydratePetDefs()` has resolved or failed. By then the draft has been re-seeded from the live registry. A stale-builtins draft can never reach `savePetDefs`.

### Fresh-project edge
If `content/petDefs` does not exist, `fetchPetDefs()` returns `null`, `hydratePetDefs()` no-ops, the registry stays at cache/builtins, the draft seeds from builtins, and Save writes builtins — correct first-time catalog initialization, not a clobber (nothing to overwrite).

## Testing (TDD)

Mock `hydratePetDefs` (and the existing `savePetDefs`/`writePetDefsCache`) in `PetsTab.test.tsx`. Drive the registry via the real `setActivePetDefs`/`BUILTIN_PET_DEFS` as the existing tests already do.

New tests:
1. **Loading gate:** before `hydratePetDefs` resolves, "loading pets…" shows and no Add/Save/list is rendered. (Use a deferred mock promise.)
2. **Re-seed from live:** mock `hydratePetDefs` to `setActivePetDefs([...with a custom def carrying a sprite])` then resolve; after it resolves, that custom def/sprite appears in the editor and Save is enabled.
3. **Clobber guard:** Save is not reachable while loading (asserts the gate); after load, Save works (existing save behavior).
4. **Failure path:** `hydratePetDefs` rejects (or resolves without changing the registry) → still unblocks (`loaded`), editor renders from the current registry.

**Existing-test migration:** the loading gate changes PetsTab's initial render. Every existing `PetsTab` test must (a) have `hydratePetDefs` mocked to resolve immediately, and (b) `await` the first query (the list/buttons appear after the effect resolves). Convert synchronous `screen.getBy…` openers to `await screen.findBy…` (or an `await waitFor`), and a shared `open*`/render helper where it reduces churn. This is mechanical but spans the file (~36 tests).

`main.tsx` is the entry module and is not unit-tested; it is covered by the e2e smoke.

## Verification
- `npm test` (re-run on a Windows worker-fork crash — non-deterministic, not a real failure).
- `npx tsc -b` (type gate is `tsc -b`, NOT `--noEmit`).
- `npm run build`.
- Re-run the P3b sprite-upload smoke (`RUN_SPRITE_SMOKE=1`, emulators incl. storage + seeded admin): step 5 (reload → re-open admin → sprite persists) must now pass green.

## Out of scope
- Course-route live hydration on admin (course works via store self-seed; not part of this bug).
- Moving pet-defs into a reactive store (zustand) — larger refactor; the mount-effect gate is sufficient (YAGNI).
- The pre-existing non-functional `setDraft` in `PetsTab` `patch()` (separate concurrency follow-up).
- Any P3b feature change — P3b itself is verified working; this fixes the orthogonal admin-hydration bug it surfaced.
