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
};

/** Fresh mixer: every channel at 70% and unmuted. */
export function defaultAudioSettings(): AudioSettings {
  const start = (): Channel => ({ level: 0.7, muted: false });
  return { master: start(), sfx: start(), music: start(), voice: start() };
}

/**
 * Effective 0..1 gain for a channel.
 * Mute precedence: master.muted > channel.muted > (master.level * channel.level).
 * The Master channel's mute IS the global mute.
 */
export function effectiveGain(channel: ChannelName, s: AudioSettings): number {
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
