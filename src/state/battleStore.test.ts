import { describe, it, expect, beforeEach } from 'vitest';
import { useBattleStore } from './battleStore';
import { makePet } from '../domain/pets';
import type { PetInstance, DrillItem } from '../data/types';
import type { CheckpointBoss } from '../content/model';
import { BOSS_TIERS } from '../domain/bossTiers';
import { GAME_CONFIG } from '../config/gameConfig';

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

  it('resolveSwipe is a no-op outside the charged phase', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().resolveSwipe(true);
    const s = useBattleStore.getState();
    expect(s.battlePhase).toBe('answering');
    expect(s.lastEvent).toBeNull();
  });

  it('onCorrect is a no-op while a charged attack is pending', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(8000); // → charged
    const bossHpBefore = useBattleStore.getState().snapshot!.bossHp;
    useBattleStore.getState().onCorrect();
    const s = useBattleStore.getState();
    expect(s.battlePhase).toBe('charged');                 // still pending
    expect(s.snapshot!.bossHp).toBe(bossHpBefore);         // boss not damaged
  });

  it('onWrong is a no-op while a charged attack is pending', () => {
    useBattleStore.getState().begin(PET, BOSS);
    useBattleStore.getState().tickCharge(8000); // → charged
    const petHpBefore = useBattleStore.getState().snapshot!.petHp;
    const itemsBefore = useBattleStore.getState().itemsAnswered;
    useBattleStore.getState().onWrong();
    const s = useBattleStore.getState();
    expect(s.battlePhase).toBe('charged');                 // still pending
    expect(s.snapshot!.petHp).toBe(petHpBefore);           // pet not hit
    expect(s.itemsAnswered).toBe(itemsBefore);             // not counted
  });
});

// ---------------------------------------------------------------------------
// P3 multi-phase ramp tests
// ---------------------------------------------------------------------------

