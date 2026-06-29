// @vitest-environment node
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

// Only runs under the emulator (firebase emulators:exec sets FIREBASE_STORAGE_EMULATOR_HOST).
// Skips cleanly during a plain `npm test` so the suite stays green without Java/emulator.
const run = process.env.FIREBASE_STORAGE_EMULATOR_HOST ? describe : describe.skip;

const PATH = 'petDefs/def-test/default.webp';
const bytes = new Uint8Array([1, 2, 3]);
const meta = { contentType: 'image/webp' };

let env: RulesTestEnvironment;

run('storage security rules', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-sentence-pet',
      storage: { rules: readFileSync('storage.rules', 'utf8') },
    });
  });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => { await env.clearStorage(); });

  it('an admin can write a petDefs file', async () => {
    const s = env.authenticatedContext('admin1', { admin: true }).storage();
    await assertSucceeds(uploadBytes(ref(s, PATH), bytes, meta));
  });

  it('a non-admin authed client cannot write a petDefs file', async () => {
    const s = env.authenticatedContext('user1', {}).storage();
    await assertFails(uploadBytes(ref(s, PATH), bytes, meta));
  });

  it('an unauthenticated client cannot write a petDefs file', async () => {
    const s = env.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(s, PATH), bytes, meta));
  });

  it('anyone can read a petDefs file', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), PATH), bytes, meta);
    });
    const anon = env.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(anon, PATH)));
  });

  it('an admin writing outside petDefs/ is denied', async () => {
    const s = env.authenticatedContext('admin1', { admin: true }).storage();
    await assertFails(uploadBytes(ref(s, 'other/x.webp'), bytes, meta));
  });
});
