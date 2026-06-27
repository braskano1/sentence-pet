import { describe, it, expect, vi } from 'vitest';

// Mock heavy deps that are pulled in through App's import chain before
// importing the named export.
// Keep the real framer-motion (PetSprite & co. use useAnimationControls etc.),
// but make AnimatePresence/MotionConfig pass-through so screen transitions don't
// defer mounting — the zone-wiring effect must run synchronously on render.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

vi.mock('./firebase/content', () => ({
  saveContent: vi.fn(),
  fetchContent: vi.fn(),
}));

vi.mock('./auth/useAuth', () => ({
  useAuth: () => ({ user: null, isAnonymous: true, signOut: vi.fn(), linkEmail: vi.fn() }),
}));

import React from 'react';
import { render } from '@testing-library/react';
import { afterEach } from 'vitest';
import App, { screenKeyAndNode, zoneForScreen } from './App';
import type { DrillType, PosLabel } from './data/types';
import { useGameStore } from './state/gameStore';
import { setMusicProvider, type Music } from './effects/music';
import { resetSharedMusic, __resetAudioGestureForTest } from './hooks/useAudio';

const DRILL: DrillType = 'pattern';

describe('screenKeyAndNode — empty-items guard', () => {
  it('returns pickDrill (JourneyMap) when screen is drill but items is empty', () => {
    const result = screenKeyAndNode('drill', /* hatched */ true, DRILL, 1, []);
    expect(result.key).toBe('pickDrill');
  });

  it('returns drill key when screen is drill and items are non-empty', () => {
    const item = {
      id: 'x1',
      drill: DRILL,
      level: 1,
      thaiHint: 'test',
      slots: ['Pronoun' as PosLabel],
      answer: ['I'],
    };
    const result = screenKeyAndNode('drill', true, DRILL, 1, [item]);
    expect(result.key).toBe('drill');
  });
});

describe('zoneForScreen — screen key → music zone', () => {
  it('maps egg → title', () => {
    expect(zoneForScreen('egg', false)).toBe('title');
  });

  it('maps drill (non-checkpoint) → drill', () => {
    expect(zoneForScreen('drill', false)).toBe('drill');
  });

  it('maps drill (checkpoint) → boss', () => {
    expect(zoneForScreen('drill', true)).toBe('boss');
  });

  it.each(['pickDrill', 'petRoom', 'shop', 'gacha', 'collection'])(
    'maps overworld screen %s → overworld',
    (key) => {
      expect(zoneForScreen(key, false)).toBe('overworld');
    },
  );

  it('maps reward → null (no overworld loop; the sting plays instead)', () => {
    expect(zoneForScreen('reward', false)).toBeNull();
  });

  it('maps evolution → null (music stops during the cinematic)', () => {
    expect(zoneForScreen('evolution', false)).toBeNull();
  });

  it('falls back to overworld for an unknown key', () => {
    expect(zoneForScreen('totally-unknown', false)).toBe('overworld');
  });

  it('ignores the checkpoint flag for non-drill keys (egg stays title)', () => {
    expect(zoneForScreen('egg', true)).toBe('title');
  });
});

describe('App — zone wiring pushes the current screen zone to the music engine', () => {
  afterEach(() => {
    setMusicProvider(null);
    resetSharedMusic();
    __resetAudioGestureForTest();
    useGameStore.getState().resetForTest();
  });

  function spyMusic() {
    const setZone = vi.fn();
    const instance: Music = {
      setZone, setGain: vi.fn(), playStinger: vi.fn(),
      setTrack: vi.fn(), previewTrack: vi.fn(), stopPreview: vi.fn(), stop: vi.fn(),
    };
    setMusicProvider((): Music => instance);
    resetSharedMusic();
    return { setZone };
  }

  it("pushes the 'overworld' zone for the hatched petRoom screen (after a gesture)", () => {
    const m = spyMusic();
    // Hatch the pet and land on petRoom → overworld zone (real track).
    useGameStore.setState((s) => ({
      pets: s.pets.map((p) => ({ ...p, hatched: true })),
      screen: 'petRoom',
    }));

    render(<App />);
    // setZone is armed but gesture-deferred; flush it with a window gesture.
    window.dispatchEvent(new Event('pointerdown'));

    expect(m.setZone).toHaveBeenCalled();
    expect(m.setZone.mock.calls.at(-1)?.[0]).toBe('overworld');
  });

  it('a global gear button opens the Settings dialog', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    useGameStore.setState((s) => ({
      pets: s.pets.map((p) => ({ ...p, hatched: true })),
      screen: 'petRoom',
    }));
    const { getByLabelText, getByRole } = render(<App />);
    await userEvent.click(getByLabelText('Settings'));
    expect(getByRole('dialog')).toBeInTheDocument();
  });
});
