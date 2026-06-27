import { describe, it, expect } from 'vitest';
import {
  ELEMENT_BEATS, elementMultiplier, maxHpFromStat, mitigatedBase,
  critChance, computeHit, dodgeChance, rollDodge, firstStrike,
  chargeFraction, lurchedFraction, buildSpellChallenge,
} from './battle';
import type { DrillItem } from '../data/types';

describe('elements', () => {
  it('forms the 4-cycle fire>air>leaf>water>fire', () => {
    expect(ELEMENT_BEATS).toEqual({ fire: 'air', air: 'leaf', leaf: 'water', water: 'fire' });
  });
  it('advantage = 1.5, disadvantage = 0.75, neutral = 1', () => {
    expect(elementMultiplier('fire', 'air')).toBe(1.5);
    expect(elementMultiplier('air', 'fire')).toBe(0.75);
    expect(elementMultiplier('fire', 'leaf')).toBe(1);
    expect(elementMultiplier('fire', 'fire')).toBe(1);
  });
});

describe('hp pool & defense', () => {
  it('hp pool = stat × hpMultiplier (8)', () => {
    expect(maxHpFromStat(100)).toBe(800);
    expect(maxHpFromStat(40)).toBe(320);
  });
  it('ratio defense never reaches zero and halves at def=C', () => {
    expect(mitigatedBase(100, 0)).toBe(100);
    expect(mitigatedBase(100, 100)).toBeCloseTo(50);
    expect(mitigatedBase(100, 50)).toBeCloseTo(66.6667, 3);
  });
});

describe('computeHit', () => {
  const base = { atkStat: 100, defStat: 0, attackerSpecies: 'fire', defenderSpecies: 'leaf' } as const;
  it('applies the combat scalar and rounds, min 1', () => {
    expect(computeHit({ ...base, crit: false })).toBe(140);
  });
  it('doubles on crit', () => {
    expect(computeHit({ ...base, crit: true })).toBe(280);
  });
  it('applies element advantage', () => {
    expect(computeHit({ ...base, defenderSpecies: 'air', crit: false })).toBe(210);
  });
  it('floors at 1', () => {
    expect(computeHit({ atkStat: 0, defStat: 90, attackerSpecies: 'fire', defenderSpecies: 'water', crit: false }))
      .toBeGreaterThanOrEqual(1);
  });
});

describe('crit & dodge & first strike', () => {
  it('critChance scales with luk and caps', () => {
    expect(critChance(0)).toBe(0);
    expect(critChance(100)).toBeCloseTo(0.4);
    expect(critChance(1000)).toBe(0.6);
  });
  it('dodgeChance uses the spd delta, clamped to [0, cap]', () => {
    expect(dodgeChance(50, 50)).toBeCloseTo(0.05);
    expect(dodgeChance(150, 50)).toBe(0.55);
    expect(dodgeChance(0, 100)).toBe(0);
  });
  it('rollDodge is true when the rng draw is below the chance', () => {
    expect(rollDodge(150, 50, () => 0.1)).toBe(true);
    expect(rollDodge(150, 50, () => 0.9)).toBe(false);
  });
  it('firstStrike when the player outspeeds', () => {
    expect(firstStrike(60, 50)).toBe(true);
    expect(firstStrike(50, 60)).toBe(false);
    expect(firstStrike(50, 50)).toBe(false);
  });
});

describe('P2 charge timer', () => {
  it('chargeFraction is elapsed/chargeMs clamped to [0,1]', () => {
    expect(chargeFraction(0, 8000)).toBe(0);
    expect(chargeFraction(4000, 8000)).toBe(0.5);
    expect(chargeFraction(8000, 8000)).toBe(1);
    expect(chargeFraction(12000, 8000)).toBe(1);   // clamps over
    expect(chargeFraction(-100, 8000)).toBe(0);     // clamps under
  });
  it('lurchedFraction adds the lurch, capped at 1', () => {
    expect(lurchedFraction(0.5, 0.3)).toBeCloseTo(0.8);
    expect(lurchedFraction(0.9, 0.3)).toBe(1);
  });

});

const trapItem: DrillItem = {
  id: 'gr-x', kind: 'dragdrop', drill: 'grammar', level: 1, thaiHint: 'เขากิน',
  slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
};
const noTrapItem: DrillItem = {
  id: 'p-x', kind: 'dragdrop', drill: 'pattern', level: 1, thaiHint: 'x',
  slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'],
};

describe('buildSpellChallenge', () => {
  it('injects the trap word at its slot and marks that index wrong', () => {
    const c = buildSpellChallenge(trapItem, () => 0);
    expect(c).not.toBeNull();
    expect(c!.words).toEqual(['he', 'eat']); // slot 1 replaced by the trap word
    expect(c!.wrongIndex).toBe(1);
    expect(c!.tip).toBe('เขา → he eats 👍');
  });
  it('returns null when the item has no traps', () => {
    expect(buildSpellChallenge(noTrapItem, () => 0)).toBeNull();
  });
});
