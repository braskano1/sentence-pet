# Design — Sentence Pet Global Leaderboard (Cut 1)

Date: 2026-07-01
Branch: `leaderboard` (off `main`)
Status: approved in brainstorming; pending spec review → writing-plans.

## Context

Sentence Pet is a bright, playful English-learning creature-collector for kids / ESL
learners (React + Vite + Zustand + Firebase, framer-motion, vitest/TDD). Everything so
far runs **emulator-only** (Firebase go-live was deferred). This epic was framed as
"leaderboard + multiplayer + backend go-live". In brainstorming it was scoped down to a
**leaderboard-only Cut 1**; multiplayer becomes a separate later epic.

## Decisions (all settled in brainstorming)

1. **Scope:** leaderboard first; async PvP / multiplayer deferred to a later cut.
2. **Metrics:** originally three (Courses, Dex, Top-3 pet Power). The **Power board was
   cut** to stay on the free tier (see #6). Cut 1 ships **two boards: Courses + Dex**.
3. **Presentation:** three→two separate tabbed boards (`Courses | Dex`), not a composite.
4. **Scope of ranking:** **global**, top-N + a "your rank" row. No friends system.
5. **Reset cadence:** **all-time** now; entry schema carries `season:'all'` so a seasonal
   board can be layered on later with no migration.
6. **Trust model:** **rules-only, free (Spark) tier.** Firestore rules cannot iterate or
   sort the `pets` subcollection, so top-3 Power is impossible to verify in rules — that
   is why Power was cut. Dropping Cloud Functions means **no Blaze, no billing card**;
   the whole feature runs on the free Spark tier. Power is recoverable in a future cut
   (add Blaze + a recompute Function + the Power tab) with no rework of this work.
7. **Display name:** a new onboarding scene, **after intro egg hatch, before petRoom**,
   where the kid **types one name**, used both in-game (greeting) and as the public board
   name. This is the known-risky path (public typed name on a kids' app); mitigated by a
   sanitizer + admin moderation and recorded here as an **explicit accepted risk**.
8. **Board participation:** **opt-in, default ON**; a Settings toggle hides the player
   (deletes their entry).

## Architecture

### Data model

**Firestore (new):**
```
leaderboards/{metric}/entries/{uid}      // metric ∈ {courses, dex}
  { uid, name, score:int, season:'all', updatedAt:serverTimestamp }
```
- Top-50: `orderBy('score','desc').limit(50)`.
- Your rank: count-aggregation `where('score','>', myScore)` + 1 (cheap, free-tier ok).
- `season:'all'` reserved for the future seasonal cut.

**gameStore (new persisted fields), PERSIST_VERSION 18→19:**
- `displayName: string` (default `''`); migration backfills.
- `leaderboardOptIn: boolean` (default `true`).
- `coursesCount: number` — rules-checkable derived int kept in sync with
  `courseComplete` (count of `true` values). Dex needs no extra field: rules call
  `.size()` on `caughtDefIds` directly.

All three live in the already-synced `meta/profile` doc — **no new sync path**.
The profile doc is `Omit<PersistedState,'pets'>`, so new persisted fields flow to cloud
for free via the existing `toCloud`/`fromCloud` mapping.

### Name-entry onboarding scene + name safety

New screen `nameEntry`, inserted after intro egg hatch, before petRoom, in the
hatch→screen flow. Kid types one name.

`sanitizeName(raw): { ok, name, reason }` — pure, tested:
- NFKC-normalize, trim.
- Enforce length 2–16.
- Allowed charset only (letters + spaces; no control/emoji surrogate abuse).
- Reject: blocklist hits, digit-runs, URLs, emails.

Confirm button gated on `ok`; re-validate before every board write. Rules cap length
as a backstop (they cannot run the full sanitizer).

**Admin moderation hook:** admin can delete any leaderboard entry (nukes the public name;
the private in-game name survives). A full review queue is deferred.

### Write path (rules-only anti-cheat)

Client updates its own entry when the relevant thing changes:
- `addCaught` (dex board), course-complete (courses board), opt-in toggle.
- Opt-in OFF ⇒ delete the entry.

`firestore.rules` addition:
```
match /leaderboards/{metric}/entries/{uid} {
  allow read: if true;
  allow delete: if request.auth.uid == uid || isAdmin();
  allow write: if request.auth != null && request.auth.uid == uid
    && request.resource.data.name.size() <= 16
    && request.resource.data.score is int
    && request.resource.data.score >= 0
    && request.resource.data.score == ( metric == 'dex'
        ? get(/databases/$(database)/documents/users/$(uid)/meta/profile).data().caughtDefIds.size()
        : get(/databases/$(database)/documents/users/$(uid)/meta/profile).data().coursesCount );
}
```
One doc-read per publish — negligible. **Trust ceiling = the player's own profile**
(the client owns its game state; server does not validate catch/battle events — that
would be a large rearchitecture, out of scope). Mitigated by server-side sanity bounds
(dex ≤ catalog size, courses ≤ total) enforced where practical. This is an **accepted
risk** for a young, low-incentive-to-cheat audience.

### Read path + UI — `Leaderboard` screen

Reachable from a petRoom menu button. Tabs `Courses | Dex` (segmented, matching the
Dex / My Pets pattern). Each tab:
- Top-50 list: rank · name · score, own row highlighted.
- Sticky footer: **your rank**, shown even when outside the top-50.
- Empty / new-player state: friendly "climb by learning!" copy.

Amber / overworld visual language; reuse existing chrome. `impeccable` pass on this
screen during build. Top-50 is short — no PanViewport needed.

### Firebase go-live — "Phase 0"

Real **Spark** project: enable Auth (anon + email-link), Firestore, Storage; deploy
`firestore.rules` + `storage.rules`; seed content (pet-defs, courses) into the real
project; wire prod config. Emulator stays the dev path. Prerequisite ops work before any
board is live. Likely its own session (ops-heavy).

## Testing (TDD)

- Pure units: `sanitizeName`; score derivations; rank / tie logic.
- Rules tests (`test:rules`): reject mismatched score; reject cross-uid write; allow
  valid write; allow owner/admin delete.
- Store migration v18→v19 test.
- Component tests: `nameEntry` confirm gating; `Leaderboard` tabs / empty / your-rank.
- Ties: equal score ordered by `updatedAt` asc (earliest first); displayed as the same
  rank number.

## Phasing

- **P0** — Firebase go-live (Spark) + rules skeleton. (own session, ops-heavy)
- **P1** — Name-entry scene + `sanitizeName` + gameStore field/migration (v18→v19).
- **P2** — Write path + rules + `coursesCount` derived count + Settings opt-in toggle.
- **P3** — Leaderboard screen (read + your-rank) + `impeccable` UI pass.

## Out of scope (later cuts)

- Multiplayer / async PvP.
- Top-3 Power board (needs Blaze + a recompute Cloud Function).
- Friends-only boards; seasonal resets (schema is ready).
- Full name review-queue moderation.

## Accepted risks (explicit)

- **Public typed kids' name** — mitigated by `sanitizeName` + admin entry-delete, not
  eliminated. User's informed call.
- **Local-state tampering** — rules-only trust ceiling is the player's own profile;
  bounded by sanity clamps; low threat for the audience.
