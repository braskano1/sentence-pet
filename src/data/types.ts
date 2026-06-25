export type PosLabel = 'Pronoun' | 'Verb' | 'Object';

export type DrillType = 'pattern' | 'wordChoice' | 'grammar' | 'mixed';

/** A tempting grammar near-miss tile tied to a gentle tip (Grammar drill). */
export interface GrammarTrap {
  slot: number;   // index into slots[]/answer[] this trap word belongs to
  word: string;   // the near-miss tile (must differ from every answer word)
  tip: string;    // gentle Thai-scaffolded nudge shown on a flagged accept
}

export interface DrillItem {
  id: string;
  drill: DrillType;     // which drill this item belongs to
  level: number;        // 1..5 (MVP uses 1, 2)
  thaiHint: string;     // shown to the kid as meaning scaffold
  slots: PosLabel[];    // POS labels shown above each slot
  answer: string[];     // correct words, in order (same length as slots)
  distractors?: string[]; // extra wrong tiles salted into the tray (Word-Choice)
  traps?: GrammarTrap[];  // near-miss tiles tied to tips (Grammar)
  strictness?: 'flag' | 'enforce'; // Grammar dial; undefined ⇒ exact match (Pattern/WC)
}

export type Screen = 'egg' | 'petRoom' | 'pickDrill' | 'drill' | 'reward' | 'shop';

export type PetStage = 'egg' | 'baby' | 'young' | 'adult';

export interface NutritionBars {
  protein: number;  // Pattern drill
  veggie: number;   // Word-Choice drill (unused in MVP)
  vitamin: number;  // Grammar drill (unused in MVP)
  treat: number;    // Mixed mode (unused in MVP)
}

export type FoodGroup = keyof NutritionBars;
