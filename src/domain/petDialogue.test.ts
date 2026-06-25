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
  it('nearEvolution branch matches /chang|happening/i', () => {
    const line = petDialogue({ ...baseCtx, nearEvolution: true }, () => 0);
    expect(line).toMatch(/chang|happening/i);
  });
  it('low happiness (not hungry, not fed, not leveled) matches /play|fun/i', () => {
    // happiness 40 < HAPPY_AT(70), lowestValue 80 (not hungry), not fed, not leveled, not nearEvolution
    const line = petDialogue({ ...baseCtx, happiness: 40, lowestValue: 80, nearEvolution: false }, () => 0);
    expect(line).toMatch(/play|fun/i);
  });
});
