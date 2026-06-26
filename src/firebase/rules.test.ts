// @vitest-environment node
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';

// Only runs under the emulator (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST).
// Skips cleanly during a plain `npm test` so the suite stays green without Java/emulator.
const run = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

let env: RulesTestEnvironment;

run('firestore security rules', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-sentence-pet',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    });
  });
  afterAll(async () => { await env.cleanup(); });
  beforeEach(async () => { await env.clearFirestore(); });

  it('admin can write and read ping', async () => {
    const fs = env.authenticatedContext('admin1', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(fs, 'ping/admin1'), { at: 1 }));
    await assertSucceeds(getDoc(doc(fs, 'ping/admin1')));
  });

  it('a non-admin cannot write ping', async () => {
    const fs = env.authenticatedContext('user1', {}).firestore();
    await assertFails(setDoc(doc(fs, 'ping/user1'), { at: 1 }));
  });

  it('anyone can read content but not write', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'content/x')));
    await assertFails(setDoc(doc(anon, 'content/x'), { a: 1 }));
  });

  it('an admin can write content', async () => {
    const fs = env.authenticatedContext('admin1', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(fs, 'content/x'), { a: 1 }));
  });

  it('owner can write own user doc; others are denied', async () => {
    const owner = env.authenticatedContext('u1', {}).firestore();
    await assertSucceeds(setDoc(doc(owner, 'users/u1/pets/p1'), { a: 1 }));
    const other = env.authenticatedContext('u2', {}).firestore();
    await assertFails(getDoc(doc(other, 'users/u1/pets/p1')));
  });

  it('default-denies an unmatched path', async () => {
    const fs = env.authenticatedContext('admin1', { admin: true }).firestore();
    await assertFails(getDoc(doc(fs, 'random/x')));
  });
});
