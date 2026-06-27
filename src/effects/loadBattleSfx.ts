import { registerSample, type SfxName } from './sfx';

const BATTLE_SFX: SfxName[] = ['hit', 'crit', 'dodge', 'bossCharge', 'bossHit', 'enrage', 'fizzle'];

let loaded = false;

/** Fetch + decode the recorded battle clips and register them over the synth
 *  recipes. Idempotent, best-effort: a missing clip silently keeps the synth
 *  fallback. Call once when a battle begins. */
export async function loadBattleSfx(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const Ctor =
    (globalThis as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext })
      .AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: new () => AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  await Promise.all(
    BATTLE_SFX.map(async (name) => {
      try {
        const res = await fetch(`/audio/sfx/${name}.mp3`);
        if (!res.ok) return;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        registerSample(name, buf);
      } catch {
        /* keep synth fallback */
      }
    }),
  );
}
