// DEV launcher: start the Firebase emulators, then auto-seed once they are ready.
// Course content is seeded from the xlsx workbooks (git is the source of truth) so
// a fresh emulator always lists the courses — no reliance on export blobs for
// content. Any data you author live in the emulator UI is ALSO persisted across
// graceful (Ctrl+C) restarts via the import/export-on-exit dir; auto-seed just
// guarantees the baseline regardless.
//
// Usage: npm run emulators   (then `npm run dev` in another terminal)
//
// NOTE: the pet-import-proof branch ships a sibling dev-emulators.mjs that seeds
// admin + pet-defs. The admin/pet-def seeds below run only if those scripts exist,
// so the two converge to "seed courses + admin + pet-defs" once that line merges.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';

const DATA_DIR = './.emulator-data';
const FIREBASE = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';

const args = ['emulators:start', '--only', 'auth,firestore,storage', '--export-on-exit', DATA_DIR];
if (existsSync(DATA_DIR)) args.splice(2, 0, '--import', DATA_DIR); // restore prior state when present

const emu = spawn(FIREBASE, args, { stdio: 'inherit', shell: true });
emu.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => emu.kill(sig)); // graceful -> export-on-exit

const ping = (port) => new Promise((res) => {
  const req = http.get({ host: '127.0.0.1', port, timeout: 1500 }, (r) => { r.resume(); res(true); });
  req.on('error', () => res(false));
  req.on('timeout', () => { req.destroy(); res(false); });
});
const waitReady = async () => {
  for (let i = 0; i < 60; i++) {
    if (await ping(8080)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

// Run a seed script, picking the runner by extension (.ts -> vite-node, .mjs -> node).
// Skips silently if the script isn't on this branch.
const seed = (script) => new Promise((res) => {
  if (!existsSync(script)) return res();
  const runner = script.endsWith('.ts') ? ['npx', 'vite-node', script] : ['node', script];
  const p = spawn(runner[0], runner.slice(1), { stdio: 'inherit', shell: true });
  p.on('exit', () => res());
});

if (await waitReady()) {
  console.log('\n[dev-emulators] emulators ready — auto-seeding…');
  await seed('scripts/seed-courses-emulator.ts'); // courses from the xlsx workbooks
  await seed('scripts/seed-dev-admin.mjs');       // present once pet-import-proof merges
  await seed('scripts/seed-petdefs-dev.mjs');     // present once pet-import-proof merges
  console.log('[dev-emulators] seed complete.\n');
} else {
  console.error('[dev-emulators] emulators did not become ready in time; skipped auto-seed.');
}
