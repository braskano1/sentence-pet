import { describe, it, expect } from 'vitest';
import { petDialogue, type DialogueCtx } from './petDialogue';

const baseCtx: DialogueCtx = {
  name: 'Bubble', species: 'water', stage: 'young',
  lowestGroup: 'protein', lowestValue: 80, happiness: 80,
  justFed: false, leveledTo: null, gainedStat: null, nearEvolution: false,
};

describe('petDialogue', () => {
  it('prioritizes level-up', () => {
    const line = petDialogue({ ...baseCtx, leveledTo: 13, gainedStat: 'atk' }, () => 0);
    expect(line).toMatch(/13|ATK|grew/i);
  });
  it('mentions hunger when a bar is low', () => {
    const line = petDialogue({ ...baseCtx, lowestValue: 15 }, () => 0);
    expect(line.length).toBeGreaterThan(0);
    expect(line).toMatch(/hungry|feed|eat/i);
  });
  it('thanks after feeding', () => {
    expect(petDialogue({ ...baseCtx, justFed: true }, () => 0)).toMatch(/thank|yum|tasty/i);
  });
  it('always returns a non-empty string (idle fallback)', () => {
    expect(petDialogue(baseCtx, () => 0).length).toBeGreaterThan(0);
  });
});
