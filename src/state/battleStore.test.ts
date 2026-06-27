import { describe, it, expect, beforeEach } from 'vitest';
import { useBattleStore } from './battleStore';
import { makePet } from '../domain/pets';
import type { PetInstance } from '../data/types';
import type { CheckpointBoss } from '../content/model';
import { BOSS_TIERS } from '../domain/bossTiers';

const boss: CheckpointBoss = {
  tierId: 'tier-1', element: 'fire', name: 'Ember Rival',
  rivalSprite: { species: 'fire', stage: 'young' },
};
const pet = makePet({
  id: 'p1', species: 'water',
  stats: { hp: 100, atk: 100, def: 50, spd: 60, luk: 0 },
  rarity: 'common',
});

describe('battleStore', () => {
  beforeEach(() => useBattleStore.getState().reset());

  it('begin sets up full bars from pet + tier', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99);
    const s = useBattleStore.getState();
    expect(s.snapshot?.bossHpMax).toBe(BOSS_TIERS[0].hpPool);
    expect(s.snapshot?.petHpMax).toBe(800); // hp 100 × 8
    expect(s.lastEvent).toBeNull();
  });

  it('a correct answer damages the boss (water beats fire = ×1.5)', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99); // 0.99 → no crit
    useBattleStore.getState().onCorrect();
    const s = useBattleStore.getState();
    expect(s.snapshot!.bossHp).toBeLessThan(BOSS_TIERS[0].hpPool);
    expect(s.lastEvent?.kind).toBe('playerHit');
  });

  it('a wrong answer on the counter-cadence item makes the boss attack', () => {
    useBattleStore.getState().begin(pet, boss, () => 0.99); // 0.99 → boss hit lands (no dodge)
    useBattleStore.getState().onWrong(); // item 1 → miss (not on every-2 cadence)
    useBattleStore.getState().onWrong(); // item 2 → boss attacks
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBeLessThan(800);
    expect(['bossHit', 'dodge']).toContain(s.lastEvent?.kind);
  });
});

// ---------------------------------------------------------------------------
// P2 charge state machine tests
// ---------------------------------------------------------------------------

const PET: PetInstance = {
  id: 'p1', species: 'water', hatched: true, xp: 0, happiness: 60,
  bars: { protein: 60, veggie: 60, vitamin: 60, treat: 60 },
  stats: { hp: 100, atk: 60, def: 50, spd: 90, luk: 0 },
  growth: { hp: 0, atk: 0, def: 0, spd: 0, luk: 0 },
  rarity: 'common', name: '',
};
// water beats fire → use a fire boss so the player has element advantage.
const BOSS: CheckpointBoss = {
  tierId: BOSS_TIERS[0].id, element: 'fire', name: 'Test Rival',
  rivalSprite: { species: 'fire', stage: 'baby' },
};

describe('charge state machine', () => {
  beforeEach(() => useBattleStore.getState().reset());

  it('begin starts answering with an empty ring', () => {
    useBattleStore.getState().begin(PET, BOSS);
    const s = useBattleStore.getState();
    expect(s.charge).toBe(0);
    expect(s.battlePhase).toBe('answering');
  });

  it('tickCharge fills the ring and crosses into charged with a bossCharge event', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(4000); // half of 8000
    expect(useBattleStore.getState().charge).toBeCloseTo(0.5);
    expect(useBattleStore.getState().battlePhase).toBe('answering');
    useBattleStore.getState().tickCharge(4000); // crosses 1
    expect(useBattleStore.getState().charge).toBe(1);
    expect(useBattleStore.getState().battlePhase).toBe('charged');
    expect(useBattleStore.getState().lastEvent).toEqual({ kind: 'bossCharge' });
  });

  it('resolveSwipe(true) dodges the charged attack (no pet damage) and re-arms', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(8000);
    const petHpBefore = useBattleStore.getState().snapshot!.petHp;
    useBattleStore.getState().resolveSwipe(true);
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBe(petHpBefore);
    expect(s.lastEvent).toEqual({ kind: 'dodge' });
    expect(s.battlePhase).toBe('answering');
    expect(s.charge).toBe(0);
  });

  it('resolveSwipe(false) falls back to the SPD roll — dodge when rng is low', () => {
    useBattleStore.getState().begin(PET, BOSS, () => 0.01); // low draw → SPD dodge succeeds
    useBattleStore.getState().tickCharge(8000);
    const petHpBefore = useBattleStore.getState().snapshot!.petHp;
    useBattleStore.getState().resolveSwipe(false);
    expect(useBattleStore.getState().snapshot!.petHp).toBe(petHpBefore);
    expect(useBattleStore.getState().lastEvent).toEqual({ kind: 'dodge' });
  });

  it('resolveSwipe(false) takes a chargedHit when the SPD roll also fails', () => {
    useBattleStore.getState().begin(PET, BOSS, () => 0.99); // high draw → SPD dodge fails
    useBattleStore.getState().tickCharge(8000);
    const petHpBefore = useBattleStore.getState().snapshot!.petHp;
    useBattleStore.getState().resolveSwipe(false);
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBeLessThan(petHpBefore);
    expect(s.lastEvent?.kind).toBe('chargedHit');
    expect(s.battlePhase).toBe('answering');
  });

  it('onWrong lurches the ring forward', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(2000); // 0.25
    useBattleStore.getState().onWrong();         // +0.3 → ~0.55
    expect(useBattleStore.getState().charge).toBeCloseTo(0.55, 5);
  });

  it('onCorrect interrupts the ring back to empty', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(4000);   // 0.5
    useBattleStore.getState().onCorrect();
    expect(useBattleStore.getState().charge).toBe(0);
    expect(useBattleStore.getState().battlePhase).toBe('answering');
  });

  it('reset clears charge and phase', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(8000);
    useBattleStore.getState().reset();
    expect(useBattleStore.getState().charge).toBe(0);
    expect(useBattleStore.getState().battlePhase).toBe('answering');
  });
});
