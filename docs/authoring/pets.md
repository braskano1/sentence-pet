# Authoring guide — Pets (the collectible catalog)

**Paste this whole file into an AI chat, then describe the pets you want.** It
produces one TSV table: the `Pets` sheet. Each row is one pet in the collectible
catalog (the Pokédex).

Pets are a **separate system** from courses, units, items, and bosses — they
have their own catalog. An import is **additive and merges by `id`**: a row whose
`id` already exists overwrites that pet; a new `id` adds one. The pets already in
the game (the four element starters) stay unless you reuse their ids, so the
**catalog-wide rules below apply to your rows *plus* the builtin pets**.

---

## What this produces

- **`Pets` sheet** — one row per pet. Each pet has an id, a Pokédex slot
  (`gen` + `dexNo`), a display name, one or more battle `types`, an art
  `element`, and stats. Optional fields cover rarity, the gacha pool, evolution
  links, and a sprite URL.

A pet's **stats** are authored as **one base range**; the importer derives the
four rarity bands (common / rare / epic / legendary) automatically — see *Stats*
below.

---

## `Pets` sheet — columns

| Column | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | ✅ | Unique, stable pet id (e.g. `def-spark`). Used to merge re-imports and to wire evolution links — keep it stable across edits. |
| `name` | string | ✅ | Display name. |
| `gen` | number ≥ 1 | ✅ | Generation (the Pokédex "book"). |
| `dexNo` | number ≥ 1 | ✅ | Number within that generation. **`(gen, dexNo)` must be unique across the WHOLE catalog** (your rows + the pets already in the game). |
| `types` | CSV, ≥ 1 | ✅ | Battle types, comma-separated. Each must be one of `leaf` / `fire` / `air` / `water` (the current type registry). |
| `element` | `leaf` / `fire` / `air` / `water` | ✅ | The art family / sprite source. One of the four — any other value is an error. |
| `base_min`, `base_max` | number PAIR | – | The pet's base stat range (see *Stats*). **Omit BOTH for standard stats** (recommended). Both-or-neither: setting only one is an error. `base_min` ≥ 0, `base_min` ≤ `base_max`. |
| `enabled` | `true` / `false` | – | Whether the pet is active. Defaults to `true`. |
| `starter` | `true` / `false` | – | Marks the starter pet. **Leave blank** — the game already has exactly one starter (see rules). |
| `rarity` | `common` / `rare` / `epic` / `legendary` | – | Optional fixed rarity override. Omit to let the game assign rarity normally. |
| `gachaObtainable` | `true` / `false` | – | Whether the pet can appear from gacha pulls. Omit to use the default. |
| `evolvesFromId` | pet id | – | The pet this one evolves *from*. Must reference a known pet id — may be another row in this same import. |
| `evolvesToId` | pet id | – | The pet this one evolves *to*. Same id rules. |
| `evolutionStage` | number ≥ 1 | – | Position in the evolution chain (1 = base form, 2 = next, …). Must **strictly increase** along a chain. |
| `spriteDefault` | http(s) URL | – | URL of the pet's default sprite. Must be a valid `http://` / `https://` URL. Omit to use the element's default art. |

A row only needs the columns it uses; leave the rest blank.

---

## Stats — one base range, derived rarities

A pet's stats are **one base range**: `base_min` and `base_max`. From that single
range the importer builds the full table the game needs — **all four rarity
bands** (common / rare / epic / legendary), for **all five stats**
(hp / atk / def / spd / luk). It uses the exact same spread the game's gacha
uses, so the four rarities stay balanced relative to each other.

- **Omit BOTH `base_min` and `base_max` to get the standard stats** — this
  reproduces the builtin pets' stats exactly. This is the recommended default;
  most pets want it.
- Set `base_min` / `base_max` together to make a pet **stronger or weaker**
  across the board. The whole band shifts; the four rarities keep their relative
  spread.
- **Per-stat asymmetry is NOT authorable here.** All five stats share one band.
  If you need a pet that is (say) high-atk / low-def, import it with a flat band
  and then tune the individual stat bands in the **admin editor** (a documented
  v1 limit).

> Reference: the builtin (omitted-base) common band is `[40, 60]`. So
> `base_min = 50`, `base_max = 70` makes a pet noticeably stronger than standard.

---

## Catalog-wide rules to satisfy (self-check before emitting)

These are checked against your rows **merged with the pets already in the game**,
so an additive import that collides with an existing pet fails:

