import { describe, it, expect } from 'vitest';
import { effectiveGain, defaultAudioSettings, clampLevel, type AudioSettings } from './mixer';

const base = (): AudioSettings => defaultAudioSettings();

describe('effectiveGain', () => {
  it('defaults to full gain (1) for every channel', () => {
    const s = base();
    expect(effectiveGain('sfx', s)).toBe(1);
    expect(effectiveGain('music', s)).toBe(1);
    expect(effectiveGain('voice', s)).toBe(1);
  });

  it('multiplies master level by channel level', () => {
    const s = base();
    s.master.level = 0.5;
    s.sfx.level = 0.4;
    expect(effectiveGain('sfx', s)).toBeCloseTo(0.2);
  });

  it('channel mute zeroes only that channel', () => {
    const s = base();
    s.sfx.muted = true;
    expect(effectiveGain('sfx', s)).toBe(0);
    expect(effectiveGain('music', s)).toBe(1);
  });

  it('master mute zeroes every channel', () => {
    const s = base();
    s.master.muted = true;
    expect(effectiveGain('sfx', s)).toBe(0);
    expect(effectiveGain('voice', s)).toBe(0);
  });

  it('allMuted overrides everything', () => {
    const s = base(); // all channels full and unmuted — worst case for override
    s.allMuted = true;
    expect(effectiveGain('sfx', s)).toBe(0);
    expect(effectiveGain('music', s)).toBe(0);
    expect(effectiveGain('voice', s)).toBe(0);
  });

  it('defaultAudioSettings returns an unmuted full-level mixer', () => {
    const s = defaultAudioSettings();
    expect(s).toEqual({
      master: { level: 1, muted: false },
      sfx: { level: 1, muted: false },
      music: { level: 1, muted: false },
      voice: { level: 1, muted: false },
      allMuted: false,
    });
  });
});

describe('clampLevel', () => {
  it('clamps above 1 to 1', () => expect(clampLevel(1.5)).toBe(1));
  it('clamps below 0 to 0', () => expect(clampLevel(-0.1)).toBe(0));
  it('returns 0 for NaN', () => expect(clampLevel(NaN)).toBe(0));
});
