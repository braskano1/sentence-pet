export type PosLabel = 'Pronoun' | 'Verb' | 'Object';

export type DrillType = 'pattern' | 'wordChoice' | 'grammar' | 'mixed';

/** The five activity families a unit node can be. Boss is not a pool item. */
export type ContentKind = 'flashcard' | 'matching' | 'dragdrop' | 'fillblank' | 'boss';

/** A tempting grammar near-miss tile tied to a gentle tip (Grammar drill). */
export interface GrammarTrap {
  slot: number;   // index into slots[]/answer[] this trap word belongs to
  word: string;   // the near-miss tile (must differ from every answer word)
  tip: string;    // gentle Thai-scaffolded nudge shown on a near-miss retry
}

/** Thai bridge text shown when the L1 toggle is on (display-only, never grades). */
export interface L1Helper {
  th: string;
}

/** Fields shared by every pool item. */
interface BaseContentItem {
  id: string;
  level: number;        // 1..5
  l1?: L1Helper;        // optional Thai helper (flashcard/matching-pair/fillblank). Dragdrop keeps thaiHint instead.
}

/** ① Flashcard — front/back recall, optional audio, self-graded practice. */
export interface FlashcardItem extends BaseContentItem {
  kind: 'flashcard';
  front: string;
  back: string;
  audio?: string;
  // speaking?: SpeakingCheck;  // RESERVED — pronunciation check, built later
}

/**
 * A single match row. left = prompt (L2), right = answer slot.
 * NOTE: `right` values must be unique within a MatchingItem — they double as
 * droppable ids / display keys. Duplicate rights grade correctly but render and
 * attribute (filledBy) ambiguously.
 */
export interface MatchingPair {
  left: string;
  right: string;
  l1?: L1Helper;        // per-pair Thai
  leftImage?: string;   // RESERVED
  rightImage?: string;  // RESERVED
}

/** ② Matching — drag each prompt tile into its target slot. */
export interface MatchingItem extends BaseContentItem {
  kind: 'matching';
  pairs: MatchingPair[]; // >= 2
}

/** ③ Drag-drop — today's slot-fill engine, unchanged. Keeps thaiHint as its L1. */
export interface DragDropItem extends BaseContentItem {
  kind: 'dragdrop';
  drill: DrillType;
  thaiHint: string;        // existing meaning scaffold (dragdrop's L1 surface)
  slots: PosLabel[];
  answer: string[];        // same length as slots
  distractors?: string[];
  traps?: GrammarTrap[];
  hidePos?: boolean;       // difficulty: hide POS label/tint in slots
}

/** ④ Fill-blank — typed, strict trimmed match. */
export interface FillBlankItem extends BaseContentItem {
  kind: 'fillblank';
  template: string;        // exactly one "___" marks the blank
  answer: string;          // strict exact match (trimmed)
  alternates?: string[];   // optional extra accepted answers
}

export type ContentItem = FlashcardItem | MatchingItem | DragDropItem | FillBlankItem;

/** Back-compat: all existing dragdrop code refers to DrillItem. */
export type DrillItem = DragDropItem;

export const isDragDrop = (i: ContentItem): i is DragDropItem => i.kind === 'dragdrop';
export const isFlashcard = (i: ContentItem): i is FlashcardItem => i.kind === 'flashcard';
export const isMatching = (i: ContentItem): i is MatchingItem => i.kind === 'matching';
export const isFillBlank = (i: ContentItem): i is FillBlankItem => i.kind === 'fillblank';

export type Screen = 'egg' | 'petRoom' | 'pickCourse' | 'pickDrill' | 'drill' | 'reward' | 'shop' | 'gacha' | 'collection' | 'evolution' | 'bossPrep' | 'battle';

export type PetStage = 'egg' | 'baby' | 'young' | 'adult';

/** A forward stage transition, for the evolution celebration. */
export interface StageChange { from: PetStage; to: PetStage; }

export interface NutritionBars {
  protein: number;  // Pattern drill
  veggie: number;   // Word-Choice drill (unused in MVP)
  vitamin: number;  // Grammar drill (unused in MVP)
  treat: number;    // Mixed mode (unused in MVP)
}

export type FoodGroup = keyof NutritionBars;

export type Species = 'leaf' | 'fire' | 'air' | 'water';

/** Expandable battle-type taxonomy id. Decoupled from the 4 art-family `Species`;
 *  membership is checked against the PET_TYPES registry in domain/petType.ts. */
export type PetType = string;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Inclusive integer stat range [min, max]. */
export type StatRange = readonly [min: number, max: number];

/**
 * Admin-authored creature definition (global content). The fixed 4 `Species`
 * remain the element/matchup taxonomy; a PetDef *references* one element.
 * Stable `id` is course-referenceable later (P4 rewardPetDefId).
 */
export interface PetDef {
  id: string;
  name: string;
  gen: number;              // generation; >= 1
  dexNo: number;            // index within its gen; (gen, dexNo) unique across the catalog
  types: PetType[];         // >= 1; each a member of the PET_TYPES registry
  element: Species;         // art-family / fallback sprite source (1 of 4) until P3
  statBands: Record<Rarity, Record<keyof BattleStats, StatRange>>;
  evolvesFromId?: string;   // ref to another PetDef.id
  evolvesToId?: string;     // ref to another PetDef.id
  evolutionStage?: number;  // 1-based stage in its chain
  starter?: boolean;        // exactly one def true; must be the gen 1, dexNo 1 def
  enabled: boolean;         // gacha-pool gate; P2 stores only, P4 reads it
}

export type PetMood = 'happy' | 'sad';

export interface BattleStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  luk: number;
}

/** One owned creature. `coins` is NOT here — it is an account-level wallet. */
export interface PetInstance {
  id: string;          // unique; 'starter-leaf' for the seeded/migrated first pet
  defId: string;       // the authored creature (PetDef.id)
  species: Species;
  hatched: boolean;    // the egg ceremony gates the first pet
  xp: number;
  happiness: number;
  bars: NutritionBars;
  stats: BattleStats;  // rolled once at creation, immutable thereafter
  growth: BattleStats; // points allocated by level-ups (+1 random per level); display = stats + growth
  rarity: Rarity;      // rolled once at creation (or derived in migrate), immutable thereafter
  name: string;        // custom name; '' falls back to the species name (see petDisplayName)
}