describe('multi-phase ramp', () => {
  beforeEach(() => useBattleStore.getState().reset());

  // tier-3 has phases: 2 (threshold at 50%). Fire boss so water PET has advantage.
  const PHASE_BOSS: CheckpointBoss = {
    tierId: 'tier-3', element: 'fire', name: 'Phase Rival',
    rivalSprite: { species: 'fire', stage: 'young' },
  };

  it('begins at phase 0 with the tier phase count', () => {
    useBattleStore.getState().begin(PET, PHASE_BOSS);
    const s = useBattleStore.getState();
    expect(s.phaseIndex).toBe(0);
    expect(s.bossPhases).toBe(2);
  });

  it('crossing 50% boss HP increments phaseIndex', () => {
    const bigPet: PetInstance = { ...PET, stats: { ...PET.stats, atk: 100 } };
    useBattleStore.getState().begin(bigPet, PHASE_BOSS, () => 0.99);
    const max = useBattleStore.getState().snapshot!.bossHpMax;
    let guard = 0;
    while (useBattleStore.getState().snapshot!.bossHp / max > 0.5 && guard++ < 100) {
      useBattleStore.getState().onCorrect();
      // re-arm to answering if a phase cross paused things (spell added in a later task)
      if (useBattleStore.getState().battlePhase !== 'answering') {
        useBattleStore.setState({ battlePhase: 'answering' });
      }
    }
    expect(useBattleStore.getState().phaseIndex).toBe(1);
  });

  it('ramped chargeMs makes the ring fill faster after a phase cross', () => {
    useBattleStore.getState().begin(PET, PHASE_BOSS, () => 0.99);
    useBattleStore.setState({ phaseIndex: 1 }); // force phase 1
    const ramped = GAME_CONFIG.battle.timer.chargeMs * GAME_CONFIG.battle.phaseRamp.chargeMult;
    useBattleStore.getState().tickCharge(ramped);
    expect(useBattleStore.getState().battlePhase).toBe('charged');
  });

  it('a kill-hit on a single-phase boss resolves win with no phase bump', () => {
    const onePunch: PetInstance = { ...PET, stats: { ...PET.stats, atk: 100 } };
    useBattleStore.getState().begin(onePunch, { ...PHASE_BOSS, tierId: 'tier-1' }, () => 0.99);
    let guard = 0;
    while (useBattleStore.getState().snapshot!.outcome == null && guard++ < 100) {
      useBattleStore.getState().onCorrect();
    }
    const s = useBattleStore.getState();
    expect(s.snapshot!.outcome).toBe('win');
    expect(s.phaseIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// P3 spot-the-error spell sub-mode tests
// ---------------------------------------------------------------------------

const SPELL_ITEM: DrillItem = {
  id: 'gr-spell', drill: 'grammar', level: 1, thaiHint: 'เขากิน',
  slots: ['Pronoun', 'Verb'], answer: ['he', 'eats'],
  traps: [{ slot: 1, word: 'eat', tip: 'เขา → he eats 👍' }],
};

describe('spot-the-error spell', () => {
  beforeEach(() => useBattleStore.getState().reset());

  const PHASE_BOSS: CheckpointBoss = {
    tierId: 'tier-3', element: 'fire', name: 'Phase Rival',
    rivalSprite: { species: 'fire', stage: 'young' },
  };

  function driveToCross() {
    const bigPet: PetInstance = { ...PET, stats: { ...PET.stats, atk: 100 } };
    useBattleStore.getState().begin(bigPet, PHASE_BOSS, () => 0, [SPELL_ITEM]);
    let guard = 0;
    while (useBattleStore.getState().phaseIndex === 0 && guard++ < 100) {
      if (useBattleStore.getState().battlePhase === 'spell') break;
      useBattleStore.getState().onCorrect();
    }
  }

  it('a phase cross opens the spell sub-mode with a built challenge', () => {
    driveToCross();
    const s = useBattleStore.getState();
    expect(s.phaseIndex).toBe(1);
    expect(s.battlePhase).toBe('spell');
    expect(s.spell).not.toBeNull();
    expect(s.spell!.wrongIndex).toBe(1);
  });

  it('tapping the wrong word breaks the spell → bonus boss damage, back to answering', () => {
    driveToCross();
    const before = useBattleStore.getState().snapshot!.bossHp;
    useBattleStore.getState().resolveSpell(1); // correct = the trap slot
    const s = useBattleStore.getState();
    expect(s.snapshot!.bossHp).toBeLessThan(before);
    expect(s.lastEvent?.kind).toBe('spellBreak');
    expect(s.battlePhase).toBe('answering');
    expect(s.spell).toBeNull();
  });

  it('a wrong tap lets the boss hit the pet', () => {
    driveToCross();
    const before = useBattleStore.getState().snapshot!.petHp;
    useBattleStore.getState().resolveSpell(0); // wrong word
    const s = useBattleStore.getState();
    expect(s.snapshot!.petHp).toBeLessThan(before);
    expect(s.lastEvent?.kind).toBe('bossHit');
    expect(s.battlePhase).toBe('answering');
  });

  it('with no trap-bearing items the cross enrages but skips the spell', () => {
    const bigPet: PetInstance = { ...PET, stats: { ...PET.stats, atk: 100 } };
    useBattleStore.getState().begin(bigPet, PHASE_BOSS, () => 0.99, []);
    let guard = 0;
    while (useBattleStore.getState().phaseIndex === 0 && guard++ < 100) {
      useBattleStore.getState().onCorrect();
    }
    const s = useBattleStore.getState();
    expect(s.phaseIndex).toBe(1);
    expect(s.battlePhase).toBe('answering');
    expect(s.spell).toBeNull();
  });
});

describe('boss atk ramp damage', () => {
  beforeEach(() => useBattleStore.getState().reset());
  const FIRE_BOSS: CheckpointBoss = {
    tierId: 'tier-3', element: 'fire', name: 'R', rivalSprite: { species: 'fire', stage: 'young' },
  };
  it('phase-1 boss counter hits harder than phase-0', () => {
    // phase 0 counter (every 2nd wrong)
    useBattleStore.getState().begin(PET, FIRE_BOSS, () => 0.99);
    const max = useBattleStore.getState().snapshot!.petHpMax;
    useBattleStore.getState().onWrong();
    useBattleStore.getState().onWrong(); // 2nd → boss hit
    const dmg0 = max - useBattleStore.getState().snapshot!.petHp;
    // phase 1 counter
    useBattleStore.getState().begin(PET, FIRE_BOSS, () => 0.99);
    useBattleStore.setState({ phaseIndex: 1 });
    const max1 = useBattleStore.getState().snapshot!.petHpMax;
    useBattleStore.getState().onWrong();
    useBattleStore.getState().onWrong();
    const dmg1 = max1 - useBattleStore.getState().snapshot!.petHp;
    expect(dmg1).toBeGreaterThan(dmg0);
  });
});
