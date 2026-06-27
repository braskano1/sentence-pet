// Offline SFX generation via the ElevenLabs sound-generation API.
// Usage: node scripts/gen-sfx.mjs   (reads ELEVENLABS_API_KEY from .env.local)
// Writes mp3 clips to public/audio/sfx/. Re-run to regenerate.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = readFileSync(resolve('.env.local'), 'utf8');
const key = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('ELEVENLABS_API_KEY missing from .env.local');

const OUT = resolve('public/audio/sfx');
mkdirSync(OUT, { recursive: true });

const CLIPS = {
  hit:        ['a short bright magical bolt impact, video game hit', 0.6],
  crit:       ['a powerful sparkly critical magic hit, game crit', 0.8],
  dodge:      ['a quick whoosh dash dodge swipe, game', 0.5],
  bossCharge: ['a rising ominous energy charge-up hum, game boss', 1.2],
  bossHit:    ['a heavy dull monster strike thud, game boss attack', 0.7],
  enrage:     ['an angry monster roar power-up surge, game boss enrage', 1.2],
  fizzle:     ['a failed spell fizzle sputter, game miss', 0.7],
};

for (const [name, [text, durationSeconds]] of Object.entries(CLIPS)) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: durationSeconds, prompt_influence: 0.6 }),
  });
  if (!res.ok) { console.error(`x ${name}: ${res.status} ${await res.text()}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(resolve(OUT, `${name}.mp3`), buf);
  console.log(`ok ${name}.mp3 (${buf.length} bytes)`);
}
