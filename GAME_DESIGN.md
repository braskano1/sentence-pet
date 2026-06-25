# Sentence Pet — Game Design Doc

A Tamagotchi-style English sentence-builder game for Thai M.4 students (~15–16 yo, pre-A1 English). Build sentences from parts of speech to feed and grow a virtual pet.

Status: design in progress (grilling session). Decisions below are locked unless marked OPEN.

---

## 1. Audience & platform
- **Users:** Thai Mattayom 4 students, solo, self-paced. Pre-A1 English level.
- **Tone trap:** kids are 15–16 → UI must look teen/cool, NOT babyish. Content English is very basic; presentation is not.
- **Platform:** Web app, browser, kid uses alone (no teacher loop in core).

## 2. Core mechanic
- **Slot-fill, drag-to-place.** Sentence shows labeled empty POS slots `[Noun][Verb][Noun]`. **Drag** a word tile from the tray onto its slot; **tap** a filled slot to clear it. (Was tap-to-place pre Phase-2; converted to drag via @dnd-kit.)
- **Pattern ladder:** preset patterns easy→hard: `S+V` → `S+V+O` → `S+V+O+place`, etc. Kid progresses up the ladder.

## 3. Modes (information architecture)
Home → pick a mode:
- **Free Play** — sandbox, any grammatically-valid combo passes (even silly). Low pressure.
- **Skill Drills** (targeted; prompt = picture + Thai hint):
  1. **Pattern drill** — word order / build the pattern
  2. **Word-Choice drill** — pick the right word among distractors
  3. **Grammar drill** — agreement / articles / plurals
- **Mixed Mode** — all three skills at once (the "boss" practice).

## 4. Difficulty — three dials
Practiced **separately** (each drill = one dial) + combined in Mixed mode:
1. **Pattern complexity** — `S+V` → longer patterns
2. **Distractor count** — 0 → several plausible wrong words (Word-Choice drill)
3. **Grammar strictness** — early: *accept but gently flag* ("tip: cat eats") → later: *enforce* agreement/articles/plurals

Each drill scales its own level 1..N. Mixed pulls from all.

