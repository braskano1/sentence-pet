export type PosLabel = 'Pronoun' | 'Verb' | 'Object';

export interface DrillItem {
  id: string;
  level: number;        // 1..5 (MVP uses 1, 2)
  thaiHint: string;     // shown to the kid as meaning scaffold
  slots: PosLabel[];    // POS labels shown above each slot
  answer: string[];     // correct words, in order (same length as slots)
}

export type Screen = 'egg' | 'petRoom' | 'drill' | 'reward';

export type PetStage = 'egg' | 'baby' | 'young' | 'adult';

export interface NutritionBars {
  protein: number;  // Pattern drill
  veggie: number;   // Word-Choice drill (unused in MVP)
  vitamin: number;  // Grammar drill (unused in MVP)
  treat: number;    // Mixed mode (unused in MVP)
}
