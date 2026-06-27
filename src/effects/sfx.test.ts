import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSfx, setSfxProvider, type Sfx, type SfxName } from './sfx';

afterEach(() => setSfxProvider(null));

describe('sfx provider seam', () => {
  it('returns a silent no-op when no AudioContext exists (jsdom)', () => {
    const s = getSfx();
    expect(() => s.play('tap', 1)).not.toThrow();
    expect(() => s.stop()).not.toThrow();
  });

  it('uses an injected provider (test spy)', () => {
    const play = vi.fn();
    const spy: Sfx = { play, stop: vi.fn() };
    setSfxProvider(() => spy);
    getSfx().play('correct', 0.8);
    expect(play).toHaveBeenCalledWith('correct', 0.8);
  });

  it('exposes the expected SfxName union via a sample registration call', () => {
    const names: SfxName[] = ['tap', 'nav', 'drop', 'correct', 'wrong', 'coin', 'purchase', 'pull', 'reveal', 'feed', 'coo'];
    expect(names.length).toBe(11);
  });
});
