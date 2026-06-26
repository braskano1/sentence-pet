// DEV-only. Signs in as a fixed test account, landing as a returning player with
// progress. Imported only by DevPanel, so it is tree-shaken from production builds.
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/auth';

export const TEST_EMAIL = 'dev@test.local';
export const TEST_PASSWORD = 'devpass123';

export function createTestAccount() {
  return createUserWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
}

/**
 * View as the fixed test account.
 * - First use: create it (a fresh non-anon sign-in) and `seed()` the progress
 *   loadout; cloud-sync mirrors it up for this uid.
 * - Later: `auth/email-already-in-use` -> `signIn()`, whose cloud-wins reconcile
 *   pulls the previously-seeded progress.
 * `create` is injectable for tests.
 */
export async function viewAsTestAccount(deps: {
  signIn: (email: string, password: string) => Promise<void>;
  seed: () => void;
  create?: () => Promise<unknown>;
}): Promise<void> {
  const create = deps.create ?? createTestAccount;
  try {
    await create();
    deps.seed();
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/email-already-in-use') {
      await deps.signIn(TEST_EMAIL, TEST_PASSWORD);
    } else {
      throw e;
    }
  }
}
