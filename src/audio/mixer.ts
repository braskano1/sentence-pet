/** A single mixer channel. level is 0..1. */
export type Channel = { level: number; muted: boolean };

/** The three per-channel outputs; master gain is applied on top via AudioSettings.master. */
export type ChannelName = 'sfx' | 'music' | 'voice';

/** The full persisted mixer state. */
export type AudioSettings = {
  master: Channel;
  sfx: Channel;
  music: Channel;
  voice: Channel;
  allMuted: boolean;
};

/** Fresh mixer: every channel full and unmuted. */
export function defaultAudioSettings(): AudioSettings {
  const full = (): Channel => ({ level: 1, muted: false });
  return { master: full(), sfx: full(), music: full(), voice: full(), allMuted: false };
}

/**
 * Effective 0..1 gain for a channel.
 * Mute precedence: allMuted > master.muted > channel.muted > (master.level * channel.level).
 */
export function effectiveGain(channel: ChannelName, s: AudioSettings): number {
  if (s.allMuted) return 0;
  if (s.master.muted) return 0;
  const ch = s[channel];
  if (ch.muted) return 0;
  return s.master.level * ch.level;
}

/** Clamp a slider value into the valid 0..1 range. */
export function clampLevel(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