## 5. Correctness engine
- **Code checks** POS-slot + word-order deterministically (data knows each word's POS).
- **AI (Anthropic) only for hints** and match-mode meaning, **in Thai** (kid is pre-A1).
- Avoid AI call per tap → fast, cheap, predictable.
- **Free Play check:** any correct-POS word in correct slot = pass. Agreement gently flagged early, enforced at higher levels.

## 6. THE GAME SYSTEM — Sentence Pet (Tamagotchi core)
The pet IS the game. Practicing = caring for the pet.

### Stats
- 🍖 Hunger · 😊 Happiness · ⚡ Energy · ❤️ Health (Health drops if others ignored; rises with balance).

### Balanced-diet hook (ties care loop to learning breadth)
Each drill yields a different food group → pet needs ALL to stay healthy:
- Pattern drill → 🥩 protein
- Word-Choice drill → 🥦 veggies
- Grammar drill → 💊 vitamins
- Mixed mode → 🍰 treat
Skipping a skill for a while → pet deficient/sad → nudges kid to practice that skill.

### Stakes & decay
- **Gets sick, never dies.** Neglect → sad/sick, slows growth, always recoverable. School-safe.
- **Session-based decay only.** Stats change only while playing — no real-time clock, no guilt, no weekend punishment.
- Consequence: retention must come from **progress + evolution + collection**, not decay pressure.

### Pets
- **Real animals.** One main bonded pet to start (classic Tamagotchi feel) + **unlock more species** as kid clears worlds / via shop.
- Evolution = animal growth (puppy → dog). New unlocks = new species.
- **Pet art = pre-made sprite set** per species × growth stage (NOT per-kid AI-generated — real animals hard to keep consistent across generations). OpenAI images are for sentence-prompt **scenes only**, not the pet.

### Growth
- **XP total drives evolution** (baby → child → teen → adult forms). Pet's body = visible proof of English progress.
- XP **weighted by difficulty** so grinding easy items can't cheese evolution. (note)

### Core loop (feeding)
1. Build correct sentence → **drops a food item** (type = drill) + **coins** + XP.
2. Kid goes to pet, **feeds manually**, sees reaction/animation.
3. Spend coins in shop.
Separates "learn" from "care"; adds economy depth.

## 7. Economy
- **Food items** (4 types from 4 drills) — feed stats.
- **Coins** — shop currency.
- **XP** — passive growth, weighted by difficulty (not spendable).

### Shop sells
- Room / habitat decor (furniture, backgrounds)
- Special foods / treats (bigger boosts)
- New pet unlocks (hatch/buy species)
- (Cosmetics REMOVED — pets are real animals.)

## 8. Architecture — Netlify + Firebase (serverless)
SQLite + Express DROPPED (don't fit serverless / file persistence). Replaced by Firebase BaaS.

| Concern | Choice |
|---|---|
| Frontend | **React + Vite + Tailwind**, hosted on **Netlify** (static) |
| Auth | **Firebase Auth** (handles security; **admin = custom claim**) |
| DB | **Firestore** (NoSQL docs) |
| AI proxy (holds keys) | **Cloud Functions for Firebase** (Node) — calls Anthropic + OpenAI server-side |
| Image cache | **Firebase Storage** |

### AI providers
- **Anthropic:** word banks, target sentences, Thai hints/feedback.
- **OpenAI:** scene images for picture prompts (pre-generated + cached in Storage).
- Keys live ONLY in Cloud Functions env, never in the client.

### Firestore data model (collections)
- `users/{uid}` — profile, role.
- `users/{uid}/pet` — pet state, stats/bars, XP, stage, inventory, coins.
- `users/{uid}/progress` — levels cleared, stars.
- `content/{itemId}` — cached AI drill items (sentence, Thai, image URL, status).
- `reviewQueue/{id}` — AI words/items pending admin approval before serving pre-A1.

### Firebase notes / flags
- **Blaze (pay-as-you-go) plan REQUIRED** — Cloud Functions need it to make outbound calls to Anthropic/OpenAI (free Spark plan blocks external network).
- Firestore is **NoSQL** — model as documents/collections, not relational joins.
- Firebase Auth covers minor-account security; still confirm **Thai PDPA consent** copy at signup. FLAG.

### Accounts
- Roles: **student + admin (you)**. Admin (custom claim) reviews AI word queue + curates themes.

### MVP deploy
- MVP is **frontend-only** (localStorage, no AI/accounts) → **Netlify alone**, no Firebase yet. Firebase enters at the AI/accounts phase.

## 9. Screens (Pet Room is the hub)
- **Pet Room** (home) — pet + stats, feed here, entry to all. Pet always center → reinforces bond.
- **Play** — pick mode (Free Play / 3 drills / Mixed) → drill screen → reward.
- **Shop** — coins → decor / treats / pet unlocks.
- **Collection** — pets owned + evolution gallery.
- (World/level map = post-MVP, optional.)

## 9a. Layout & responsive — LOCKED (mobile-first)
Strategy: **responsive Tailwind, phone-prioritized** (works phone→desktop, phone is the design target). Decisions:

1. **App shell:** every screen fills the viewport at `100dvh` (use `dvh`, not `vh`, so mobile browser chrome never clips). No per-screen page scroll.
2. **Max width:** app capped to a phone-ish column (`max-w-md` ≈ 448px), centered. On wider screens the column is framed by an ambient outer backdrop ("phone on a stand"). No separate desktop layout for MVP.
3. **Single shell component (`AppShell.tsx`):** owns `100dvh` + `max-w-md` + safe-area padding + portrait nudge + outer/inner bg seam. Screens render inner content only — they do NOT set their own `min-h-screen`.
4. **Screen zones:** drill & PetRoom use fixed three-zone flex columns — top (header/hint or pet+stats), middle `flex-1` (slots / pet), **bottom pinned** (word tray / action buttons) so the primary tap targets sit in the thumb arc and never clip.
5. **Touch targets:** every interactive element ≥ 48px (`min-h-12`) — meets iOS 44 / Android 48 minimums; prevents mistaps that would count as false "mistakes" against stars.
6. **Orientation:** portrait-locked by design; landscape shows a "rotate your phone" nudge overlay (CSS, in AppShell). No landscape layout for MVP.
7. **Fluid pet sprite:** sized with `clamp` (e.g. `text-[clamp(4rem,18vh,8rem)]`) so it shrinks on short phones and the Play CTA never gets pushed off-screen.
8. **Safe-area insets:** AppShell pads `env(safe-area-inset-*)`; `index.html` viewport meta uses `viewport-fit=cover`. Bottom-pinned targets clear the notch / home indicator.
9. **Two background layers:** ambient **outer** backdrop (body) + per-screen **inner** tint (the column). Partner's painterly room bg later drops into the **inner** layer via the asset-loader; outer stays ambient. Clean swap seam.
10. **Sentence display:** tile/answer **data is lowercase** natural mid-sentence form (`he`, `she`, `they`, `rice` — but `I` and acronyms like `TV` keep their natural form). A `renderSentence` / `capitalizeFirst` display helper capitalizes the first word and appends a period in the view only (per §10). Answer-check stays exact on raw tokens.

## 10. Session & onboarding
- **Round shape:** 5 sentences = 1 round → earn a food bundle + coins → feed pet. Tight, fast dopamine, fits pre-A1 attention.
- **Onboarding:** kid builds ONE easy sentence → **egg hatches** into starter pet. Instant win + bond before any pressure; teaches mechanic by doing.
- **Match-mode normalization:** drag-tiles only (no typing); tap a filled slot to clear → correct = placed tiles equal target sequence; first word auto-capitalized, period auto-added. No fuzzy parsing.

## 11. MVP — tracer bullet (build first)
Vertical slice, end-to-end, proves the core loop:
- 1 drill (**Pattern**), deterministic code check
- **hardcoded** word bank (NO AI yet)
- earn 1 food → feed 1 pet → pet reacts → 1 evolution
- egg-hatch onboarding
- NO shop, NO accounts, NO AI, NO images yet
Then layer: more drills → AI word banks/hints → images → economy/shop → accounts/admin.

## 12. Numbers / tuning

### Pattern ladder (5 rungs)
- L1 `S+V` — *I run*
- L2 `S+V+O` — *I eat rice*
- L3 `S+V+Adj+O` — *I eat hot rice*
- L4 `+place` — *I eat rice at home*
- L5 `+time` — *I eat rice at home every day*

### Level matrix (4 drills × 5 levels = 20)
Each drill uses the 5 rungs as the sentence frame; only its own dial ramps L1→L5.
| Drill | What ramps |
|---|---|
| Pattern | the 5 rungs; no distractors; lenient grammar |
| Word-Choice | rungs; distractors 0 → several |
| Grammar | rungs; strictness *flag* → *enforce* |
| Mixed | rungs; all dials on |

> **Grammar dial (shipped):** realised as a per-item `strictness: 'flag' | 'enforce'`. L1 = flag (near-miss subject–verb agreement is accepted: food drops + gentle Thai tip + one-star dock); L2 = enforce (near-miss rejected → retry). Engine: `src/domain/grade.ts` `gradePlacement`. In-app only L1 is reachable until level-select lands; L2 is authored + unit-tested.

> **Mixed (shipped):** the "boss" — all three dials on per item. L1 = S+V+O frame + 1 distractor (Word-Choice dial) + 1 subject–verb agreement trap (Grammar dial), graded **enforce** (near-miss & distractor reject → retry; no soft-accept). Yields 🍰 treat, making the 4th nutrition bar live. Pure-data slice — reuses `gradePlacement`/`trayWords`, no new engine. L1 (5 items) playable now; L2–L5 await level-select.

### Pass & stars
- **Clear a level = 5/5 correct** (retry within the round until all 5 right).
- **Stars measure hints + mistakes used:** 3⭐ = no hints + no wrong taps; fewer stars as hints/errors accrue. Replay for 3⭐ = mastery hook.

### Pet stat model (final)
- **4 nutrition bars**: protein (Pattern drill), veggie (Word-Choice), vitamin (Grammar), treat (Mixed). Each 0–100.
- **Health (displayed) = min(4 bars)** → hard balance enforcement: neglect any one drill → its bar empties → Health sinks regardless of the others. Forces practicing all skills.
- **Happiness** (0–100), separate meter, from treats / level clears / 3⭐ / story.
- Hunger & Energy dropped (subsumed by bars).
- **Evolution: 4 stages** (Egg→Baby→Young→Adult). Full-grown ≈ clearing all 20 levels once.

### Economy / loop rhythm
Play round → pet "tires" (bars decay) → feed earned food → play next.
- A round of one drill yields food for **only that drill's group** → must **rotate drills** to keep all 4 bars up (= the balanced-diet hook, enforced by `Health = min`).

### Config defaults (locked starting values — put in one tunable config table, adjust in playtest)
```
Bars (protein/veg/vitamin/treat): 0–100, start 60, −5 per round played
Food:           1 item = +15 to its bar  (5-correct round = +75 to that group)
Happiness:      0–100, −5/round; +10 on level clear; +5 per 3⭐; + treats
Health:         = min(4 bars)   [display only]
Pass:           5/5 correct to clear a level (retry within round)
Stars:          3⭐ = no hints + no wrong taps; dock per hint/error
Coins:          10 + 5×stars   (3⭐ = 25)
XP:             10 × level (L1=10 … L5=50); evolve at hatch / 1000 / 2000 / 3000
Shop:           treat 15 · decor 50–150 · new pet 300
```

## 13. Still OPEN (build)
- Tech scaffold layout (monorepo? client/server folders).
- Accounts/PDPA consent flow (deferred — not in MVP).
