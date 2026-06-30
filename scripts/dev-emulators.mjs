// DEV launcher: start the Firebase emulators, then auto-seed the dev admin + the
// pet-def catalog once they are ready. The seed scripts are idempotent, so the
// baseline data (admin account + Model-B pet chains) is restored on EVERY start —
// a restart never rolls the catalog back. Any data you authored live in the
// emulator UI is ALSO persisted across graceful (Ctrl+C) restarts via the
// import/export-on-exit dir; auto-seed just guarantees the baseline regardless.
//
// Usage: npm run dev:emulators   (then `npm run dev` in another terminal)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';

const DATA_DIR = './.emulator-data';
const DEV_ORIGIN = process.env.DEV_ORIGIN ?? 'http://localhost:5173';
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
    if ((await ping(8080)) && (await ping(9099))) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

const run = (script) => new Promise((res) => {
  const p = spawn('node', [script], { stdio: 'inherit', shell: true, env: { ...process.env, DEV_ORIGIN } });
  p.on('exit', () => res());
});

if (await waitReady()) {
  console.log('\n[dev-emulators] emulators ready — auto-seeding admin + catalog…');
  await run('scripts/seed-dev-admin.mjs');
  await run('scripts/seed-petdefs-dev.mjs');
  console.log('[dev-emulators] seed complete. Catalog + admin live.\n');
} else {
  console.error('[dev-emulators] emulators did not become ready in time; skipped auto-seed.');
}
