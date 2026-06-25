import type { BattleStats, FoodGroup, PetStage, Species } from '../data/types';

export interface DialogueCtx {
  name: string;
  species: Species;
  stage: PetStage;
  lowestGroup: FoodGroup;
  lowestValue: number;
  happiness: number;
  justFed: boolean;
  leveledTo: number | null;
  gainedStat: keyof BattleStats | null;
  nearEvolution: boolean;
}

const HUNGRY_AT = 30;
const HAPPY_AT = 70;
const FOOD_WORD: Record<FoodGroup, string> = { protein: 'meat', veggie: 'veggies', vitamin: 'vitamins', treat: 'a treat' };
const STAT_WORD: Record<keyof BattleStats, string> = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD', luk: 'LUK' };

function pick(rng: () => number, lines: string[]): string {
  return lines[Math.floor(rng() * lines.length)] ?? lines[0];
}

/** One contextual line. Priority: level-up > fed > hunger > near-evolution > low-happiness > idle. */
export function petDialogue(ctx: DialogueCtx, rng: () => number): string {
  if (ctx.leveledTo !== null) {
    const stat = ctx.gainedStat ? ` +1 ${STAT_WORD[ctx.gainedStat]}!` : '';
    return pick(rng, [`I grew to Lv ${ctx.leveledTo}!${stat}`, `Level ${ctx.leveledTo}!${stat} 💪`]);
  }
  if (ctx.justFed) return pick(rng, ['Yum, thank you!', 'So tasty!', 'Mmm, more please?']);
  if (ctx.lowestValue <= HUNGRY_AT) {
    const food = FOOD_WORD[ctx.lowestGroup];
    return pick(rng, [`I'm hungry, feed me ${food}!`, `Can I eat some ${food}?`, `My tummy needs ${food}.`]);
  }
  if (ctx.nearEvolution) return pick(rng, ['I feel like I am changing...', 'Something is happening to me!']);
  if (ctx.happiness < HAPPY_AT) return pick(rng, ['Can we play?', 'I want to have fun!', 'Play a round with me?']);
  return pick(rng, [`Hi! I'm ${ctx.name}.`, 'What a nice day!', "Let's learn together!", 'I love it here!']);
}