- **`id`s are unique.** No two rows share an `id`, and you don't reuse a builtin
  pet's id unless you mean to overwrite it.
- **`(gen, dexNo)` is unique across the WHOLE catalog** — including the builtin
  pets, which occupy **gen 1, dexNo 1–4**. Author new pets at a free slot (use
  **gen 2** to be safe).
- **Exactly one starter, at gen 1 / dexNo 1.** The game already has it. **Do NOT
  set `starter` on any of your rows** — a second starter fails validation.
- **At least one pet is enabled** (true of the builtins, so this holds unless you
  disable everything).
- **Evolution links resolve.** Every `evolvesFromId` / `evolvesToId` names a real
  pet id — which may be another row in this same file.
- **Evolution stages strictly increase along a chain, no cycles.** If A evolves
  to B, B's `evolutionStage` must be greater than A's (e.g. 1 → 2 → 3). A chain
  must not loop back on itself.
- **`rarity`, if set, is one of the four** (`common` / `rare` / `epic` /
  `legendary`).
- **`spriteDefault`, if set, is a valid `http(s)` URL.**

---

## v1 NOT supported (don't emit)

State these to the AI as out of scope so it doesn't emit columns the importer
ignores:

- **Per-stat asymmetric stat bands** — stats are one shared base range; tune
  per-stat bands in the admin editor after import.
- **Sprite variants** (per stage × mood art) — only `spriteDefault` is
  authorable here. Add variant sprites in the admin editor.
- **Any column not in the table above** — unknown columns are ignored.

---

## Worked example

Three new pets in **gen 2** (so they don't collide with the four builtins at gen
1, dexNo 1–4). The first two form an evolution pair (`Spark` → `Blaze`, stages 1
then 2); the third (`Tide`) carries an explicit stronger base range and a sprite
URL. **None is a starter** — the builtin starter already exists.

**`Pets` sheet**

| id | name | gen | dexNo | types | element | base_min | base_max | enabled | gachaObtainable | evolvesFromId | evolvesToId | evolutionStage | spriteDefault |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| def-spark | Spark | 2 | 1 | fire | fire | | | true | true | | def-blaze | 1 | |
| def-blaze | Blaze | 2 | 2 | fire | fire | | | true | false | def-spark | | 2 | |
| def-tide | Tide | 2 | 3 | water | water | 50 | 70 | true | true | | | | https://cdn.example.com/tide.png |

- `Spark` and `Blaze` reference each other (`evolvesToId` / `evolvesFromId`) and
  have increasing `evolutionStage` (1 → 2).
- `Spark` is a chain root (no `evolvesFromId`) and `gachaObtainable = true`;
  `Blaze` is the evolved form, so `gachaObtainable = false`.
- `Tide` omits evolution columns (a lone pet) and uses an explicit base range
  `50–70` to be stronger than standard, plus a `spriteDefault` URL.
- Every `(gen, dexNo)` is free; no row is a `starter`.

---

## Output format — emit EXACTLY this

End your answer with the `Pets` sheet as one **tab-separated** table (real Tab
characters between cells, not spaces), header row first. The commas inside
`types` are **data** and stay inside their cell — only tabs separate columns.
Include **every** column any of your rows uses as the header; leave a cell blank
when a row doesn't use that column.

```
=== Sheet: Pets ===
id<TAB>name<TAB>gen<TAB>dexNo<TAB>types<TAB>element<TAB>base_min<TAB>base_max<TAB>enabled<TAB>gachaObtainable<TAB>evolvesFromId<TAB>evolvesToId<TAB>evolutionStage<TAB>spriteDefault
def-spark<TAB>Spark<TAB>2<TAB>1<TAB>fire<TAB>fire<TAB><TAB><TAB>true<TAB>true<TAB><TAB>def-blaze<TAB>1<TAB>
def-blaze<TAB>Blaze<TAB>2<TAB>2<TAB>fire<TAB>fire<TAB><TAB><TAB>true<TAB>false<TAB>def-spark<TAB><TAB>2<TAB>
def-tide<TAB>Tide<TAB>2<TAB>3<TAB>water<TAB>water<TAB>50<TAB>70<TAB>true<TAB>true<TAB><TAB><TAB><TAB>https://cdn.example.com/tide.png
```

`<TAB>` = one literal Tab character. Never the text "<TAB>", never spaces. Note
the consecutive tabs where `base_min` / `base_max` (and the evolution columns)
are left empty. Drop the `=== Sheet ===` label when pasting into Excel — it only
names the target sheet.
